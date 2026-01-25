import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Node,
  Edge,
  BackgroundVariant,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/flowchart-dark-mode.css';
import { FlowchartData } from '../../hooks/useFlowchartData';
import { nodeTypes } from './nodeTypes';

interface FlowchartPreviewCanvasProps {
  /** 流程图数据 */
  data: FlowchartData;
  /** 预览高度（像素） */
  height: number;
  /** 需要高亮的节点 ID（节点级别关联） */
  highlightedNodeId?: string;
  /** 只读模式（始终为 true） */
  readOnly: boolean;
}

/**
 * 将持久化的节点数据转换为 ReactFlow 格式
 */
const convertNodesToReactFlow = (
  nodes: any[],
  highlightedNodeId?: string
): Node[] => {
  console.log('[FlowchartPreviewCanvas] Converting nodes:', nodes);
  
  return nodes.map((node) => {
    const isHighlighted = highlightedNodeId && node.id === highlightedNodeId;

    const convertedNode = {
      id: node.id,
      type: node.type || 'default',
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
    
    console.log('[FlowchartPreviewCanvas] Converted node:', convertedNode);
    return convertedNode;
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
 * 获取箭头标记配置
 * React Flow 要求 markerEnd/markerStart 必须是对象，不能是字符串
 */
const getMarkerConfig = (markerType?: string) => {
  if (!markerType || markerType === 'none') {
    return undefined;
  }
  // 返回 React Flow 期望的对象格式
  return {
    type: MarkerType.ArrowClosed,
    markerUnits: 'strokeWidth',
    orient: 'auto',
    width: 12,
    height: 12
  };
};

/**
 * 将持久化的边数据转换为 ReactFlow 格式
 * 错误处理：标签溢出截断，无效样式回退到默认值
 */
const convertEdgesToReactFlow = (edges: any[]): Edge[] => {
  console.log('[FlowchartPreviewCanvas] Converting edges:', edges);

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

    // 修复：markerEnd 和 markerStart 必须是对象，不是字符串
    const markerEnd = getMarkerConfig(edge.markerEnd || 'arrowclosed');
    const markerStart = edge.markerStart ? getMarkerConfig(edge.markerStart) : undefined;

    // 修复：不覆盖已有的 style
    const edgeStyle = edge.style || {
      stroke: '#b1b1b7',
      strokeWidth: 2
    };

    const convertedEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      // 关键修复：将空字符串转换为 undefined，ReactFlow 才能正确连接
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      type: edge.type || 'smoothstep',
      label: displayLabel,
      labelStyle,
      labelBgStyle,
      animated: edge.animated || false,
      style: edgeStyle,
      markerEnd,
      markerStart,
      selectable: false,
      data: { fullLabel: edge.label }
    };

    console.log('[FlowchartPreviewCanvas] Converted edge:', convertedEdge);
    return convertedEdge;
  });
};

/**
 * FlowchartPreviewCanvas 组件
 *
 * 简化的流程图预览画布，用于在待办详情中预览流程图
 *
 * 特性：
 * - 完全禁用编辑功能（节点拖拽、连线编辑等）
 * - 完全禁用交互功能（缩放、平移等）
 * - 纯静态快照视图
 * - 自动适应视图（fitView）
 * - 支持节点高亮显示
 *
 * @example
 * ```tsx
 * <FlowchartPreviewCanvas
 *   data={flowchartData}
 *   height={300}
 *   highlightedNodeId="node-123"
 *   readOnly={true}
 * />
 * ```
 */
export const FlowchartPreviewCanvas: React.FC<FlowchartPreviewCanvasProps> = ({
  data,
  height,
  highlightedNodeId,
  readOnly
}) => {
  // 转换数据格式
  const nodes = useMemo(() => {
    console.log('[FlowchartPreviewCanvas] Raw nodes data:', data.nodes);
    return convertNodesToReactFlow(data.nodes || [], highlightedNodeId);
  }, [data.nodes, highlightedNodeId]);

  const edges = useMemo(() => {
    console.log('[FlowchartPreviewCanvas] Raw edges data:', data.edges);
    return convertEdgesToReactFlow(data.edges || []);
  }, [data.edges]);

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
        // 完全禁用交互 - 静态快照
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnPinch={false}
        // 简化的视图配置 - 自动适应
        fitView={true}
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.0
        }}
        // 隐藏品牌标识
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#e0e0e0"
        />
      </ReactFlow>
    </div>
  );
};
