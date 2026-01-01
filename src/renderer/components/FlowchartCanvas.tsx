import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
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
import { toRuntimeNodes, toRuntimeEdges } from '../utils/flowchartTransforms';
import { FlowchartPatchService } from '../services/FlowchartPatchService';
import { UndoRedoManager } from '../services/UndoRedoManager';
import { nodeTypes } from './flowchart/nodeTypes';
import { NodeEditPanel } from './flowchart/NodeEditPanel';
import { NodeContextMenu } from './flowchart/NodeContextMenu';
import { wouldCreateCycle } from '../utils/cycleDetection';

interface FlowchartCanvasProps {
  flowchartId: string;
  persistedNodes: PersistedNode[];
  persistedEdges: PersistedEdge[];
  todos: Todo[];
  onPatchesApplied: (patches: FlowchartPatch[]) => void;
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
  onPatchesApplied
}) => {
  // 1. 持久化层数据
  const [persistedNodes, setPersistedNodes] = useState<PersistedNode[]>(initialPersistedNodes);
  const [persistedEdges, setPersistedEdges] = useState<PersistedEdge[]>(initialPersistedEdges);

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

  // 5. 当持久化数据变化时，更新运行时数据
  // 使用 setNodes 的函数式更新，保留拖动状态
  useEffect(() => {
    setRuntimeNodes((currentNodes) => {
      const newNodes = toRuntimeNodes(domainNodes);
      
      // 如果有节点正在拖动，保留其位置和拖动状态
      const updatedNodes = newNodes.map(newNode => {
        const currentNode = currentNodes.find(n => n.id === newNode.id);
        if (currentNode && (currentNode.dragging || currentNode.selected)) {
          // 保留拖动中的节点位置和状态
          return {
            ...newNode,
            position: currentNode.position,
            dragging: currentNode.dragging,
            selected: currentNode.selected
          };
        }
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

    // 记录到 Undo 历史
    patches.forEach(p => undoRedoManager.current.execute(p));

    // 通知父组件保存
    onPatchesApplied(patches);
  }, [persistedNodes, persistedEdges, onPatchesApplied]);

  // 7. 处理节点双击编辑 - 启用内联编辑
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // 双击启用内联编辑模式
    setInlineEditingNodeId(node.id);
  }, []);

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

  // 9. 处理拖拽放置
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
      type: 'default',
      markerEnd: 'arrowclosed' // 默认使用闭合箭头
    };

    // 创建 Patch
    const patch: FlowchartPatch = {
      type: 'addEdge',
      edge: newEdge
    };

    applyPatches([patch]);

    // 应用到 React Flow
    setRuntimeEdges((eds) => addEdge(connection, eds));
  }, [applyPatches, setRuntimeEdges, persistedEdges]);

  // 13. 撤销功能
  const handleUndo = useCallback(() => {
    const patch = undoRedoManager.current.undo();
    if (!patch) return;

    // 根据 patch 类型提取 ID
    let nodeId: string | undefined;
    let edgeId: string | undefined;

    if (patch.type === 'addNode' || patch.type === 'updateNode' || patch.type === 'removeNode') {
      nodeId = patch.type === 'addNode' ? patch.node.id : patch.id;
    } else if (patch.type === 'addEdge' || patch.type === 'updateEdge' || patch.type === 'removeEdge') {
      edgeId = patch.type === 'addEdge' ? patch.edge.id : patch.id;
    }

    // 应用反向 Patch
    const invertedPatch = FlowchartPatchService.invertPatch(
      patch,
      nodeId ? persistedNodes.find(n => n.id === nodeId) : undefined,
      edgeId ? persistedEdges.find(e => e.id === edgeId) : undefined
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
      onPatchesApplied([invertedPatch]);
    }
  }, [persistedNodes, persistedEdges, onPatchesApplied]);

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
    onPatchesApplied([patch]);
  }, [persistedNodes, persistedEdges, onPatchesApplied]);

  // 15. 处理删除选中元素
  const handleDelete = useCallback(() => {
    const selectedNodes = runtimeNodes.filter(n => n.selected);
    const selectedEdges = runtimeEdges.filter(e => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const patches: FlowchartPatch[] = [];

    // 删除选中的节点
    selectedNodes.forEach(node => {
      patches.push({
        type: 'removeNode',
        id: node.id
      });
    });

    // 删除选中的边
    selectedEdges.forEach(edge => {
      patches.push({
        type: 'removeEdge',
        id: edge.id
      });
    });

    applyPatches(patches);
  }, [runtimeNodes, runtimeEdges, applyPatches]);

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

  return (
    <div 
      style={{ width: '100%', height: '100%' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={runtimeNodes}
        edges={runtimeEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
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
  );
};
