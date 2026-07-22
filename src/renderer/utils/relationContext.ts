import { Todo, TodoRelation } from '../../shared/types';

export interface RelationContextGroups {
  backgrounds: Todo[];
  backgroundExtensions: Todo[];
  extensions: Todo[];
  parallels: Todo[];
}

const byCreatedAt = (a: Todo, b: Todo) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

const findTodo = (allTodos: Todo[], todoId: string) =>
  allTodos.find(todo => todo && String(todo.id) === todoId);

const pushUnique = (todos: Todo[], visited: Set<string>, todo: Todo) => {
  const todoId = String(todo.id);
  if (visited.has(todoId)) return;

  todos.push(todo);
  visited.add(todoId);
};

export const getRelationContextGroups = (
  currentTodo: Todo,
  allTodos: Todo[],
  relations: TodoRelation[]
): RelationContextGroups => {
  const currentTodoId = String(currentTodo.id);
  const backgrounds: Todo[] = [];
  const backgroundIds = new Set<string>();
  const visitedAncestors = new Set<string>();
  const maxDepth = 5;

  function collectParents(todoId: string, depth: number) {
    if (visitedAncestors.has(todoId) || depth >= maxDepth) return;
    visitedAncestors.add(todoId);

    relations.forEach(rel => {
      const sourceId = String(rel.source_id);
      const targetId = String(rel.target_id);
      const isParentRelation = targetId === todoId &&
        (rel.relation_type === 'background' || rel.relation_type === 'extends');

      if (!isParentRelation) return;

      const parentTodo = findTodo(allTodos, sourceId);
      if (!parentTodo) return;

      pushUnique(backgrounds, backgroundIds, parentTodo);
      collectParents(sourceId, depth + 1);
    });
  }

  if (currentTodo.id) {
    collectParents(currentTodoId, 0);
  }

  const backgroundExtensions: Todo[] = [];
  const siblingIds = new Set<string>();

  backgrounds.forEach(parent => {
    const parentId = String(parent.id);
    relations.forEach(rel => {
      const sourceId = String(rel.source_id);
      const targetId = String(rel.target_id);
      const isSiblingRelation = sourceId === parentId &&
        (rel.relation_type === 'background' || rel.relation_type === 'extends');

      if (!isSiblingRelation || targetId === currentTodoId) return;

      const siblingTodo = findTodo(allTodos, targetId);
      if (siblingTodo) {
        pushUnique(backgroundExtensions, siblingIds, siblingTodo);
      }
    });
  });

  const extensions: Todo[] = [];
  const extensionIds = new Set<string>();

  relations.forEach(rel => {
    if (rel.relation_type !== 'extends') return;

    const sourceId = String(rel.source_id);
    const targetId = String(rel.target_id);
    if (sourceId !== currentTodoId) return;

    const extensionTodo = findTodo(allTodos, targetId);
    if (extensionTodo) {
      pushUnique(extensions, extensionIds, extensionTodo);
    }
  });

  const parallels: Todo[] = [];
  const parallelIds = new Set<string>();

  relations.forEach(rel => {
    if (rel.relation_type !== 'parallel') return;

    const sourceId = String(rel.source_id);
    const targetId = String(rel.target_id);
    const parallelTodoId = sourceId === currentTodoId
      ? targetId
      : targetId === currentTodoId
        ? sourceId
        : null;

    if (!parallelTodoId) return;

    const parallelTodo = findTodo(allTodos, parallelTodoId);
    if (parallelTodo) {
      pushUnique(parallels, parallelIds, parallelTodo);
    }
  });

  return {
    backgrounds: backgrounds.sort(byCreatedAt),
    backgroundExtensions: backgroundExtensions.sort(byCreatedAt),
    extensions: extensions.sort(byCreatedAt),
    parallels
  };
};
