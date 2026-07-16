import { Todo, TodoRelation } from '../../../shared/types';
import { buildCompactTodoRows } from '../compactTodoNesting';

const makeTodo = (id: string): Todo => ({
  id,
  title: `Todo ${id}`,
  content: '',
  status: 'pending',
  priority: 'mental',
  tags: '',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
});

const makeExtendsRelation = (sourceId: string, targetId: string): TodoRelation => ({
  id: `${sourceId}-${targetId}`,
  source_id: sourceId,
  target_id: targetId,
  relation_type: 'extends',
  created_at: '2026-07-16T00:00:00.000Z',
});

describe('buildCompactTodoRows', () => {
  it('renders descendants directly below parents with one indent per generation', () => {
    const parent = makeTodo('parent');
    const unrelated = makeTodo('unrelated');
    const child = makeTodo('child');
    const grandchild = makeTodo('grandchild');

    const rows = buildCompactTodoRows(
      [parent, unrelated, child, grandchild],
      [
        makeExtendsRelation('parent', 'child'),
        makeExtendsRelation('child', 'grandchild'),
      ]
    );

    expect(rows.map(row => row.todo.id)).toEqual(['parent', 'child', 'grandchild', 'unrelated']);
    expect(rows.map(row => row.indentLevel)).toEqual([0, 1, 2, 0]);
  });

  it('keeps sibling order from the incoming sorted todo list', () => {
    const parent = makeTodo('parent');
    const childB = makeTodo('child-b');
    const childA = makeTodo('child-a');

    const rows = buildCompactTodoRows(
      [parent, childB, childA],
      [
        makeExtendsRelation('parent', 'child-a'),
        makeExtendsRelation('parent', 'child-b'),
      ]
    );

    expect(rows.map(row => row.todo.id)).toEqual(['parent', 'child-b', 'child-a']);
    expect(rows.map(row => row.indentLevel)).toEqual([0, 1, 1]);
  });
});
