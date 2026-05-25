import { Todo } from '../../shared/types';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, Select, Button, Space, Divider, message, Spin, Tag, Modal } from 'antd';
import { SaveOutlined, CloseOutlined, CheckOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import MilkdownEditorWrapper, { MilkdownEditorRef } from './MilkdownEditor';
import dayjs from 'dayjs';

const { Option } = Select;

interface InlineEditPanelProps {
  todo: Todo;
  allTodos: Todo[];
  onUpdate: (updates: Partial<Todo>) => Promise<void>;
  onCancel: () => void;
  onExit: () => void; // 保存并退出编辑模式
  onUnsavedChange?: (hasChanges: boolean) => void; // 新增：未保存状态变化回调
  isSaving: boolean;
}

/**
 * 内联编辑面板组件
 * 用于TodoViewDrawer中的编辑模式，提供完整的待办编辑功能
 */
const InlineEditPanel: React.FC<InlineEditPanelProps> = ({
  todo,
  allTodos,
  onUpdate,
  onCancel,
  onExit,
  onUnsavedChange,
  isSaving
}) => {
  const [editedTitle, setEditedTitle] = useState(todo.title);
  const [editedStatus, setEditedStatus] = useState(todo.status);
  const [editedPriority, setEditedPriority] = useState(todo.priority);
  const [editedTags, setEditedTags] = useState<string[]>(
    todo.tags ? todo.tags.split(',').filter(tag => tag.trim()) : []
  );
  const [editedContent, setEditedContent] = useState(todo.content || '');
  const [inputTag, setInputTag] = useState('');

  const richEditorRef = useRef<MilkdownEditorRef>(null);
  const isComposingRef = useRef(false);

  // 🔧 新增：未保存状态追踪
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 🔧 新增：保存状态提示
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved'>('unsaved');

  // 🔧 新增：检查是否有未保存的更改
  const checkUnsavedChanges = useCallback(() => {
    const hasChanges =
      editedTitle !== todo.title ||
      editedStatus !== todo.status ||
      editedPriority !== todo.priority ||
      editedTags.join(',') !== (todo.tags || '') ||
      editedContent !== (todo.content || '');

    setHasUnsavedChanges(hasChanges);

    // 🔧 新增：通知父组件未保存状态变化
    if (onUnsavedChange) {
      onUnsavedChange(hasChanges);
    }

    return hasChanges;
  }, [editedTitle, editedStatus, editedPriority, editedTags, editedContent, todo, onUnsavedChange]);

  // 🔧 新增：内容变化时更新未保存状态
  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, []);

  // 🔧 新增：标题变化时更新未保存状态
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, []);

  // 🔧 新增：状态变化时更新未保存状态
  const handleStatusChange = useCallback((value: Todo['status']) => {
    setEditedStatus(value);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, []);

  // 🔧 新增：优先级变化时更新未保存状态
  const handlePriorityChange = useCallback((value: Todo['priority']) => {
    setEditedPriority(value);
    setHasUnsavedChanges(true);
    setSaveStatus('unsaved');
  }, []);

  // 提取所有历史标签并按使用频率排序
  const historyTags = React.useMemo(() => {
    const tagFrequency: Record<string, number> = {};

    allTodos.forEach(t => {
      if (t.tags) {
        t.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagFrequency[trimmed] = (tagFrequency[trimmed] || 0) + 1;
          }
        });
      }
    });

    return Object.keys(tagFrequency).sort((a, b) =>
      tagFrequency[b] - tagFrequency[a]
    );
  }, [allTodos]);

  // 移除旧的自动保存逻辑

  // 🔧 优化：手动保存函数（立即执行，无延迟）
  const handleManualSave = async () => {
    try {
      setSaveStatus('saving');

      const updates: Partial<Todo> = {
        title: editedTitle.trim() || '未命名待办',
        content: editedContent,
        status: editedStatus,
        priority: editedPriority,
        tags: editedTags.join(','),
        updatedAt: new Date().toISOString()
      };

      console.log('[InlineEditPanel] Manual save:', updates);

      await onUpdate(updates);

      setHasUnsavedChanges(false);
      setSaveStatus('saved');

      // 🔧 新增：通知父组件未保存状态已清除
      if (onUnsavedChange) {
        onUnsavedChange(false);
      }

      message.success({
        content: '保存成功',
        duration: 2,
        key: 'inline-edit-save'
      });

      console.log('[InlineEditPanel] Manual save completed successfully');
    } catch (error) {
      console.error('[InlineEditPanel] Manual save failed:', error);
      setSaveStatus('unsaved');
      message.error({
        content: '保存失败，请重试',
        duration: 3,
        key: 'inline-edit-save-fail'
      });
    }
  };

  // 手动保存并退出编辑模式
  const handleSaveAndExit = async () => {
    try {
      await handleManualSave();
      onExit();
    } catch (error) {
      console.error('[InlineEditPanel] Save and exit failed:', error);
      // 不调用onExit，因为保存失败
    }
  };

  // 🔧 优化：取消编辑（移除saveTimeoutRef引用）
  const handleCancel = () => {
    console.log('[InlineEditPanel] Canceling edit, restoring original data');

    // 恢复原始数据
    setEditedTitle(todo.title);
    setEditedStatus(todo.status);
    setEditedPriority(todo.priority);
    setEditedTags(todo.tags ? todo.tags.split(',').filter(tag => tag.trim()) : []);
    setEditedContent(todo.content || '');

    // 重置未保存状态
    setHasUnsavedChanges(false);
    setSaveStatus('unsaved');

    onCancel();
  };

  // 🔧 新增：Ctrl+S快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S 或 Cmd+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        console.log('[InlineEditPanel] Ctrl+S pressed, triggering save');
        handleManualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleManualSave]);

  // 添加标签
  const handleAddTag = () => {
    const trimmedTag = inputTag.trim();
    if (trimmedTag && !editedTags.includes(trimmedTag)) {
      setEditedTags([...editedTags, trimmedTag]);
      setInputTag('');
    }
  };

  // 移除标签
  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  // 输入法事件处理
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  // 🔧 优化：组件卸载时清理（移除saveTimeoutRef，因为不再使用自动保存）
  useEffect(() => {
    console.log('[InlineEditPanel] Component mounted, tracking unsaved changes');
    return () => {
      console.log('[InlineEditPanel] Component unmounting');
      // 清理工作（如果有需要）
    };
  }, []);

  return (
    <div className="inline-edit-panel">
      {/* 编辑工具栏 */}
      <div className="edit-toolbar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid #f0f0f0'
      }}>
        <Space>
          <Button
            type="primary"
            icon={saveStatus === 'saving' ? <LoadingOutlined /> : <SaveOutlined />}
            onClick={handleManualSave}
            loading={saveStatus === 'saving'}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? '保存中...' : '保存 (Ctrl+S)'}
          </Button>
          <Button
            type="default"
            icon={<SaveOutlined />}
            onClick={handleSaveAndExit}
            disabled={saveStatus === 'saving'}
          >
            保存并退出
          </Button>
          <Button
            icon={<CloseOutlined />}
            onClick={handleCancel}
            disabled={saveStatus === 'saving'}
          >
            取消
          </Button>
        </Space>

        <div className="save-status" style={{
          fontSize: 12,
          color: saveStatus === 'saved' ? '#52c41a' : saveStatus === 'saving' ? '#1890ff' : '#999',
          fontWeight: saveStatus === 'saved' ? 500 : 400
        }}>
          {saveStatus === 'saved' && <CheckOutlined style={{ marginRight: 4 }} />}
          {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : hasUnsavedChanges ? '有未保存更改' : '未修改'}
        </div>
      </div>

      {/* 标题编辑 */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="输入待办标题"
          value={editedTitle}
          onChange={handleTitleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          size="large"
          style={{ fontSize: 18, fontWeight: 500 }}
        />
      </div>

      {/* 状态和优先级编辑 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          value={editedStatus}
          onChange={handleStatusChange}
          style={{ width: 120 }}
        >
          <Option value="pending">待办</Option>
          <Option value="in_progress">进行中</Option>
          <Option value="completed">已完成</Option>
          <Option value="paused">暂停</Option>
        </Select>

        <Select
          value={editedPriority}
          onChange={handlePriorityChange}
          style={{ width: 120 }}
        >
          <Option value="low">低优先级</Option>
          <Option value="medium">中优先级</Option>
          <Option value="high">高优先级</Option>
        </Select>
      </div>

      {/* 标签编辑 */}
      <div style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="添加标签"
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              onPressEnter={handleAddTag}
              style={{ flex: 1 }}
            />
            <Button onClick={handleAddTag}>添加</Button>
          </div>

          {editedTags.length > 0 && (
            <div>
              {editedTags.map(tag => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => handleRemoveTag(tag)}
                  style={{ marginBottom: 4 }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          {historyTags.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                历史标签：
              </div>
              <div>
                {historyTags.slice(0, 10).map(tag => (
                  <Tag
                    key={tag}
                    onClick={() => {
                      if (!editedTags.includes(tag)) {
                        setEditedTags([...editedTags, tag]);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      opacity: editedTags.includes(tag) ? 0.5 : 1,
                      marginBottom: 4
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Space>
      </div>

      <Divider />

      {/* 富文本编辑器 */}
      <div className="content-editor">
        <MilkdownEditorWrapper
          ref={richEditorRef}
          value={editedContent}
          onChange={handleContentChange}
          style={{
            height: 400,
          }}
        />
      </div>
    </div>
  );
};

export default InlineEditPanel;