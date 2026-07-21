import { useState, useCallback } from 'react';
import { App } from 'antd';
import { Todo } from '../../shared/types';
import {
  buildRenumberedOrder,
  computeAllFinalOrders
} from '../utils/orderConflictResolver';

interface UseOrderEditProps {
  todo: Todo;
  activeTab: string;
  sortedTodos: Todo[];
  allTodos: Todo[];
  parallelGroupsMap?: Map<string, Set<string>>;
  onUpdateDisplayOrder: (id: string, tabKey: string, order: number) => Promise<void>;
  onUpdateDisplayOrders?: (updates: Array<{uuid: string, tabKey: string, displayOrder: number}>) => Promise<void>;
}

/**
 * 序号编辑共享 Hook
 * 提供统一的序号编辑逻辑，支持冲突解决和并列分组同步
 */
export const useOrderEdit = (props: UseOrderEditProps) => {
  const { todo, activeTab, sortedTodos, allTodos, parallelGroupsMap, onUpdateDisplayOrders } = props;
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
      // 1. 构建重排顺序：把当前待办移到目标位置，其余保持相对顺序
      const reordered = buildRenumberedOrder(sortedTodos, todo.id, editingOrder);

      // 2. 全量重排：按 index 分配连续 displayOrder，并同步并列分组
      const updates = computeAllFinalOrders({
        newOrder: reordered,
        activeTab,
        parallelGroupsMap: parallelGroupsMap ?? new Map(),
        allTodos,
      });

      // 3. 一次性落库（含当前待办）+ 刷新（与紧凑拖拽同一通路）
      if (onUpdateDisplayOrders) {
        await onUpdateDisplayOrders(updates);
      } else {
        await window.electronAPI.todo.batchUpdateDisplayOrders(updates);
      }

      setEditingOrder(undefined);
      if (updates.length > 1) {
        message.success(`序号已保存，已重排 ${updates.length} 个待办`);
      } else {
        message.success('序号已保存');
      }
    } catch (error) {
      message.error('更新排序失败');
      console.error('Order save error:', error);
      setEditingOrder(undefined);
    } finally {
      setSavingOrder(false);
    }
  }, [todo, editingOrder, activeTab, sortedTodos, allTodos, parallelGroupsMap, onUpdateDisplayOrders, message]);

  return {
    editingOrder,
    setEditingOrder,
    savingOrder,
    handleOrderSave,
  };
};
