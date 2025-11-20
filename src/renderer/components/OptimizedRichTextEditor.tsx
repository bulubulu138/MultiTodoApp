import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button, Space, Tooltip, message } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

interface OptimizedRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  maxHeight?: number;
  onPreviewClick?: () => void;
  style?: React.CSSProperties;
}

// 从HTML中提取纯文本的函数
const extractPlainText = (html: string): string => {
  if (!html) return '';

  const temp = document.createElement('div');
  temp.innerHTML = html;

  // 移除所有图片
  const images = temp.querySelectorAll('img');
  images.forEach(img => img.remove());

  const text = temp.textContent || temp.innerText || '';
  return text.trim().replace(/\s+/g, ' ');
};

// 获取预览文本（最多100字符）
const getPreviewText = (html: string, maxLength: number = 100): string => {
  const plainText = extractPlainText(html);
  if (!plainText) return '(无内容)';

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.substring(0, maxLength) + '...';
};

const OptimizedRichTextEditor: React.FC<OptimizedRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入内容...',
  readOnly = false,
  maxHeight = 200,
  onPreviewClick,
  style = {}
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<ReactQuill>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // 当外部value变化时，更新本地值
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // 优化的防抖保存函数
  const debouncedSave = useCallback((newValue: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      onChange(newValue);

      setTimeout(() => {
        setIsSaving(false);
      }, 300); // 模拟保存完成
    }, 500); // 500ms防抖
  }, [onChange]);

  // 处理内容变化
  const handleChange = useCallback((content: string) => {
    setLocalValue(content);
    debouncedSave(content);
  }, [debouncedSave]);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    // 聚焦编辑器
    setTimeout(() => {
      if (editorRef.current) {
        const quill = editorRef.current.getEditor();
        quill.focus();
        // 将光标移动到内容末尾
        const length = quill.getLength();
        quill.setSelection(length - 1, 0);
      }
    }, 100);
  }, []);

  // 完成编辑
  const handleFinishEdit = useCallback(() => {
    // 立即保存当前值
    onChange(localValue);
    setIsEditing(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(false);
  }, [localValue, onChange]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setLocalValue(value);
    setIsEditing(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(false);
  }, [value]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 预览模式：显示纯文本或可点击的卡片
  if (!isEditing) {
    const previewText = getPreviewText(localValue);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          padding: '8px 12px',
          minHeight: '40px',
          cursor: readOnly ? 'default' : 'pointer',
          backgroundColor: '#fafafa',
          position: 'relative',
          overflow: 'hidden',
          ...style
        }}
        onClick={readOnly ? undefined : onPreviewClick || handleStartEdit}
      >
        {previewText === '(无内容)' ? (
          <span style={{ color: '#bfbfbf', fontSize: '14px' }}>
            {placeholder}
          </span>
        ) : (
          <div style={{
            color: '#262626',
            fontSize: '14px',
            lineHeight: '1.5',
            wordBreak: 'break-word'
          }}>
            {previewText}
          </div>
        )}

        {!readOnly && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px'
          }}>
            <Tooltip title="点击编辑">
              <EditOutlined
                style={{
                  color: '#8c8c8c',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}
              />
            </Tooltip>
          </div>
        )}
      </motion.div>
    );
  }

  // 编辑模式：显示富文本编辑器
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      style={{
        border: '1px solid #4096ff',
        borderRadius: '8px',
        position: 'relative',
        ...style
      }}
    >
      <div className="quill-editor-container" style={{
        marginBottom: '8px'
      }}>
        <ReactQuill
          ref={editorRef}
          theme="snow"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          readOnly={readOnly}
          style={{
            maxHeight: `${maxHeight}px`,
          }}
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'color': [] }, { 'background': [] }],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'indent': '-1'}, { 'indent': '+1' }],
              ['link', 'image'],
              ['clean']
            ],
            clipboard: {
              matchVisual: false,
            },
            history: {
              delay: 1000,
              maxStack: 50,
              userOnly: true
            }
          }}
          formats={[
            'header',
            'bold', 'italic', 'underline', 'strike',
            'color', 'background',
            'list', 'indent',
            'link', 'image'
          ]}
        />
      </div>

      {/* 编辑状态指示器 */}
      {isSaving && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'rgba(64, 150, 255, 0.1)',
          color: '#4096ff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1
        }}>
          保存中...
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '8px 12px',
        borderTop: '1px solid #f0f0f0'
      }}>
        <Space size="small">
          <Tooltip title="取消">
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={handleCancelEdit}
            >
              取消
            </Button>
          </Tooltip>
          <Tooltip title="完成编辑">
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={handleFinishEdit}
              loading={isSaving}
            >
              完成
            </Button>
          </Tooltip>
        </Space>
      </div>
    </motion.div>
  );
};

// 性能优化：使用 React.memo 避免不必要的重渲染
export default memo(OptimizedRichTextEditor, (prevProps, nextProps) => {
  // 只有当关键 props 改变时才重新渲染
  return (
    prevProps.value === nextProps.value &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.maxHeight === nextProps.maxHeight
  );
});