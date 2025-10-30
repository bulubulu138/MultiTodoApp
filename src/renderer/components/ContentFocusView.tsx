import { Todo } from '../../shared/types';
import React, { useState, useMemo, useCallback } from 'react';
import { Divider, Button, Checkbox, Space, Spin, Empty, App } from 'antd';
import { SaveOutlined, EyeOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';

interface ContentFocusViewProps {
  todos: Todo[];
  allTodos?: Todo[];
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  loading: boolean;
}

// 单个待办项组件（使用 React.memo 优化性能）
const ContentFocusItem = React.memo<{
  todo: Todo;
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  isLast: boolean;
}>(({ todo, onUpdate, onView, isLast }) => {
  const { message } = App.useApp();
  const [editedContent, setEditedContent] = useState<string>(todo.content);
  const [isSaving, setIsSaving] = useState(false);

  // 检查内容是否被修改
  const hasChanges = useMemo(() => {
    return editedContent !== todo.content;
  }, [editedContent, todo.content]);

  // 保存内容
  const handleSave = useCallback(async () => {
    if (!hasChanges || !todo.id) return;
    
    setIsSaving(true);
    try {
      await onUpdate(todo.id, { content: editedContent });
      message.success('内容已保存');
    } catch (error) {
      message.error('保存失败');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, todo.id, editedContent, onUpdate, message]);

  // 切换完成状态
  const handleToggleComplete = useCallback(async (checked: boolean) => {
    if (!todo.id) return;
    
    const newStatus = checked ? 'completed' : 'pending';
    const updates: Partial<Todo> = { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    
    try {
      await onUpdate(todo.id, updates);
      message.success(checked ? '已标记为完成' : '已标记为待办');
    } catch (error) {
      message.error('更新状态失败');
      console.error('Status update error:', error);
    }
  }, [todo.id, onUpdate, message]);

  // 查看详情
  const handleViewDetails = useCallback(() => {
    onView(todo);
  }, [todo, onView]);

  return (
    <div className="content-focus-item">
      {/* 顶部工具栏 */}
      <div className="content-focus-item-header">
        <Space>
          <Checkbox
            checked={todo.status === 'completed'}
            onChange={(e) => handleToggleComplete(e.target.checked)}
          >
            {todo.status === 'completed' ? '已完成' : '标记完成'}
          </Checkbox>
          
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={handleViewDetails}
          >
            查看详情
          </Button>
        </Space>

        {hasChanges && (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={isSaving}
          >
            保存
          </Button>
        )}
      </div>

      {/* 富文本编辑器 */}
      <div className="content-focus-item-editor">
        <RichTextEditor
          value={editedContent}
          onChange={setEditedContent}
          placeholder="编辑待办内容..."
          style={{ minHeight: '150px' }}
        />
      </div>

      {/* 分割线 */}
      {!isLast && <Divider className="content-focus-divider" />}
    </div>
  );
});

ContentFocusItem.displayName = 'ContentFocusItem';

// 主组件
const ContentFocusView: React.FC<ContentFocusViewProps> = ({
  todos,
  allTodos,
  onUpdate,
  onView,
  loading,
}) => {
  if (loading) {
    return (
      <div className="content-focus-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="content-focus-empty">
        <Empty description="暂无待办事项" />
      </div>
    );
  }

  return (
    <div className="content-focus-view">
      {todos.map((todo, index) => (
        <ContentFocusItem
          key={todo.id}
          todo={todo}
          onUpdate={onUpdate}
          onView={onView}
          isLast={index === todos.length - 1}
        />
      ))}
    </div>
  );
};

export default ContentFocusView;

