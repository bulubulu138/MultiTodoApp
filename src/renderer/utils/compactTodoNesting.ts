import { Todo, TodoRelation } from '../../shared/types';

export interface CompactTodoRow {
  todo: Todo;
  indentLevel: number;
}

export const buildCompactTodoRows = (
  todos: Todo[],
  relations: TodoRelation[]
): CompactTodoRow[] => {
  const todoById = new Map(todos.map(todo => [todo.id, todo]));
  const originalIndex = new Map(todos.map((todo, index) => [todo.id, index]));
  const childIdsByParent = new Map<string, string[]>();
  const childIds = new Set<string>();

  relations.forEach(relation => {
    if (relation.relation_type !== 'extends') return;

    const parentId = String(relation.source_id);
    const childId = String(relation.target_id);

    if (!todoById.has(parentId) || !todoById.has(childId)) return;

    const children = childIdsByParent.get(parentId) ?? [];
    children.push(childId);
    childIdsByParent.set(parentId, children);
    childIds.add(childId);
  });

  childIdsByParent.forEach(children => {
    children.sort((leftId, rightId) => {
      return (originalIndex.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (originalIndex.get(rightId) ?? Number.MAX_SAFE_INTEGER);
    });
  });

  const rows: CompactTodoRow[] = [];
  const visited = new Set<string>();

  const appendTodoWithChildren = (todo: Todo, indentLevel: number) => {
    if (visited.has(todo.id)) return;

    visited.add(todo.id);
    rows.push({ todo, indentLevel });

    const children = childIdsByParent.get(todo.id) ?? [];
    children.forEach(childId => {
      const childTodo = todoById.get(childId);
      if (childTodo) {
        appendTodoWithChildren(childTodo, indentLevel + 1);
      }
    });
  };

  todos.forEach(todo => {
    if (!childIds.has(todo.id)) {
      appendTodoWithChildren(todo, 0);
    }
  });

  todos.forEach(todo => appendTodoWithChildren(todo, 0));

  return rows;
};
