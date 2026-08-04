import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InlineEditPanel from '../InlineEditPanel';
import { Todo } from '../../../shared/types';

jest.mock('../MilkdownEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="content-editor" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}));

const baseTodo: Todo = {
  id: 'todo-1',
  title: '整理复盘',
  content: '内容',
  status: 'pending',
  priority: 'mental',
  tags: '',
  owner: '张三',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z'
};

function renderPanel(overrides: Partial<Todo> = {}) {
  const onUpdate = jest.fn().mockResolvedValue(undefined);

  render(
    <InlineEditPanel
      todo={{ ...baseTodo, ...overrides }}
      allTodos={[
        baseTodo,
        { ...baseTodo, id: 'todo-2', owner: '李四' },
        { ...baseTodo, id: 'todo-3', owner: ' 张三 ' }
      ]}
      onUpdate={onUpdate}
      onCancel={jest.fn()}
      onExit={jest.fn()}
      isSaving={false}
    />
  );

  return { onUpdate };
}

describe('InlineEditPanel owner editing', () => {
  it('saves a normalized owner from the detail edit panel', async () => {
    const { onUpdate } = renderPanel();

    fireEvent.change(screen.getByPlaceholderText('输入负责人，或参考已有负责人名称'), {
      target: { value: ' 李四 ' }
    });
    fireEvent.click(screen.getByText('保存 (Ctrl+S)'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ owner: '李四' }));
  });

  it('clears owner when the owner input is emptied', async () => {
    const { onUpdate } = renderPanel();

    fireEvent.change(screen.getByPlaceholderText('输入负责人，或参考已有负责人名称'), {
      target: { value: '   ' }
    });
    fireEvent.click(screen.getByText('保存 (Ctrl+S)'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ owner: undefined }));
  });
});
