import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
import { getCompactAnimationConfig } from '../utils/refinedDragAnimations';
import { dragStartFeedback, dragEndFeedback } from '../utils/hapticFeedback';
import { dragPerformanceMonitor, getAnimationConfigByPerformance, PerformanceLevel } from '../utils/dragPerformanceMonitor';

interface DragDropTodoListProps {
  todos: Todo[];
  activeTab: string;
  onDragEnd: (newOrder: Todo[]) => void;
  renderTodoItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
  isTodoDraggable?: (todo: Todo) => boolean;
  useCompactAnimation?: boolean;
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
    // 启用默认动画以防止回弹
    animateLayoutChanges: () => true,
    transition: undefined,
  });

  // 获取动画配置
  const animationConfig = getAnimationConfig();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? 'none'  // 拖拽时禁用过渡
      : 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',  // 释放时使用平滑过渡
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
  useCompactAnimation = false,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 开发模式检测
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 简单节流函数实现（避免引入lodash依赖）
  const createThrottle = useCallback(() => {
    let lastCall = 0;
    return (fn: Function, delay: number) => {
      return (...args: any[]) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          fn(...args);
        }
      };
    };
  }, []);

  // 位置更新节流
  const throttledSetIndicatorPosition = useMemo(
    () => {
      const throttle = createThrottle();
      return throttle((position: number | null) => {
        setIndicatorPosition(position);
      }, 16); // 约60fps
    },
    [createThrottle]
  );

  // 位置计算逻辑优化
  const calculatePosition = useMemo(() => {
    return (overRect: any, activeRect: any, containerRect: any): number | null => {
      if (!activeRect || !overRect || !containerRect) return null;

      const activeRectTop = activeRect.translated?.top ?? activeRect.initial?.top ?? 0;
      const activeRectHeight = activeRect.translated?.height ?? activeRect.initial?.height ?? 0;

      const centerY = overRect.top + overRect.height / 2;
      const activeCenterY = activeRectTop + activeRectHeight / 2;

      if (activeCenterY < centerY) {
        return overRect.top - containerRect.top;
      } else {
        return overRect.bottom - containerRect.top;
      }
    };
  }, []);

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

    // 仅在开发模式启用性能监控
    if (isDevelopment) {
      dragPerformanceMonitor.startMonitoring();
    }

    // 改变光标状态
    document.body.style.cursor = 'grabbing';
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event;
    if (over && over.rect && containerRef.current) {
      const activeRect = event.active.rect.current;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (activeRect) {
        // 使用优化后的位置计算
        const targetPosition = calculatePosition(over.rect, activeRect, containerRect);
        // 使用节流更新
        throttledSetIndicatorPosition(targetPosition);
      }
    }
  };

  // 添加清理函数
  useEffect(() => {
    return () => {
      // 组件卸载时恢复光标状态
      document.body.style.cursor = 'default';
    };
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // 仅在开发模式停止性能监控
    if (isDevelopment) {
      dragPerformanceMonitor.stopMonitoring();
    }

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

  // 根据紧凑模式选择动画配置
  const useCompact = useCompactAnimation;
  const compactConfig = {
    opacity: 0.95,
    scale: 1.05,
    rotate: 2,
    shadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
    duration: 80,
  };

  const standardConfig = getAnimationConfig();

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
              opacity: useCompact ? compactConfig.opacity : standardConfig.opacity,
              transform: `scale(${useCompact ? compactConfig.scale : standardConfig.scale}) rotate(${useCompact ? compactConfig.rotate : standardConfig.rotate}deg)`,
              boxShadow: useCompact ? compactConfig.shadow : standardConfig.shadow,
              transition: `transform ${useCompact ? compactConfig.duration : standardConfig.transitionDuration}ms ease-out, box-shadow ${useCompact ? compactConfig.duration : standardConfig.transitionDuration}ms ease-out`,
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