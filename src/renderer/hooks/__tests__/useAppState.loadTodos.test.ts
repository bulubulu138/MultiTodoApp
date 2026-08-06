import { renderHook, act } from '@testing-library/react';
import { useAppState } from '../useAppState';

describe('useAppState - loadTodos', () => {
  const fullTodo = {
    id: 'todo-1',
    title: 'Full title',
    content: '<p>This is the full content body that must not be truncated.</p>',
    status: 'pending',
    priority: 'medium',
    tags: '',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };

  beforeEach(() => {
    (window as any).electronAPI = {
      todo: {
        getAll: jest.fn().mockResolvedValue([fullTodo]),
        getSummaries: jest.fn().mockResolvedValue([
          { ...fullTodo, content: 'This is truncated...' },
        ]),
      },
      relations: {
        getAll: jest.fn().mockResolvedValue([]),
      },
      settings: {
        get: jest.fn().mockResolvedValue({}),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads full todos so content focus mode can render the complete body', async () => {
    const { result } = renderHook(() => useAppState());

    await act(async () => {
      await result.current.loadTodos();
    });

    expect(window.electronAPI.todo.getAll).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.todo.getSummaries).not.toHaveBeenCalled();
    expect(result.current.state.todos).toHaveLength(1);
    expect(result.current.state.todos[0].content).toBe(fullTodo.content);
  });
});
