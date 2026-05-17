/**
 * 修复版拖拽组件
 * 确保紧凑模式下的拖拽功能正常工作
 */

import React, { useState, useCallback } from 'react';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Todo } from '../../shared/types';

interface FixedDragDropTodoListProps {
  todos: Todo[];
  activeTab: string;
  onDragEnd: (newOrder: Todo[]) => void;
  renderTodoItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
  isTodoDraggable?: (todo: Todo) => boolean;
}

/**
 * 固定版可拖拽项
 */
const FixedSortableItem: React.FC<{
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
    animateLayoutChanges: () => false, // 禁用默认动画
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 1,
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

/**
 * 固定版拖拽手柄
 */
export const FixedDragHandle: React.FC<{
  isDraggable: boolean;
  attributes?: any;
  listeners?: any;
  className?: string;
  title?: string;
}> = ({ isDraggable, attributes, listeners, className = '', title }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    cursor: isDraggable ? 'grab' : 'not-allowed',
    userSelect: 'none',
    transition: 'all 0.2s ease',
    opacity: isDraggable ? (isHovering ? 0.7 : 0.5) : 0.2,
    transform: isPressed ? 'scale(0.95)' : 'scale(1)',
    background: isHovering ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
    color: isDraggable ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.2)',
    fontSize: '12px',
    lineHeight: '1',
  };

  return (
    <div
      className={`drag-handle ${className}`}
      style={handleStyle}
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
      {...(title ? { title } : {})}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      ⋮⋮
    </div>
  );
};

/**
 * 固定版位置指示器
 */
const FixedPlacementIndicator: React.FC<{
  position: number;
  visible: boolean;
}> = ({ position, visible }) => {
  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    right: '16px',
    top: `${position}px`,
    height: '2px',
    background: '#1890ff',
    boxShadow: '0 0 8px rgba(24, 144, 255, 0.5)',
    transition: 'top 0.2s ease, opacity 0.2s ease',
    zIndex: 1000,
    pointerEvents: 'none',
  };

  return <div style={style} />;
};

/**
 * 固定版拖拽预览
 */
const FixedDragOverlay: React.FC<{
  todo: Todo;
  renderItem: (todo: Todo, isDragging?: boolean, dragHandleProps?: any) => React.ReactNode;
}> = ({ todo, renderItem }) => {
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 9999,
    transformOrigin: 'center center',
    cursor: 'grabbing',
    opacity: 0.9,
    transform: 'scale(1.02) rotate(2deg)',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
  };

  return (
    <div style={overlayStyle} className="drag-overlay">
      {renderItem(todo, true, null)}
    </div>
  );
};

/**
 * 主固定版拖拽列表组件
 */
export const FixedDragDropTodoList: React.FC<FixedDragDropTodoListProps> = ({
  todos,
  activeTab,
  onDragEnd,
  renderTodoItem,
  isTodoDraggable,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);

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
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;
    if (!over || !over.rect) {
      setIndicatorPosition(null);
      return;
    }

    const overRect = over.rect;
    const activeRect = event.active.rect.current;

    if (activeRect) {
      // 提取 activeRect 属性，兼容 @dnd-kit/sortable v10 的新结构
      // activeRect 现在是 { initial: ClientRect | null; translated: ClientRect | null; }
      const activeRectTop = activeRect.translated?.top ?? activeRect.initial?.top ?? 0;
      const activeRectHeight = activeRect.translated?.height ?? activeRect.initial?.height ?? 0;

      const centerY = overRect.top + overRect.height / 2;
      const activeCenterY = activeRectTop + activeRectHeight / 2;

      let targetPosition: number;
      if (activeCenterY < centerY) {
        targetPosition = overRect.top;
      } else {
        targetPosition = overRect.bottom;
      }

      setIndicatorPosition(targetPosition);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    document.body.style.cursor = 'default';
    setIndicatorPosition(null);

    if (over && active.id !== over.id) {
      const oldIndex = todos.findIndex((todo) => todo.id === active.id);
      const newIndex = todos.findIndex((todo) => todo.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTodos = [...todos];
        const [movedTodo] = newTodos.splice(oldIndex, 1);
        newTodos.splice(newIndex, 0, movedTodo);
        onDragEnd(newTodos);
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
        <div className="drag-drop-todo-list" style={{ position: 'relative' }}>
          <FixedPlacementIndicator
            position={indicatorPosition || 0}
            visible={indicatorPosition !== null}
          />
          {todos.map((todo) => (
            <div key={todo.id} data-id={todo.id}>
              <FixedSortableItem
                todo={todo}
                renderItem={renderTodoItem}
                isDraggable={isTodoDraggable ? isTodoDraggable(todo) : true}
              />
            </div>
          ))}
        </div>
      </SortableContext>

      {activeTodo && (
        <FixedDragOverlay
          todo={activeTodo}
          renderItem={renderTodoItem}
        />
      )}
    </DndContext>
  );
};

export default FixedDragDropTodoList;