import { Todo } from '../../shared/types';

export interface SortConfig {
  activeTab: string;
  sortOption: string;
}

/**
 * 多Tab环境下的排序算法
 * @param todos 待办列表
 * @param config 排序配置
 * @returns 排序后的待办列表
 */
export function sortTodosWithTodayCompleted(todos: Todo[], config: SortConfig): Todo[] {
  const { activeTab, sortOption } = config;

  // 分离 today_completed 和其他状态
  const todayCompletedTodos: Todo[] = [];
  const otherTodos: Todo[] = [];

  todos.forEach(todo => {
    if (todo.status === 'today_completed') {
      todayCompletedTodos.push(todo);
    } else {
      otherTodos.push(todo);
    }
  });

  // 对非 today_complete 的待办进行正常排序
  const sortedOtherTodos = sortOtherTodos(otherTodos, activeTab, sortOption);

  // 对 today_completed 待办按 displayOrder 排序
  const sortedTodayCompletedTodos = sortTodayCompletedTodos(todayCompletedTodos, activeTab);

  // 合并：today_completed 始终在底部
  return [...sortedOtherTodos, ...sortedTodayCompletedTodos];
}

/**
 * 排序非今日完成待办
 */
function sortOtherTodos(todos: Todo[], activeTab: string, sortOption: string): Todo[] {
  return todos.sort((a, b) => {
    // 优先按 displayOrder 排序
    const displayOrderA = getDisplayOrder(a, activeTab);
    const displayOrderB = getDisplayOrder(b, activeTab);

    if (displayOrderA !== null && displayOrderB !== null) {
      return displayOrderA - displayOrderB;
    }

    // 如果没有 displayOrder，按其他逻辑排序
    if (sortOption === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    } else if (sortOption === 'deadline') {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }

    // 默认按创建时间排序
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * 排序今日完成待办（保持在底部）
 */
function sortTodayCompletedTodos(todos: Todo[], activeTab: string): Todo[] {
  return todos.sort((a, b) => {
    const displayOrderA = getDisplayOrder(a, activeTab);
    const displayOrderB = getDisplayOrder(b, activeTab);

    if (displayOrderA !== null && displayOrderB !== null) {
      return displayOrderA - displayOrderB;
    }

    // 按今日完成时间排序
    const timeA = a.todayCompletedAt ? new Date(a.todayCompletedAt).getTime() : 0;
    const timeB = b.todayCompletedAt ? new Date(b.todayCompletedAt).getTime() : 0;
    return timeA - timeB;
  });
}

/**
 * 获取待办在特定Tab中的显示顺序
 */
function getDisplayOrder(todo: Todo, activeTab: string): number | null {
  if (todo.displayOrders && todo.displayOrders[activeTab] !== undefined) {
    return todo.displayOrders[activeTab];
  }
  return todo.displayOrder ?? null;
}

/**
 * 计算新待办的 displayOrder
 * @param todos 当前待办列表
 * @param activeTab 当前Tab
 * @param insertPosition 插入位置 ('top' | 'bottom')
 * @returns 新的 displayOrder 值
 */
export function calculateNewDisplayOrder(
  todos: Todo[],
  activeTab: string,
  insertPosition: 'top' | 'bottom' = 'bottom'
): number {
  const filteredTodos = todos.filter(todo => todo.status !== 'today_completed');

  if (filteredTodos.length === 0) {
    return 0;
  }

  const displayOrders = filteredTodos
    .map(todo => getDisplayOrder(todo, activeTab))
    .filter((order): order is number => order !== null);

  if (displayOrders.length === 0) {
    return insertPosition === 'top' ? 0 : 0;
  }

  const maxOrder = Math.max(...displayOrders);
  const minOrder = Math.min(...displayOrders);

  return insertPosition === 'top' ? minOrder - 1 : maxOrder + 1;
}

/**
 * 检查待办是否可拖拽
 * @param todo 待办对象
 * @returns 是否可拖拽
 */
export function isTodoDraggable(todo: Todo): boolean {
  return todo.status !== 'today_completed';
}

/**
 * 过滤可拖拽的待办
 * @param todos 待办列表
 * @returns 可拖拽的待办列表
 */
export function filterDraggableTodos(todos: Todo[]): Todo[] {
  return todos.filter(todo => isTodoDraggable(todo));
}