import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined, WarningOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';
import { InlineTextEditor } from './InlineTextEditor';
import { useHandleVisibilityContext } from '../../contexts/HandleVisibilityContext';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * 验证并规范化样式属性
 * 确保所有样式值都是有效的，防止渲染错误
 */
const validateAndNormalizeStyle = (style: any) => {
  const defaultStyle = {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    fontSize: 14,
    color: '#262626',
    textAlign: 'center' as 'left' | 'center' | 'right'
  };

  if (!style || typeof style !== 'object') {
    console.warn('[TextNode] Invalid style object, using defaults:', style);
    return defaultStyle;
  }

  try {
    // 验证并规范化 fontSize
    let fontSize = defaultStyle.fontSize;
    if (typeof style.fontSize === 'number' && style.fontSize > 0 && style.fontSize <= 100) {
      fontSize = style.fontSize;
    } else if (style.fontSize !== undefined) {
      console.warn('[TextNode] Invalid fontSize value, using default:', style.fontSize);
    }

    // 验证并规范化 color
    let color = defaultStyle.color;
    if (typeof style.color === 'string' && style.color.length > 0) {
      color = style.color;
    } else if (style.color !== undefined) {
      console.warn('[TextNode] Invalid color value, using default:', style.color);
    }

    // 验证并规范化 textAlign
    let textAlign: 'left' | 'center' | 'right' = defaultStyle.textAlign;
    const validAlignments = ['left', 'center', 'right'];
    if (typeof style.textAlign === 'string' && validAlignments.includes(style.textAlign)) {
      textAlign = style.textAlign as 'left' | 'center' | 'right';
    } else if (style.textAlign !== undefined) {
      console.warn('[TextNode] Invalid textAlign value, using default:', style.textAlign);
    }

    // 验证并规范化 backgroundColor
    let backgroundColor = defaultStyle.backgroundColor;
    if (typeof style.backgroundColor === 'string') {
      backgroundColor = style.backgroundColor;
    } else if (style.backgroundColor !== undefined) {
      console.warn('[TextNode] Invalid backgroundColor value, using default:', style.backgroundColor);
    }

    // 验证并规范化 borderColor
    let borderColor = defaultStyle.borderColor;
    if (typeof style.borderColor === 'string') {
      borderColor = style.borderColor;
    } else if (style.borderColor !== undefined) {
      console.warn('[TextNode] Invalid borderColor value, using default:', style.borderColor);
    }

    // 验证并规范化 borderWidth
    let borderWidth = defaultStyle.borderWidth;
    if (typeof style.borderWidth === 'number' && style.borderWidth >= 0 && style.borderWidth <= 20) {
      borderWidth = style.borderWidth;
    } else if (style.borderWidth !== undefined) {
      console.warn('[TextNode] Invalid borderWidth value, using default:', style.borderWidth);
    }

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      fontSize,
      color,
      textAlign
    };
  } catch (error) {
    console.error('[TextNode] Error validating style, using defaults:', error);
    return defaultStyle;
  }
};

/**
 * TextNode - 文本节点组件
 * 
 * 特点：
 * - 无边框、透明背景，仅显示文本
 * - 支持双击内联编辑
 * - 支持文本对齐选项（左对齐、居中、右对齐）
 * - 最小化视觉样式，适合作为注释或标签
 * - 健壮的错误处理：空文本、无效样式、渲染失败
 * 
 * Requirements: 1.1, 1.2, 1.3
 * Error Handling: Empty text nodes, invalid style properties, rendering failures
 */
const TextNodeInner: React.FC<NodeProps<RuntimeNodeData>> = ({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 安全地提取数据，处理可能的 undefined 或 null
  let label: string;
  let computedStyle: any;
  let isLocked: boolean;
  let isHighlighted: boolean;

  try {
    label = data?.label ?? '';
    computedStyle = data?.computedStyle;
    isLocked = data?.isLocked ?? false;
    isHighlighted = data?.isHighlighted ?? false;
  } catch (error) {
    console.error('[TextNode] Error accessing node data:', error);
    setRenderError('数据访问错误');
    label = '';
    computedStyle = undefined;
    isLocked = false;
    isHighlighted = false;
  }

  const { getHandleStyle } = useHandleVisibilityContext();

  // 验证并规范化样式，确保所有属性都是有效的
  const style = validateAndNormalizeStyle(computedStyle);

  // 处理空文本节点：显示占位符文本
  const displayLabel = label && label.trim().length > 0 ? label : 'Empty Text';
  const isEmptyText = !label || label.trim().length === 0;

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    try {
      if (!isLocked) {
        e.stopPropagation();
        setIsEditing(true);
      }
    } catch (error) {
      console.error('[TextNode] Error handling double click:', error);
      setRenderError('编辑启动失败');
    }
  }, [isLocked]);

  const handleSave = useCallback((newLabel: string) => {
    try {
      // 触发自定义事件通知父组件
      window.dispatchEvent(new CustomEvent('node-label-change', {
        detail: { nodeId: id, newLabel }
      }));
      setIsEditing(false);
      setRenderError(null); // 清除任何之前的错误
    } catch (error) {
      console.error('[TextNode] Error saving label:', error);
      setRenderError('保存失败');
    }
  }, [id]);

  const handleCancel = useCallback(() => {
    try {
      setIsEditing(false);
      setRenderError(null); // 清除任何之前的错误
    } catch (error) {
      console.error('[TextNode] Error canceling edit:', error);
    }
  }, []);

  // 高亮样式 - 文本节点使用文字阴影而非边框
  const highlightStyle = isHighlighted ? {
    textShadow: '0 0 8px rgba(114, 46, 209, 0.8)',
    animation: 'textPulse 0.8s ease-in-out 2'
  } : {};

  // 选中样式 - 使用淡淡的背景色和文字阴影
  const selectionStyle = selected ? {
    backgroundColor: 'rgba(24, 144, 255, 0.05)',
    textShadow: '0 0 4px rgba(24, 144, 255, 0.3)',
    borderRadius: '4px'
  } : {};

  // 如果有渲染错误，显示错误指示器
  if (renderError) {
    return (
      <div
        style={{
          padding: '8px 12px',
          minWidth: '80px',
          backgroundColor: '#fff2e8',
          border: '1px solid #ffbb96',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <WarningOutlined style={{ color: '#fa8c16' }} />
        <span style={{ fontSize: '12px', color: '#d4380d' }}>
          {renderError}
        </span>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes textPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}
      </style>
      <div
        style={{
          padding: '8px 12px',
          minWidth: '80px',
          maxWidth: '300px',
          position: 'relative',
          backgroundColor: style.backgroundColor || 'transparent',
          border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : 'none',
          borderRadius: '4px',
          transition: 'all 0.15s',
          ...selectionStyle
        }}
        onDoubleClick={handleDoubleClick}
      >
        {/* 四向连接点 - 双向 Handle（既可作为源也可作为目标） */}
        <Handle 
          type="source" 
          position={Position.Top} 
          id="top" 
          isConnectableStart={true}
          isConnectableEnd={true}
          style={getHandleStyle(id, 'top')} 
        />
        <Handle 
          type="source" 
          position={Position.Left} 
          id="left" 
          isConnectableStart={true}
          isConnectableEnd={true}
          style={getHandleStyle(id, 'left')} 
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="right" 
          isConnectableStart={true}
          isConnectableEnd={true}
          style={getHandleStyle(id, 'right')} 
        />
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="bottom" 
          isConnectableStart={true}
          isConnectableEnd={true}
          style={getHandleStyle(id, 'bottom')} 
        />

        {isLocked && (
          <LockOutlined
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              fontSize: '10px',
              color: '#8c8c8c',
              opacity: 0.6
            }}
          />
        )}

        {isEditing ? (
          <InlineTextEditor
            value={label}
            onSave={handleSave}
            onCancel={handleCancel}
            multiline={true}
            style={{
              fontSize: style.fontSize || 14,
              textAlign: style.textAlign || 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #1890ff'
            }}
          />
        ) : (
          <div
            style={{
              fontSize: style.fontSize || 14,
              color: isEmptyText ? '#bfbfbf' : (style.color || '#262626'), // 空文本使用灰色
              wordBreak: 'break-word',
              textAlign: style.textAlign || 'center',
              cursor: isLocked ? 'default' : 'text',
              whiteSpace: 'pre-wrap',
              fontStyle: isEmptyText ? 'italic' : 'normal', // 空文本使用斜体
              ...highlightStyle
            }}
          >
            {displayLabel}
          </div>
        )}
      </div>
    </>
  );
};

/**
 * TextNode 导出组件 - 包装在 ErrorBoundary 中
 * 捕获任何渲染错误，防止整个流程图崩溃
 */
export const TextNode: React.FC<NodeProps<RuntimeNodeData>> = (props) => {
  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            padding: '8px 12px',
            minWidth: '80px',
            backgroundColor: '#fff1f0',
            border: '1px solid #ffa39e',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <WarningOutlined style={{ color: '#cf1322' }} />
          <span style={{ fontSize: '12px', color: '#cf1322' }}>
            文本节点渲染失败
          </span>
        </div>
      }
    >
      <TextNodeInner {...props} />
    </ErrorBoundary>
  );
};
