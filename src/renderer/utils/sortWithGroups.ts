/**
 * 分组排序工具函数
 * 用于在所有排序模式下保持并列待办的分组
 */

import { Todo, TodoRelation } from '../../shared/types';
import { SortOption } from '../components/Toolbar';

/**
 * 使用迭代算法构建并列关系分组（性能优化版）
 * 返回 Map: todoId -> Set<todoId> (该待办所属的分组)
 */
export function buildParallelGroups(
  todos: Todo[],
  relations: TodoRelation[]
): Map<number, Set<number>> {
  const groups = new Map<number, Set<number>>();
  const visited = new Set<number>();

  // 预处理并列关系，构建邻接表
  const parallelRelations = relations.filter(r => r.relation_type === 'parallel');
  const adjacencyMap = new Map<number, Set<number>>();

  parallelRelations.forEach(r => {
    if (!adjacencyMap.has(r.source_id)) {
      adjacencyMap.set(r.source_id, new Set());
    }
    if (!adjacencyMap.has(r.target_id)) {
      adjacencyMap.set(r.target_id, new Set());
    }
    adjacencyMap.get(r.source_id)!.add(r.target_id);
    adjacencyMap.get(r.target_id)!.add(r.source_id);
  });

  // 使用迭代BFS替代递归DFS
  todos.forEach(todo => {
    const todoId = todo.id!;
    if (visited.has(todoId)) return;

    // 检查是否有并列关系
    if (!adjacencyMap.has(todoId)) return;

    const groupSet = new Set<number>();
    const stack = [todoId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      groupSet.add(currentId);

      // 添加所有相邻节点到栈中
      const neighbors = adjacencyMap.get(currentId);
      if (neighbors) {
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            stack.push(neighborId);
          }
        });
      }
    }

    // 为组内所有成员设置分组
    groupSet.forEach(id => groups.set(id, groupSet));
  });

  return groups;
}

/**
 * 为每个分组选择代表 todo
 * 代表用于排序时取代整个组
 * 策略：根据比较器选择组内排序值最优的 todo
 */
export function selectGroupRepresentatives(
  groups: Map<number, Set<number>>,
  todos: Todo[],
  compareFn: (a: Todo, b: Todo) => number
): Map<Set<number>, Todo> {
  const representatives = new Map<Set<number>, Todo>();
  const processedGroups = new Set<Set<number>>();

  for (const [todoId, group] of groups) {
    if (processedGroups.has(group)) continue;
    processedGroups.add(group);

    // 使用比较器选择代表（选择排序后会在最前面的）
    const groupTodos = todos.filter(t => group.has(t.id!));
    if (groupTodos.length > 0) {
      const representative = groupTodos.reduce((best, todo) =>
        compareFn(todo, best) < 0 ? todo : best
      );
      representatives.set(group, representative);
    }
  }

  return representatives;
}

/**
 * 按分组排序
 * 1. 先按分组分类
 * 2. 组内按 ID 排序
 * 3. 组间使用代表 todo 排序
 * 4. 展平返回
 */
export function sortWithGroups(
  todos: Todo[],
  groups: Map<number, Set<number>>,
  representatives: Map<Set<number>, Todo>,
  compareFn: (a: Todo, b: Todo) => number
): Todo[] {
  // 1. 分组 todos - 每个非并列待办也单独成组
  const grouped = new Map<Set<number>, Todo[]>();
  const allRepresentatives = new Map(representatives); // 复制现有代表

  for (const todo of todos) {
    let group = groups.get(todo.id!);
    if (!group) {
      // 无并列关系：创建只包含自己的 Set
      group = new Set([todo.id!]);
      // 为这个单独的待办设置代表（就是它自己）
      allRepresentatives.set(group, todo);
    }
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(todo);
  }

  // 2. 组内排序：所有待办都使用比较器排序（无论是否有分组）
  for (const [group, todoList] of grouped) {
    todoList.sort(compareFn);
  }

  // 3. 组间排序（使用代表）
  const sortedGroups = Array.from(grouped.entries()).sort(
    ([groupA, todosA], [groupB, todosB]) => {
      const repA = allRepresentatives.get(groupA)!;
      const repB = allRepresentatives.get(groupB)!;
      return compareFn(repA, repB);
    }
  );

  // 4. 展平
  return sortedGroups.flatMap(([_, todos]) => todos);
}

// 缓存时间戳以提升性能
const timestampCache = new Map<string, number>();

function getTimestamp(dateString: string): number {
  if (timestampCache.has(dateString)) {
    return timestampCache.get(dateString)!;
  }

  const timestamp = new Date(dateString).getTime();
  timestampCache.set(dateString, timestamp);
  return timestamp;
}

/**
 * 获取排序比较器（性能优化版）
 */
export function getSortComparator(sortOption: SortOption): (a: Todo, b: Todo) => number {
  switch (sortOption) {
    case 'createdAt-asc':
      return (a, b) => getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
    case 'createdAt-desc':
      return (a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
    case 'updatedAt-asc':
      return (a, b) => getTimestamp(a.updatedAt) - getTimestamp(b.updatedAt);
    case 'updatedAt-desc':
      return (a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt);
    case 'deadline-asc':
      return (a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return getTimestamp(a.deadline) - getTimestamp(b.deadline);
      };
    case 'deadline-desc':
      return (a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return getTimestamp(b.deadline) - getTimestamp(a.deadline);
      };
    default:
      return () => 0;
  }
}

/**
 * 清理时间戳缓存（用于内存管理）
 */
export function clearTimestampCache(): void {
  timestampCache.clear();
}

