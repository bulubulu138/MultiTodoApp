import { useState, useCallback } from 'react';
import { App } from 'antd';
import { Todo } from '../../shared/types';
import {
  resolveOrderConflicts,
  syncParallelGroupOrders
} from '../utils/orderConflictResolver';

interface UseOrderEditProps {
  todo: Todo;
  activeTab: string;
  allTodos: Todo[];
  parallelGroup?: Set<string>;
  onUpdateDisplayOrder: (id: string, tabKey: string, order: number) => Promise<void>;
}

/**
 * 序号编辑共享 Hook
 * 提供统一的序号编辑逻辑，支持冲突解决和并列分组同步
 */
export const useOrderEdit = (props: UseOrderEditProps) => {
  const { todo, activeTab, allTodos, parallelGroup, onUpdateDisplayOrder } = props;
  const [editingOrder, setEditingOrder] = useState<number | undefined>();
  const [savingOrder, setSavingOrder] = useState(false);
  const { message } = App.useApp();

  const handleOrderSave = useCallback(async () => {
    if (!todo.id || editingOrder === undefined) return;

    const currentValue = todo.displayOrders && todo.displayOrders[activeTab];
    if (editingOrder === currentValue) {
      setEditingOrder(undefined);
      return;
    }

    setSavingOrder(true);

    try {
      // 1. 冲突解决
      const adjustments = resolveOrderConflicts({
        targetOrder: editingOrder,
        currentTodoId: todo.id,
        allTodos,
        activeTab
      });

      // 2. 批量更新冲突的待办
      if (adjustments.length > 0) {
        const updates = adjustments.map(adj => ({
          uuid: String(adj.id),
          tabKey: activeTab,
          displayOrder: adj.newOrder
        }));

        await window.electronAPI.todo.batchUpdateDisplayOrders(updates);
        message.success(`序号 ${editingOrder} 已占用，已自动调整 ${adjustments.length} 个待办的序号`);
      }

      // 3. 同步并列分组
      if (parallelGroup && parallelGroup.size > 1) {
        await syncParallelGroupOrders({
          groupId: parallelGroup,
          currentTodoId: todo.id,
          newOrder: editingOrder,
          activeTab
        });
      }

      // 4. 设置当前待办的序号
      await onUpdateDisplayOrder(todo.id, activeTab, editingOrder);

      setEditingOrder(undefined);
      message.success('序号已保存');
    } catch (error) {
      message.error('更新排序失败');
      console.error('Order save error:', error);
      setEditingOrder(undefined);
    } finally {
      setSavingOrder(false);
    }
  }, [todo.id, editingOrder, activeTab, allTodos, parallelGroup, onUpdateDisplayOrder, message]);

  return {
    editingOrder,
    setEditingOrder,
    savingOrder,
    handleOrderSave,
  };
};