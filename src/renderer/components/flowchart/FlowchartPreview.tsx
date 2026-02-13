import React, { useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  Node,
  Edge,
  BackgroundVariant,
  ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/flowchart-dark-mode.css';
import { Spin, Alert, Button } from 'antd';
import { nodeTypes } from './nodeTypes';
import { PersistedNode, PersistedEdge } from '../../../shared/types';

interface FlowchartPreviewProps {
  /** 流程图节点数据 */
  nodes: PersistedNode[];
  /** 流程图边数据 */
  edges: PersistedEdge[];
  /** 预览高度（像素） */
  height?: number;
  /** 需要高亮的节点 ID（可选） */
  highlightedNodeId?: string;
}

/**
 * 将持久化的节点数据转换为 ReactFlow 格式
 * 错误处理：缺失节点类型时使用默认的 rectangle 类型
 */
const convertNodesToReactFlow = (
  nodes: PersistedNode[],
  highlightedNodeId?: string
): Node[] => {
  return nodes.map((node) => {
    const isHighlighted = highlightedNodeId && node.id === highlightedNodeId;

    // 错误处理：验证节点类型，如果无效则使用默认类型
    const validNodeTypes = ['rectangle', 'rounded-rectangle', 'diamond', 'circle', 'todo', 'text'];
    let nodeType = node.type || 'rectangle';
    
    if (!validNodeTypes.includes(nodeType)) {
      console.warn(`Invalid node type: ${nodeType}, falling back to 'rectangle'`);
      nodeType = 'rectangle';
    }
    
    // 错误处理：验证节点类型是否已注册
    if (!nodeTypes[nodeType]) {
      console.warn(`Node type '${nodeType}' not registered, falling back to 'rectangle'`);
      nodeType = 'rectangle';
    }

    return {
      id: node.id,
      type: nodeType,
      position: node.position || { x: 0, y: 0 },
      data: {
        ...node.data,
        label: node.data?.label || '未命名节点'
      },
      // 高亮样式
      style: isHighlighted
        ? {
            border: '3px solid #1890ff',
            boxShadow: '0 0 10px rgba(24, 144, 255, 0.5)',
            backgroundColor: '#e6f7ff'
          }
        : undefined,
      // 禁用拖拽和选择
      draggable: false,
      selectable: false,
      connectable: false
    };
  });
};

/**
 * 截断过长的标签文本
 * 错误处理：标签溢出时使用省略号
 */
const truncateLabel = (label: string | undefined, maxLength: number = 30): string | undefined => {
  if (!label) return label;
  
  if (label.length > maxLength) {
    return label.substring(0, maxLength) + '...';
  }
  
  return label;
};

/**
 * 将持久化的边数据转换为 ReactFlow 格式
 * 错误处理：标签溢出截断，无效样式回退到默认值，无效边类型使用默认值
 */
const convertEdgesToReactFlow = (edges: PersistedEdge[]): Edge[] => {
  return edges.map((edge) => {
    // 错误处理：验证并应用标签样式
    const labelStyle = edge.labelStyle ? {
      fontSize: typeof edge.labelStyle.fontSize === 'number' && 
                edge.labelStyle.fontSize > 0 && 
                edge.labelStyle.fontSize < 100
        ? edge.labelStyle.fontSize 
        : 12,
      fill: edge.labelStyle.color || '#000',
    } : undefined;

    const labelBgStyle = edge.labelStyle ? {
      fill: edge.labelStyle.backgroundColor || '#fff',
      fillOpacity: 0.8
    } : undefined;

    // 错误处理：截断过长的标签
    const displayLabel = truncateLabel(edge.label);

    // 错误处理：验证边类型，如果无效则使用默认类型
    const validEdgeTypes = ['default', 'smoothstep', 'step', 'straight', 'bezier'];
    let edgeType = edge.type || 'default';
    
    if (!validEdgeTypes.includes(edgeType)) {
      console.warn(`Invalid edge type: ${edgeType}, falling back to 'default'`);
      edgeType = 'default';
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edgeType,
      label: displayLabel,
      labelStyle,
      labelBgStyle,
      animated: edge.animated || false,
      style: edge.style,
      markerEnd: edge.markerEnd,
      markerStart: edge.markerStart,
      // 禁用选择
      selectable: false,
      // 保存完整标签用于悬停显示
      data: {
        fullLabel: edge.label
      }
    };
  });
};

/**
 * FlowchartPreview 内部组件（在 ReactFlowProvider 内部）
 */
const FlowchartPreviewInner: React.FC<FlowchartPreviewProps> = ({
  nodes: persistedNodes,
  edges: persistedEdges,
  height = 400,
  highlightedNodeId
}) => {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // 等待 DOM 准备就绪，带重试机制
  useEffect(() => {
    // 重置错误状态
    setInitError(null);
    
    // 延迟渲染以确保 ReactFlow 正确初始化
    const timer = setTimeout(() => {
      try {
        // 验证数据
        if (!Array.isArray(persistedNodes)) {
          throw new Error('Invalid nodes data: expected array');
        }
        if (!Array.isArray(persistedEdges)) {
          throw new Error('Invalid edges data: expected array');
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('FlowchartPreview initialization error:', error);
        setInitError(error instanceof Error ? error.message : '初始化失败');
        setIsReady(false);
      }
    }, 100 + retryCount * 200); // 增加重试延迟

    return () => clearTimeout(timer);
  }, [persistedNodes, persistedEdges, retryCount]);

  // 转换数据格式，带错误处理
  const nodes = useMemo(() => {
    try {
      return convertNodesToReactFlow(persistedNodes, highlightedNodeId);
    } catch (error) {
      console.error('Error converting nodes:', error);
      setInitError('节点数据转换失败');
      return [];
    }
  }, [persistedNodes, highlightedNodeId]);

  const edges = useMemo(() => {
    try {
      return convertEdgesToReactFlow(persistedEdges);
    } catch (error) {
      console.error('Error converting edges:', error);
      setInitError('连接线数据转换失败');
      return [];
    }
  }, [persistedEdges]);

  // 重试处理
  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      setIsReady(false);
      setInitError(null);
    } else {
      setInitError('重试次数已达上限，请刷新页面');
    }
  };

  // 显示错误状态
  if (initError) {
    return (
      <div
        style={{
          height: `${height}px`,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '20px'
        }}
      >
        <Alert
          message="预览加载失败"
          description={
            <div>
              <p>{initError}</p>
              {retryCount < MAX_RETRIES && (
                <Button type="primary" onClick={handleRetry} style={{ marginTop: '10px' }}>
                  重试 ({retryCount + 1}/{MAX_RETRIES})
                </Button>
              )}
            </div>
          }
          type="error"
          showIcon
        />
      </div>
    );
  }

  // 显示加载状态
  if (!isReady) {
    return (
      <div
        style={{
          height: `${height}px`,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          border: '1px solid #d9d9d9',
          borderRadius: '4px'
        }}
      >
        <Spin tip="初始化预览..." />
      </div>
    );
  }

  return (
    <div
      style={{
        height: `${height}px`,
        width: '100%',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: '#fafafa'
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        // 与编辑器一致，支持 source/source 句柄连线渲染
        connectionMode={ConnectionMode.Loose}
        // 禁用所有编辑功能
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        // 启用查看功能
        panOnDrag={true}
        zoomOnScroll={true}
        panOnScroll={false}
        // 自动适应视图
        fitView={true}
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
          minZoom: 0.1,
          maxZoom: 1.5
        }}
        // 缩放范围
        minZoom={0.1}
        maxZoom={2}
        // 禁用交互式控制
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#e0e0e0"
        />
        <Controls
          showInteractive={false}
          showZoom={true}
          showFitView={true}
        />
      </ReactFlow>
    </div>
  );
};

/**
 * FlowchartPreview 组件
 * 
 * 用于在待办详情视图中预览流程图的组件
 * 
 * 特性：
 * - 使用 ReactFlowProvider 包装以确保正确初始化
 * - 添加初始化延迟以确保 DOM 准备就绪
 * - 配置 ReactFlow 为只读模式
 * - 支持节点高亮显示
 * - 完整渲染所有节点、边和标签
 * 
 * 修复问题：
 * - 确保连接线正确渲染
 * - 确保所有自定义节点类型都已注册
 * - 确保边的标签和样式正确显示
 * 
 * @example
 * ```tsx
 * <FlowchartPreview
 *   nodes={flowchartData.nodes}
 *   edges={flowchartData.edges}
 *   height={300}
 *   highlightedNodeId="node-123"
 * />
 * ```
 */
export const FlowchartPreview: React.FC<FlowchartPreviewProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowchartPreviewInner {...props} />
    </ReactFlowProvider>
  );
};
