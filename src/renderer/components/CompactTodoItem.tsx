import React, { useRef, useEffect, useState } from 'react';
import { Checkbox, CheckboxChangeEvent, InputNumber, Tooltip } from 'antd';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCompactTodoEdit } from '../hooks/useCompactTodoEdit';

interface CompactTodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onView: (todo: Todo) => void | Promise<void>;
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
    width: '24px', // 精致尺寸
    height: '24px', // 方形纵横比
    borderRadius: '4px', // 细腻圆角
    marginRight: '4px', // 4px间距到下一个元素
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: canDrag ? 'grab' : 'default',
    userSelect: 'none',
    opacity: canDrag ? (isHoveringDragHandle ? 0.9 : 0.6) : 0.2, // 仅透明度变化
    fontSize: '14px', // 增大字体以提高可见性
    letterSpacing: '1px', // 增加字间距以在视觉上分隔
    color: colors.dragHandleText, // 使用主题中性色
    transition: 'opacity 0.2s ease', // 仅过渡透明度
    backgroundColor: colors.dragHandleBg, // 中性灰色背景
    border: `1px solid ${colors.dragHandleBorder}`, // 细微边框
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
      {/* 拖拽手柄（在拖拽模式下显示） - 移至左侧 */}
      {enableDrag && (
        <div
          style={dragHandleStyle}
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          {...(!canDrag ? { title: '今日已完成的项目不可拖拽' } : {})}
          onMouseEnter={() => setIsHoveringDragHandle(true)}
          onMouseLeave={() => setIsHoveringDragHandle(false)}
        >
          ⋮⋮
        </div>
      )}

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
    </div>
  );
};

// 为 CompactTodoItem 添加记忆化，优化性能并确保数据变化时能重新渲染
const MemoizedCompactTodoItem = React.memo(CompactTodoItem, (prevProps, nextProps) => {
  // 优化的比较函数：移除对 updatedAt 的依赖（避免拖拽时频繁重新渲染）
  // 只比较真正影响UI的关键字段
  return (
    prevProps.todo.id === nextProps.todo.id &&
    prevProps.todo.status === nextProps.todo.status &&
    prevProps.todo.title === nextProps.todo.title &&
    prevProps.currentDisplayOrder === nextProps.currentDisplayOrder &&
    prevProps.editingOrder === nextProps.editingOrder &&
    prevProps.savingOrder === nextProps.savingOrder &&
    prevProps.isInGroup === nextProps.isInGroup &&
    prevProps.isGroupStart === nextProps.isGroupStart
    // 注意：不再比较 updatedAt，因为拖拽操作会频繁更新它
    // 注意：不再比较 displayOrders，因为拖拽排序已经通过 currentDisplayOrder 处理
  );
});

MemoizedCompactTodoItem.displayName = 'MemoizedCompactTodoItem';

export default MemoizedCompactTodoItem;
