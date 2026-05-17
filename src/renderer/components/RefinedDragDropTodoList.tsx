/**
 * 精致拖拽列表面板
 * 使用现代极简主义设计，创造丝滑的交互体验
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDndMonitor,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { Todo } from '../../shared/types';
import {
  getRefinedAnimationConfig,
  refinedDragAnimation,
  calculateRefinedSnap,
  RefinedAnimationUtils
} from '../utils/refinedDragAnimations';
import { subtleHapticFeedback, successHapticFeedback } from '../utils/hapticFeedback';

interface RefinedDragDropTodoListProps {
  todos: Todo[];
  activeTab: string;
  onDragEnd: (newOrder: Todo[]) => void;
  renderTodoItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
  isTodoDraggable?: (todo: Todo) => boolean;
}

/**
 * 精致可拖拽项组件
 */
const RefinedSortableItem: React.FC<{
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
    animateLayoutChanges: () => false, // 禁用默认动画，使用我们的精致动画
  });

  const config = getRefinedAnimationConfig();
  const elementRef = useRef<HTMLDivElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? config.dragOpacity : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const itemStyle = {
    ...style,
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={itemStyle}
      className={`refined-draggable-item ${isDragging ? 'dragging' : ''}`}
    >
      {renderItem(todo, isDragging, { attributes, listeners })}
    </div>
  );
};

/**
 * 精致拖拽手柄组件
 */
export const RefinedDragHandle: React.FC<{
  isDraggable: boolean;
  attributes?: any;
  listeners?: any;
  className?: string;
}> = ({ isDraggable, attributes, listeners, className = '' }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    cursor: isDraggable ? 'grab' : 'not-allowed',
    userSelect: 'none',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    opacity: isDraggable ? (isHovering ? 0.8 : 0.6) : 0.2,
    transform: isPressed ? 'scale(0.95)' : isHovering ? 'scale(1.05)' : 'scale(1)',
    background: isPressed
      ? 'rgba(24, 144, 255, 0.1)'
      : isHovering
      ? 'rgba(0, 0, 0, 0.04)'
      : 'transparent',
    border: isHovering
      ? '1px solid rgba(24, 144, 255, 0.2)'
      : '1px solid transparent',
    color: isPressed
      ? 'rgba(24, 144, 255, 1)'
      : isHovering
      ? 'rgba(24, 144, 255, 0.8)'
      : 'rgba(0, 0, 0, 0.45)',
  };

  const iconStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: isHovering ? 'translateY(-1px)' : 'translateY(0)',
  };

  return (
    <div
      className={`refined-drag-handle ${className}`}
      style={handleStyle}
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      <div className="handle-icon" style={iconStyle}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="13" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
          <circle cx="13" cy="13" r="1.5" />
        </svg>
      </div>
    </div>
  );
};

/**
 * 精致位置指示器组件
 */
const RefinedPlacementIndicator: React.FC<{
  position: number;
  visible: boolean;
}> = ({ position, visible }) => {
  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    right: '16px',
    top: `${position}px`,
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #1890ff, transparent)',
    borderRadius: '2px',
    boxShadow: `
      0 0 12px rgba(24, 144, 255, 0.5),
      0 0 24px rgba(24, 144, 255, 0.3)
    `,
    transformOrigin: 'left center',
    zIndex: 1000,
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transform: visible ? 'scaleX(1)' : 'scaleX(0)',
    transition: `
      top 0.2s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)
    `,
  };

  return (
    <>
      <div style={style} className="refined-placement-indicator" />
      <div
        style={{
          position: 'absolute',
          left: '16px',
          right: '16px',
          top: `${position}px`,
          height: '20px',
          background: 'radial-gradient(circle, rgba(24, 144, 255, 0.2), transparent 70%)',
          transform: 'translateY(-10px)',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      />
    </>
  );
};

/**
 * 精致拖拽预览组件
 */
const RefinedDragOverlay: React.FC<{
  todo: Todo;
  renderItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
}> = ({ todo, renderItem }) => {
  const config = getRefinedAnimationConfig();

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 9999,
    transformOrigin: 'center center',
    cursor: 'grabbing',
    opacity: config.dragOpacity,
    transform: `scale(${config.dragScale}) rotate(${config.dragRotation}deg)`,
    boxShadow: config.dragShadow,
    filter: `blur(${config.dragBlur}px)`,
    transition: `
      transform ${config.dragStartDuration}ms ${config.dragStartEasing},
      box-shadow ${config.dragStartDuration}ms ${config.dragStartEasing},
      opacity ${config.dragStartDuration}ms ${config.dragStartEasing}
    `,
  };

  return (
    <div style={overlayStyle} className="refined-drag-overlay">
      {renderItem(todo, true, null)}
      <div
        style={{
          position: 'absolute',
          inset: '-4px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1), rgba(24, 144, 255, 0))',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </div>
  );
};

/**
 * 主精致拖拽列表组件
 */
export const RefinedDragDropTodoList: React.FC<RefinedDragDropTodoListProps> = ({
  todos,
  activeTab,
  onDragEnd,
  renderTodoItem,
  isTodoDraggable,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 精致的传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);

    // 精致的触感反馈
    subtleHapticFeedback();

    // 改变光标状态
    document.body.style.cursor = 'grabbing';

    // 添加拖拽开始动画
    const activeElement = document.querySelector(`[data-id="${event.active.id}"]`);
    if (activeElement) {
      activeElement.classList.add('animate-in');
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;
    if (!over || !over.rect) {
      setIndicatorPosition(null);
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // 计算相对位置
    const overRect = over.rect;
    const activeRect = event.active.rect.current;

    if (activeRect) {
      // 精致的磁吸计算
      // 提取 activeRect 属性，兼容 @dnd-kit/sortable v10 的新结构
      // activeRect 现在是 { initial: ClientRect | null; translated: ClientRect | null; }
      const activeRectTop = activeRect.translated?.top ?? activeRect.initial?.top ?? 0;
      const activeRectHeight = activeRect.translated?.height ?? activeRect.initial?.height ?? 0;

      const snapResult = calculateRefinedSnap(
        activeRectTop,
        overRect.top + overRect.height / 2,
        getRefinedAnimationConfig().snapThreshold,
        getRefinedAnimationConfig().snapStrength
      );

      // 判断是在目标元素的上半部分还是下半部分
      const centerY = overRect.top + overRect.height / 2;
      const activeCenterY = activeRectTop + activeRectHeight / 2;

      let targetPosition: number;
      if (activeCenterY < centerY) {
        targetPosition = overRect.top - containerRect.top;
      } else {
        targetPosition = overRect.bottom - containerRect.top;
      }

      setIndicatorPosition(targetPosition);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    // 恢复光标状态
    document.body.style.cursor = 'default';

    // 清除指示器
    setIndicatorPosition(null);

    if (over && active.id !== over.id) {
      const oldIndex = todos.findIndex((todo) => todo.id === active.id);
      const newIndex = todos.findIndex((todo) => todo.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 创建新的排序数组
        const newTodos = [...todos];
        const [movedTodo] = newTodos.splice(oldIndex, 1);
        newTodos.splice(newIndex, 0, movedTodo);

        // 调用回调函数
        onDragEnd(newTodos);

        // 成功反馈
        successHapticFeedback();

        // 添加精致的成功动画
        setTimeout(() => {
          const movedElement = document.querySelector(`[data-id="${active.id}"]`);
          if (movedElement) {
            movedElement.classList.add('elastic-drop');
            setTimeout(() => {
              movedElement.classList.remove('elastic-drop');
            }, 350);
          }
        }, 50);
      }
    }

    setActiveId(null);
  }, [todos, onDragEnd]);

  // 清理函数
  React.useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

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
          className="refined-drag-container"
          style={{
            position: 'relative',
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          <RefinedPlacementIndicator
            position={indicatorPosition || 0}
            visible={indicatorPosition !== null}
          />
          {todos.map((todo) => (
            <div key={todo.id} data-id={todo.id}>
              <RefinedSortableItem
                todo={todo}
                renderItem={renderTodoItem}
                isDraggable={isTodoDraggable ? isTodoDraggable(todo) : true}
              />
            </div>
          ))}
        </div>
      </SortableContext>

      {createPortal(
        <DragOverlay>
          {activeTodo ? (
            <RefinedDragOverlay
              todo={activeTodo}
              renderItem={renderTodoItem}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
};

export default RefinedDragDropTodoList;