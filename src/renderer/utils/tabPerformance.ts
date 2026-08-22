import { Todo } from '../../shared/types';

export const VIRTUAL_SCROLL_THRESHOLD = 50;

export const shouldUseVirtualScroll = (todoCount: number): boolean =>
  todoCount > VIRTUAL_SCROLL_THRESHOLD;

export const countTodoTags = (todos: Todo[]): Map<string, number> => {
  const counts = new Map<string, number>();

  todos.forEach((todo) => {
    if (!todo?.tags) return;

    const uniqueTags = new Set(
      todo.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    );

    uniqueTags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return counts;
};
