import { Todo, TodoRelation, TodoTreeNode } from '../../shared/types';

export interface BuiltTodoTree {
  roots: TodoTreeNode[];
  nodeById: Map<string, TodoTreeNode>;
  parentByChildId: Map<string, TodoRelation>;
}

export interface ReparentValidationResult {
  allowed: boolean;
  reason?: 'same-node' | 'descendant' | 'missing-node';
}

const compareRelationRecency = (left: TodoRelation, right: TodoRelation): number => {
  const leftTime = Date.parse(left.created_at || '');
  const rightTime = Date.parse(right.created_at || '');

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return 0;
};

export const getParentRelations = (
  childTodoId: string,
  relations: TodoRelation[]
): TodoRelation[] => relations.filter(relation =>
  relation.relation_type === 'extends' && String(relation.target_id) === String(childTodoId)
);

export const getCurrentParentRelation = (
  childTodoId: string,
  relations: TodoRelation[]
): TodoRelation | null => {
  const parentRelations = getParentRelations(childTodoId, relations);

  if (parentRelations.length === 0) return null;

  return parentRelations.reduce((current, next) => (
    compareRelationRecency(current, next) <= 0 ? next : current
  ));
};

export const getDescendantIds = (
  todoId: string,
  nodeById: Map<string, TodoTreeNode>
): Set<string> => {
  const descendants = new Set<string>();
  const root = nodeById.get(String(todoId));
  const stack = [...(root?.children || [])];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    const id = String(node.todo.id);
    if (descendants.has(id)) continue;

    descendants.add(id);
    stack.push(...(node.children || []));
  }

  return descendants;
};

export const getAttachableTodos = (
  parentTodoId: string,
  todos: Todo[],
  relations: TodoRelation[]
): Todo[] => {
  const tree = buildTodoTree(todos, relations);
  const excludedIds = new Set<string>([String(parentTodoId), ...getDescendantIds(parentTodoId, tree.nodeById)]);

  return todos.filter(todo => todo?.id && !excludedIds.has(String(todo.id)));
};

export const buildTodoTree = (todos: Todo[], relations: TodoRelation[]): BuiltTodoTree => {
  const nodeById = new Map<string, TodoTreeNode>();
  const parentByChildId = new Map<string, TodoRelation>();

  todos.filter(todo => todo && todo.id).forEach(todo => {
    nodeById.set(String(todo.id), {
      key: String(todo.id),
      title: todo.title,
      todo,
      children: [],
    });
  });

  relations.forEach(relation => {
    if (relation.relation_type !== 'extends') return;

    const parentId = String(relation.source_id);
    const childId = String(relation.target_id);
    if (!nodeById.has(parentId) || !nodeById.has(childId) || parentId === childId) return;

    const existing = parentByChildId.get(childId);
    if (!existing || compareRelationRecency(existing, relation) <= 0) {
      parentByChildId.set(childId, relation);
    }
  });

  parentByChildId.forEach((relation, childId) => {
    const parentNode = nodeById.get(String(relation.source_id));
    const childNode = nodeById.get(childId);
    if (!parentNode || !childNode) return;

    parentNode.children = [...(parentNode.children || []), childNode];
  });

  parentByChildId.forEach((relation, childId) => {
    if (!getDescendantIds(childId, nodeById).has(String(relation.source_id))) return;

    const parentNode = nodeById.get(String(relation.source_id));
    if (parentNode?.children) {
      parentNode.children = parentNode.children.filter(node => String(node.todo.id) !== childId);
    }
    parentByChildId.delete(childId);
  });

  const childIds = new Set(parentByChildId.keys());
  const roots = Array.from(nodeById.values()).filter(node => !childIds.has(String(node.todo.id)));

  const sortNodes = (nodes: TodoTreeNode[]) => {
    nodes.sort((left, right) => new Date(right.todo.createdAt).getTime() - new Date(left.todo.createdAt).getTime());
    nodes.forEach(node => sortNodes(node.children || []));
  };
  sortNodes(roots);

  return { roots, nodeById, parentByChildId };
};

export const canReparentTodo = (
  childTodoId: string,
  newParentTodoId: string,
  nodeById: Map<string, TodoTreeNode>
): ReparentValidationResult => {
  const childId = String(childTodoId);
  const parentId = String(newParentTodoId);

  if (!nodeById.has(childId) || !nodeById.has(parentId)) {
    return { allowed: false, reason: 'missing-node' };
  }

  if (childId === parentId) {
    return { allowed: false, reason: 'same-node' };
  }

  if (getDescendantIds(childId, nodeById).has(parentId)) {
    return { allowed: false, reason: 'descendant' };
  }

  return { allowed: true };
};
