import { Node, Edge } from 'reactflow';
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
 */
export function toRuntimeEdge(domainEdge: DomainEdge): Edge {
  const edge: Edge = {
    id: domainEdge.id,
    source: domainEdge.source,
    target: domainEdge.target,
    sourceHandle: domainEdge.sourceHandle,
    targetHandle: domainEdge.targetHandle,
    type: domainEdge.type || 'default',
    label: domainEdge.label,
    style: domainEdge.style
  };

  // 添加箭头标记
  if (domainEdge.markerEnd) {
    edge.markerEnd = {
      type: domainEdge.markerEnd === 'none' ? undefined : domainEdge.markerEnd
    };
  } else {
    // 默认使用箭头
    edge.markerEnd = { type: 'arrowclosed' };
  }

  if (domainEdge.markerStart && domainEdge.markerStart !== 'none') {
    edge.markerStart = {
      type: domainEdge.markerStart
    };
  }

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
