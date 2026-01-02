import { PersistedEdge } from '../../shared/types';

/**
 * 流程图数据迁移工具
 * 
 * 用于将旧版本的流程图数据迁移到新版本
 * 确保向后兼容性
 */

/**
 * 迁移边数据
 * 为现有边添加默认的箭头类型和线型
 */
export function migrateEdgeData(edge: PersistedEdge): PersistedEdge {
  const migratedEdge: PersistedEdge = {
    ...edge,
    // 如果没有 markerEnd，添加默认值
    markerEnd: edge.markerEnd || 'arrowclosed',
    // 如果没有 type，添加默认值
    type: edge.type || 'default',
    // 如果没有 animated，添加默认值
    animated: edge.animated || false
  };

  console.log('[Migration] Migrated edge:', {
    id: edge.id,
    before: { markerEnd: edge.markerEnd, type: edge.type, animated: edge.animated },
    after: { markerEnd: migratedEdge.markerEnd, type: migratedEdge.type, animated: migratedEdge.animated }
  });

  return migratedEdge;
}

/**
 * 批量迁移边数据
 */
export function migrateEdges(edges: PersistedEdge[]): PersistedEdge[] {
  console.log(`[Migration] Migrating ${edges.length} edges...`);
  return edges.map(migrateEdgeData);
}

/**
 * 检查边是否需要迁移
 */
export function needsEdgeMigration(edge: PersistedEdge): boolean {
  return !edge.markerEnd || !edge.type || edge.animated === undefined;
}

/**
 * 检查边数组是否需要迁移
 */
export function needsEdgesMigration(edges: PersistedEdge[]): boolean {
  return edges.some(needsEdgeMigration);
}
