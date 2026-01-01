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
  return {
    id: domainEdge.id,
    source: domainEdge.source,
    target: domainEdge.target,
    sourceHandle: domainEdge.sourceHandle,
    targetHandle: domainEdge.targetHandle,
    type: domainEdge.type || 'default',
    label: domainEdge.label,
    style: domainEdge.style
  };
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
