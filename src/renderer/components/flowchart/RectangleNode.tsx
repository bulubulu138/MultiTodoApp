import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';
import { InlineTextEditor } from './InlineTextEditor';

/**
 * RectangleNode - 矩形节点组件
 * 支持双击内联编辑
 */
export const RectangleNode: React.FC<NodeProps<RuntimeNodeData>> = ({ id, data, selected }) => {
  const { label, computedStyle, isLocked, isHighlighted } = data;
  const [isEditing, setIsEditing] = useState(false);

  const style = computedStyle || {
    backgroundColor: '#fff',
    borderColor: '#d9d9d9',
    borderWidth: 2
  };

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isLocked) {
      e.stopPropagation();
      setIsEditing(true);
    }
  }, [isLocked]);

  const handleSave = useCallback((newLabel: string) => {
    // 触发自定义事件通知父组件
    window.dispatchEvent(new CustomEvent('node-label-change', {
      detail: { nodeId: id, newLabel }
    }));
    setIsEditing(false);
  }, [id]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // 高亮样式
  const highlightStyle = isHighlighted ? {
    boxShadow: '0 0 0 3px #722ed1, 0 0 20px rgba(114, 46, 209, 0.5)',
    animation: 'pulse 1s ease-in-out 3'
  } : {};

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}
      </style>
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '4px',
          border: `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor}`,
          backgroundColor: style.backgroundColor,
          minWidth: '120px',
          maxWidth: '200px',
          position: 'relative',
          boxShadow: selected ? '0 0 0 2px #1890ff' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          ...highlightStyle
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
        style={{ background: '#555' }} 
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left" 
        isConnectableStart={true}
        isConnectableEnd={true}
        style={{ background: '#555' }} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right" 
        isConnectableStart={true}
        isConnectableEnd={true}
        style={{ background: '#555' }} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom" 
        isConnectableStart={true}
        isConnectableEnd={true}
        style={{ background: '#555' }} 
      />

      {isLocked && (
        <LockOutlined
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '12px',
            color: '#8c8c8c'
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
            textAlign: 'center'
          }}
        />
      ) : (
        <div style={{
          fontSize: style.fontSize || 14,
          color: style.color || '#262626',
          wordBreak: 'break-word',
          textAlign: 'center',
          cursor: isLocked ? 'default' : 'text'
        }}>
          {label}
        </div>
      )}
    </div>
    </>
  );
};
