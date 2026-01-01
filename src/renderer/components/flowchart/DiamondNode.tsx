import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';

/**
 * DiamondNode - 菱形节点组件（用于决策点）
 */
export const DiamondNode: React.FC<NodeProps<RuntimeNodeData>> = ({ data, selected }) => {
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
          width: '100px',
          height: '100px',
          transform: 'rotate(45deg)',
          border: `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor}`,
          backgroundColor: style.backgroundColor,
          boxShadow: selected ? '0 0 0 2px #1890ff' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
            color: '#262626',
            wordBreak: 'break-word',
            textAlign: 'center',
            maxWidth: '70px',
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
