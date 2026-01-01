import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';

/**
 * CircleNode - 圆形节点组件（用于开始/结束点）
 */
export const CircleNode: React.FC<NodeProps<RuntimeNodeData>> = ({ data, selected }) => {
  const { label, computedStyle, isLocked } = data;

  const style = computedStyle || {
    backgroundColor: '#fff',
    borderColor: '#d9d9d9',
    borderWidth: 2
  };

  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />

      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor}`,
          backgroundColor: style.backgroundColor,
          boxShadow: selected ? '0 0 0 2px #1890ff' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
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

        <div
          style={{
            fontSize: style.fontSize || 12,
            color: '#262626',
            wordBreak: 'break-word',
            textAlign: 'center',
            maxWidth: '60px',
            padding: '4px'
          }}
        >
          {label}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};
