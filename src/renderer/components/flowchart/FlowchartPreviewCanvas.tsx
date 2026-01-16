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
  return nodes.map((node) => {
    const isHighlighted = highlightedNodeId && node.id === highlightedNodeId;

    return {
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
  });
};

/**
 * 将持久化的边数据转换为 ReactFlow 格式
 */
const convertEdgesToReactFlow = (edges: any[]): Edge[] => {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'default',
    label: edge.label,
    animated: edge.animated || false,
    style: edge.style,
    // 禁用选择
    selectable: false
  }));
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
    return convertNodesToReactFlow(data.nodes || [], highlightedNodeId);
  }, [data.nodes, highlightedNodeId]);

  const edges = useMemo(() => {
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
