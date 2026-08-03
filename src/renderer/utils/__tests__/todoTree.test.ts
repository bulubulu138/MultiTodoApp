import { Todo, TodoRelation } from '../../../shared/types';
import {
  buildTodoTree,
  canReparentTodo,
  getCurrentParentRelation,
  getDescendantIds,
  getParentRelations,
} from '../todoTree';

const makeTodo = (id: string, title = `Todo ${id}`, status: Todo['status'] = 'pending'): Todo => ({
  id,
  title,
  content: '',
  status,
  priority: 'mental',
  tags: '',
  createdAt: `2026-08-03T00:00:0${id.length}.000Z`,
  updatedAt: `2026-08-03T00:00:0${id.length}.000Z`,
});

const relation = (
  id: string,
  source_id: string,
  target_id: string,
  relation_type: TodoRelation['relation_type'] = 'extends',
  created_at = '2026-08-03T00:00:00.000Z'
): TodoRelation => ({ id, source_id, target_id, relation_type, created_at });

describe('todoTree utilities', () => {
  it('builds roots and children from extends relations', () => {
    const todos = [makeTodo('parent'), makeTodo('child'), makeTodo('other', 'Other', 'completed')];
    const relations = [relation('r1', 'parent', 'child')];

    const result = buildTodoTree(todos, relations);

    expect(result.roots.map(node => node.todo.id)).toEqual(['parent', 'other']);
    expect(result.roots[0].children?.map(node => node.todo.id)).toEqual(['child']);
    expect(result.parentByChildId.get('child')?.source_id).toBe('parent');
  });

  it('ignores background and parallel relations for the editable hierarchy', () => {
    const todos = [makeTodo('a'), makeTodo('b'), makeTodo('c')];
    const relations = [
      relation('r1', 'a', 'b', 'background'),
      relation('r2', 'b', 'c', 'parallel'),
    ];

    const result = buildTodoTree(todos, relations);

    expect(result.roots.map(node => node.todo.id)).toEqual(['a', 'b', 'c']);
    expect(result.parentByChildId.size).toBe(0);
  });

  it('chooses the newest parent when inconsistent data gives one child multiple parents', () => {
    const todos = [makeTodo('old-parent'), makeTodo('new-parent'), makeTodo('child')];
    const relations = [
      relation('old', 'old-parent', 'child', 'extends', '2026-08-03T00:00:00.000Z'),
      relation('new', 'new-parent', 'child', 'extends', '2026-08-03T00:01:00.000Z'),
    ];

    const result = buildTodoTree(todos, relations);

    expect(result.parentByChildId.get('child')?.id).toBe('new');
    const newParent = result.roots.find(node => node.todo.id === 'new-parent');
    expect(newParent?.children?.map(node => node.todo.id)).toEqual(['child']);
  });

  it('finds descendants without including the starting node', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')]
    );

    expect(Array.from(getDescendantIds('a', result.nodeById)).sort()).toEqual(['b', 'c']);
  });

  it('blocks moving a node under itself or under its descendant', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')]
    );

    expect(canReparentTodo('a', 'a', result.nodeById).allowed).toBe(false);
    expect(canReparentTodo('a', 'c', result.nodeById).allowed).toBe(false);
  });

  it('allows moving a node under a different valid parent', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b')]
    );

    expect(canReparentTodo('b', 'c', result.nodeById)).toEqual({ allowed: true });
  });

  it('returns the current parent relation for a child', () => {
    const relations = [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')];

    expect(getCurrentParentRelation('b', relations)?.id).toBe('ab');
    expect(getCurrentParentRelation('a', relations)).toBeNull();
  });

  it('returns all parent relations for single-parent cleanup', () => {
    const relations = [
      relation('old', 'old-parent', 'child', 'extends', '2026-08-03T00:00:00.000Z'),
      relation('new', 'new-parent', 'child', 'extends', '2026-08-03T00:01:00.000Z'),
      relation('ignored', 'other', 'child', 'background'),
    ];

    expect(getParentRelations('child', relations).map(parentRelation => parentRelation.id)).toEqual(['old', 'new']);
  });

  it('breaks cycles by leaving at least one node as a root', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b'), relation('bc', 'b', 'c'), relation('ca', 'c', 'a')]
    );

    expect(result.roots.length).toBeGreaterThan(0);
  });
});
