import { Todo } from '../../shared/types';
import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Divider, Button, Checkbox, Space, Spin, Empty, App } from 'antd';
import { SaveOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';

interface ContentFocusViewProps {
  todos: Todo[];
  allTodos?: Todo[];
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  loading: boolean;
}

// 暴露给父组件的方法
export interface ContentFocusViewRef {
  saveAll: () => Promise<void>;
}

// 单个待办项组件接口
interface ContentFocusItemProps {
  todo: Todo;
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  isLast: boolean;
}

// 暴露给父组件的方法
export interface ContentFocusItemRef {
  saveNow: () => Promise<void>;
}

// 单个待办项组件（使用 forwardRef 暴露保存方法）
const ContentFocusItem = React.memo(
  forwardRef<ContentFocusItemRef, ContentFocusItemProps>(({ todo, onUpdate, onView, isLast }, ref) => {
    const { message } = App.useApp();
    const [editedContent, setEditedContent] = useState<string>(todo.content);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
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

    // 保存内容（静默保存，不显示提示）
    const handleSave = useCallback(async () => {
      if (!hasChanges || !todo.id) return;
      
      // 如果内容与上次保存的内容相同，跳过保存
      if (editedContent === lastSavedContentRef.current) return;
      
      setIsSaving(true);
      try {
        await onUpdate(todo.id, { content: editedContent });
        // 更新最后保存的内容引用
        lastSavedContentRef.current = editedContent;
        // 静默保存，不显示提示
      } catch (error) {
        message.error('保存失败');
        console.error('Save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, [hasChanges, todo.id, editedContent, onUpdate, message]);

    // 暴露给父组件的保存方法
    useImperativeHandle(ref, () => ({
      saveNow: async () => {
        if (hasChanges && editedContent !== lastSavedContentRef.current) {
          // 清除防抖定时器
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          // 立即保存
          await handleSave();
        }
      }
    }), [hasChanges, editedContent, handleSave]);

    // 优化的自动保存：使用短防抖（1秒），避免频繁保存但不打断输入
    useEffect(() => {
      if (!hasChanges) {
        return;
      }

      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 设置新的定时器 - 1秒防抖，输入停止后自动保存
      saveTimeoutRef.current = setTimeout(() => {
        handleSave();
      }, 1000); // 1秒防抖，快速响应但不打断输入

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

    // 失去焦点时立即保存
    const handleBlur = useCallback(() => {
      if (hasChanges) {
        // 清除防抖定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // 立即保存
        handleSave();
      }
    }, [hasChanges, handleSave]);

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

          {/* 保存状态指示器 - 简化状态显示 */}
          <Space size={4}>
            {isSaving && (
              <span style={{ fontSize: 12, color: '#1890ff' }}>
                <SaveOutlined /> 保存中...
              </span>
            )}
            {!isSaving && !hasChanges && (
              <span style={{ fontSize: 12, color: '#52c41a' }}>
                <CheckCircleOutlined /> 已保存
              </span>
            )}
          </Space>
        </div>

        {/* 富文本编辑器 - 添加失去焦点保存 */}
        <div className="content-focus-item-editor" onBlur={handleBlur}>
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
  })
);

ContentFocusItem.displayName = 'ContentFocusItem';

// 主组件 - 使用 forwardRef 暴露保存所有的方法
const ContentFocusView = forwardRef<ContentFocusViewRef, ContentFocusViewProps>(({
  todos,
  allTodos,
  onUpdate,
  onView,
  loading,
}, ref) => {
  // 为每个待办项创建 ref
  const itemRefsMap = useRef<Map<number, ContentFocusItemRef>>(new Map());

  // 暴露给父组件的保存所有方法
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      const savePromises: Promise<void>[] = [];
      itemRefsMap.current.forEach((itemRef) => {
        if (itemRef && itemRef.saveNow) {
          savePromises.push(itemRef.saveNow());
        }
      });
      await Promise.all(savePromises);
    }
  }), []);

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
          ref={(itemRef) => {
            if (itemRef && todo.id) {
              itemRefsMap.current.set(todo.id, itemRef);
            }
          }}
          todo={todo}
          onUpdate={onUpdate}
          onView={onView}
          isLast={index === todos.length - 1}
        />
      ))}
    </div>
  );
});

ContentFocusView.displayName = 'ContentFocusView';

export default ContentFocusView;

