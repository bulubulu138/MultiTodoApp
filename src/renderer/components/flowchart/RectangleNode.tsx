import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';

/**
 * RectangleNode - 矩形节点组件
 */
export const RectangleNode: React.FC<NodeProps<RuntimeNodeData>> = ({ data, selected }) => {
  const { label, computedStyle, isLocked } = data;

  const style = computedStyle || {
    backgroundColor: '#fff',
    borderColor: '#d9d9d9',
    borderWidth: 2
  };

  return (
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
        transition: 'all 0.2s'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

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

      <div style={{
        fontSize: style.fontSize || 14,
        color: '#262626',
        wordBreak: 'break-word',
        textAlign: 'center'
      }}>
        {label}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};
