import { TodoRelation } from '../../shared/types';

/**
 * 计算待办的各类型关联数量
 * 
 * 关系方向说明：
 * - extends: A extends B (A 扩展自 B) - source 扩展自 target
 * - background: A background B (A 是 B 的背景) - source 是 target 的背景
 * - parallel: A parallel B (A 和 B 并列) - 无方向性，双向关系
 * 
 * @param todoId 待办ID
 * @param relations 所有关联关系
 * @returns 各类型关联数量（根据待办在关系中的角色正确计数）
 */
export const getRelationCounts = (todoId: number, relations: TodoRelation[]) => {
  const counts = {
    extends: 0,      // 当前待办扩展自多少个待办（当前是 source）
    background: 0,   // 当前待办是多少个待办的背景（当前是 source）
    parallel: 0      // 当前待办与多少个待办并列（无方向性）
  };
  
  relations.forEach(r => {
    if (r.relation_type === 'parallel') {
      // 并列关系无方向，只要涉及该待办就计数
      if (r.source_id === todoId || r.target_id === todoId) {
        counts.parallel++;
      }
    } else if (r.relation_type === 'extends') {
      // 延伸关系：只计算当前待办作为 source 的情况（当前待办扩展自其他待办）
      if (r.source_id === todoId) {
        counts.extends++;
      }
      // 如果当前待办是 target，表示其他待办扩展自它，这种情况显示为"被延伸"
      // 但在 RelationIndicators 中，我们只显示当前待办的主动关系
    } else if (r.relation_type === 'background') {
      // 背景关系：只计算当前待办作为 source 的情况（当前待办是其他待办的背景）
      if (r.source_id === todoId) {
        counts.background++;
      }
      // 如果当前待办是 target，表示其他待办是它的背景，这种情况显示为"有背景"
      // 但在 RelationIndicators 中，我们只显示当前待办的主动关系
    }
  });
  
  return counts;
};

/**
 * 获取待办的关联待办列表（按类型分组）
 * 
 * 遵循与 getRelationCounts 相同的逻辑：
 * - extends: 返回当前待办扩展自的待办（target）
 * - background: 返回当前待办作为背景的待办（target）
 * - parallel: 返回与当前待办并列的待办（无方向性）
 * 
 * @param todoId 待办ID
 * @param relations 所有关联关系
 * @param allTodos 所有待办
 * @returns 按类型分组的关联待办
 */
export const getRelatedTodos = (
  todoId: number, 
  relations: TodoRelation[],
  allTodos: any[]
) => {
  const related = {
    extends: [] as any[],
    background: [] as any[],
    parallel: [] as any[]
  };
  
  relations.forEach(r => {
    if (r.relation_type === 'parallel') {
      // 并列关系：无方向性，获取另一端的待办
      if (r.source_id === todoId || r.target_id === todoId) {
        const relatedId = r.source_id === todoId ? r.target_id : r.source_id;
        const relatedTodo = allTodos.find(t => t.id === relatedId);
        if (relatedTodo) {
          related.parallel.push(relatedTodo);
        }
      }
    } else if (r.relation_type === 'extends') {
      // 延伸关系：只处理当前待办是 source 的情况，获取 target（被扩展的待办）
      if (r.source_id === todoId) {
        const relatedTodo = allTodos.find(t => t.id === r.target_id);
        if (relatedTodo) {
          related.extends.push(relatedTodo);
        }
      }
    } else if (r.relation_type === 'background') {
      // 背景关系：只处理当前待办是 source 的情况，获取 target（需要背景的待办）
      if (r.source_id === todoId) {
        const relatedTodo = allTodos.find(t => t.id === r.target_id);
        if (relatedTodo) {
          related.background.push(relatedTodo);
        }
      }
    }
  });
  
  return related;
};

