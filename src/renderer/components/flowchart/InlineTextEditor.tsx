import React, { useState, useEffect, useRef } from 'react';

interface InlineTextEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
  multiline?: boolean;
}

/**
 * InlineTextEditor - 内联文字编辑器
 * 
 * 用于节点上的快速文字编辑，支持：
 * - Enter 保存（Shift+Enter 换行）
 * - Escape 取消
 * - 点击外部自动保存
 * - 阻止键盘事件冒泡
 */
export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  value,
  onSave,
  onCancel,
  style,
  multiline = true
}) => {
  const [text, setText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦并选中文本
    const element = multiline ? textareaRef.current : inputRef.current;
    if (element) {
      element.focus();
      element.select();
    }
  }, [multiline]);

  const handleSave = () => {
    if (text.trim() !== value.trim()) {
      onSave(text.trim() || value); // 如果为空，保持原值
    } else {
      onCancel(); // 没有变化，直接取消
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 阻止事件冒泡到画布，防止触发全局快捷键
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter 保存（Shift+Enter 换行）
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      // Escape 取消
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // 点击外部自动保存
    handleSave();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setText(e.target.value);
  };

  const commonStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    border: '2px solid #1890ff',
    borderRadius: '4px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',
    ...style
  };

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={commonStyle}
        rows={3}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={commonStyle}
    />
  );
};
