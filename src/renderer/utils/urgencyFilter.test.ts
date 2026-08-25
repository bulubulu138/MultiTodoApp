import { Todo } from '../../shared/types';
import { filterTodosByUrgency } from './urgencyFilter';

const makeTodo = (id: string, status: Todo['status'], urgency?: Todo['urgency']): Todo => ({
  id,
  title: id,
  content: '',
  status,
  priority: 'trivial',
  urgency: urgency as Todo['urgency'],
  tags: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('filterTodosByUrgency', () => {
  const todos = [
    makeTodo('high', 'pending', 'high'),
    makeTodo('low', 'pending', 'low'),
    makeTodo('legacy', 'pending'),
    makeTodo('completed', 'completed', 'high')
  ];

  it('filters high and treats missing urgency as low in pending tab', () => {
    expect(filterTodosByUrgency(todos, 'pending', 'high').map(todo => todo.id)).toEqual(['high']);
    expect(filterTodosByUrgency(todos, 'pending', 'low').map(todo => todo.id)).toEqual(['low', 'legacy']);
  });

  it('ignores urgency filter outside pending tab', () => {
    expect(filterTodosByUrgency(todos, 'completed', 'high')).toEqual(todos);
  });
});
