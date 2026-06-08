import React, { useRef, useEffect, useState } from 'react';
import { App, Button, Checkbox, CheckboxChangeEvent, InputNumber, Tooltip } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import { useCompactTodoEdit } from '../hooks/useCompactTodoEdit';
import { getDeadlineDisplay } from '../utils/deadlineFormatter';

interface CompactTodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onView: (todo: Todo) => void | Promise<void>;
  activeTab: string;
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
  activeTab,
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
  const { message } = App.useApp();
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
    handleCompositionStart,
    handleCompositionEnd,
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

  const isCompleted = todo.status === 'completed';

  // 检查是否可拖拽
  const canDrag = true;

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
            color: currentDisplayOrder !== undefined ? colors.infoColor : colors.textMuted,
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

  // 计算截止时间显示
  const deadlineInfo = todo.deadline ? getDeadlineDisplay(todo.deadline) : null;

  // 样式定义 - 优化为更紧凑的布局
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '36px', // 稍微减小高度以更紧凑
    padding: '0 4px', // 减少内边距
    margin: '1px 0', // 减少外边距
    backgroundColor: deadlineInfo?.isOverdue ? (document.documentElement.dataset.theme === 'dark' ? 'rgba(248, 113, 113, 0.14)' : '#fff1f0') : 'transparent', // 已过期待办的背景
    borderLeft: deadlineInfo?.isOverdue ? `3px solid ${colors.dangerColor}` : undefined, // 已过期待办的左边框
    borderRadius: '3px', // 稍微减小圆角
    transition: 'background-color 0.2s, opacity 0.2s',
    cursor: canDrag ? 'move' : 'pointer',
    opacity: isCompleted ? 0.4 : 1,
    position: 'relative', // 为绝对定位的截止时间提供定位上下文
  };

  const checkboxStyle: React.CSSProperties = {
    marginRight: '6px', // 稍微减小间距
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  };

  const startButtonStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    minWidth: 24,
    marginRight: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: '#ffffff',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  };

  const titleInputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '13px', // 稍微减小字体
    color: 'inherit',
    padding: '0 2px', // 减少内边距
    paddingRight: deadlineInfo ? '90px' : '2px', // 如果有截止时间，为右侧留出空间
    outline: 'none',
    textDecoration: isCompleted ? 'line-through' : 'none',
    cursor: isEditing ? 'text' : 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const deadlineBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    padding: '2px 6px',
    borderRadius: '3px',
    backgroundColor: document.documentElement.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.95)',
    color: deadlineInfo?.color,
    fontWeight: 500,
    pointerEvents: 'none', // 不阻止点击事件
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
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
    color: document.documentElement.dataset.theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : colors.dragHandleText,
    transition: 'opacity 0.2s ease',
    backgroundColor: document.documentElement.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.92)' : colors.dragHandleBg,
    border: document.documentElement.dataset.theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.96)' : `1px solid ${colors.dragHandleBorder}`
  };

  // 处理容器双击事件
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== inputRef.current) {
      onView(todo);
    }
  };

  // 处理checkbox变化：直接切换为已完成/待办状态
  const handleCheckboxChange = async (e: CheckboxChangeEvent) => {
    e.stopPropagation(); // 防止触发容器的点击事件

    try {
      const newState = isCompleted ? 'pending' : 'completed';
      const updates: any = {
        status: newState,
        completedAt: newState === 'completed' ? new Date().toISOString() : undefined,
        todayCompletedAt: undefined,
        updatedAt: new Date().toISOString()
      };

      await onUpdate(todo.id, updates);
    } catch (error) {
      console.error('Failed to toggle completed status:', error);
    }
  };

  // 开始任务：仅用于待办池紧凑模式，将任务送入今日事
  const handleStartTask = async (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();

    if (!todo.id || todo.status !== 'pending') return;

    try {
      await onUpdate(todo.id, { status: 'in_progress' });
      message.success('任务已进入"今日事"');
    } catch (error) {
      message.error('启动任务失败');
      console.error('Failed to start task:', error);
    }
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`compact-todo-item ${isCompleted ? 'completed' : ''}`}
      onDoubleClick={handleContainerDoubleClick}
    >
      {/* 拖拽手柄（在拖拽模式下显示） - 移至左侧 */}
      {enableDrag && (
        <div
          style={dragHandleStyle}
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          onMouseEnter={() => setIsHoveringDragHandle(true)}
          onMouseLeave={() => setIsHoveringDragHandle(false)}
        >
          ⋮⋮
        </div>
      )}

      {/* 待办池显示开始按钮，其他Tab保持原有Checkbox */}
      {activeTab === 'pending' && todo.status === 'pending' ? (
        <Tooltip title="进入今日事">
          <Button
            className="start-task-button"
            shape="circle"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={handleStartTask}
            style={startButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
            }}
          />
        </Tooltip>
      ) : (
        <Checkbox
          checked={isCompleted}
          onChange={handleCheckboxChange}
          style={checkboxStyle}
        />
      )}

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
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        style={titleInputStyle}
        disabled={isSaving}
        placeholder="输入待办标题..."
      />

      {/* 截止时间显示 */}
      {deadlineInfo && (
        <div style={deadlineBadgeStyle}>
          {deadlineInfo.text}
        </div>
      )}
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
    prevProps.activeTab === nextProps.activeTab &&
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
