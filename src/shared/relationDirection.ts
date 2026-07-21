import { Todo, TodoRelation } from './types';

export type RelationDisplayType = 'background' | 'extends' | 'parallel';

export interface RelationDisplay<TTodo = Todo> {
  relatedTodo: TTodo;
  displayType: RelationDisplayType;
}

export const createRelationForNewTodoPlacement = (
  newTodoId: string,
  targetTodoId: string,
  relationType: 'extends' | 'parallel'
): Omit<TodoRelation, 'id' | 'created_at'> => {
  if (relationType === 'extends') {
    return {
      source_id: targetTodoId,
      target_id: newTodoId,
      relation_type: 'extends'
    };
  }

  return {
    source_id: newTodoId,
    target_id: targetTodoId,
    relation_type: 'parallel'
  };
};

export const createRelationForModalSelection = (
  currentTodoId: string,
  selectedTodoId: string,
  relationType: RelationDisplayType
): Omit<TodoRelation, 'id' | 'created_at'> => {
  if (relationType === 'extends') {
    return {
      source_id: currentTodoId,
      target_id: selectedTodoId,
      relation_type: 'extends'
    };
  }

  if (relationType === 'background') {
    return {
      source_id: selectedTodoId,
      target_id: currentTodoId,
      relation_type: 'background'
    };
  }

  return {
    source_id: currentTodoId,
    target_id: selectedTodoId,
    relation_type: 'parallel'
  };
};

export const getDisplayRelationForTodo = <TTodo>(
  currentTodoId: string,
  relation: TodoRelation,
  findTodo: (todoId: string) => TTodo | undefined
): RelationDisplay<TTodo> | null => {
  const sourceId = String(relation.source_id);
  const targetId = String(relation.target_id);

  if (relation.relation_type === 'parallel') {
    const relatedTodoId = sourceId === currentTodoId ? targetId : sourceId;
    const relatedTodo = findTodo(relatedTodoId);
    return relatedTodo ? { relatedTodo, displayType: 'parallel' } : null;
  }

  if (relation.relation_type === 'extends') {
    if (sourceId === currentTodoId) {
      const relatedTodo = findTodo(targetId);
      return relatedTodo ? { relatedTodo, displayType: 'extends' } : null;
    }

    if (targetId === currentTodoId) {
      const relatedTodo = findTodo(sourceId);
      return relatedTodo ? { relatedTodo, displayType: 'background' } : null;
    }

    return null;
  }

  if (relation.relation_type === 'background') {
    if (targetId === currentTodoId) {
      const relatedTodo = findTodo(sourceId);
      return relatedTodo ? { relatedTodo, displayType: 'background' } : null;
    }

    if (sourceId === currentTodoId) {
      const relatedTodo = findTodo(targetId);
      return relatedTodo ? { relatedTodo, displayType: 'extends' } : null;
    }
  }

  return null;
};
