import { Todo } from '../../shared/types';

interface ConflictResolutionConfig {
  targetOrder: number;
  currentTodoId: string;
  allTodos: Todo[];
  activeTab: string;
}

export interface ConflictAdjustment {
  id: string;
  oldOrder: number;
  newOrder: number;
}

/**
 * 递归式冲突解决算法
 * 处理链式冲突：A占1，B设1→A移2，C占2→B移3
 *
 * @param config 冲突解决配置
 * @returns 需要调整的待办列表
 */
export function resolveOrderConflicts(
  config: ConflictResolutionConfig
): ConflictAdjustment[] {
  const { targetOrder, currentTodoId, allTodos, activeTab } = config;

  // 1. 获取当前 tab 所有有序号的待办（排除当前待办）
  const currentTabTodos = allTodos.filter(t =>
    t.id !== currentTodoId &&
    t.displayOrders &&
    t.displayOrders[activeTab] != null
  );

  // 2. 构建序号到待办的映射
  const orderToTodoMap = new Map<number, Todo>();
  currentTabTodos.forEach(t => {
    const order = t.displayOrders![activeTab]!;
    orderToTodoMap.set(order, t);
  });

  // 3. 递归式冲突解决
  const adjustments: ConflictAdjustment[] = [];

  const resolveConflict = (targetOrder: number): void => {
    const conflictTodo = orderToTodoMap.get(targetOrder);

    if (!conflictTodo) {
      return; // 没有冲突
    }

    const nextOrder = targetOrder + 1;
    resolveConflict(nextOrder); // 递归检查下一个序号

    adjustments.push({
      id: conflictTodo.id,
      oldOrder: targetOrder,
      newOrder: nextOrder
    });

    // 更新映射（模拟移动后的状态）
    orderToTodoMap.delete(targetOrder);
    orderToTodoMap.set(nextOrder, conflictTodo);
  };

  resolveConflict(targetOrder);
  return adjustments;
}

interface ParallelGroupSyncConfig {
  groupId: Set<string>;
  currentTodoId: string;
  newOrder: number;
  activeTab: string;
}

/**
 * 并列分组同步
 * 当分组内某个待办的序号改变时，同步整个分组
 *
 * @param config 分组同步配置
 */
export async function syncParallelGroupOrders(
  config: ParallelGroupSyncConfig
): Promise<void> {
  const { groupId, currentTodoId, newOrder, activeTab } = config;

  if (groupId.size <= 1) return; // 单个待办无需同步

  const groupUpdates = Array.from(groupId)
    .filter(id => id !== currentTodoId)
    .map(id => ({
      uuid: String(id),
      tabKey: activeTab,
      displayOrder: newOrder
    }));

  if (groupUpdates.length > 0) {
    await window.electronAPI.todo.batchUpdateDisplayOrders(groupUpdates);
  }
}