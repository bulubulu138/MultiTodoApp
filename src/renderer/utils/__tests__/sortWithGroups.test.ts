import { buildParallelGroups, sortWithGroups, selectGroupRepresentatives } from '../sortWithGroups';
import { Todo, TodoRelation } from '../../../shared/types';

const makeTodo = (id: string, displayOrder: number | null): Todo => ({
  id,
  title: `Todo ${id}`,
  content: '',
  status: 'pending',
  priority: 'medium',
  tags: [],
  displayOrders: displayOrder === null ? {} : { pending: displayOrder },
  createdAt: '2026-05-31T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z',
});

describe('sortWithGroups', () => {
  it('keeps manual order in sync with displayOrders changes', () => {
    const relations: TodoRelation[] = [];
    const initialTodos = [makeTodo('a', 0), makeTodo('b', 1), makeTodo('c', null)];

    const groups = buildParallelGroups(initialTodos, relations);
    const comparator = (left: Todo, right: Todo) => {
      const leftOrder = left.displayOrders?.pending;
      const rightOrder = right.displayOrders?.pending;
      if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return String(left.id).localeCompare(String(right.id));
    };

    const representatives = selectGroupRepresentatives(groups, initialTodos, comparator);
    expect(sortWithGroups(initialTodos, groups, representatives, comparator).map(todo => todo.id)).toEqual(['a', 'b', 'c']);

    const updatedTodos = [makeTodo('a', 2), makeTodo('b', 1), makeTodo('c', null)];
    const updatedGroups = buildParallelGroups(updatedTodos, relations);
    const updatedRepresentatives = selectGroupRepresentatives(updatedGroups, updatedTodos, comparator);

    expect(sortWithGroups(updatedTodos, updatedGroups, updatedRepresentatives, comparator).map(todo => todo.id)).toEqual(['b', 'a', 'c']);
  });
});
