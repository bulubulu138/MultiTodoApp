import React, { useMemo, useState, useCallback } from 'react';
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
    return sortTodosWithTodayCompleted(todos, {
      activeTab,
      sortOption,
    });
  }, [todos, activeTab, sortOption]);

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
        await syncParallelGroupOrders({
          groupId: parallelGroup,
          currentTodoId: todoId,
          newOrder,
          activeTab
        });
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
      onDragEnd={onDragEnd || (() => {})}
      renderTodoItem={renderTodoItem}
      isTodoDraggable={(todo) => todo.status !== 'today_completed'}
    />
  );
};

export default CompactTodoView;