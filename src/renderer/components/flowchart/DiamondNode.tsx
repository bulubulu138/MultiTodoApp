import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';
import { InlineTextEditor } from './InlineTextEditor';
import { useHandleVisibilityContext } from '../../contexts/HandleVisibilityContext';

/**
 * DiamondNode - 菱形节点组件（用于决策点）
 * 支持双击内联编辑
 */
export const DiamondNode: React.FC<NodeProps<RuntimeNodeData>> = ({ id, data, selected }) => {
  const { label, computedStyle, isLocked, isHighlighted } = data;
  const [isEditing, setIsEditing] = useState(false);
  const { getHandleStyle } = useHandleVisibilityContext();

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
    window.dispatchEvent(new CustomEvent('node-label-change', {
      detail: { nodeId: id, newLabel }
    }));
    setIsEditing(false);
  }, [id]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // 高亮样式 - 性能优化：简化动画
  const highlightStyle = isHighlighted ? {
    boxShadow: '0 0 0 3px #722ed1, 0 0 20px rgba(114, 46, 209, 0.5)',
    animation: 'pulse 0.8s ease-in-out 2' // 减少动画次数和时长
  } : {};

  if (isEditing) {
    return (
      <div style={{ minWidth: '120px', maxWidth: '150px' }}>
        <InlineTextEditor
          value={label}
          onSave={handleSave}
          onCancel={handleCancel}
          multiline={true}
          style={{
            fontSize: style.fontSize || 12,
            textAlign: 'center'
          }}
        />
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
        `}
      </style>
      <div style={{ position: 'relative' }} onDoubleClick={handleDoubleClick}>
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

        <div
          style={{
            width: '100px',
            height: '100px',
            transform: 'rotate(45deg)',
            border: `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor}`,
            backgroundColor: style.backgroundColor,
            boxShadow: selected ? '0 0 0 2px #1890ff' : '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'box-shadow 0.15s', // 性能优化：只对必要属性添加过渡，缩短时长
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...highlightStyle
          }}
        >
        {isLocked && (
          <LockOutlined
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              fontSize: '12px',
              color: '#8c8c8c',
              transform: 'rotate(-45deg)'
            }}
          />
        )}

        <div
          style={{
            transform: 'rotate(-45deg)',
            fontSize: style.fontSize || 12,
            color: style.color || '#262626',
            wordBreak: 'break-word',
            textAlign: 'center',
            maxWidth: '70px',
            padding: '4px',
            cursor: isLocked ? 'default' : 'text'
          }}
        >
          {label}
        </div>
      </div>
    </div>
    </>
  );
};
