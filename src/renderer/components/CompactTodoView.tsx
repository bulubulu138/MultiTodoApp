import React, { useMemo, useCallback, useState } from 'react';
import { Todo, TodoRelation } from '../../shared/types';
import { SortOption } from './Toolbar';
import { useThemeColors } from '../hooks/useThemeColors';
import { App } from 'antd';
import CompactTodoItem from './CompactTodoItem';
import { sortTodosWithTodayCompleted } from '../utils/sortUtils';
import DragDropTodoList from './DragDropTodoList';
import { resolveOrderConflicts, syncParallelGroupOrders } from '../utils/orderConflictResolver';

interface CompactTodoViewProps {
  todos: Todo[];
  allTodos?: Todo[];
  onUpdate: (id: string, updates: any) => Promise<void>;
  onView: (todo: Todo) => void;
  activeTab: string;
  relations: TodoRelation[];
  sortOption?: SortOption;
  onDragEnd?: (newOrder: Todo[]) => void;
  dragDropOrder?: Record<string, string[]>; // 从父组件传入的拖拽状态
}

/**
 * 紧凑视图主容器组件
 * 负责列表渲染和拖拽排序
 */
export const CompactTodoView: React.FC<CompactTodoViewProps> = ({
  todos,
  allTodos = [],
  onUpdate,
  onView,
  activeTab,
  relations,
  sortOption = 'manual',
  onDragEnd,
  dragDropOrder: propDragDropOrder = {}, // 从父组件传入的拖拽状态
}) => {
  const colors = useThemeColors();
  const { message } = App.useApp();

  // 序号编辑状态
  const [editingOrders, setEditingOrders] = useState<Record<string, number>>({});
  const [savingOrders, setSavingOrders] = useState<Record<string, boolean>>({});

  // 计算并列关系分组
  const parallelGroups = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    const visited = new Set<string>();

    const dfs = (todoId: string, groupSet: Set<string>) => {
      if (visited.has(todoId)) return;
      visited.add(todoId);
      groupSet.add(todoId);

      const parallelRels = relations.filter(r =>
        r.relation_type === 'parallel' &&
        (r.source_id === todoId || r.target_id === todoId)
      );

      parallelRels.forEach(rel => {
        const relatedId = String(rel.source_id) === todoId
          ? String(rel.target_id)
          : String(rel.source_id);
        dfs(relatedId, groupSet);
      });
    };

    todos.forEach(todo => {
      if (!visited.has(todo.id)) {
        const hasParallel = relations.some(r =>
          r.relation_type === 'parallel' &&
          (r.source_id === todo.id || r.target_id === todo.id)
        );

        if (hasParallel) {
          const groupSet = new Set<string>();
          dfs(todo.id, groupSet);
          groupSet.forEach(id => groups.set(id, groupSet));
        }
      }
    });

    return groups;
  }, [relations, todos]);

  // 排序后的待办列表
  const sortedTodos = useMemo(() => {
    // 优先使用父组件传入的 dragDropOrder 状态（拖动时）
    const currentDragOrder = propDragDropOrder[activeTab];

    if (currentDragOrder && currentDragOrder.length > 0) {
      // 如果有拖动状态，按照拖动顺序排序
      const orderMap = new Map(currentDragOrder.map((id, index) => [id, index]));
      return [...todos].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? 999999;
        const bIndex = orderMap.get(b.id) ?? 999999;
        return aIndex - bIndex;
      });
    }

    // 否则使用原有排序逻辑
    return sortTodosWithTodayCompleted(todos, {
      activeTab,
      sortOption,
    });
  }, [todos, activeTab, sortOption, propDragDropOrder]);

  // 处理今日完成状态切换
  const handleToggleTodayCompleted = async (todo: Todo) => {
    const newStatus = todo.status === 'today_completed' ? 'pending' : 'today_completed';
    const updates: any = {
      status: newStatus,
      todayCompletedAt: newStatus === 'today_completed' ? new Date().toISOString() : undefined,
    };
    await onUpdate(todo.id, updates);
  };

  // 处理序号保存
  const handleOrderSave = useCallback(async (
    todoId: string,
    newOrder: number,
    parallelGroup?: Set<string>
  ) => {
    setSavingOrders(prev => ({ ...prev, [todoId]: true }));

    try {
      // 1. 冲突解决
      const adjustments = resolveOrderConflicts({
        targetOrder: newOrder,
        currentTodoId: todoId,
        allTodos,
        activeTab
      });

      // 2. 批量更新
      const updates = [
        { uuid: todoId, tabKey: activeTab, displayOrder: newOrder },
        ...adjustments.map(adj => ({
          uuid: adj.id,
          tabKey: activeTab,
          displayOrder: adj.newOrder
        }))
      ];

      await window.electronAPI.todo.batchUpdateDisplayOrders(updates);

      if (adjustments.length > 0) {
        message.success(`序号 ${newOrder} 已占用，已自动调整 ${adjustments.length} 个待办的序号`);
      }

      // 3. 同步并列分组
      if (parallelGroup && parallelGroup.size > 1) {
        const groupUpdates = syncParallelGroupOrders({
          groupId: parallelGroup,
          currentTodoId: todoId,
          newOrder,
          activeTab
        });
        if (groupUpdates.length > 0) {
          await window.electronAPI.todo.batchUpdateDisplayOrders(groupUpdates);
        }
      }

      message.success('序号已保存');
      setEditingOrders(prev => {
        const newState = { ...prev };
        delete newState[todoId];
        return newState;
      });
    } catch (error) {
      message.error('更新排序失败');
      console.error('Order save error:', error);
      setEditingOrders(prev => {
        const newState = { ...prev };
        delete newState[todoId];
        return newState;
      });
    } finally {
      setSavingOrders(prev => {
        const newState = { ...prev };
        delete newState[todoId];
        return newState;
      });
    }
  }, [allTodos, activeTab, message]);

  // 处理紧凑模式拖动结束
  const handleCompactDragEnd = useCallback(async (newOrder: Todo[]) => {
    // 防御性检查：验证输入数据
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      console.warn('Invalid newOrder in handleCompactDragEnd:', newOrder);
      return;
    }

    // 拖拽状态管理完全委托给父组件（通过 onDragEnd 回调）
    // 父组件会：
    // 1. 设置 App.dragDropOrder 状态（乐观更新）
    // 2. 保存到数据库
    // 3. 延迟更新 todos 状态
    // CompactTodoView 通过 propDragDropOrder prop 接收更新后的状态
    if (onDragEnd) {
      await onDragEnd(newOrder);
    }
  }, [onDragEnd]);

  // 渲染单个待办项
  const renderTodoItem = useCallback((todo: Todo, isDragging?: boolean, dragHandleProps?: any) => {
    const canDrag = todo.status !== 'today_completed';
    const parallelGroup = parallelGroups.get(todo.id);
    const isInGroup = parallelGroup && parallelGroup.size > 1;
    const isGroupStart = isInGroup && (() => {
      const prevTodo = sortedTodos[sortedTodos.indexOf(todo) - 1];
      return !prevTodo || !parallelGroup.has(prevTodo.id);
    })();

    return (
      <CompactTodoItem
        todo={todo}
        onUpdate={onUpdate}
        onView={onView}
        onToggleTodayCompleted={handleToggleTodayCompleted}
        colors={colors}
        enableDrag={canDrag}
        dragHandleProps={dragHandleProps}
        // 新增 props
        currentDisplayOrder={todo.displayOrders?.[activeTab]}
        editingOrder={editingOrders[todo.id]}
        setEditingOrder={(value) => {
          if (value !== undefined) {
            setEditingOrders(prev => ({ ...prev, [todo.id]: value }));
          } else {
            setEditingOrders(prev => {
              const newState = { ...prev };
              delete newState[todo.id];
              return newState;
            });
          }
        }}
        onOrderSave={() => handleOrderSave(todo.id, editingOrders[todo.id]!, parallelGroup)}
        savingOrder={savingOrders[todo.id]}
        isInGroup={isInGroup}
        isGroupStart={isGroupStart}
      />
    );
  }, [parallelGroups, sortedTodos, activeTab, editingOrders, savingOrders, handleOrderSave, handleToggleTodayCompleted, colors, onUpdate]);

  return (
    <DragDropTodoList
      todos={sortedTodos}
      activeTab={activeTab}
      onDragEnd={handleCompactDragEnd}
      renderTodoItem={renderTodoItem}
      isTodoDraggable={(todo) => todo.status !== 'today_completed'}
      useCompactAnimation={true}
    />
  );
};

// 为 CompactTodoView 添加记忆化，优化性能并确保数据变化时能重新渲染
const MemoizedCompactTodoView = React.memo(CompactTodoView, (prevProps, nextProps) => {
  // 基础属性检查
  const basicChecks =
    prevProps.todos.length === nextProps.todos.length &&
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.sortOption === nextProps.sortOption &&
    prevProps.relations.length === nextProps.relations.length;

  // 如果基础检查失败，需要重新渲染
  if (!basicChecks) return false;

  // 检查 todos 数组内容是否真正变化
  // 首先检查数组引用是否变化（最常见且重要的变化）
  if (prevProps.todos !== nextProps.todos) return false;

  // 如果数组引用相同，再进行内容检查（可选，因为引用变化已经处理了大多数情况）
  // 使用轻量级策略：检查首尾元素的关键属性
  if (prevProps.todos.length > 0 && nextProps.todos.length > 0) {
    const firstChanged = prevProps.todos[0].id !== nextProps.todos[0].id ||
                        prevProps.todos[0].updatedAt !== nextProps.todos[0].updatedAt;
    const lastChanged = prevProps.todos[prevProps.todos.length - 1].id !== nextProps.todos[prevProps.todos.length - 1].id ||
                       prevProps.todos[prevProps.todos.length - 1].updatedAt !== nextProps.todos[prevProps.todos.length - 1].updatedAt;

    // 如果首尾元素有变化，需要重新渲染
    if (firstChanged || lastChanged) return false;
  }

  return basicChecks;
});

MemoizedCompactTodoView.displayName = 'MemoizedCompactTodoView';

export default MemoizedCompactTodoView;