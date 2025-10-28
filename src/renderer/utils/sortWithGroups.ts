/**
 * 分组排序工具函数
 * 用于在所有排序模式下保持并列待办的分组
 */

import { Todo, TodoRelation } from '../../shared/types';
import { SortOption } from '../components/Toolbar';

/**
 * 使用 DFS 构建并列关系分组
 * 返回 Map: todoId -> Set<todoId> (该待办所属的分组)
 */
export function buildParallelGroups(
  todos: Todo[],
  relations: TodoRelation[]
): Map<number, Set<number>> {
  const groups = new Map<number, Set<number>>();
  const visited = new Set<number>();

  const dfs = (todoId: number, groupSet: Set<number>) => {
    if (visited.has(todoId)) return;
    visited.add(todoId);
    groupSet.add(todoId);

    // 找到所有与该 todo 有并列关系的其他 todo
    const relatedIds = relations
      .filter(r => r.relation_type === 'parallel')
      .filter(r => r.source_id === todoId || r.target_id === todoId)
      .map(r => (r.source_id === todoId ? r.target_id : r.source_id));

    relatedIds.forEach(relatedId => dfs(relatedId, groupSet));
  };

  todos.forEach(todo => {
    if (!visited.has(todo.id!)) {
      const parallelRels = relations.filter(
        r =>
          r.relation_type === 'parallel' &&
          (r.source_id === todo.id || r.target_id === todo.id)
      );

      if (parallelRels.length > 0) {
        const groupSet = new Set<number>();
        dfs(todo.id!, groupSet);
        groupSet.forEach(id => groups.set(id, groupSet));
      }
    }
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
  // 1. 分组 todos
  const grouped = new Map<Set<number> | null, Todo[]>();

  for (const todo of todos) {
    const group = groups.get(todo.id!) || null;
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
      const repA = groupA ? representatives.get(groupA)! : todosA[0];
      const repB = groupB ? representatives.get(groupB)! : todosB[0];
      return compareFn(repA, repB);
    }
  );

  // 4. 展平
  return sortedGroups.flatMap(([_, todos]) => todos);
}

/**
 * 获取排序比较器
 */
export function getSortComparator(sortOption: SortOption): (a: Todo, b: Todo) => number {
  switch (sortOption) {
    case 'createdAt-asc':
      return (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case 'createdAt-desc':
      return (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case 'updatedAt-asc':
      return (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    case 'updatedAt-desc':
      return (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    case 'deadline-asc':
      return (a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return (
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        );
      };
    case 'deadline-desc':
      return (a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return (
          new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
        );
      };
    default:
      return () => 0;
  }
}

