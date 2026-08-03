import React, { useMemo } from 'react';
import { Button, Empty, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Todo, TodoRelation, TodoTreeNode } from '../../shared/types';
import { buildTodoTree } from '../utils/todoTree';
import ReadOnlyMarkdown from './ReadOnlyMarkdown';
import TodoOwnerAvatar from './TodoOwnerAvatar';
import styles from './TodoTreeView.module.css';

const { Text, Title } = Typography;

interface TodoTreeViewProps {
  todos: Todo[];
  relations: TodoRelation[];
  loading: boolean;
  selectedTodo: Todo | null;
  onSelectTodo: (todo: Todo) => void;
  onAddChild: (parentTodo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onReparent: (childTodoId: string, parentTodoId: string) => void;
}

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
  onAddChild: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  selectedTodoId,
  depth = 0,
  onSelectTodo,
  onAddChild,
  onEdit,
  onDelete,
}) => {
  const id = String(node.todo.id);
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });
  const isSelected = selectedTodoId === id;
  const marginLeft = depth > 0 ? depth * 8 : 0;

  return (
    <div ref={droppable.setNodeRef} className={styles.nodeWrap} style={{ marginLeft }}>
      <div
        ref={draggable.setNodeRef}
        {...draggable.attributes}
        {...draggable.listeners}
        className={`${styles.nodeRow} ${isSelected ? styles.nodeRowSelected : ''}`}
        onClick={() => onSelectTodo(node.todo)}
      >
        <div className={styles.nodeMain}>
          <div className={styles.nodeTitle}>{node.todo.title || '未命名待办'}</div>
          <div className={styles.nodeMeta}>
            <Tag>{statusText[node.todo.status]}</Tag>
            <Tag>{priorityText[node.todo.priority]}</Tag>
            {node.todo.owner && <TodoOwnerAvatar owner={node.todo.owner} size={18} />}
          </div>
        </div>

        <Space size={4} className={styles.nodeActions} onClick={(event) => event.stopPropagation()}>
          <Tooltip title="新增子待办">
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => onAddChild(node.todo)} />
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
        <div className={styles.children}>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedTodoId={selectedTodoId}
              onSelectTodo={onSelectTodo}
              onAddChild={onAddChild}
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
  onAddChild,
  onEdit,
  onDelete,
  onReparent,
}) => {
  const tree = useMemo(() => buildTodoTree(todos, relations), [todos, relations]);
  const selectedTodoId = selectedTodo ? String(selectedTodo.id) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const childTodoId = event.active.id ? String(event.active.id) : '';
    const parentTodoId = event.over?.id ? String(event.over.id) : '';
    if (!childTodoId || !parentTodoId || childTodoId === parentTodoId) return;
    onReparent(childTodoId, parentTodoId);
  };

  return (
    <div className={styles.treeView}>
      <section className={styles.treePane}>
        <div className={styles.treeHeader}>
          <Text strong>待办树</Text>
          <Text type="secondary">{todos.length} 项</Text>
        </div>

        <div className={styles.treeBody}>
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
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </DndContext>
          )}
        </div>
      </section>

      <section className={styles.detailPane}>
        <div className={styles.detailHeader}>
          <Text strong>详情</Text>
          {selectedTodo && (
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(selectedTodo)}>
                子待办
              </Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(selectedTodo)}>
                编辑
              </Button>
            </Space>
          )}
        </div>

        <div className={styles.detailBody}>
          {!selectedTodo ? (
            <Empty description="选择一个待办查看详情" />
          ) : (
            <Space direction="vertical" size={16} className={styles.detailSection} style={{ width: '100%' }}>
              <Title level={4} className={styles.detailTitle}>{selectedTodo.title || '未命名待办'}</Title>

              <div className={styles.detailMeta}>
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
