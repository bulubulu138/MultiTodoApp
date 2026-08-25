import matter from 'gray-matter';
import { MarkdownParser } from './MarkdownParser';
import { Todo } from '../shared/types';

describe('MarkdownParser urgency', () => {
  const parser = new MarkdownParser();

  const markdown = (urgency = '') => `---
id: a
title: A
status: pending
priority: trivial
${urgency}created_at: 2026-01-01T00:00:00.000Z
updated_at: 2026-01-01T00:00:00.000Z
---
`;

  it('reads high urgency from frontmatter', () => {
    expect(parser.parseTodo(markdown('urgency: high\n')).urgency).toBe('high');
  });

  it.each(['', 'urgency: urgent\n', 'urgency: 3\n'])('defaults %p urgency to low', (urgency) => {
    expect(parser.parseTodo(markdown(urgency)).urgency).toBe('low');
  });

  it('writes urgency to generated frontmatter', async () => {
    const todo: Todo = {
      id: 'a',
      title: 'A',
      content: '',
      status: 'pending',
      priority: 'trivial',
      urgency: 'high',
      tags: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    const generated = await parser.generateTodo(todo);
    expect(matter(generated).data.urgency).toBe('high');
  });
});
