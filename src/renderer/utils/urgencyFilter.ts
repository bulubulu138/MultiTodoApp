import { Todo } from '../../shared/types';

export type UrgencyFilter = 'all' | 'high' | 'low';

export function filterTodosByUrgency(
  todos: Todo[],
  activeTab: string,
  urgencyFilter: UrgencyFilter
): Todo[] {
  if (activeTab !== 'pending' || urgencyFilter === 'all') {
    return todos;
  }

  return todos.filter(todo => (todo.urgency ?? 'low') === urgencyFilter);
}
