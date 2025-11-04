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
    const isComposingRef = useRef(false); // 追踪输入法状态
    
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

    // 智能保存调度函数 - 检查输入法状态
    const scheduleAutoSave = useCallback(() => {
      // 如果正在使用输入法，直接返回，不调度保存
      if (isComposingRef.current) {
        return;
      }

      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 设置新的保存定时器 - 1秒防抖
      saveTimeoutRef.current = setTimeout(() => {
        // 再次检查输入法状态（防止在定时器执行时正在使用输入法）
        if (!isComposingRef.current) {
          handleSave();
        }
      }, 1000);
    }, [handleSave]);

    // 暴露给父组件的保存方法
    useImperativeHandle(ref, () => ({
      saveNow: async () => {
        if (hasChanges && editedContent !== lastSavedContentRef.current) {
          // 清除防抖定时器
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          // 立即保存（即使在输入法状态也保存，因为是用户主动触发）
          await handleSave();
        }
      }
    }), [hasChanges, editedContent, handleSave]);

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
        status: newStatus
        // 注意：completedAt 和 updatedAt 由数据库层自动处理
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

    // 输入法开始事件
    const handleCompositionStart = useCallback(() => {
      console.log('[AutoSave] 输入法开始');
      isComposingRef.current = true;
      
      // 清除所有待触发的保存定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }, []);

    // 输入法结束事件
    const handleCompositionEnd = useCallback(() => {
      console.log('[AutoSave] 输入法结束');
      isComposingRef.current = false;
      
      // 输入法结束后，重新启动防抖保存
      scheduleAutoSave();
    }, [scheduleAutoSave]);

    // 内容变化处理
    const handleContentChange = useCallback((content: string) => {
      // 立即更新本地内容（不影响输入）
      setEditedContent(content);
      
      // 只在非输入法状态下启动保存调度
      if (!isComposingRef.current) {
        scheduleAutoSave();
      }
      // 如果在输入法状态，不做任何保存操作
    }, [scheduleAutoSave]);

    // 失去焦点时立即保存
    const handleBlur = useCallback(() => {
      // 失去焦点时，如果不在输入法状态且有更改，立即保存
      if (!isComposingRef.current && hasChanges) {
        // 清除防抖定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // 立即保存
        handleSave();
      }
    }, [hasChanges, handleSave]);

    // 键盘事件处理 - Ctrl+S / Cmd+S 手动保存
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      // 检测 Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认的保存行为
        
        // 立即保存（即使在输入法状态也保存）
        if (hasChanges) {
          // 清除自动保存定时器
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          
          // 立即保存
          handleSave();
          
          // 显示保存提示
          message.success('已手动保存', 1);
        } else {
          message.info('没有需要保存的更改', 1);
        }
      }
    }, [hasChanges, handleSave, message]);

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

        {/* 富文本编辑器 - 添加输入法事件、失去焦点保存和键盘快捷键 */}
        <div 
          className="content-focus-item-editor" 
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <RichTextEditor
            value={editedContent}
            onChange={handleContentChange}
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

