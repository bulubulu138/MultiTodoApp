import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Divider, Button, Checkbox, Space, Spin, Empty, App, Input, InputNumber, Tag, Tooltip } from 'antd';
import { SaveOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import MilkdownEditorWrapper, { MilkdownEditorRef } from './MilkdownEditor';
import RelationIndicators from './RelationIndicators';
import { formatCompletedTime } from '../utils/timeFormatter';
import { ColorTheme } from '../theme/themes';
import { useOrderEdit } from '../hooks/useOrderEdit';
import { useThemeColors } from '../hooks/useThemeColors';
import { getDeadlineDisplay } from '../utils/deadlineFormatter';
import dayjs from 'dayjs';

interface ContentFocusViewProps {
  todos: Todo[];
  allTodos?: Todo[];
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void | Promise<void>;
  loading: boolean;
  activeTab: string;
  relations: TodoRelation[];
  onUpdateDisplayOrder: (todoId: string, tabKey: string, displayOrder: number) => Promise<void>;
  onUpdateDisplayOrders?: (updates: Array<{uuid: string, tabKey: string, displayOrder: number}>) => Promise<void>;
  colorTheme?: ColorTheme;
}

// 暴露给父组件的方法
export interface ContentFocusViewRef {
  saveAll: () => Promise<void>;
}


// 单个待办项组件接口
interface ContentFocusItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void | Promise<void>;
  isLast: boolean;
  activeTab: string;
  sortedTodos: Todo[];
  allTodos: Todo[];
  relations: TodoRelation[];
  parallelGroup?: Set<string>;
  parallelGroupsMap?: Map<string, Set<string>>;
  prevTodo: Todo | null;
  nextTodo: Todo | null;
  onUpdateDisplayOrder: (todoId: string, tabKey: string, displayOrder: number) => Promise<void>;
  onUpdateDisplayOrders?: (updates: Array<{uuid: string, tabKey: string, displayOrder: number}>) => Promise<void>;
}

// 暴露给父组件的方法
export interface ContentFocusItemRef {
  saveNow: () => Promise<void>;
}

// 单个待办项组件（使用 forwardRef 暴露保存方法）
const ContentFocusItem = React.memo(
  forwardRef<ContentFocusItemRef, ContentFocusItemProps>(({
    todo,
    onUpdate,
    onView,
    isLast,
    activeTab,
    sortedTodos,
    allTodos,
    relations,
    parallelGroup,
    parallelGroupsMap,
    prevTodo,
    nextTodo,
    onUpdateDisplayOrder,
    onUpdateDisplayOrders,
  }, ref) => {
    const { message } = App.useApp();
    const colors = useThemeColors();
    const [editedContent, setEditedContent] = useState<string>(todo.content);
    const [editedTitle, setEditedTitle] = useState<string>(todo.title);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isComposingRef = useRef(false); // 追踪输入法状态
    const editorRef = useRef<MilkdownEditorRef>(null);
    const editorFocusedRef = useRef(false); // 🔥 新增：追踪编辑器焦点状态
    const editorReadyRef = useRef(false); // 🔥 新增：追踪编辑器初始化状态，防止在初始化过程中触发同步

    // 使用共享的序号编辑 Hook
    const {
      editingOrder,
      setEditingOrder,
      savingOrder,
      handleOrderSave,
    } = useOrderEdit({
      todo,
      activeTab,
      sortedTodos,
      parallelGroupsMap,
      onUpdateDisplayOrder,
      onUpdateDisplayOrders,
    });

    const lastSavedContentRef = useRef(todo.content);
    const lastSavedTitleRef = useRef(todo.title);
    const currentProcessingTodoRef = useRef<string | null>(null); // 追踪当前正在处理的todoId

    // 用于存储最新的值，避免组件卸载时的闭包陷阱
    const latestTitleRef = useRef(editedTitle);
    const latestTodoIdRef = useRef(todo.id);

    // 同步最新值到 ref
    useEffect(() => {
      latestTitleRef.current = editedTitle;
    }, [editedTitle]);

    useEffect(() => {
      latestTodoIdRef.current = todo.id;
    }, [todo.id]);

    // 🔥 关键修复：当todo.id变化时，完全重置组件状态
    // 这确保了tab切换后，用户看到的始终是当前todo的最新内容
    useEffect(() => {
      console.log('[ContentFocusItem] Resetting state for todo change', {
        todoId: todo.id,
        status: todo.status,
        contentPreview: todo.content.substring(0, 50) + '...',
        title: todo.title,
        updatedAt: todo.updatedAt
      });

      // 1. 清理所有定时器（防止保存到错误的todo）
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }

      // 2. 重置所有状态为新todo的值
      setEditedContent(todo.content);
      setEditedTitle(todo.title);
      setIsSaving(false);
      setIsSavingTitle(false);

      // 3. 重置所有refs（关键！）
      lastSavedContentRef.current = todo.content;
      lastSavedTitleRef.current = todo.title;
      editorFocusedRef.current = false;
      editorReadyRef.current = false;
      isComposingRef.current = false;
      currentProcessingTodoRef.current = null;

      // 4. 重置编辑器就绪状态（延迟设置，确保编辑器完全初始化）
      const readyTimer = setTimeout(() => {
        editorReadyRef.current = true;
      }, 200);

      // 5. 清理函数
      return () => {
        clearTimeout(readyTimer);
      };
    }, [todo.id, todo.content, todo.title, todo.status, todo.updatedAt])

    // 🔥 关键修复：同步外部更新的 todo.content（仅在编辑器失焦且初始化完成后才同步）
    // 注意：
    // - todo.id变化时的完全重置由上面的集中重置useEffect处理
    // - 这里只处理同一个todo的增量同步（例如在TodoViewDrawer中修改了内容）
    // 只在以下情况下才同步外部value到编辑器：
    useEffect(() => {
      // 1. 外部内容确实发生了变化（todo.content !== lastSavedContentRef.current）
      // 2. 当前不在保存中（!isSaving）
      // 3. **编辑器不在焦点状态**（!editorFocusedRef.current）← 这是关键！
      // 4. 用户不在编辑中（!isCurrentlyEditing）
      // 5. **编辑器已完全初始化**（editorReadyRef.current）← 新增！防止在初始化过程中触发同步
      //
      // 这样可以防止编辑期间的外部value同步破坏Quill的history栈，
      // 特别是在撤销操作期间，外部value同步会覆盖撤销结果
      // 同时防止在编辑器初始化过程中触发同步，避免无限加载循环
      const isCurrentlyEditing = editedContent !== lastSavedContentRef.current;

      if (todo.content !== lastSavedContentRef.current && !isSaving && !isCurrentlyEditing && !editorFocusedRef.current && editorReadyRef.current) {
        setEditedContent(todo.content);
        lastSavedContentRef.current = todo.content;
      }

      // 🔧 新增：开发环境下的数据一致性检查
      if (process.env.NODE_ENV === 'development') {
        if (todo.content !== editedContent && !isSaving && !editorFocusedRef.current && !isCurrentlyEditing && editorReadyRef.current) {
          console.warn('[ContentFocusView] Potential data inconsistency detected:', {
            todoId: todo.id,
            todoContentPreview: todo.content.substring(0, 50) + '...',
            editedContentPreview: editedContent.substring(0, 50) + '...',
            isSaving,
            editorFocused: editorFocusedRef.current,
            isCurrentlyEditing
          });
        }
      }
    }, [todo.content, isSaving, editedContent]);

    // 同步外部更新的 todo.title（仅在保存完成后更新）
    // 注意：
    // - todo.id变化时的完全重置由上面的集中重置useEffect处理
    // - 这里只处理同一个todo的增量同步
    useEffect(() => {
      // 添加额外检查：如果当前正在编辑标题，不覆盖
      const isCurrentlyEditing = editedTitle !== lastSavedTitleRef.current;

      if (todo.title !== lastSavedTitleRef.current && !isSavingTitle && !isCurrentlyEditing) {
        setEditedTitle(todo.title);
        lastSavedTitleRef.current = todo.title;
      }

      // 🔧 新增：开发环境下的数据一致性检查
      if (process.env.NODE_ENV === 'development') {
        if (todo.title !== editedTitle && !isSavingTitle && !isCurrentlyEditing) {
          console.warn('[ContentFocusView] Title data inconsistency detected:', {
            todoId: todo.id,
            todoTitle: todo.title,
            editedTitle: editedTitle,
            isSavingTitle,
            isCurrentlyEditing
          });
        }
      }
    }, [todo.title, isSavingTitle, editedTitle]);

    const getLatestContent = useCallback(() => {
      return editorRef.current?.getMarkdown() ?? editedContent;
    }, [editedContent]);

    // 检查内容是否被修改
    const hasChanges = useMemo(() => {
      return editedContent !== lastSavedContentRef.current;
    }, [editedContent]);

    // 保存内容（静默保存，不显示提示）
    const handleSave = useCallback(async () => {
      if (!todo.id) return;

      const latestContent = getLatestContent();
      if (latestContent === lastSavedContentRef.current) return;

      setIsSaving(true);
      try {
        await onUpdate(todo.id, { content: latestContent });
        // 更新最后保存的内容引用
        lastSavedContentRef.current = latestContent;
        setEditedContent(latestContent);
        // 静默保存，不显示提示
      } catch (error) {
        message.error('保存失败');
        console.error('Save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, [todo.id, getLatestContent, onUpdate, message]);

    // 🔧 新增：监听isSaving状态变化，在保存完成后检查是否需要补偿同步
    useEffect(() => {
      // 当isSaving从true变为false时，检查是否有待同步的外部更新
      if (!isSaving && todo.content !== lastSavedContentRef.current) {
        const isCurrentlyEditing = editedContent !== lastSavedContentRef.current;

        // 如果编辑器不在焦点状态且用户未在编辑，执行补偿同步
        if (!editorFocusedRef.current && !isCurrentlyEditing && editorReadyRef.current) {
          console.log('[ContentFocusView] Compensation sync triggered after save completed', {
            todoId: todo.id,
            externalContent: todo.content.substring(0, 50) + '...',
            currentEditedContent: editedContent.substring(0, 50) + '...'
          });

          // 使用短延迟确保在当前渲染周期结束后再同步，避免状态更新冲突
          const compensationTimer = setTimeout(() => {
            // 再次检查条件，确保在延迟期间状态没有变化
            if (todo.content !== lastSavedContentRef.current && !editorFocusedRef.current) {
              setEditedContent(todo.content);
              lastSavedContentRef.current = todo.content;
              console.log('[ContentFocusView] Compensation sync completed', { todoId: todo.id });
            }
          }, 100); // 100ms延迟

          return () => clearTimeout(compensationTimer);
        }
      }
    }, [isSaving, todo.content, todo.id, editedContent]);

    // 保存标题（防抖）
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newTitle = e.target.value;
      setEditedTitle(newTitle);

      // 清除之前的定时器
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }

      // ⭐ 如果正在使用输入法，不调度保存
      if (isComposingRef.current) {
        return;
      }

      // 设置防抖保存（1秒）
      titleSaveTimeoutRef.current = setTimeout(async () => {
        // ⭐ 再次检查输入法状态（防止在定时器执行时正在使用输入法）
        if (isComposingRef.current) {
          return;
        }

        if (newTitle !== lastSavedTitleRef.current && newTitle.trim() && todo.id) {
          setIsSavingTitle(true);
          try {
            await onUpdate(todo.id, { title: newTitle.trim() });
            lastSavedTitleRef.current = newTitle.trim();
            setEditedTitle(newTitle.trim());
          } catch (error) {
            message.error('标题保存失败');
            console.error('Title save error:', error);
            // 恢复原标题
            setEditedTitle(lastSavedTitleRef.current);
          } finally {
            setIsSavingTitle(false);
          }
        }
      }, 1000);
    }, [todo.id, onUpdate, message]);

    // 失去焦点时立即保存标题
    const handleTitleBlur = useCallback(async () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }

      const trimmedTitle = editedTitle.trim();
      if (trimmedTitle !== lastSavedTitleRef.current && trimmedTitle && todo.id) {
        try {
          await onUpdate(todo.id, { title: trimmedTitle });
          lastSavedTitleRef.current = trimmedTitle;
          setEditedTitle(trimmedTitle);
        } catch {
          message.error('标题保存失败');
          setEditedTitle(lastSavedTitleRef.current);
        }
      }
    }, [editedTitle, todo.id, onUpdate, message]);

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

      // 设置新的保存定时器 - 2.5秒防抖，减少频繁保存提升性能
      saveTimeoutRef.current = setTimeout(() => {
        // 再次检查输入法状态（防止在定时器执行时正在使用输入法）
        if (!isComposingRef.current) {
          handleSave();
        }
      }, 2500); // 增加到2.5秒，减少保存频率
    }, [handleSave]);

    // 暴露给父组件的保存方法
    useImperativeHandle(ref, () => ({
      saveNow: async () => {
        // 清除防抖定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // 立即保存（即使在输入法状态也保存，因为是用户主动触发）
        await handleSave();
      },
    }), [handleSave]);

    // 注入"开始"按钮的CSS样式
    useEffect(() => {
      const styles = `
        .start-task-button {
          cursor: pointer;
        }

        .start-task-button:active {
          transform: scale(0.95) !important;
        }

        .start-task-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;

      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);

      return () => {
        document.head.removeChild(styleElement);
      };
    }, []);

    // 组件卸载时保存未保存的更改
    useEffect(() => {
      return () => {
        // 🔥 关键修复：清除编辑器焦点状态
        editorFocusedRef.current = false;

        // 清除定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        if (titleSaveTimeoutRef.current) {
          clearTimeout(titleSaveTimeoutRef.current);
        }

        // 清除当前处理的todoId标志
        if (currentProcessingTodoRef.current === todo.id) {
          currentProcessingTodoRef.current = null;
        }

        // 保存内容（同步，不等待）
        const currentContent = editorRef.current?.getMarkdown() ?? lastSavedContentRef.current;
        const currentTodoId = latestTodoIdRef.current;
        if (currentContent !== lastSavedContentRef.current && currentTodoId) {
          onUpdate(currentTodoId, { content: currentContent });
        }

        // 保存标题（同步，不等待）
        const currentTitle = typeof latestTitleRef.current === 'string'
          ? latestTitleRef.current.trim()
          : String(latestTitleRef.current || '').trim();
        if (currentTitle !== lastSavedTitleRef.current && currentTitle && currentTodoId) {
          onUpdate(currentTodoId, { title: currentTitle });
        }
      };
    }, [todo.id]); // 添加todo.id依赖以确保正确的标识

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

    // 开始任务（从待办池到今日事）
    const handleStartTask = useCallback(async () => {
      if (!todo.id || todo.status !== 'pending') return;

      try {
        // 更新状态为"今日事"
        await onUpdate(todo.id, { status: 'in_progress' });

        // 显示Toast提示
        message.success('🎯 任务已进入"今日事"');

        // 不自动切换tab，保持当前视图
      } catch (error) {
        message.error('启动任务失败');
        console.error('Start task error:', error);
      }
    }, [todo.id, onUpdate, message]);

    // 查看详情
    const handleViewDetails = useCallback(() => {
      onView(todo);
    }, [todo, onView]);

    // 输入法开始事件
    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true;

      // 在容器上设置 composition 状态标记
      const container = document.querySelector(`[data-todo-id="${todo.id}"]`);
      if (container) {
        container.setAttribute('data-composing', 'true');
      }

      // 清除所有待触发的保存定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }, [todo.id]);

    // 输入法结束事件
    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false;

      // 移除容器上的 composition 状态标记
      const container = document.querySelector(`[data-todo-id="${todo.id}"]`);
      if (container) {
        container.removeAttribute('data-composing');
      }

      // 输入法结束后，重新启动防抖保存
      scheduleAutoSave();
    }, [todo.id, scheduleAutoSave]);

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
      // 🔥 关键修复：清除编辑器焦点状态
      editorFocusedRef.current = false;

      // 失去焦点时，如果不在输入法状态，立即保存最新内容
      if (!isComposingRef.current) {
        // 清除防抖定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // 立即保存
        handleSave();
      }
    }, [handleSave, todo.id]);

    // 保留原有函数名以兼容可能的引用（内部实现改为调用新函数）
    const handleFocus = useCallback(() => {
      // 🔥 关键修复：设置编辑器焦点状态
      editorFocusedRef.current = true;
    }, [todo.id]);

    const handleClick = useCallback(() => {
      // 直接聚焦，不触发激活逻辑
      if (editorRef.current && typeof editorRef.current.focus === 'function') {
        try {
          editorRef.current.focus();
        } catch (error) {
          console.warn('[EditorClick] Failed to focus on click:', error);
        }
      }
    }, [editorRef]);

    // 键盘事件处理 - Ctrl+S / Cmd+S 手动保存
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      // 在输入法期间阻止空格键的默认滚动行为
      if (isComposingRef.current && event.key === ' ') {
        event.preventDefault();
        // 🔥 关键修复：移除 stopPropagation 和 return，让 Ctrl+Z 等其他键盘事件能够传播到编辑器
      }

      // 检测 Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认的保存行为

        const latestContent = getLatestContent();

        // 立即保存（即使在输入法状态也保存）
        if (latestContent !== lastSavedContentRef.current) {
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
    }, [getLatestContent, handleSave, message]);

    // 计算分组边界和并列关系
    const isInParallelGroup = parallelGroup && parallelGroup.size > 1;
    const isInGroup = isInParallelGroup && (
      (prevTodo && parallelGroup?.has(prevTodo.id)) ||
      (nextTodo && parallelGroup?.has(nextTodo.id))
    );
    const isGroupStart = isInGroup && (!prevTodo || !parallelGroup?.has(prevTodo.id));
    const isGroupEnd = isInGroup && (!nextTodo || !parallelGroup?.has(nextTodo.id));
    
    // 检查是否有并列关系
    const hasParallel = relations.some(r => 
      r.relation_type === 'parallel' && 
      (r.source_id === todo.id || r.target_id === todo.id)
    );
    
    // 获取当前显示的序号
    const currentDisplayOrder = editingOrder !== undefined 
      ? editingOrder 
      : (todo.displayOrders && todo.displayOrders[activeTab]);

    return (
      <div
        className="content-focus-item"
        data-todo-id={todo.id}
        data-group-start={isGroupStart}
        data-group-end={isGroupEnd}
        data-in-group={isInGroup}
        style={{
          borderTop: isGroupStart ? '2px dashed var(--group-border-color, #fa8c16)' : undefined,
          borderBottom: isGroupEnd ? '2px dashed var(--group-border-color, #fa8c16)' : undefined,
          borderLeft: isInGroup ? '3px solid var(--group-border-color, #fa8c16)' : undefined,
          borderRight: isInGroup ? '3px solid var(--group-border-bg, rgba(250, 140, 22, 0.3))' : undefined,
          paddingTop: isGroupStart ? 12 : 0,
          paddingBottom: isGroupEnd ? 12 : 0,
          paddingLeft: isInGroup ? 12 : 0,
          paddingRight: isInGroup ? 12 : 0,
        }}
      >
        {/* 顶部工具栏 */}
        <div className="content-focus-item-header">
          <Space>
            {/* 完成时间显示 */}
            {todo.status === 'completed' && todo.completedAt && (
              <span style={{ fontSize: 11, color: colors.successColor }}>
                {formatCompletedTime(todo.completedAt)}完成
              </span>
            )}
            
            {/* 并列待办标识 */}
            {hasParallel && (
              <Tag color="orange" style={{ margin: 0, fontSize: 12 }}>
                并列
              </Tag>
            )}
            
            {/* 分组标签 */}
            {isGroupStart && isInGroup && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
                并列分组
              </Tag>
            )}
            
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={handleViewDetails}
            >
              查看详情
            </Button>
            
            {/* 关联指示器 */}
            {todo.id && (
              <RelationIndicators
                todoId={todo.id}
                relations={relations}
                allTodos={allTodos}
                size="small"
                showLabels={false}
                onViewRelations={handleViewDetails}
              />
            )}

            {/* 时间编辑器 */}
            <TimeDisplay
              todo={todo}
            />
          </Space>

          {/* 右侧：排序序号 + 保存状态 */}
          <Space size={8}>
            {/* 排序序号 */}
            <Space size={4} style={{ fontSize: 12 }}>
              <span style={{ color: colors.textMuted }}>序号:</span>
              {editingOrder !== undefined ? (
                <Tooltip title={
                  isInGroup && !isGroupStart 
                    ? "分组内待办的序号由第一个待办统一控制" 
                    : "输入序号后按回车或点击其他地方保存"
                }>
                  <InputNumber
                    size="small"
                    value={editingOrder}
                    onChange={(value) => setEditingOrder(value ?? undefined)}
                    onPressEnter={handleOrderSave}
                    onBlur={handleOrderSave}
                    min={0}
                    disabled={savingOrder || !!(isInGroup && !isGroupStart)}
                    style={{ 
                      width: 70,
                      opacity: (isInGroup && !isGroupStart) ? 0.5 : 1
                    }}
                    placeholder="设置序号"
                  />
                </Tooltip>
              ) : (
                <Tooltip title={
                  isInGroup && !isGroupStart 
                    ? "分组内待办的序号由第一个待办统一控制" 
                    : "点击编辑序号"
                }>
                  <span 
                    onClick={() => {
                      if (!!(isInGroup && !isGroupStart)) {
                        return; // 禁用点击
                      }
                      // 如果当前没有序号，设置为 0 作为默认值
                      setEditingOrder(currentDisplayOrder ?? 0);
                    }}
                    style={{ 
                      cursor: !!(isInGroup && !isGroupStart) ? 'not-allowed' : 'pointer', 
                      color: currentDisplayOrder !== undefined ? colors.infoColor : colors.textMuted,
                      opacity: !!(isInGroup && !isGroupStart) ? 0.5 : 1,
                    minWidth: 20,
                    textAlign: 'center',
                    display: 'inline-block'
                  }}
                >
                  {currentDisplayOrder ?? '-'}
                </span>
                </Tooltip>
              )}
            </Space>
            
            {/* 保存状态指示器 */}
            {(isSaving || isSavingTitle) && (
              <span style={{ fontSize: 12, color: colors.infoColor }}>
                <SaveOutlined /> 保存中...
              </span>
            )}
            {!isSaving && !isSavingTitle && !hasChanges && !savingOrder && (
              <span style={{ fontSize: 12, color: colors.successColor }}>
                <CheckCircleOutlined /> 已保存
              </span>
            )}
            {savingOrder && (
              <span style={{ fontSize: 12, color: '#1890ff' }}>
                <SaveOutlined /> 保存序号...
              </span>
            )}
          </Space>
        </div>

        {/* 主内容区：复选框 + 标题输入框 + 编辑器 */}
        <div className="content-focus-item-main">
          {/* 完成状态复选框或开始按钮 */}
          {activeTab === 'pending' && todo.status === 'pending' ? (
            // 待办池中的pending任务显示"开始"按钮
            <Button
              className="start-task-button"
              shape="circle"
              icon={<PlayCircleOutlined />}
              onClick={handleStartTask}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
              }}
            />
          ) : (
            // 其他情况显示原有checkbox
            <Checkbox
              className="content-focus-checkbox"
              checked={todo.status === 'completed'}
              onChange={(e) => handleToggleComplete(e.target.checked)}
            />
          )}

          {/* 标题和内容区域 */}
          <div className="content-focus-item-content">
            {/* 可编辑标题输入框 */}
            <Input.TextArea
              value={editedTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="待办标题..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              className="content-focus-title-input"
              disabled={isSavingTitle}
            />

            {/* 富文本编辑器 - 添加输入法事件、失去焦点保存和键盘快捷键 */}
            <div
              className="content-focus-item-editor"
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={handleBlur}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              tabIndex={-1}
              style={{ cursor: 'text' }}
            >
            <MilkdownEditorWrapper
              ref={editorRef}
              value={editedContent}
              onChange={handleContentChange}
              minHeight="3em"
            />
            </div>
          </div>
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
  activeTab,
  relations,
  onUpdateDisplayOrder,
  onUpdateDisplayOrders,
  colorTheme,
}, ref) => {
  // 为每个待办项创建 ref
  const itemRefsMap = useRef<Map<string, ContentFocusItemRef>>(new Map());

  // 使用 DFS 构建并列关系分组 Map（复用自TodoList）
  const parallelGroups = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    const visited = new Set<string>();

    const dfs = (todoId: string, groupSet: Set<string>) => {
      if (visited.has(todoId)) return;
      visited.add(todoId);
      groupSet.add(todoId);

      // 找到所有与该 todo 有并列关系的其他 todo
      const relatedIds = relations
        .filter(r => r.relation_type === 'parallel')
        .filter(r => r.source_id === todoId || r.target_id === todoId)
        .map(r => String(r.source_id) === todoId ? String(r.target_id) : String(r.source_id));

      for (const relatedId of relatedIds) {
        dfs(relatedId, groupSet);
      }
    };
    
    // 为每个有并列关系的 todo 构建分组
    todos.forEach(todo => {
      if (!todo.id) return;

      const hasParallel = relations.some(r =>
        r.relation_type === 'parallel' &&
        (r.source_id === todo.id || r.target_id === todo.id)
      );

      if (hasParallel && !visited.has(todo.id)) {
        const groupSet = new Set<string>();
        dfs(todo.id, groupSet);

        // 将这个分组应用到所有成员
        groupSet.forEach(id => {
          groups.set(id, groupSet);
        });
      }
    });
    
    return groups;
  }, [relations, todos]);

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
        <Spin size="large" />
        <div style={{ marginTop: 8 }}>加载中...</div>
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
    <div style={{ display: 'flex', height: '100%', flexDirection: 'row', minHeight: 0 }}>
      {/* 主内容区 */}
      <div className="content-focus-scroll-area" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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
              activeTab={activeTab}
              sortedTodos={todos}
              allTodos={allTodos || todos}
              relations={relations}
              parallelGroup={parallelGroups.get(todo.id)}
              parallelGroupsMap={parallelGroups}
              prevTodo={index > 0 ? todos[index - 1] : null}
              nextTodo={index < todos.length - 1 ? todos[index + 1] : null}
              onUpdateDisplayOrder={onUpdateDisplayOrder}
              onUpdateDisplayOrders={onUpdateDisplayOrders}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

ContentFocusView.displayName = 'ContentFocusView';

// 时间只读展示组件
interface TimeDisplayProps {
  todo: Todo;
}

// 🔧 修复：自定义memo比较函数，确保deadline变化时能触发重渲染
const TimeDisplayMemoComparator = (
  prevProps: TimeDisplayProps,
  nextProps: TimeDisplayProps
) => {
  // 只比较deadline字段，忽略其他todo字段的变化
  // 返回true表示props相等（不重渲染），返回false表示props不同（需要重渲染）
  return prevProps.todo.deadline === nextProps.todo.deadline;
};

const TimeDisplay: React.FC<TimeDisplayProps> = React.memo(({ todo }) => {
  // 只显示截止时间，使用相对时间格式
  if (!todo.deadline) return null;

  const deadlineInfo = getDeadlineDisplay(todo.deadline);

  return (
    <Tag
      icon={<ClockCircleOutlined />}
      style={{
        margin: 0,
        color: deadlineInfo.color,
        borderColor: deadlineInfo.color,
        backgroundColor: deadlineInfo.isOverdue ? (document.documentElement.dataset.theme === 'dark' ? 'rgba(248, 113, 113, 0.14)' : '#fff1f0') : 'transparent'
      }}
    >
      {deadlineInfo.text}
    </Tag>
  );
}, TimeDisplayMemoComparator);

export default ContentFocusView;

