import { Node, Edge, MarkerType } from 'reactflow';
import { DomainNode, DomainEdge, RuntimeNode, RuntimeEdge } from '../../shared/types';

/**
 * 将业务领域层节点转换为 React Flow 运行时节点
 */
export function toRuntimeNode(domainNode: DomainNode): Node {
  return {
    id: domainNode.id,
    type: domainNode.type,
    position: domainNode.position,
    data: {
      ...domainNode.data,
      isHovered: false,
      isDragging: false
    },
    draggable: !domainNode.data.isLocked
  };
}

/**
 * 将业务领域层边转换为 React Flow 运行时边
 * 支持自定义箭头类型和方向
 */
export function toRuntimeEdge(domainEdge: DomainEdge): Edge {
  // 获取箭头标记配置
  const getMarkerConfig = (markerType?: string) => {
    if (!markerType || markerType === 'none') {
      return undefined;
    }
    
    // 使用自定义的 SVG 标记
    return {
      type: MarkerType.Arrow,
      markerUnits: 'strokeWidth',
      orient: 'auto',
      width: 12,
      height: 12
    };
  };

  const edge: Edge = {
    id: domainEdge.id,
    source: domainEdge.source,
    target: domainEdge.target,
    sourceHandle: domainEdge.sourceHandle,
    targetHandle: domainEdge.targetHandle,
    type: domainEdge.type || 'default',
    label: domainEdge.label,
    style: domainEdge.style,
    animated: (domainEdge as any).animated || false,
    // 支持自定义箭头类型
    markerEnd: getMarkerConfig((domainEdge as any).markerEnd || 'arrowclosed'),
    markerStart: getMarkerConfig((domainEdge as any).markerStart)
  };

  return edge;
}

/**
 * 批量转换节点
 */
export function toRuntimeNodes(domainNodes: DomainNode[]): Node[] {
  return domainNodes.map(toRuntimeNode);
}

/**
 * 批量转换边
 */
export function toRuntimeEdges(domainEdges: DomainEdge[]): Edge[] {
  return domainEdges.map(toRuntimeEdge);
}
