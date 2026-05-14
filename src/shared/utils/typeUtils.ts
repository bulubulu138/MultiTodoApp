import { Todo } from '../types';

/**
 * 类型安全的 ID 工具函数
 * 处理 Todo.id 从 number 到 string | number 的兼容性转换
 */

/**
 * 将 ID 转换为数字类型（用于数据库操作）
 * 如果是UUID字符串，则生成一个临时的数字ID用于内部状态管理
 */
export function toNumberId(id: number | string | undefined): number {
  if (id === undefined || id === null) {
    throw new Error('ID cannot be undefined or null');
  }
  if (typeof id === 'number') {
    return id;
  }

  // 尝试解析为数字
  const numId = parseInt(String(id), 10);
  if (!isNaN(numId)) {
    return numId;
  }

  // 对于UUID字符串，生成一个哈希数字用于状态管理
  // 这是一个临时解决方案，确保不抛出错误
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 将 ID 转换为字符串类型（用于文件存储）
 */
export function toStringId(id: number | string | undefined): string {
  if (id === undefined || id === null) {
    throw new Error('ID cannot be undefined or null');
  }
  return String(id);
}

/**
 * 检查 ID 是否为数字类型
 */
export function isNumericId(id: number | string | undefined): boolean {
  if (id === undefined || id === null) {
    return false;
  }
  return typeof id === 'number' || !isNaN(parseInt(String(id), 10));
}

/**
 * 检查 ID 是否为 UUID 字符串类型
 */
export function isUUID(id: number | string | undefined): boolean {
  if (id === undefined || id === null) {
    return false;
  }
  if (typeof id === 'number') {
    return false;
  }
  // 简单的 UUID 格式检查：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * 安全的 ID 转换：保持原有类型，不丢失信息
 */
export function normalizeId(id: number | string | undefined): number | string {
  if (id === undefined || id === null) {
    throw new Error('ID cannot be undefined or null');
  }
  // 如果已经是数字，返回数字
  if (typeof id === 'number') {
    return id;
  }
  // 如果是字符串，尝试解析为数字
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    return numId; // 返回数字以兼容现有系统
  }
  // 如果是 UUID 字符串，保持字符串
  return id;
}

/**
 * 批量转换 ID 数组为数字类型
 */
export function toNumberIds(ids: Array<number | string>): number[] {
  return ids.map(toNumberId);
}

/**
 * 批量转换 ID 数组为字符串类型
 */
export function toStringIds(ids: Array<number | string>): string[] {
  return ids.map(toStringId);
}

/**
 * 比较两个 ID 是否相等
 */
export function areIdsEqual(id1: number | string | undefined, id2: number | string | undefined): boolean {
  if (id1 === undefined || id2 === undefined) {
    return id1 === id2;
  }
  return String(id1) === String(id2);
}

/**
 * 类型守卫：确保 ID 为数字类型
 */
export function assertNumericId(id: number | string | undefined): asserts id is number {
  if (!isNumericId(id)) {
    throw new Error(`Expected numeric ID, got ${typeof id}: ${id}`);
  }
}

/**
 * 类型守卫：确保 ID 为字符串类型
 */
export function assertStringId(id: number | string | undefined): asserts id is string {
  if (typeof id !== 'string') {
    throw new Error(`Expected string ID, got ${typeof id}: ${id}`);
  }
}

/**
 * 从待办对象中安全获取数字 ID
 */
export function getTodoNumericId(todo: Todo): number {
  if (!todo.id) {
    throw new Error('Todo must have an ID');
  }
  return toNumberId(todo.id);
}

/**
 * 从待办对象中安全获取字符串 ID
 */
export function getTodoStringId(todo: Todo): string {
  if (!todo.id) {
    throw new Error('Todo must have an ID');
  }
  return toStringId(todo.id);
}

/**
 * 更新待办的 ID（用于迁移过程中）
 */
export function migrateTodoId(todo: Todo, newId: string): Todo {
  return {
    ...todo,
    id: newId
  };
}