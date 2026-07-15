import type { Todo } from '../../shared/types.js';

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
 * @deprecated 使用 computeParallelGroupFinalOrders 替代
 * 保留此函数以维持向后兼容性
 * @param config 分组同步配置
 * @returns 需要更新的待办列表，由调用方负责执行 IPC
 */
export function syncParallelGroupOrders(
  config: ParallelGroupSyncConfig
): Array<{uuid: string, tabKey: string, displayOrder: number}> {
  const { groupId, currentTodoId, newOrder, activeTab } = config;

  if (groupId.size <= 1) return [];

  return Array.from(groupId)
    .filter(id => id !== currentTodoId)
    .map(id => ({
      uuid: String(id),
      tabKey: activeTab,
      displayOrder: newOrder
    }));
}

interface ComputeOrdersConfig {
  newOrder: Todo[];
  activeTab: string;
  parallelGroupsMap: Map<string, Set<string>>;
}

/**
 * 预计算所有待办的最终displayOrders，包括并列分组同步
 * Phase 1 优化：一次性计算所有更新，避免重复调用数据库
 *
 * @param config 预计算配置
 * @returns 所有需要更新的待办列表（已去重）
 */
export function computeParallelGroupFinalOrders(
  config: ComputeOrdersConfig
): Array<{uuid: string, tabKey: string, displayOrder: number}> {
  const { newOrder, activeTab, parallelGroupsMap } = config;
  const updates: Array<{uuid: string, tabKey: string, displayOrder: number}> = [];
  const processedGroups = new Set<string>();

  // 1. 主序号更新（基于拖拽后的新位置）
  const mainUpdates = newOrder.map((todo, index) => ({
    uuid: todo.id,
    tabKey: activeTab,
    displayOrder: index
  }));

  // 2. 并列分组同步（去重处理，避免重复更新）
  for (const [todoId, group] of parallelGroupsMap) {
    if (group.size <= 1) continue;

    // 生成分组唯一标识，避免重复处理同一分组
    const groupKey = Array.from(group).sort().join(',');
    if (processedGroups.has(groupKey)) continue;
    processedGroups.add(groupKey);

    // 找到该分组中待办的新序号
    const newIndex = newOrder.findIndex(t => t.id === todoId);
    if (newIndex !== -1) {
      // 为组内其他成员同步相同序号
      Array.from(group)
        .filter(id => id !== todoId)
        .forEach(memberId => {
          updates.push({
            uuid: memberId,
            tabKey: activeTab,
            displayOrder: newIndex
          });
        });
    }
  }

  return [...mainUpdates, ...updates];
}

interface BatchConflictResolutionConfig {
  proposedUpdates: Array<{uuid: string, displayOrder: number}>;
  allTodos: Todo[];
  activeTab: string;
}

/**
 * 批量解决displayOrders冲突，替代递归式解决
 * Phase 2 优化：一次性处理所有冲突，提升计算性能
 *
 * @param config 批量冲突解决配置
 * @returns 冲突调整列表
 */
export function resolveAllDisplayOrderConflicts(
  config: BatchConflictResolutionConfig
): Array<{uuid: string, oldOrder: number, newOrder: number}> {
  const { proposedUpdates, allTodos, activeTab } = config;
  const occupiedOrders = new Map<number, string>();
  const adjustments: Array<{uuid: string, oldOrder: number, newOrder: number}> = [];

  // 构建当前序号占用映射
  allTodos.forEach(todo => {
    if (todo.displayOrders && todo.displayOrders[activeTab] != null) {
      occupiedOrders.set(todo.displayOrders[activeTab], todo.id);
    }
  });

  // 处理提议的更新，解决冲突
  const sortedProposals = [...proposedUpdates].sort((a, b) => a.displayOrder - b.displayOrder);

  for (const proposal of sortedProposals) {
    const { uuid, displayOrder: targetOrder } = proposal;
    let finalOrder = targetOrder;

    // 找到第一个可用序号
    while (occupiedOrders.has(finalOrder) && occupiedOrders.get(finalOrder) !== uuid) {
      finalOrder++;
    }

    if (finalOrder !== targetOrder) {
      adjustments.push({
        uuid,
        oldOrder: targetOrder,
        newOrder: finalOrder
      });
    }

    // 更新占用映射
    occupiedOrders.set(finalOrder, uuid);
  }

  return adjustments;
}

interface CompleteComputeOrdersConfig {
  newOrder: Todo[];
  activeTab: string;
  parallelGroupsMap: Map<string, Set<string>>;
  allTodos: Todo[];
}

/**
 * 完整预计算所有待办的最终displayOrders
 * Phase 2 优化：包括并列分组同步和批量冲突解决
 *
 * @param config 完整预计算配置
 * @returns 最终需要更新的待办列表
 */
export function computeAllFinalOrders(
  config: CompleteComputeOrdersConfig
): Array<{uuid: string, tabKey: string, displayOrder: number}> {
  const { newOrder, activeTab, parallelGroupsMap, allTodos } = config;

  // 1. 计算主序号和并列分组同步
  const proposedUpdates = computeParallelGroupFinalOrders({
    newOrder,
    activeTab,
    parallelGroupsMap
  });

  // 2. 批量解决冲突
  const adjustments = resolveAllDisplayOrderConflicts({
    proposedUpdates,
    allTodos,
    activeTab
  });

  // 3. 应用冲突调整
  const finalUpdates = proposedUpdates.map(update => {
    const adjustment = adjustments.find(adj => adj.uuid === update.uuid);
    return adjustment
      ? { ...update, displayOrder: adjustment.newOrder }
      : update;
  });

  return finalUpdates;
}

/**
 * 构建全量重排后的顺序数组（专注模式序号编辑用）
 *
 * 把 currentTodoId 对应待办移到 targetPosition（钳制到合法范围），
 * 其余待办保持原有相对顺序。返回的数组交给 computeAllFinalOrders
 * 按 index 分配连续 displayOrder，行为等价于紧凑模式拖拽：
 * 覆盖全部可见待办（含原本无序号的），结果无空号。
 *
 * @param sortedTodos  当前可见、已按显示顺序排好的列表（专注模式下即 todos 数组）
 * @param currentTodoId 要移动的待办 id
 * @param targetPosition 目标位置（用户输入的序号）
 * @returns 重排后的 Todo[]，数组顺序即新位置
 */
export function buildRenumberedOrder(
  sortedTodos: Todo[],
  currentTodoId: string,
  targetPosition: number
): Todo[] {
  const currentIndex = sortedTodos.findIndex(t => t.id === currentTodoId);
  if (currentIndex === -1) {
    return sortedTodos; // 防御：目标待办不在列表
  }

  // 1. 移除当前待办
  const remaining = sortedTodos.filter(t => t.id !== currentTodoId);
  const currentTodo = sortedTodos[currentIndex];

  // 2. 钳制 targetPosition 到 [0, remaining.length]（合法插入位置）
  const clamped = Math.max(0, Math.min(targetPosition, remaining.length));

  // 3. 插入目标位置
  const result = [...remaining];
  result.splice(clamped, 0, currentTodo);
  return result;
}