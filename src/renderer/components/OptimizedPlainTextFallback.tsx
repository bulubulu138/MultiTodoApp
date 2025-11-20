import React, { memo, useMemo, useCallback } from 'react';
import { Button, Tooltip, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface OptimizedPlainTextFallbackProps {
  content: string;
  placeholder?: string;
  maxLength?: number;
  onEdit?: () => void;
  showEditButton?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// 性能优化的文本提取函数
const extractText = useMemo(() => {
  // 创建一个临时的 DOM 解析器（在服务端渲染时不会执行）
  let tempDiv: HTMLDivElement | null = null;

  return (html: string): string => {
    if (!html) return '';

    // 检查是否为纯文本（不包含HTML标签）
    if (!/<[^>]*>/.test(html)) {
      return html;
    }

    // 懒创建临时 DOM 元素
    if (!tempDiv && typeof document !== 'undefined') {
      tempDiv = document.createElement('div');
    }

    if (tempDiv) {
      tempDiv.innerHTML = html;

      // 移除所有图片
      const images = tempDiv.querySelectorAll('img');
      images.forEach(img => img.remove());

      // 获取纯文本
      const text = tempDiv.textContent || tempDiv.innerText || '';

      // 清理多余空白
      return text.trim().replace(/\s+/g, ' ');
    }

    // 回退方案：简单的HTML标签移除
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  };
}, []);

// 性能优化的文本截断函数
const truncateText = useMemo(() => {
  return (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) {
      return text || '';
    }

    // 使用更高效的字符串操作
    return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  };
}, []);

const OptimizedPlainTextFallback: React.FC<OptimizedPlainTextFallbackProps> = ({
  content,
  placeholder = '请输入内容...',
  maxLength = 100,
  onEdit,
  showEditButton = true,
  className = '',
  style = {},
  onClick
}) => {
  // 使用 useMemo 缓存文本处理结果
  const processedText = useMemo(() => {
    const extractedText = extractText(content);
    return truncateText(extractedText, maxLength);
  }, [content, maxLength]);

  // 处理点击事件
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 防止事件冒泡
    e.stopPropagation();

    if (onClick) {
      onClick();
    } else if (onEdit) {
      onEdit();
    }
  }, [onClick, onEdit]);

  // 如果没有内容，显示占位符
  if (!processedText) {
    return (
      <div
        className={`optimized-plain-text-fallback empty ${className}`}
        style={{
          padding: '8px 12px',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafafa',
          border: '1px dashed #d9d9d9',
          borderRadius: '8px',
          cursor: onEdit ? 'pointer' : 'default',
          ...style
        }}
        onClick={onEdit ? handleClick : undefined}
      >
        <Text style={{ color: '#bfbfbf', fontSize: '14px' }}>
          {placeholder}
        </Text>
        {showEditButton && onEdit && (
          <Tooltip title="点击编辑">
            <EditOutlined
              style={{
                color: '#8c8c8c',
                fontSize: '12px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            />
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div
      className={`optimized-plain-text-fallback ${className}`}
      style={{
        padding: '8px 12px',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        cursor: onEdit ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        ...style
      }}
      onClick={onEdit ? handleClick : undefined}
      onMouseEnter={(e) => {
        if (onEdit) {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
          e.currentTarget.style.borderColor = '#d9d9d9';
        }
      }}
      onMouseLeave={(e) => {
        if (onEdit) {
          e.currentTarget.style.backgroundColor = '#fafafa';
          e.currentTarget.style.borderColor = '#f0f0f0';
        }
      }}
    >
      <Text
        style={{
          color: '#262626',
          fontSize: '14px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
          flex: 1,
          marginRight: showEditButton ? '8px' : '0'
        }}
        title={content} // 显示完整内容的工具提示
      >
        {processedText}
      </Text>

      {showEditButton && onEdit && (
        <Tooltip title="点击编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            style={{
              color: '#8c8c8c',
              fontSize: '12px',
              padding: '2px 6px',
              height: 'auto',
              lineHeight: '1'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
        </Tooltip>
      )}
    </div>
  );
};

// 使用 React.memo 进行性能优化
export default memo(OptimizedPlainTextFallback, (prevProps, nextProps) => {
  // 只有关键 props 改变时才重新渲染
  return (
    prevProps.content === nextProps.content &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.maxLength === nextProps.maxLength &&
    prevProps.showEditButton === nextProps.showEditButton &&
    prevProps.onEdit === nextProps.onEdit
  );
});