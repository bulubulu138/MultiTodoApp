import { Todo } from '../../shared/types';
import { FileStorageManager } from '../FileStorageManager';

/**
 * 今日已完成状态管理器
 * 负责处理待办的今日完成状态切换和过期检查
 */
export class TodayCompletedManager {
  constructor(private fileStorageManager: FileStorageManager) {
  }

  /**
   * 切换今日完成状态
   * @param uuid Todo ID
   * @param currentState 当前状态
   */
  async toggleTodayCompleted(uuid: string, currentState: string): Promise<void> {
    const todo = await this.fileStorageManager.getTodoById(uuid);
    if (!todo) {
      throw new Error(`Todo not found: ${uuid}`);
    }

    let newStatus: string;
    let updates: Partial<Todo>;

    if (currentState === 'today_completed') {
      // 取消今日完成，恢复为待办
      newStatus = 'pending';
      updates = {
        status: newStatus as Todo['status'],
        todayCompletedAt: undefined, // 清除今日完成时间
        updatedAt: new Date().toISOString()
      };
    } else if (currentState === 'pending') {
      // 标记为今日完成
      newStatus = 'today_completed';
      updates = {
        status: newStatus as Todo['status'],
        todayCompletedAt: new Date().toISOString(), // 记录进入今日完成的时间
        updatedAt: new Date().toISOString()
      };
    } else {
      throw new Error(`Invalid state transition from ${currentState} to today_completed`);
    }

    await this.fileStorageManager.updateTodo(uuid, updates);
    console.log(`[TodayCompletedManager] ✅ Toggled todo ${uuid}: ${currentState} -> ${newStatus}`);
  }

  /**
   * 检查今日完成状态是否过期
   * @param todayCompletedAt 今日完成时间
   * @returns 是否过期（不是今天）
   */
  private isTodayCompletedExpired(todayCompletedAt: string): boolean {
    if (!todayCompletedAt) return false;

    const completedDate = new Date(todayCompletedAt);
    const today = new Date();

    // 比较日期部分（忽略时间）
    return completedDate.toDateString() !== today.toDateString();
  }

  /**
   * 批量转换过期的今日完成待办
   * @returns 转换的数量
   */
  async convertExpiredTodayCompleted(): Promise<number> {
    const allTodos = await this.fileStorageManager.getAllTodos();
    const expiredTodos = allTodos.filter(todo =>
      todo.status === 'today_completed' &&
      this.isTodayCompletedExpired(todo.todayCompletedAt!)
    );

    console.log(`[TodayCompletedManager] 🕍 Found ${expiredTodos.length} expired today_completed todos`);

    let convertedCount = 0;
    for (const todo of expiredTodos) {
      try {
        await this.fileStorageManager.updateTodo(todo.id, {
          status: 'completed' as Todo['status'],
          completedAt: todo.todayCompletedAt, // 保留原始完成时间
          todayCompletedAt: undefined, // 清除今日完成时间
          updatedAt: new Date().toISOString()
        });
        convertedCount++;
        console.log(`[TodayCompletedManager] ✅ Converted expired todo: ${todo.id}`);
      } catch (error) {
        console.error(`[TodayCompletedManager] ❌ Failed to convert todo ${todo.id}:`, error);
      }
    }

    console.log(`[TodayCompletedManager] 🎉 Converted ${convertedCount}/${expiredTodos.length} expired todos`);
    return convertedCount;
  }
}