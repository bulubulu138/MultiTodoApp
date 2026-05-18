import React, { useRef, useEffect, useState } from 'react';
import { Checkbox, CheckboxChangeEvent, InputNumber, Tooltip } from 'antd';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCompactTodoEdit } from '../hooks/useCompactTodoEdit';

interface CompactTodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onView: (todo: Todo) => void;
  onToggleTodayCompleted: (todo: Todo) => void;
  colors?: any;
  enableDrag?: boolean;
  dragHandleProps?: any;
  // 新增序号编辑相关 props
  currentDisplayOrder?: number;
  editingOrder?: number | null;
  setEditingOrder?: (value: number | undefined) => void;
  onOrderSave?: () => Promise<void>;
  savingOrder?: boolean;
  isInGroup?: boolean;
  isGroupStart?: boolean;
}

/**
 * 紧凑卡片项组件
 * 极简布局：checkbox + 可编辑标题
 */
export const CompactTodoItem: React.FC<CompactTodoItemProps> = ({
  todo,
  onUpdate,
  onView,
  onToggleTodayCompleted,
  colors: propColors,
  enableDrag = false,
  dragHandleProps,
  // 新增 props
  currentDisplayOrder,
  editingOrder,
  setEditingOrder,
  onOrderSave,
  savingOrder = false,
  isInGroup = false,
  isGroupStart = false,
}) => {
  const colors = propColors || useThemeColors();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHoveringDragHandle, setIsHoveringDragHandle] = useState(false);

  const {
    isEditing,
    editedTitle,
    isSaving,
    handleChange,
    handleBlur,
    handleKeyDown,
    handleClick,
  } = useCompactTodoEdit({
    todoId: todo.id,
    initialTitle: todo.title,
    onUpdate,
  });

  // 聚焦时全选文本
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 检查是否为今日已完成状态
  const isTodayCompleted = todo.status === 'today_completed';

  // 检查是否可拖拽
  const canDrag = todo.status !== 'today_completed';

  // 检查是否可以编辑序号
  const canEditOrder = canDrag && !(isInGroup && !isGroupStart);

  // 序号编辑器组件
  const OrderEditor = () => {
    if (editingOrder !== undefined && setEditingOrder && onOrderSave) {
      return (
        <InputNumber
          size="small"
          value={editingOrder}
          onChange={(value) => setEditingOrder(value ?? undefined)}
          onPressEnter={() => onOrderSave()}
          onBlur={() => onOrderSave()}
          min={0}
          disabled={savingOrder || !canEditOrder}
          style={{
            width: 45,
            fontSize: '11px',
            height: '24px',
            marginRight: '6px',
            flexShrink: 0,
          }}
          autoFocus
        />
      );
    }

    return (
      <Tooltip title={canEditOrder ? '点击编辑序号' : '分组内序号由第一个待办控制'}>
        <span
          onClick={canEditOrder && setEditingOrder ? () => setEditingOrder(currentDisplayOrder ?? 0) : undefined}
          style={{
            cursor: canEditOrder ? 'pointer' : 'not-allowed',
            color: currentDisplayOrder !== undefined ? '#1890ff' : '#ccc',
            fontSize: '11px',
            minWidth: '20px',
            textAlign: 'center',
            userSelect: 'none',
            marginRight: '6px',
            flexShrink: 0,
          }}
        >
          {currentDisplayOrder !== undefined ? currentDisplayOrder : '#'}
        </span>
      </Tooltip>
    );
  };

  // 样式定义 - 优化为更紧凑的布局
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '36px', // 稍微减小高度以更紧凑
    padding: '0 4px', // 减少内边距
    margin: '1px 0', // 减少外边距
    backgroundColor: 'transparent',
    borderRadius: '3px', // 稍微减小圆角
    transition: 'background-color 0.2s, opacity 0.2s',
    cursor: canDrag ? 'move' : 'pointer',
    opacity: isTodayCompleted ? 0.4 : 1,
  };

  const checkboxStyle: React.CSSProperties = {
    marginRight: '6px', // 稍微减小间距
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  };

  const titleInputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '13px', // 稍微减小字体
    color: 'inherit',
    padding: '0 2px', // 减少内边距
    outline: 'none',
    textDecoration: isTodayCompleted ? 'line-through' : 'none',
    cursor: isEditing ? 'text' : 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const dragHandleStyle: React.CSSProperties = {
    marginLeft: '4px', // 减小间距
    flexShrink: 0,
    cursor: canDrag ? 'grab' : 'not-allowed',
    opacity: canDrag ? (isHoveringDragHandle ? 0.8 : 0.6) : 0.2,
    fontSize: '12px', // 增大字体
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px', // 从 16px 增加到 32px
    height: '32px', // 从 16px 增加到 32px
    borderRadius: '6px', // 增加圆角
    transition: 'all 200ms ease-out', // 增加过渡动画
    backgroundColor: isHoveringDragHandle && canDrag ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
  };

  // 处理容器双击事件
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== inputRef.current) {
      onView(todo);
    }
  };

  // 处理checkbox变化 - 简化逻辑，直接更新状态
  const handleCheckboxChange = async (e: CheckboxChangeEvent) => {
    e.stopPropagation(); // 防止触发容器的点击事件

    // 直接调用状态管理器进行状态切换
    try {
      const newState = todo.status === 'today_completed' ? 'pending' : 'today_completed';
      const updates: any = {
        status: newState,
        todayCompletedAt: newState === 'today_completed' ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString()
      };

      await onUpdate(todo.id, updates);
    } catch (error) {
      console.error('Failed to toggle today completed status:', error);
    }
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`compact-todo-item ${isTodayCompleted ? 'today-completed' : ''}`}
      onDoubleClick={handleContainerDoubleClick}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isTodayCompleted}
        onChange={handleCheckboxChange}
        style={checkboxStyle}
      />

      {/* 序号编辑器 */}
      <OrderEditor />

      {/* 可编辑标题 */}
      <input
        ref={inputRef}
        type="text"
        value={editedTitle}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        style={titleInputStyle}
        disabled={isSaving}
        placeholder="输入待办标题..."
      />

      {/* 拖拽手柄（在拖拽模式下显示） */}
      {enableDrag && (
        <div
          style={dragHandleStyle}
          {...(canDrag ? dragHandleProps?.attributes : {})}
          {...(canDrag ? dragHandleProps?.listeners : {})}
          {...(!canDrag ? { title: '今日已完成的项目不可拖拽' } : {})}
          onMouseEnter={() => setIsHoveringDragHandle(true)}
          onMouseLeave={() => setIsHoveringDragHandle(false)}
        >
          ⋮⋮
        </div>
      )}
    </div>
  );
};

// 为 CompactTodoItem 添加记忆化，优化性能并确保数据变化时能重新渲染
const MemoizedCompactTodoItem = React.memo(CompactTodoItem, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键 props 改变时重新渲染
  return (
    prevProps.todo.id === nextProps.todo.id &&
    prevProps.todo.status === nextProps.todo.status &&
    prevProps.todo.updatedAt === nextProps.todo.updatedAt &&
    prevProps.todo.title === nextProps.todo.title &&
    prevProps.currentDisplayOrder === nextProps.currentDisplayOrder &&
    prevProps.savingOrder === nextProps.savingOrder
  );
});

MemoizedCompactTodoItem.displayName = 'MemoizedCompactTodoItem';

export default MemoizedCompactTodoItem;