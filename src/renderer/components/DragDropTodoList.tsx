import React, { useState, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragMoveEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Todo } from '../../shared/types';
import { shouldReduceMotion, getAnimationConfig } from '../utils/dragAnimations';
import { dragStartFeedback, dragEndFeedback } from '../utils/hapticFeedback';
import { dragPerformanceMonitor, getAnimationConfigByPerformance, PerformanceLevel } from '../utils/dragPerformanceMonitor';

interface DragDropTodoListProps {
  todos: Todo[];
  activeTab: string;
  onDragEnd: (newOrder: Todo[]) => void;
  renderTodoItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
  isTodoDraggable?: (todo: Todo) => boolean;
}

// 位置指示器组件
const PlacementIndicator: React.FC<{
  position: number;
  visible: boolean;
}> = ({ position, visible }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: position,
        height: '2px',
        backgroundColor: '#1890ff',
        transformOrigin: 'left',
        zIndex: 1000,
        boxShadow: '0 0 8px rgba(24, 144, 255, 0.5)',
        transition: 'top 150ms ease-out',
      }}
    />
  );
};

// 可排序的单个任务项组件
const SortableTodoItem: React.FC<{
  todo: Todo;
  renderItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
  isDraggable?: boolean;
}> = ({ todo, renderItem, isDraggable = true }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    disabled: !isDraggable,
    // 完全禁用 @dnd-kit 默认动画
    animateLayoutChanges: () => false,
    transition: null,
  });

  // 获取动画配置
  const animationConfig = getAnimationConfig();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // 拖拽时禁用过渡以提高性能
    opacity: isDragging ? animationConfig.opacity : 1,
    scale: isDragging ? 1.02 : 1,
    boxShadow: isDragging ? animationConfig.shadow : 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`todo-item-sortable ${isDragging ? 'dragging' : ''}`}
    >
      {renderItem(todo, isDragging, { attributes, listeners })}
    </div>
  );
};

// 主拖拽列表组件
export const DragDropTodoList: React.FC<DragDropTodoListProps> = ({
  todos,
  activeTab,
  onDragEnd,
  renderTodoItem,
  isTodoDraggable,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 配置拖拽传感器 - 移除距离限制，实现立即响应
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 0,      // 无延迟
        tolerance: 5,  // 小容差防止误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);

    // 触感反馈
    dragStartFeedback();

    // 开始性能监控
    dragPerformanceMonitor.startMonitoring();

    // 改变光标状态
    document.body.style.cursor = 'grabbing';
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event;
    if (over && over.rect && containerRef.current) {
      // 计算放置位置指示线
      const overRect = over.rect;
      const activeRect = event.active.rect.current;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (activeRect) {
        // 提取 activeRect 属性，兼容 @dnd-kit/sortable v10 的新结构
        // activeRect 现在是 { initial: ClientRect | null; translated: ClientRect | null; }
        const activeRectTop = activeRect.translated?.top ?? activeRect.initial?.top ?? 0;
        const activeRectHeight = activeRect.translated?.height ?? activeRect.initial?.height ?? 0;

        // 判断是在目标元素的上半部分还是下半部分
        const centerY = overRect.top + overRect.height / 2;
        const activeCenterY = activeRectTop + activeRectHeight / 2;

        let targetPosition: number;
        if (activeCenterY < centerY) {
          // 在上半部分，显示在目标元素上方
          targetPosition = overRect.top;
        } else {
          // 在下半部分，显示在目标元素下方
          targetPosition = overRect.bottom;
        }

        // 关键修复：转换为相对于容器的坐标
        const relativePosition = targetPosition - containerRect.top;
        setIndicatorPosition(relativePosition);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // 停止性能监控
    dragPerformanceMonitor.stopMonitoring();

    // 恢复光标状态
    document.body.style.cursor = 'default';

    if (over && active.id !== over.id) {
      const oldIndex = todos.findIndex((todo) => todo.id === active.id);
      const newIndex = todos.findIndex((todo) => todo.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 创建新的待办数组
        const newTodos = [...todos];
        const [movedTodo] = newTodos.splice(oldIndex, 1);
        newTodos.splice(newIndex, 0, movedTodo);

        // 立即触发数据更新，不等待动画
        onDragEnd(newTodos);

        // 成功拖拽反馈
        dragEndFeedback();
      }
    }

    setActiveId(null);
    setIndicatorPosition(null);
  };

  const activeTodo = todos.find((todo) => todo.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={todos.map((todo) => todo.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={containerRef}
          className="drag-drop-todo-list"
          style={{ position: 'relative' }}
        >
          <PlacementIndicator
            position={indicatorPosition || 0}
            visible={indicatorPosition !== null}
          />
          {todos.map((todo) => (
            <SortableTodoItem
              key={todo.id}
              todo={todo}
              renderItem={renderTodoItem}
              isDraggable={isTodoDraggable ? isTodoDraggable(todo) : true}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTodo ? (
          <div
            className="drag-overlay"
            style={{
              opacity: 0.85,
              transform: `scale(${getAnimationConfig().scale}) rotate(${getAnimationConfig().rotate}deg)`,
              boxShadow: getAnimationConfig().shadow,
              transition: `transform ${getAnimationConfig().transitionDuration}ms ease-out, box-shadow ${getAnimationConfig().transitionDuration}ms ease-out`,
              cursor: 'grabbing',
            }}
          >
            {renderTodoItem(activeTodo, true, null)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DragDropTodoList;