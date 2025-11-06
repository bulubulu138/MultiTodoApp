import { TodoRelation } from '../../shared/types';

/**
 * 计算待办的各类型关联数量
 * @param todoId 待办ID
 * @param relations 所有关联关系
 * @returns 各类型关联数量
 */
export const getRelationCounts = (todoId: number, relations: TodoRelation[]) => {
  const counts = {
    extends: 0,
    background: 0,
    parallel: 0
  };
  
  relations.forEach(r => {
    if (r.source_id === todoId || r.target_id === todoId) {
      const type = r.relation_type as keyof typeof counts;
      if (type in counts) {
        counts[type]++;
      }
    }
  });
  
  return counts;
};

/**
 * 获取待办的关联待办列表（按类型分组）
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
    if (r.source_id === todoId || r.target_id === todoId) {
      const relatedId = r.source_id === todoId ? r.target_id : r.source_id;
      const relatedTodo = allTodos.find(t => t.id === relatedId);
      
      if (relatedTodo) {
        const type = r.relation_type as keyof typeof related;
        if (type in related) {
          related[type].push(relatedTodo);
        }
      }
    }
  });
  
  return related;
};

