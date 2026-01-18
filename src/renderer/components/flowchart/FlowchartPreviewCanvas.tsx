import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  BackgroundVariant
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

    const convertedEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type || 'smoothstep',
      label: displayLabel,
      labelStyle,
      labelBgStyle,
      animated: edge.animated || false,
      style: edge.style || { stroke: '#b1b1b7', strokeWidth: 2 },
      markerEnd: edge.markerEnd || { type: 'arrowclosed', color: '#b1b1b7' },
      markerStart: edge.markerStart,
      // 禁用选择
      selectable: false,
      // 保存完整标签用于悬停显示
      data: {
        fullLabel: edge.label
      }
    };
    
    console.log('[FlowchartPreviewCanvas] Converted edge:', convertedEdge);
    return convertedEdge;
  });
};

/**
 * FlowchartPreviewCanvas 组件
 * 
 * 只读模式的流程图画布，用于在待办详情中预览流程图
 * 
 * 特性：
 * - 完全禁用编辑功能（节点拖拽、连线编辑等）
 * - 支持缩放和平移查看
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

  // 初始视口（如果数据中有保存）
  const defaultViewport = useMemo(() => {
    if (data.viewport) {
      return {
        x: data.viewport.x,
        y: data.viewport.y,
        zoom: data.viewport.zoom
      };
    }
    return undefined;
  }, [data.viewport]);

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
        // 默认视口
        defaultViewport={defaultViewport}
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
