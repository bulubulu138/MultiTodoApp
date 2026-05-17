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

  // 同步外部标题更新
  useEffect(() => {
    if (!isEditing) {
      setEditedTitle(initialTitle);
    }
  }, [initialTitle, isEditing]);

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
    if (trimmedTitle === initialTitle) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(todoId, { title: trimmedTitle });
      setIsEditing(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
      setEditedTitle(initialTitle); // 恢复原值
    } finally {
      setIsSaving(false);
    }
  }, [todoId, editedTitle, initialTitle, onUpdate, validateTitle]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);

    // 防抖保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTitle();
    }, 1000);
  }, [saveTitle]);

  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTitle();
  }, [saveTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditedTitle(initialTitle);
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      saveTitle();
    }
  }, [initialTitle, saveTitle]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  return {
    isEditing,
    editedTitle,
    isSaving,
    handleChange,
    handleBlur,
    handleKeyDown,
    handleClick,
  };
};