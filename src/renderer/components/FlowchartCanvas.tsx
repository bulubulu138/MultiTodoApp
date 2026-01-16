import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/flowchart-dark-mode.css';
import { message } from 'antd';
import {
  PersistedNode,
  PersistedEdge,
  FlowchartPatch,
  Todo,
  NodeType,
  RuntimeNodeData
} from '../../shared/types';
import { useDomainNodes } from '../hooks/useDomainNodes';
import { useHandleVisibility } from '../hooks/useHandleVisibility';
import { toRuntimeNodes, toRuntimeEdges } from '../utils/flowchartTransforms';
import { FlowchartPatchService } from '../services/FlowchartPatchService';
import { UndoRedoManager } from '../services/UndoRedoManager';
import { nodeTypes } from './flowchart/nodeTypes';
import { NodeEditPanel } from './flowchart/NodeEditPanel';
import { NodeContextMenu } from './flowchart/NodeContextMenu';
import { wouldCreateCycle } from '../utils/cycleDetection';
import { migrateEdges, needsEdgesMigration } from '../utils/flowchartMigration';
import { HandleVisibilityProvider } from '../contexts/HandleVisibilityContext';

interface FlowchartCanvasProps {
  flowchartId: string;
  persistedNodes: PersistedNode[];
  persistedEdges: PersistedEdge[];
  todos: Todo[];
  onPatchesApplied: (patches: FlowchartPatch[]) => void;
  onNodesEdgesChange?: (nodes: PersistedNode[], edges: PersistedEdge[]) => void;
  highlightedNodeId?: string | null;
  onHighlightComplete?: () => void;
  initialViewport?: { x: number; y: number; zoom: number }; // 新增：初始视口
}

/**
 * FlowchartCanvas 组件
 * 
 * React Flow 画布核心组件，处理节点和边的渲染与交互
 * 实现三层数据模型管理（Persisted → Domain → Runtime）
 */
export const FlowchartCanvas: React.FC<FlowchartCanvasProps> = ({
  flowchartId,
  persistedNodes: initialPersistedNodes,
  persistedEdges: initialPersistedEdges,
  todos,
  onPatchesApplied,
  onNodesEdgesChange,
  highlightedNodeId,
  onHighlightComplete,
  initialViewport // 新增：接收初始视口
}) => {
  // 获取当前主题
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  
  // 监听主题变化
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme || 'light';
      setTheme(newTheme);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  // 1. 持久化层数据
  const [persistedNodes, setPersistedNodes] = useState<PersistedNode[]>(initialPersistedNodes);
  const [persistedEdges, setPersistedEdges] = useState<PersistedEdge[]>(initialPersistedEdges);

  // 1.1 监听 props 变化，更新持久化层数据（修复：切换流程图时数据不更新的问题）
  useEffect(() => {
    console.log('[FlowchartCanvas] Props changed, updating persisted data');
    console.log('[FlowchartCanvas] New nodes count:', initialPersistedNodes.length);
    console.log('[FlowchartCanvas] New edges count:', initialPersistedEdges.length);
    
    // 应用数据迁移
    let migratedEdges = initialPersistedEdges;
    if (needsEdgesMigration(initialPersistedEdges)) {
      console.log('[FlowchartCanvas] Applying edge migration...');
      migratedEdges = migrateEdges(initialPersistedEdges);
    }
    
    setPersistedNodes(initialPersistedNodes);
    setPersistedEdges(migratedEdges);
  }, [initialPersistedNodes, initialPersistedEdges]);

  // 2. 通过 selector 计算业务领域层数据
  const domainNodes = useDomainNodes(persistedNodes, todos);
  const domainEdges = useMemo(() => persistedEdges, [persistedEdges]);

  // 3. 转换为 React Flow 运行时格式
  const [runtimeNodes, setRuntimeNodes, onNodesChange] = useNodesState(
    toRuntimeNodes(domainNodes)
  );
  const [runtimeEdges, setRuntimeEdges, onEdgesChange] = useEdgesState(
    toRuntimeEdges(domainEdges)
  );

  // 4. Undo/Redo 管理
  const undoRedoManager = useRef(new UndoRedoManager());

  // 5. React Flow 实例
  const reactFlowInstance = useReactFlow();

  // 6. 拖拽状态
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null);

  // 7. 节点编辑状态
  const [editingNode, setEditingNode] = useState<{ id: string; data: RuntimeNodeData } | null>(null);
  const [inlineEditingNodeId, setInlineEditingNodeId] = useState<string | null>(null);

  // 8. 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: null
  });

  // 9. Handle 可见性控制
  const handleVisibility = useHandleVisibility();

  // 10. 流程图与待办关联状态
  const [associatedTodoIds, setAssociatedTodoIds] = useState<number[]>([]);

  // 10.1 加载当前流程图的关联待办列表
  useEffect(() => {
    const loadAssociations = async () => {
      try {
        const ids = await window.electronAPI.flowchartTodoAssociation.queryByFlowchart(flowchartId);
        setAssociatedTodoIds(ids);
      } catch (error) {
        console.error('加载流程图关联失败:', error);
      }
    };

    loadAssociations();
  }, [flowchartId]);

  // 5. 当持久化数据变化时，更新运行时数据
  // 关键修复：完全保留节点位置，只更新数据内容
  useEffect(() => {
    setRuntimeNodes((currentNodes) => {
      const newNodes = toRuntimeNodes(domainNodes);
      
      // 创建当前节点的 Map 以便快速查找
      const currentNodesMap = new Map(currentNodes.map(n => [n.id, n]));
      
      // 更新策略：
      // 1. 对于已存在的节点：完全保留其位置、选中状态、拖动状态
      // 2. 对于新节点：使用持久化层的位置
      const updatedNodes = newNodes.map(newNode => {
        const currentNode = currentNodesMap.get(newNode.id);
        
        if (currentNode) {
          // 节点已存在，保留所有运行时状态，只更新 data
          return {
            ...newNode,
            position: currentNode.position, // 保留当前位置
            selected: currentNode.selected, // 保留选中状态
            dragging: currentNode.dragging, // 保留拖动状态
            data: newNode.data // 更新数据（label、resolvedTodo 等）
          };
        }
        
        // 新节点，直接使用
        return newNode;
      });
      
      return updatedNodes;
    });
  }, [domainNodes, setRuntimeNodes]);

  useEffect(() => {
    setRuntimeEdges(toRuntimeEdges(domainEdges));
  }, [domainEdges, setRuntimeEdges]);

  // 5.1 监听 Todo 数据变化（实时同步）
  // 当 todos prop 变化时，domainNodes 会自动重新计算（通过 useDomainNodes）
  // 这样就实现了任务数据的实时同步

  // 5.2 高亮节点功能
  useEffect(() => {
    if (highlightedNodeId && reactFlowInstance) {
      // 查找需要高亮的节点
      const node = runtimeNodes.find(n => n.id === highlightedNodeId);
      if (!node) {
        console.warn(`Node ${highlightedNodeId} not found for highlighting`);
        return;
      }

      // 调整视口居中到节点
      const nodeWidth = 150; // 默认节点宽度
      const nodeHeight = 50; // 默认节点高度
      
      reactFlowInstance.setCenter(
        node.position.x + nodeWidth / 2,
        node.position.y + nodeHeight / 2,
        { zoom: 1.2, duration: 800 }
      );

      // 添加高亮效果（临时修改节点数据）
      setRuntimeNodes((nds) =>
        nds.map((n) => {
          if (n.id === highlightedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                isHighlighted: true
              }
            };
          }
          return n;
        })
      );

      // 3秒后移除高亮
      const timer = setTimeout(() => {
        setRuntimeNodes((nds) =>
          nds.map((n) => {
            if (n.id === highlightedNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  isHighlighted: false
                }
              };
            }
            return n;
          })
        );
        onHighlightComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightedNodeId, runtimeNodes, reactFlowInstance, onHighlightComplete, setRuntimeNodes]);

  // 6. 应用 Patches
  const applyPatches = useCallback((patches: FlowchartPatch[]) => {
    if (patches.length === 0) return;

    // 应用到持久化层
    const result = FlowchartPatchService.applyPatches(
      null,
      persistedNodes,
      persistedEdges,
      patches
    );

    setPersistedNodes(result.nodes);
    setPersistedEdges(result.edges);

    // 通知父组件数据已更新
    if (onNodesEdgesChange) {
      onNodesEdgesChange(result.nodes, result.edges);
    }

    // 记录到 Undo 历史
    patches.forEach(p => undoRedoManager.current.execute(p));

    // 通知父组件保存
    onPatchesApplied(patches);
  }, [persistedNodes, persistedEdges, onPatchesApplied, onNodesEdgesChange]);

  // 7. 处理节点双击编辑 - 启用内联编辑
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // 双击启用内联编辑模式
    setInlineEditingNodeId(node.id);
  }, []);

  // 7.01 处理节点鼠标进入
  const handleNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
    handleVisibility.setHoveredNode(node.id);
  }, [handleVisibility]);

  // 7.02 处理节点鼠标离开
  const handleNodeMouseLeave = useCallback(() => {
    handleVisibility.setHoveredNode(null);
  }, [handleVisibility]);

  // 7.0 处理内联编辑保存
  const handleInlineEditSave = useCallback((nodeId: string, newLabel: string) => {
    const node = persistedNodes.find(n => n.id === nodeId);
    if (!node) return;

    const patch: FlowchartPatch = {
      type: 'updateNode',
      id: nodeId,
      changes: {
        data: {
          ...node.data,
          label: newLabel
        }
      }
    };

    applyPatches([patch]);
    setInlineEditingNodeId(null);
  }, [persistedNodes, applyPatches]);

  // 7.1 处理节点右键菜单
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id
    });
  }, []);

  // 7.2 打开详细编辑抽屉
  const handleOpenDetailEdit = useCallback(() => {
    if (!contextMenu.nodeId) return;
    const node = runtimeNodes.find(n => n.id === contextMenu.nodeId);
    if (node) {
      setEditingNode({
        id: node.id,
        data: node.data as RuntimeNodeData
      });
    }
  }, [contextMenu.nodeId, runtimeNodes]);

  // 7.3 切换节点锁定状态
  const handleToggleLock = useCallback(() => {
    if (!contextMenu.nodeId) return;
    const node = persistedNodes.find(n => n.id === contextMenu.nodeId);
    if (!node) return;

    const patch: FlowchartPatch = {
      type: 'updateNode',
      id: contextMenu.nodeId,
      changes: {
        data: {
          ...node.data,
          isLocked: !node.data.isLocked
        }
      }
    };

    applyPatches([patch]);
  }, [contextMenu.nodeId, persistedNodes, applyPatches]);

  // 7.4 复制节点
  const handleCopyNode = useCallback(() => {
    if (!contextMenu.nodeId) return;
    const node = persistedNodes.find(n => n.id === contextMenu.nodeId);
    if (!node) return;

    const newNode: PersistedNode = {
      ...node,
      id: `node-${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      }
    };

    const patch: FlowchartPatch = {
      type: 'addNode',
      node: newNode
    };

    applyPatches([patch]);
  }, [contextMenu.nodeId, persistedNodes, applyPatches]);

  // 7.5 删除节点（从右键菜单）
  const handleDeleteNode = useCallback(() => {
    if (!contextMenu.nodeId) return;

    const patch: FlowchartPatch = {
      type: 'removeNode',
      id: contextMenu.nodeId
    };

    applyPatches([patch]);
  }, [contextMenu.nodeId, applyPatches]);

  // 8. 处理节点编辑保存
  const handleNodeEditSave = useCallback((updates: Partial<RuntimeNodeData>) => {
    if (!editingNode) return;

    const patch: FlowchartPatch = {
      type: 'updateNode',
      id: editingNode.id,
      changes: {
        data: {
          ...editingNode.data,
          ...updates
        }
      }
    };

    applyPatches([patch]);
    setEditingNode(null);
  }, [editingNode, applyPatches]);

  // 9. 初始化标志 - 用于控制 fitView
  const isInitializedRef = useRef(false);

  // 9.1 初始化时执行 fitView 或恢复 viewport
  useEffect(() => {
    if (!isInitializedRef.current && runtimeNodes.length > 0) {
      // 延迟执行，确保节点已渲染
      setTimeout(() => {
        if (initialViewport) {
          // 如果有初始 viewport，恢复它
          console.log('[FlowchartCanvas] Restoring viewport:', initialViewport);
          reactFlowInstance.setViewport(initialViewport, { duration: 200 });
        } else {
          // 否则执行 fitView
          console.log('[FlowchartCanvas] No initial viewport, using fitView');
          reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
        }
        isInitializedRef.current = true;
      }, 100);
    }
  }, [runtimeNodes.length, reactFlowInstance, initialViewport]);

  // 9.2 处理拖拽放置
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow') as NodeType;
    if (!type) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const newNode: PersistedNode = {
      id: `node-${Date.now()}`,
      type,
      position,
      data: {
        label: '新节点',
        style: {
          backgroundColor: '#fff',
          borderColor: '#d9d9d9',
          borderWidth: 2
        }
      }
    };

    const patch: FlowchartPatch = {
      type: 'addNode',
      node: newNode
    };

    applyPatches([patch]);
  }, [reactFlowInstance, applyPatches]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // 10. 处理节点变化 -> 生成 Patch
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // 先应用到 React Flow（保持拖动流畅性）
    onNodesChange(changes);

    // 然后生成 Patch 用于持久化
    const patches: FlowchartPatch[] = [];

    changes.forEach(change => {
      if (change.type === 'position' && 'position' in change && change.position && change.dragging === false) {
        // 只在拖动结束时才持久化位置（dragging === false）
        // 检查节点是否被锁定
        const node = persistedNodes.find(n => n.id === change.id);
        if (node?.data.isLocked) {
          // 节点被锁定，忽略位置变化
          return;
        }

        // 节点位置变化
        patches.push({
          type: 'updateNode',
          id: change.id,
          changes: { position: change.position }
        });
      } else if (change.type === 'remove') {
        // 节点删除
        patches.push({
          type: 'removeNode',
          id: change.id
        });
      }
      // 其他变化类型（select, dimensions 等）不需要持久化
    });

    if (patches.length > 0) {
      applyPatches(patches);
    }
  }, [onNodesChange, applyPatches, persistedNodes]);

  // 11. 处理边变化 -> 生成 Patch
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const patches: FlowchartPatch[] = [];

    changes.forEach(change => {
      if (change.type === 'remove') {
        // 边删除
        patches.push({
          type: 'removeEdge',
          id: change.id
        });
      }
      // 其他变化类型不需要持久化
    });

    if (patches.length > 0) {
      applyPatches(patches);
    }

    // 应用到 React Flow
    onEdgesChange(changes);
  }, [onEdgesChange, applyPatches]);

  // 12. 处理连接创建
  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // 检测循环依赖
    if (wouldCreateCycle(persistedEdges, connection.source, connection.target)) {
      message.warning('无法创建连接：这会导致循环依赖');
      return;
    }

    // 生成新边的 ID
    const edgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;

    const newEdge: PersistedEdge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      type: 'default', // 默认线型
      markerEnd: 'arrowclosed', // 默认使用闭合箭头
      animated: false // 默认不动画
    };

    // 创建 Patch
    const patch: FlowchartPatch = {
      type: 'addEdge',
      edge: newEdge
    };

    applyPatches([patch]);

    // 应用到 React Flow
    setRuntimeEdges((eds) => addEdge(connection, eds));
    
    // 连接完成，重置 Handle 可见性
    handleVisibility.setConnecting(null);
  }, [applyPatches, setRuntimeEdges, persistedEdges, handleVisibility]);

  // 12.1 处理连接开始
  const handleConnectStart = useCallback((_event: any, params: { nodeId: string | null; handleId: string | null }) => {
    if (params.nodeId) {
      handleVisibility.setConnecting(params.nodeId);
    }
  }, [handleVisibility]);

  // 12.2 处理连接结束
  const handleConnectEnd = useCallback(() => {
    handleVisibility.setConnecting(null);
  }, [handleVisibility]);

  // 13. 撤销功能
  const handleUndo = useCallback(() => {
    const patch = undoRedoManager.current.undo();
    if (!patch) return;

    // 优先从 patch.metadata 中提取原始数据
    let originalNode: PersistedNode | undefined;
    let originalEdge: PersistedEdge | undefined;

    if (patch.metadata) {
      // 使用 metadata 中的原始数据
      originalNode = patch.metadata.originalNode || patch.metadata.originalNodeState;
      originalEdge = patch.metadata.originalEdge || patch.metadata.originalEdgeState;
    } else {
      // 回退：从当前状态查找（用于兼容旧的 patch）
      if (patch.type === 'addNode' || patch.type === 'updateNode' || patch.type === 'removeNode') {
        const nodeId = patch.type === 'addNode' ? patch.node.id : patch.id;
        originalNode = persistedNodes.find(n => n.id === nodeId);
      } else if (patch.type === 'addEdge' || patch.type === 'updateEdge' || patch.type === 'removeEdge') {
        const edgeId = patch.type === 'addEdge' ? patch.edge.id : patch.id;
        originalEdge = persistedEdges.find(e => e.id === edgeId);
      }
    }

    // 应用反向 Patch
    const invertedPatch = FlowchartPatchService.invertPatch(
      patch,
      originalNode,
      originalEdge
    );

    if (invertedPatch) {
      const result = FlowchartPatchService.applyPatch(
        null,
        persistedNodes,
        persistedEdges,
        invertedPatch
      );

      setPersistedNodes(result.nodes);
      setPersistedEdges(result.edges);
      
      // 通知父组件数据已更新
      if (onNodesEdgesChange) {
        onNodesEdgesChange(result.nodes, result.edges);
      }
      
      onPatchesApplied([invertedPatch]);
    } else {
      // 如果无法生成反向 patch，显示错误消息
      message.error('无法撤销此操作 - 数据不足');
    }
  }, [persistedNodes, persistedEdges, onPatchesApplied, onNodesEdgesChange]);

  // 14. 重做功能
  const handleRedo = useCallback(() => {
    const patch = undoRedoManager.current.redo();
    if (!patch) return;

    const result = FlowchartPatchService.applyPatch(
      null,
      persistedNodes,
      persistedEdges,
      patch
    );

    setPersistedNodes(result.nodes);
    setPersistedEdges(result.edges);
    
    // 通知父组件数据已更新
    if (onNodesEdgesChange) {
      onNodesEdgesChange(result.nodes, result.edges);
    }
    
    onPatchesApplied([patch]);
  }, [persistedNodes, persistedEdges, onPatchesApplied, onNodesEdgesChange]);

  // 15. 处理删除选中元素
  const handleDelete = useCallback(() => {
    const selectedNodes = runtimeNodes.filter(n => n.selected);
    const selectedEdges = runtimeEdges.filter(e => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const patches: FlowchartPatch[] = [];

    // 删除选中的节点
    selectedNodes.forEach(node => {
      // 查找原始节点数据（从持久化层）
      const originalNode = persistedNodes.find(n => n.id === node.id);
      
      // 查找所有连接到该节点的边
      const connectedEdges = persistedEdges.filter(
        edge => edge.source === node.id || edge.target === node.id
      );

      // 创建带有元数据的 removeNode patch
      patches.push({
        type: 'removeNode',
        id: node.id,
        metadata: {
          originalNode,
          originalEdges: connectedEdges
        }
      });
    });

    // 删除选中的边
    selectedEdges.forEach(edge => {
      // 查找原始边数据（从持久化层）
      const originalEdge = persistedEdges.find(e => e.id === edge.id);

      // 创建带有元数据的 removeEdge patch
      patches.push({
        type: 'removeEdge',
        id: edge.id,
        metadata: {
          originalEdge
        }
      });
    });

    applyPatches(patches);
  }, [runtimeNodes, runtimeEdges, persistedNodes, persistedEdges, applyPatches]);

  // 16. 处理全选
  const handleSelectAll = useCallback(() => {
    setRuntimeNodes(nodes => nodes.map(node => ({ ...node, selected: true })));
    setRuntimeEdges(edges => edges.map(edge => ({ ...edge, selected: true })));
  }, [setRuntimeNodes, setRuntimeEdges]);

  // 17. 键盘快捷键 - 改进：检查编辑状态
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否在输入框中
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;

      // 如果在输入框中，不处理全局快捷键（除了 Escape）
      if (isInputField && event.key !== 'Escape') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd+Z: 撤销
      if (ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } 
      // Ctrl/Cmd+Y 或 Ctrl/Cmd+Shift+Z: 重做
      else if (ctrlKey && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        handleRedo();
      }
      // Delete 或 Backspace: 删除选中元素（仅在非输入状态）
      else if ((event.key === 'Delete' || event.key === 'Backspace') && !isInputField) {
        event.preventDefault();
        handleDelete();
      }
      // Ctrl/Cmd+A: 全选
      else if (ctrlKey && event.key === 'a' && !isInputField) {
        event.preventDefault();
        handleSelectAll();
      }
      // Escape: 关闭上下文菜单和编辑面板
      else if (event.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
        setEditingNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleDelete, handleSelectAll]);

  // 18. 监听节点标签变化事件
  useEffect(() => {
    const handleNodeLabelChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string; newLabel: string }>;
      const { nodeId, newLabel } = customEvent.detail;

      const node = persistedNodes.find(n => n.id === nodeId);
      if (!node) return;

      const patch: FlowchartPatch = {
        type: 'updateNode',
        id: nodeId,
        changes: {
          data: {
            ...node.data,
            label: newLabel
          }
        }
      };

      applyPatches([patch]);
    };

    window.addEventListener('node-label-change', handleNodeLabelChange);
    return () => window.removeEventListener('node-label-change', handleNodeLabelChange);
  }, [persistedNodes, applyPatches]);

  // 19. 处理 viewport 变化（用于持久化）
  const handleMoveEnd = useCallback((_event: any, viewport: { x: number; y: number; zoom: number }) => {
    console.log('[FlowchartCanvas] Viewport changed:', viewport);
    
    // 生成 viewport patch
    const patch: FlowchartPatch = {
      type: 'updateViewport',
      viewport
    };

    // 应用 patch（会触发保存）
    applyPatches([patch]);
  }, [applyPatches]);

  // 20. 处理待办关联
  const handleAssociate = useCallback(async (todoId: number) => {
    try {
      const result = await window.electronAPI.flowchartTodoAssociation.create(flowchartId, todoId);
      if (result.success) {
        // 更新本地状态
        setAssociatedTodoIds(prev => [...prev, todoId]);
      } else {
        throw new Error('关联失败');
      }
    } catch (error) {
      console.error('创建关联失败:', error);
      throw error;
    }
  }, [flowchartId]);

  // 21. 处理取消待办关联
  const handleDisassociate = useCallback(async (todoId: number) => {
    try {
      const result = await window.electronAPI.flowchartTodoAssociation.delete(flowchartId, todoId);
      if (result.success) {
        // 更新本地状态
        setAssociatedTodoIds(prev => prev.filter(id => id !== todoId));
      } else {
        throw new Error('取消关联失败');
      }
    } catch (error) {
      console.error('取消关联失败:', error);
      throw error;
    }
  }, [flowchartId]);

  return (
    <HandleVisibilityProvider value={{
      getHandleStyle: handleVisibility.getHandleStyle,
      setHoveredNode: handleVisibility.setHoveredNode,
      setConnecting: handleVisibility.setConnecting
    }}>
      <div 
        data-theme={theme}
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >


      {/* 自定义箭头标记定义 */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* 开放箭头 */}
          <marker
            id="arrow"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M2,2 L10,6 L2,10"
              fill="none"
              stroke={theme === 'dark' ? '#595959' : '#b1b1b7'}
              strokeWidth="1.5"
            />
          </marker>
          
          {/* 闭合箭头 */}
          <marker
            id="arrowclosed"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M2,2 L10,6 L2,10 Z"
              fill={theme === 'dark' ? '#595959' : '#b1b1b7'}
              stroke={theme === 'dark' ? '#595959' : '#b1b1b7'}
              strokeWidth="1"
            />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={runtimeNodes}
        edges={runtimeEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeContextMenu={handleNodeContextMenu}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        attributionPosition="bottom-left"
        // 性能优化选项
        onlyRenderVisibleElements={true}
        fitView
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      <NodeContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        nodeId={contextMenu.nodeId}
        isLocked={
          contextMenu.nodeId
            ? persistedNodes.find(n => n.id === contextMenu.nodeId)?.data.isLocked || false
            : false
        }
        onOpenDetailEdit={handleOpenDetailEdit}
        onToggleLock={handleToggleLock}
        onCopy={handleCopyNode}
        onDelete={handleDeleteNode}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0, nodeId: null })}
      />

      <NodeEditPanel
        visible={!!editingNode}
        nodeData={editingNode?.data || null}
        todos={todos}
        onClose={() => setEditingNode(null)}
        onSave={handleNodeEditSave}
      />
    </div>
    </HandleVisibilityProvider>
  );
};
