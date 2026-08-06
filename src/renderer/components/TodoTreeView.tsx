import React, { useMemo, useState } from 'react';
import { Button, Empty, Modal, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Todo, TodoRelation, TodoTreeNode } from '../../shared/types';
import { buildTodoTree, getAttachableTodos } from '../utils/todoTree';
import ReadOnlyMarkdown from './ReadOnlyMarkdown';
import TodoOwnerAvatar from './TodoOwnerAvatar';
import './TodoTreeView.css';

const { Text, Title } = Typography;

interface TodoTreeViewProps {
  todos: Todo[];
  relations: TodoRelation[];
  loading: boolean;
  selectedTodo: Todo | null;
  onSelectTodo: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onReparent: (childTodoId: string, parentTodoId: string) => void;
}

interface ExistingTodoSelectorProps {
  visible: boolean;
  parentTodo: Todo | null;
  todos: Todo[];
  relations: TodoRelation[];
  onCancel: () => void;
  onConfirm: (todo: Todo) => void;
}

const ExistingTodoSelector: React.FC<ExistingTodoSelectorProps> = ({
  visible,
  parentTodo,
  todos,
  relations,
  onCancel,
  onConfirm,
}) => {
  const [selectedTodoId, setSelectedTodoId] = useState<string | undefined>(undefined);

  const attachableTodos = useMemo(() => {
    if (!parentTodo) return [];
    return getAttachableTodos(String(parentTodo.id), todos, relations);
  }, [parentTodo, relations, todos]);

  const options = useMemo(() => attachableTodos.map(todo => ({
    value: String(todo.id),
    label: todo.title || '未命名待办',
  })), [attachableTodos]);

  return (
    <Modal
      title="选择已有待办"
      open={visible}
      onCancel={onCancel}
      onOk={() => {
        const selectedTodo = attachableTodos.find(todo => String(todo.id) === selectedTodoId);
        if (selectedTodo) {
          onConfirm(selectedTodo);
        }
      }}
      okText="确认加入子树"
      cancelText="取消"
      destroyOnClose
      afterClose={() => setSelectedTodoId(undefined)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Select
          showSearch
          placeholder="选择一个已有待办"
          value={selectedTodoId}
          onChange={setSelectedTodoId}
          options={options}
          optionFilterProp="label"
          style={{ width: '100%' }}
          disabled={!parentTodo}
        />
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
          只显示不会造成循环引用的待办。
        </div>
      </Space>
    </Modal>
  );
};

const statusText: Record<Todo['status'], string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  paused: '暂停',
};

const priorityText: Record<Todo['priority'], string> = {
  mental: '脑力',
  communication: '沟通',
  trivial: '琐碎',
};

interface TreeNodeRowProps {
  node: TodoTreeNode;
  selectedTodoId: string | null;
  depth?: number;
  onSelectTodo: (todo: Todo) => void;
  onOpenAttachSelector: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  selectedTodoId,
  depth = 0,
  onSelectTodo,
  onOpenAttachSelector,
  onEdit,
  onDelete,
}) => {
  const id = String(node.todo.id);
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });
  const isSelected = selectedTodoId === id;
  const marginLeft = depth > 0 ? depth * 8 : 0;

  return (
    <div ref={droppable.setNodeRef} className="todo-tree-nodeWrap" style={{ marginLeft }}>
      <div
        ref={draggable.setNodeRef}
        {...draggable.attributes}
        {...draggable.listeners}
        className={`todo-tree-nodeRow ${isSelected ? 'todo-tree-nodeRowSelected' : ''}`}
        onClick={() => onSelectTodo(node.todo)}
      >
        <div className="todo-tree-nodeMain">
          <div className="todo-tree-nodeTitle">{node.todo.title || '未命名待办'}</div>
          <div className="todo-tree-nodeMeta">
            <Tag>{statusText[node.todo.status]}</Tag>
            <Tag>{priorityText[node.todo.priority]}</Tag>
            {node.todo.owner && <TodoOwnerAvatar owner={node.todo.owner} size={18} />}
          </div>
        </div>

        <Space size={4} className="todo-tree-nodeActions" onClick={(event) => event.stopPropagation()}>
          <Tooltip title="加入已有待办到子树">
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => onOpenAttachSelector(node.todo)} />
          </Tooltip>
          <Tooltip title="编辑待办">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(node.todo)} />
          </Tooltip>
          <Tooltip title="删除待办">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(node.todo)} />
          </Tooltip>
        </Space>
      </div>

      {node.children && node.children.length > 0 && (
        <div className="todo-tree-children">
          {node.children.map(child => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedTodoId={selectedTodoId}
              onSelectTodo={onSelectTodo}
              onOpenAttachSelector={onOpenAttachSelector}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TodoTreeView: React.FC<TodoTreeViewProps> = ({
  todos,
  relations,
  loading,
  selectedTodo,
  onSelectTodo,
  onEdit,
  onDelete,
  onReparent,
}) => {
  const tree = useMemo(() => buildTodoTree(todos, relations), [todos, relations]);
  const selectedTodoId = selectedTodo ? String(selectedTodo.id) : null;
  const [attachTargetTodo, setAttachTargetTodo] = useState<Todo | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const childTodoId = event.active.id ? String(event.active.id) : '';
    const parentTodoId = event.over?.id ? String(event.over.id) : '';
    if (!childTodoId || !parentTodoId || childTodoId === parentTodoId) return;
    onReparent(childTodoId, parentTodoId);
  };

  const handleAttachConfirm = (todo: Todo) => {
    if (!attachTargetTodo) return;
    onReparent(String(todo.id), String(attachTargetTodo.id));
    setAttachTargetTodo(null);
  };

  return (
    <div className="todo-tree-view">
      <section className="todo-tree-pane">
        <div className="todo-tree-header">
          <Text strong>待办树</Text>
          <Text type="secondary">{todos.length} 项</Text>
        </div>

        <div className="todo-tree-body">
          {loading ? (
            <Spin />
          ) : tree.roots.length === 0 ? (
            <Empty description="暂无待办" />
          ) : (
            <DndContext onDragEnd={handleDragEnd}>
              {tree.roots.map(node => (
                <TreeNodeRow
                  key={node.key}
                  node={node}
                  selectedTodoId={selectedTodoId}
                  onSelectTodo={onSelectTodo}
                  onOpenAttachSelector={setAttachTargetTodo}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </DndContext>
          )}
        </div>
      </section>

      <ExistingTodoSelector
        visible={Boolean(attachTargetTodo)}
        parentTodo={attachTargetTodo}
        todos={todos}
        relations={relations}
        onCancel={() => setAttachTargetTodo(null)}
        onConfirm={handleAttachConfirm}
      />

      <section className="todo-tree-detailPane">
        <div className="todo-tree-detailHeader">
          <Text strong>详情</Text>
          {selectedTodo && (
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setAttachTargetTodo(selectedTodo)}>
                子待办
              </Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(selectedTodo)}>
                编辑
              </Button>
            </Space>
          )}
        </div>

        <div className="todo-tree-detailBody">
          {!selectedTodo ? (
            <Empty description="选择一个待办查看详情" />
          ) : (
            <Space direction="vertical" size={16} className="todo-tree-detailSection" style={{ width: '100%' }}>
              <Title level={4} className="todo-tree-detailTitle">{selectedTodo.title || '未命名待办'}</Title>

              <div className="todo-tree-detailMeta">
                <Tag>{statusText[selectedTodo.status]}</Tag>
                <Tag>{priorityText[selectedTodo.priority]}</Tag>
                {selectedTodo.owner && <TodoOwnerAvatar owner={selectedTodo.owner} size={22} />}
              </div>

              {selectedTodo.tags && (
                <Space wrap>
                  {selectedTodo.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              )}

              {selectedTodo.content ? (
                <ReadOnlyMarkdown content={selectedTodo.content} showCopyButton maxHeight={420} />
              ) : (
                <Text type="secondary">暂无内容</Text>
              )}
            </Space>
          )}
        </div>
      </section>
    </div>
  );
};

export default TodoTreeView;
