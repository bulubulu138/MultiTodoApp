import React from 'react';
import { render, screen } from '@testing-library/react';
import ReviewTodoDetailContent from '../ReviewTodoDetailContent';

const sanitizeMock = jest.fn((html: string) => `sanitized:${html}`);

jest.mock('dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => sanitizeMock(html),
  },
}));

describe('ReviewTodoDetailContent', () => {
  beforeEach(() => {
    sanitizeMock.mockClear();
  });

  it('sanitizes todo content only when content changes', () => {
    const todo = {
      id: 'todo-1',
      title: 'Opened todo',
      content: '<p>Large todo body</p>',
      status: 'pending',
      priority: 'mental',
      tags: '',
    } as any;

    const { rerender } = render(<ReviewTodoDetailContent todo={todo} />);

    expect(sanitizeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('sanitized:<p>Large todo body</p>')).toBeInTheDocument();

    rerender(<ReviewTodoDetailContent todo={{ ...todo }} />);

    expect(sanitizeMock).toHaveBeenCalledTimes(1);

    rerender(<ReviewTodoDetailContent todo={{ ...todo, content: '<p>updated</p>' }} />);

    expect(sanitizeMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('sanitized:<p>updated</p>')).toBeInTheDocument();
  });
});
