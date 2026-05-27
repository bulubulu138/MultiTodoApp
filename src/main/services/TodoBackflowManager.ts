import { DatabaseManager } from './DatabaseManager';
import { SettingsManager } from '../SettingsManager';
import { Todo } from '../../shared/types';

interface BackflowResult {
  backflowCount: number;
  lastBackflowDate: string | null;
}

export class TodoBackflowManager {
  private databaseManager: DatabaseManager;
  private settingsManager: SettingsManager;

  constructor(databaseManager: DatabaseManager, settingsManager: SettingsManager) {
    this.databaseManager = databaseManager;
    this.settingsManager = settingsManager;
  }

  /**
   * 检查并执行回流逻辑
   */
  async checkAndBackflowTodos(): Promise<BackflowResult> {
    try {
      const lastBackflowDate = await this.getLastBackflowDate();
      const today = new Date().toDateString();

      // 如果今天已经回流过，跳过
      if (lastBackflowDate === today) {
        console.log('[TodoBackflow] 今天已经执行过回流，跳过');
        return { backflowCount: 0, lastBackflowDate };
      }

      console.log('[TodoBackflow] 开始执行每日回流...');

      // 获取所有"今日事"（in_progress）状态的任务
      const allTodos = await this.databaseManager.getStorageManager().getAllTodos();
      const inProgressTodos = allTodos.filter((todo: Todo) => todo.status === 'in_progress');

      if (inProgressTodos.length === 0) {
        console.log('[TodoBackflow] 没有"今日事"任务需要回流');
        await this.setLastBackflowDate(today);
        return { backflowCount: 0, lastBackflowDate: today };
      }

      // 按updatedAt排序，最新的排在前面（回流到"待办池"顶部）
      const sortedTodos = [...inProgressTodos].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      console.log(`[TodoBackflow] 找到 ${sortedTodos.length} 个"今日事"任务需要回流`);

      // 批量更新状态为pending
      const updates = sortedTodos.map(todo => ({
        uuid: String(todo.id),
        updates: {
          status: 'pending' as Todo['status'],
          updatedAt: new Date().toISOString() // 更新回流时间
        }
      }));

      await this.databaseManager.getStorageManager().bulkUpdateTodos(updates);

      // 记录回流日期
      await this.setLastBackflowDate(today);

      console.log(`[TodoBackflow] 成功回流 ${sortedTodos.length} 个任务到待办池`);

      return { backflowCount: sortedTodos.length, lastBackflowDate: today };

    } catch (error) {
      console.error('[TodoBackflow] 回流失败:', error);
      // 降级处理：即使回流失败，也不阻塞应用启动
      return { backflowCount: 0, lastBackflowDate: null };
    }
  }

  /**
   * 获取上次回流日期
   */
  private async getLastBackflowDate(): Promise<string | null> {
    try {
      const settings = this.settingsManager.getSettings();
      return settings.lastBackflowDate || null;
    } catch (error) {
      console.error('[TodoBackflow] 获取上次回流日期失败:', error);
      return null;
    }
  }

  /**
   * 设置回流日期
   */
  private async setLastBackflowDate(date: string): Promise<void> {
    try {
      this.settingsManager.updateSettings({ lastBackflowDate: date });
    } catch (error) {
      console.error('[TodoBackflow] 设置回流日期失败:', error);
    }
  }
}
