import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';

interface UseCompactTodoEditProps {
  todoId: string;
  initialTitle: string;
  onUpdate: (id: string, updates: any) => Promise<void>;
}

/**
 * 紧凑视图的标题编辑逻辑Hook
 * 处理标题的状态管理、输入验证、防抖保存、IPC集成
 */
export const useCompactTodoEdit = ({
  todoId,
  initialTitle,
  onUpdate,
}: UseCompactTodoEditProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isComposingRef = useRef(false); // 追踪输入法状态
  const lastSavedTitleRef = useRef(initialTitle); // 追踪最后保存的标题值
  const justSavedRef = useRef(false); // 追踪是否刚刚保存完成

  // 同步外部标题更新（仅在真正的外部修改时）
  useEffect(() => {
    // 如果刚刚保存完成，忽略 prop 更新（避免竞态条件）
    if (justSavedRef.current) {
      return;
    }

    // 只在以下条件都满足时才同步：
    // 1. initialTitle 与最后保存的值不同（真正的外部更新）
    // 2. 不在保存中
    // 3. 当前编辑值等于最后保存的值（确保不在编辑中）
    const isCurrentlyEditing = editedTitle !== lastSavedTitleRef.current;

    if (initialTitle !== lastSavedTitleRef.current && !isSaving && !isCurrentlyEditing) {
      setEditedTitle(initialTitle);
      lastSavedTitleRef.current = initialTitle;
    }
  }, [initialTitle, isSaving, editedTitle]);

  const validateTitle = useCallback((title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('标题不能为空');
    }
    if (trimmed.length > 200) {
      throw new Error('标题过长（最多200字符）');
    }
    return trimmed;
  }, []);

  const saveTitle = useCallback(async () => {
    if (!todoId) return;

    const trimmedTitle = validateTitle(editedTitle);
    if (trimmedTitle === lastSavedTitleRef.current) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(todoId, { title: trimmedTitle });
      lastSavedTitleRef.current = trimmedTitle; // 保存成功后立即更新 ref
      setEditedTitle(trimmedTitle); // 确保状态一致
      justSavedRef.current = true; // 标记刚刚保存完成
      setIsEditing(false);

      // 500ms 后清除标记（给 IPC 通信和 React 渲染足够时间）
      setTimeout(() => {
        justSavedRef.current = false;
      }, 500);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
      setEditedTitle(lastSavedTitleRef.current); // 恢复到最后保存的值
    } finally {
      setIsSaving(false);
    }
  }, [todoId, editedTitle, onUpdate, validateTitle]);

  // 智能保存调度函数 - 检查输入法状态并启动防抖保存
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
        saveTitle();
      }
    }, 1000);
  }, [saveTitle]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
    // 使用统一的保存调度函数
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 如果正在使用输入法，延迟保存等待输入法确认
    if (isComposingRef.current) {
      setTimeout(() => {
        if (!isComposingRef.current) {
          saveTitle();
        }
      }, 100);
    } else {
      saveTitle();
    }
  }, [saveTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditedTitle(lastSavedTitleRef.current);
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      saveTitle();
    }
  }, [saveTitle]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  // 输入法事件处理器
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    // 输入法结束后，重新启动防抖保存
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  return {
    isEditing,
    editedTitle,
    isSaving,
    handleChange,
    handleBlur,
    handleKeyDown,
    handleClick,
    handleCompositionStart,
    handleCompositionEnd,
  };
};