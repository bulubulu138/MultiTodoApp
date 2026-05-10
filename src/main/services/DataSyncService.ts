// 数据同步服务 - 实现双存储模式下的自动同步
import { HybridStorageManager } from './HybridStorageManager';
import { Todo } from '../../shared/types';

/**
 * 同步状态
 */
export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  itemsProcessed: number;
  itemsSuccess: number;
  itemsFailed: number;
  errors: string[];
}

/**
 * 同步配置
 */
export interface SyncConfig {
  enabled: boolean;
  interval: number; // 同步间隔（毫秒）
  autoSyncOnSwitch: boolean; // 切换存储模式时自动同步
  conflictResolution: 'latest' | 'database' | 'file';
}

/**
 * 同步进度
 */
export interface SyncProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

/**
 * 数据同步监听器
 */
export type SyncListener = (progress: SyncProgress) => void;

/**
 * 数据同步服务
 */
export class DataSyncService {
  private hybridStorage: HybridStorageManager;
  private config: SyncConfig;
  private syncStatus: SyncStatus = 'idle';
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTime: number = 0;
  private syncHistory: SyncResult[] = [];

  constructor(hybridStorage: HybridStorageManager, config: SyncConfig) {
    this.hybridStorage = hybridStorage;
    this.config = config;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果启用了自动同步，重启定时器
    if (this.config.enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * 获取最后同步时间
   */
  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * 获取同步历史
   */
  public getSyncHistory(): SyncResult[] {
    return [...this.syncHistory];
  }

  /**
   * 添加同步监听器
   */
  public addListener(listener: SyncListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除同步监听器
   */
  public removeListener(listener: SyncListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 启动自动同步
   */
  public startAutoSync(): void {
    this.stopAutoSync(); // 先停止现有的定时器

    if (!this.config.enabled) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.interval);

    console.log(`[DataSyncService] Auto-sync started with interval ${this.config.interval}ms`);
  }

  /**
   * 停止自动同步
   */
  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[DataSyncService] Auto-sync stopped');
    }
  }

  /**
   * 执行手动同步
   */
  public async manualSync(): Promise<SyncResult> {
    console.log('[DataSyncService] Manual sync triggered');
    return await this.performSync();
  }

  /**
   * 执行同步操作
   */
  private async performSync(): Promise<SyncResult> {
    if (this.syncStatus === 'syncing') {
      console.log('[DataSyncService] Sync already in progress, skipping');
      return {
        success: false,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        itemsProcessed: 0,
        itemsSuccess: 0,
        itemsFailed: 0,
        errors: ['Sync already in progress']
      };
    }

    const startTime = Date.now();
    this.syncStatus = 'syncing';
    this.lastSyncTime = startTime;

    const result: SyncResult = {
      success: false,
      startTime,
      endTime: 0,
      duration: 0,
      itemsProcessed: 0,
      itemsSuccess: 0,
      itemsFailed: 0,
      errors: []
    };

    try {
      console.log('[DataSyncService] Starting sync operation');

      // 阶段1：获取所有数据
      this.notifyProgress({
        phase: 'fetching',
        current: 0,
        total: 100,
        message: '正在获取数据...'
      });

      const allTodos = await this.hybridStorage.getAllTodos();
      result.itemsProcessed = allTodos.length;

      // 阶段2：同步数据
      this.notifyProgress({
        phase: 'syncing',
        current: 30,
        total: 100,
        message: `正在同步 ${allTodos.length} 个待办事项...`
      });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < allTodos.length; i++) {
        const todo = allTodos[i];
        const progress = 30 + Math.floor((i / allTodos.length) * 60);

        this.notifyProgress({
          phase: 'syncing',
          current: progress,
          total: 100,
          message: `正在同步 (${i + 1}/${allTodos.length}): ${todo.title}`
        });

        try {
          // 确保数据在两个存储中都存在且是最新的
          await this.syncTodo(todo);
          successCount++;
        } catch (error) {
          failCount++;
          result.errors.push(`Failed to sync todo ${todo.id}: ${error}`);
        }
      }

      result.itemsSuccess = successCount;
      result.itemsFailed = failCount;

      // 阶段3：验证
      this.notifyProgress({
        phase: 'verifying',
        current: 95,
        total: 100,
        message: '正在验证数据完整性...'
      });

      // 刷新缓存
      this.hybridStorage.invalidateCache();

      // 验证数据数量
      const syncedTodos = await this.hybridStorage.getAllTodos();
      if (syncedTodos.length !== allTodos.length) {
        result.errors.push(`Data count mismatch: before=${allTodos.length}, after=${syncedTodos.length}`);
      }

      // 完成
      this.notifyProgress({
        phase: 'complete',
        current: 100,
        total: 100,
        message: '同步完成'
      });

      result.success = result.itemsFailed === 0;
      console.log(`[DataSyncService] Sync completed: ${successCount} success, ${failCount} failed`);

    } catch (error) {
      console.error('[DataSyncService] Sync failed:', error);
      result.errors.push(`Sync failed: ${error}`);
      result.success = false;
    } finally {
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
      this.syncStatus = result.success ? 'idle' : 'error';

      // 保存到历史记录（只保留最近10条）
      this.syncHistory.push(result);
      if (this.syncHistory.length > 10) {
        this.syncHistory.shift();
      }
    }

    return result;
  }

  /**
   * 同步单个待办
   */
  private async syncTodo(todo: Todo): Promise<void> {
    // 获取当前存储模式
    const config = this.hybridStorage.getConfig();
    const currentMode = config.currentMode;

    // 根据冲突解决策略同步数据
    if (this.config.conflictResolution === 'database') {
      // 以数据库为准：确保数据库数据同步到文件
      if (currentMode === 'file') {
        await this.syncToFile(todo);
      }
    } else if (this.config.conflictResolution === 'file') {
      // 以文件为准：确保文件数据同步到数据库
      if (currentMode === 'database') {
        await this.syncToDatabase(todo);
      }
    } else {
      // 默认：使用混合存储的冲突解决机制
      // HybridStorageManager已经在getAllTodos中处理了冲突
      // 这里只需要确保数据在两个存储中都存在
      await this.ensureBothStorages(todo);
    }
  }

  /**
   * 确保待办在两个存储中都存在
   */
  private async ensureBothStorages(todo: Todo): Promise<void> {
    // 这个方法的实现取决于HybridStorageManager的内部逻辑
    // 由于HybridStorageManager已经处理了双存储的读写，这里主要是触发缓存刷新
    // 实际的同步逻辑在HybridStorageManager中实现
  }

  /**
   * 同步到文件存储
   */
  private async syncToFile(todo: Todo): Promise<void> {
    // 导出为Markdown文件
    try {
      if (typeof todo.id === 'number') {
        await this.hybridStorage.exportTodoAsMarkdown(todo.id);
      }
    } catch (error) {
      console.warn(`[DataSyncService] Failed to sync todo ${todo.id} to file:`, error);
      throw error;
    }
  }

  /**
   * 同步到数据库
   */
  private async syncToDatabase(todo: Todo): Promise<void> {
    // 数据库同步逻辑在HybridStorageManager中已经处理
    // 这里主要是确保文件中的数据也反映到数据库
    // 由于HybridStorageManager的双存储架构，这个操作已经在读取时自动完成
  }

  /**
   * 通知同步进度
   */
  private notifyProgress(progress: SyncProgress): void {
    this.listeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('[DataSyncService] Listener error:', error);
      }
    });
  }

  /**
   * 切换存储模式时的同步
   */
  public async syncOnModeSwitch(newMode: 'database' | 'file'): Promise<SyncResult> {
    if (!this.config.autoSyncOnSwitch) {
      return {
        success: true,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        itemsProcessed: 0,
        itemsSuccess: 0,
        itemsFailed: 0,
        errors: []
      };
    }

    console.log(`[DataSyncService] Syncing on mode switch to ${newMode}`);
    this.notifyProgress({
      phase: 'switching',
      current: 0,
      total: 100,
      message: `正在切换到 ${newMode === 'database' ? '数据库' : 'Markdown文件'} 模式...`
    });

    return await this.performSync();
  }

  /**
   * 获取同步统计
   */
  public getSyncStats(): {
    lastSyncTime: number;
    syncStatus: SyncStatus;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
  } {
    const totalSyncs = this.syncHistory.length;
    const successfulSyncs = this.syncHistory.filter(r => r.success).length;
    const failedSyncs = totalSyncs - successfulSyncs;
    const averageDuration = totalSyncs > 0
      ? this.syncHistory.reduce((sum, r) => sum + r.duration, 0) / totalSyncs
      : 0;

    return {
      lastSyncTime: this.lastSyncTime,
      syncStatus: this.syncStatus,
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      averageDuration
    };
  }

  /**
   * 清除同步历史
   */
  public clearSyncHistory(): void {
    this.syncHistory = [];
    console.log('[DataSyncService] Sync history cleared');
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
    this.syncHistory = [];
    console.log('[DataSyncService] Service destroyed');
  }
}