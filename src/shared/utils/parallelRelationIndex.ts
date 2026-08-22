import { TodoRelation } from '../types';

export interface ParallelRelationIndex {
  parallelAdjacency: Map<string, Set<string>>;
  parallelGroupByTodo: Map<string, Set<string>>;
  hasParallelByTodo: Set<string>;
}

export function buildParallelRelationIndex(relations: TodoRelation[]): ParallelRelationIndex {
  const parallelAdjacency = new Map<string, Set<string>>();
  const hasParallelByTodo = new Set<string>();

  for (const relation of relations) {
    if (relation.relation_type !== 'parallel') {
      continue;
    }

    const sourceId = String(relation.source_id);
    const targetId = String(relation.target_id);

    if (!parallelAdjacency.has(sourceId)) {
      parallelAdjacency.set(sourceId, new Set<string>());
    }
    if (!parallelAdjacency.has(targetId)) {
      parallelAdjacency.set(targetId, new Set<string>());
    }

    parallelAdjacency.get(sourceId)!.add(targetId);
    parallelAdjacency.get(targetId)!.add(sourceId);
    hasParallelByTodo.add(sourceId);
    hasParallelByTodo.add(targetId);
  }

  const parallelGroupByTodo = new Map<string, Set<string>>();
  const visited = new Set<string>();

  for (const todoId of parallelAdjacency.keys()) {
    if (visited.has(todoId)) {
      continue;
    }

    const group = new Set<string>();
    const pending = [todoId];
    visited.add(todoId);

    while (pending.length > 0) {
      const currentId = pending.pop()!;
      group.add(currentId);

      for (const relatedId of parallelAdjacency.get(currentId) || []) {
        if (!visited.has(relatedId)) {
          visited.add(relatedId);
          pending.push(relatedId);
        }
      }
    }

    for (const groupMemberId of group) {
      parallelGroupByTodo.set(groupMemberId, group);
    }
  }

  return {
    parallelAdjacency,
    parallelGroupByTodo,
    hasParallelByTodo
  };
}
