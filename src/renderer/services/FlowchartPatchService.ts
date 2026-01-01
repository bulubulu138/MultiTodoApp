import {
  FlowchartPatch,
  FlowchartSchema,
  PersistedNode,
  PersistedEdge
} from '../../shared/types';

/**
 * FlowchartPatchService
 * 
 * 负责应用增量 Patch 到流程图数据，支持 Undo/Redo 功能
 */
export class FlowchartPatchService {
  /**
   * 应用单个 Patch 到持久化层数据
   */
  static applyPatch(
    schema: FlowchartSchema | null,
    nodes: PersistedNode[],
    edges: PersistedEdge[],
    patch: FlowchartPatch
  ): { schema: FlowchartSchema | null; nodes: PersistedNode[]; edges: PersistedEdge[] } {
    switch (patch.type) {
      case 'addNode':
        return {
          schema,
          nodes: [...nodes, patch.node],
          edges
        };

      case 'updateNode': {
        const updatedNodes = nodes.map(node =>
          node.id === patch.id
            ? { ...node, ...patch.changes }
            : node
        );
        return { schema, nodes: updatedNodes, edges };
      }

      case 'removeNode': {
        // 删除节点时，同时删除相关的边
        const filteredNodes = nodes.filter(node => node.id !== patch.id);
        const filteredEdges = edges.filter(
          edge => edge.source !== patch.id && edge.target !== patch.id
        );
        return { schema, nodes: filteredNodes, edges: filteredEdges };
      }

      case 'addEdge':
        return {
          schema,
          nodes,
          edges: [...edges, patch.edge]
        };

      case 'updateEdge': {
        const updatedEdges = edges.map(edge =>
          edge.id === patch.id
            ? { ...edge, ...patch.changes }
            : edge
        );
        return { schema, nodes, edges: updatedEdges };
      }

      case 'removeEdge': {
        const filteredEdges = edges.filter(edge => edge.id !== patch.id);
        return { schema, nodes, edges: filteredEdges };
      }

      case 'updateViewport': {
        if (!schema) return { schema, nodes, edges };
        return {
          schema: { ...schema, viewport: patch.viewport },
          nodes,
          edges
        };
      }

      case 'updateMetadata': {
        if (!schema) return { schema, nodes, edges };
        return {
          schema: { ...schema, ...patch.changes },
          nodes,
          edges
        };
      }

      default:
        return { schema, nodes, edges };
    }
  }

  /**
   * 批量应用多个 Patches
   */
  static applyPatches(
    schema: FlowchartSchema | null,
    nodes: PersistedNode[],
    edges: PersistedEdge[],
    patches: FlowchartPatch[]
  ): { schema: FlowchartSchema | null; nodes: PersistedNode[]; edges: PersistedEdge[] } {
    return patches.reduce(
      (acc, patch) => this.applyPatch(acc.schema, acc.nodes, acc.edges, patch),
      { schema, nodes, edges }
    );
  }

  /**
   * 生成反向 Patch（用于 Undo）
   * 注意：这需要保存原始数据才能生成准确的反向 Patch
   */
  static invertPatch(
    patch: FlowchartPatch,
    originalNode?: PersistedNode,
    originalEdge?: PersistedEdge,
    originalViewport?: any,
    originalMetadata?: Partial<FlowchartSchema>
  ): FlowchartPatch | null {
    switch (patch.type) {
      case 'addNode':
        // 添加节点的反向操作是删除节点
        return { type: 'removeNode', id: patch.node.id };

      case 'removeNode':
        // 删除节点的反向操作是添加节点（需要原始节点数据）
        if (!originalNode) {
          console.warn('Cannot invert removeNode without original node data');
          return null;
        }
        return { type: 'addNode', node: originalNode };

      case 'updateNode':
        // 更新节点的反向操作是恢复原始数据
        if (!originalNode) {
          console.warn('Cannot invert updateNode without original node data');
          return null;
        }
        // 只恢复被修改的字段
        const nodeChanges: Partial<PersistedNode> = {};
        if (patch.changes.position) nodeChanges.position = originalNode.position;
        if (patch.changes.data) nodeChanges.data = originalNode.data;
        if (patch.changes.type) nodeChanges.type = originalNode.type;
        return { type: 'updateNode', id: patch.id, changes: nodeChanges };

      case 'addEdge':
        // 添加边的反向操作是删除边
        return { type: 'removeEdge', id: patch.edge.id };

      case 'removeEdge':
        // 删除边的反向操作是添加边（需要原始边数据）
        if (!originalEdge) {
          console.warn('Cannot invert removeEdge without original edge data');
          return null;
        }
        return { type: 'addEdge', edge: originalEdge };

      case 'updateEdge':
        // 更新边的反向操作是恢复原始数据
        if (!originalEdge) {
          console.warn('Cannot invert updateEdge without original edge data');
          return null;
        }
        const edgeChanges: Partial<PersistedEdge> = {};
        if (patch.changes.label !== undefined) edgeChanges.label = originalEdge.label;
        if (patch.changes.style) edgeChanges.style = originalEdge.style;
        if (patch.changes.type) edgeChanges.type = originalEdge.type;
        return { type: 'updateEdge', id: patch.id, changes: edgeChanges };

      case 'updateViewport':
        // 更新视口的反向操作是恢复原始视口
        if (!originalViewport) {
          console.warn('Cannot invert updateViewport without original viewport data');
          return null;
        }
        return { type: 'updateViewport', viewport: originalViewport };

      case 'updateMetadata':
        // 更新元数据的反向操作是恢复原始元数据
        if (!originalMetadata) {
          console.warn('Cannot invert updateMetadata without original metadata');
          return null;
        }
        return { type: 'updateMetadata', changes: originalMetadata };

      default:
        return null;
    }
  }
}
