import { Todo } from '../../shared/types';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Divider, Button, Checkbox, Space, Spin, Empty, App } from 'antd';
import { SaveOutlined, EyeOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
  const [isPending, setIsPending] = useState(false); // 等待保存状态（防抖倒计时中）
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加输入状态追踪，避免在用户输入时触发保存
  const isEditingRef = useRef(false);
  const lastSavedContentRef = useRef(todo.content);

  // 同步外部更新的 todo.content（仅在保存完成后更新）
  useEffect(() => {
    // 只有当外部内容变化且不是由当前组件保存触发时，才更新本地状态
    if (todo.content !== lastSavedContentRef.current && !isSaving) {
      setEditedContent(todo.content);
      lastSavedContentRef.current = todo.content;
    }
  }, [todo.content, isSaving]);

  // 检查内容是否被修改
  const hasChanges = useMemo(() => {
    return editedContent !== lastSavedContentRef.current;
  }, [editedContent]);

  // 保存内容
  const handleSave = useCallback(async () => {
    if (!hasChanges || !todo.id) return;
    
    // 如果内容与上次保存的内容相同，跳过保存
    if (editedContent === lastSavedContentRef.current) return;
    
    setIsSaving(true);
    try {
      await onUpdate(todo.id, { content: editedContent });
      // 更新最后保存的内容引用
      lastSavedContentRef.current = editedContent;
      // 自动保存使用更轻量的提示
      message.success({ content: '已自动保存', duration: 1 });
    } catch (error) {
      message.error('保存失败');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, todo.id, editedContent, onUpdate, message]);

  // 优化的自动保存：增加防抖延迟，减少对用户输入的干扰
  useEffect(() => {
    if (!hasChanges) {
      setIsPending(false); // 没有改动，清除等待状态
      return;
    }

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsPending(true); // 设置等待保存状态

    // 设置新的定时器 - 增加到 3 秒，避免频繁打断用户输入
    saveTimeoutRef.current = setTimeout(() => {
      setIsPending(false); // 开始保存，清除等待状态
      handleSave();
    }, 3000); // 3秒防抖延迟，给用户充足的连续输入时间

    // 清理函数：组件卸载或内容再次变化时清除定时器
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedContent, hasChanges, handleSave]);

  // 组件卸载时保存未保存的更改
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // 如果有未保存的更改，立即保存
      // 注意：这里使用 ref 获取最新值，避免闭包问题
      const currentContent = editedContent;
      const currentTodoId = todo.id;
      if (currentContent !== todo.content && currentTodoId) {
        onUpdate(currentTodoId, { content: currentContent });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在组件卸载时执行

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

        {/* 保存状态指示器 */}
        <Space size={4}>
          {isSaving && (
            <span style={{ fontSize: 12, color: '#1890ff' }}>
              <SaveOutlined /> 保存中...
            </span>
          )}
          {!isSaving && isPending && (
            <span style={{ fontSize: 12, color: '#52c41a' }}>
              <ClockCircleOutlined /> 等待保存...
            </span>
          )}
          {!isSaving && !isPending && hasChanges && (
            <span style={{ fontSize: 12, color: '#faad14' }}>
              未保存
            </span>
          )}
        </Space>
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

