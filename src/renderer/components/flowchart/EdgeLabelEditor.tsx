import React, { useState, useEffect, useRef } from 'react';

interface EdgeLabelEditorProps {
  edgeId: string;
  currentLabel: string;
  position: { x: number; y: number };
  onSave: (label: string) => void;
  onCancel: () => void;
}

// 最大标签长度（字符数）
const MAX_LABEL_LENGTH = 100;

/**
 * EdgeLabelEditor - 边标签内联编辑器
 * 
 * 用于编辑连接线上的标签文本，支持：
 * - 定位在边的中点
 * - Enter 保存
 * - Escape 取消
 * - 点击外部自动保存
 * - 阻止键盘事件冒泡
 * 
 * 错误处理：
 * - 标签长度限制（最大100字符）
 * - 无效位置回退到默认位置
 * - 并发编辑冲突（最后写入获胜）
 */
export const EdgeLabelEditor: React.FC<EdgeLabelEditorProps> = ({
  edgeId,
  currentLabel,
  position,
  onSave,
  onCancel
}) => {
  const [text, setText] = useState(currentLabel || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦并选中文本
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    const trimmedText = text.trim();
    
    // 错误处理：检查标签长度
    if (trimmedText.length > MAX_LABEL_LENGTH) {
      setError(`标签长度不能超过 ${MAX_LABEL_LENGTH} 个字符`);
      return;
    }
    
    // 如果文本有变化，保存；否则取消
    if (trimmedText !== currentLabel) {
      try {
        onSave(trimmedText);
      } catch (err) {
        // 错误处理：保存失败（可能是并发编辑冲突）
        console.error('[EdgeLabelEditor] Failed to save label:', err);
        setError('保存失败，请重试');
      }
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 阻止事件冒泡到画布，防止触发全局快捷键
    e.stopPropagation();

    if (e.key === 'Enter') {
      // Enter 保存
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      // Escape 取消
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // 点击外部自动保存（如果没有错误）
    if (!error) {
      handleSave();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // 清除错误提示
    if (error) {
      setError(null);
    }
    
    // 实时检查长度
    if (newText.length > MAX_LABEL_LENGTH) {
      setError(`${newText.length}/${MAX_LABEL_LENGTH} 字符`);
    }
  };

  // 错误处理：验证位置是否有效
  const isValidPosition = (pos: { x: number; y: number }): boolean => {
    return (
      typeof pos.x === 'number' &&
      typeof pos.y === 'number' &&
      !isNaN(pos.x) &&
      !isNaN(pos.y) &&
      isFinite(pos.x) &&
      isFinite(pos.y)
    );
  };

  // 错误处理：使用有效位置或回退到默认位置
  const safePosition = isValidPosition(position) 
    ? position 
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // 编辑器样式 - 定位在边的中点
  const editorStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${safePosition.x}px`,
    top: `${safePosition.y}px`,
    transform: 'translate(-50%, -50%)', // 居中对齐
    zIndex: 1000,
    padding: '4px 8px',
    border: error ? '2px solid #ff4d4f' : '2px solid #1890ff',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: '100px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
  };

  const errorStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${safePosition.x}px`,
    top: `${safePosition.y + 30}px`,
    transform: 'translateX(-50%)',
    zIndex: 1001,
    padding: '2px 8px',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    fontSize: '11px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={editorStyle}
        placeholder="输入标签..."
        maxLength={MAX_LABEL_LENGTH + 50} // 允许稍微超出以显示错误
      />
      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}
    </>
  );
};
