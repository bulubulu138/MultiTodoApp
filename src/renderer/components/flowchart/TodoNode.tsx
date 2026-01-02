import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LockOutlined, CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { RuntimeNodeData } from '../../../shared/types';
import { InlineTextEditor } from './InlineTextEditor';

/**
 * TodoNode - 关联待办任务的节点组件
 * 
 * 从 resolvedTodo 读取数据，不直接依赖 Todo 实体
 * 根据任务状态显示计算后的样式
 * 支持双击内联编辑
 */
export const TodoNode: React.FC<NodeProps<RuntimeNodeData>> = ({ id, data, selected }) => {
  const { label, resolvedTodo, computedStyle, isLocked, isHighlighted } = data;
  const [isEditing, setIsEditing] = useState(false);

  // 优先使用任务标题，否则使用节点 label
  const displayLabel = resolvedTodo?.title || label;

  // 使用计算后的样式
  const style = computedStyle || {
    backgroundColor: '#fff',
    borderColor: '#333',
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

  // 高亮样式
  const highlightStyle = isHighlighted ? {
    boxShadow: '0 0 0 3px #722ed1, 0 0 20px rgba(114, 46, 209, 0.5)',
    animation: 'pulse 1s ease-in-out 3'
  } : {};

  // 获取状态图标
  const getStatusIcon = () => {
    if (!resolvedTodo) return null;

    const iconStyle = { marginRight: '4px', fontSize: '12px' };
    
    switch (resolvedTodo.status) {
      case 'completed':
        return <CheckCircleOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
      case 'in_progress':
        return <ClockCircleOutlined style={{ ...iconStyle, color: '#faad14' }} />;
      case 'paused':
        return <PauseCircleOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
      default:
        return null;
    }
  };

  // 获取优先级标签
  const getPriorityBadge = () => {
    if (!resolvedTodo) return null;

    const priorityColors = {
      high: '#ff4d4f',
      medium: '#faad14',
      low: '#52c41a'
    };

    const priorityLabels = {
      high: '高',
      medium: '中',
      low: '低'
    };

    return (
      <span
        style={{
          fontSize: '10px',
          padding: '1px 4px',
          borderRadius: '2px',
          backgroundColor: priorityColors[resolvedTodo.priority],
          color: '#fff',
          marginLeft: '4px'
        }}
      >
        {priorityLabels[resolvedTodo.priority]}
      </span>
    );
  };

  if (isEditing) {
    return (
      <div style={{ minWidth: '150px', maxWidth: '250px' }}>
        <InlineTextEditor
          value={label}
          onSave={handleSave}
          onCancel={handleCancel}
          multiline={true}
          style={{
            fontSize: style.fontSize || 14,
            color: '#fff',
            backgroundColor: style.backgroundColor
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
            50% { transform: scale(1.05); }
          }
        `}
      </style>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '6px',
          border: `${style.borderWidth}px ${selected ? 'solid' : 'solid'} ${style.borderColor}`,
          backgroundColor: style.backgroundColor,
          minWidth: '150px',
          maxWidth: '250px',
          position: 'relative',
          boxShadow: selected ? '0 0 0 2px #1890ff' : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          color: style.color || '#fff', // 使用计算出的文字颜色
          fontWeight: 500,
          ...highlightStyle
        }}
        onDoubleClick={handleDoubleClick}
      >
      {/* 四向连接点 */}
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#555' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#555' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#555' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#555' }} />

      {/* 锁定图标 */}
      {isLocked && (
        <LockOutlined
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '12px',
            color: style.color || '#fff',
            opacity: 0.8
          }}
        />
      )}

      {/* 节点内容 */}
      <div style={{ cursor: isLocked ? 'default' : 'text' }}>
        <div style={{ 
          fontSize: style.fontSize || 14,
          marginBottom: resolvedTodo ? '6px' : 0,
          wordBreak: 'break-word'
        }}>
          {displayLabel}
        </div>

        {/* 任务信息 */}
        {resolvedTodo && (
          <div style={{ 
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            color: style.color || '#fff',
            opacity: 0.9
          }}>
            {getStatusIcon()}
            {getPriorityBadge()}
          </div>
        )}

        {/* 任务已删除提示 */}
        {data.todoId && !resolvedTodo && (
          <div style={{ 
            fontSize: '11px',
            color: style.color || '#fff',
            opacity: 0.7,
            fontStyle: 'italic'
          }}>
            (任务已删除)
          </div>
        )}
      </div>
    </div>
    </>
  );
};
