/**
 * ID 类型安全工具函数
 * 确保在文件存储架构中正确处理 UUID 字符串
 */

import { isUUID } from './typeUtils';

/**
 * 从 Todo 对象中安全获取 UUID 字符串
 * @param todo - Todo 对象
 * @returns UUID 字符串
 * @throws 如果 ID 不存在或格式无效
 */
export function getTodoUUID(todo: { id?: number | string }): string {
  if (!todo.id) {
    throw new Error('Todo must have an ID');
  }

  const uuid = String(todo.id);

  // 验证是否为有效的 UUID 格式
  if (!isUUID(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }

  return uuid;
}

/**
 * 验证 UUID 字符串格式
 * @param uuid - 待验证的 UUID
 * @returns 是否为有效 UUID
 */
export function isValidUUID(uuid: string): boolean {
  return isUUID(uuid);
}

/**
 * 类型守卫：确保参数为有效的 UUID 字符串
 * @param uuid - 待验证的参数
 * @throws 如果不是有效的 UUID 字符串
 */
export function assertUUID(uuid: string): asserts uuid is string {
  if (!isValidUUID(uuid)) {
    throw new Error(`Expected valid UUID, got: ${uuid}`);
  }
}

/**
 * 批量获取 UUID 字符串数组
 * @param todos - Todo 对象数组
 * @returns UUID 字符串数组
 */
export function getTodoUUIDs(todos: Array<{ id?: number | string }>): string[] {
  return todos.map(getTodoUUID);
}
