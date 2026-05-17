import { BrowserWindow } from 'electron';
import { FileStorageManager } from '../FileStorageManager';
import { TodayCompletedManager } from './TodayCompletedManager';

/**
 * 今日已完成状态调度器
 * 负责在启动时检查过期状态，并在每天午夜执行自动转换
 */
export class TodayCompletedScheduler {
  private todayCompletedManager: TodayCompletedManager;
  private midnightInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private mainWindow: BrowserWindow | undefined = undefined;

  constructor(fileStorageManager: FileStorageManager, mainWindow?: BrowserWindow) {
    this.todayCompletedManager = new TodayCompletedManager(fileStorageManager);
    this.mainWindow = mainWindow;
  }

  /**
   * 启动定时任务
   */
  start(): void {
    if (this.isRunning) {
      console.log('[TodayCompletedScheduler] ⚠️ Already running, skipping start');
      return;
    }

    console.log('[TodayCompletedScheduler] 🚀 Starting midnight conversion scheduler');

    // 计算距离下一个午夜的时间
    const msUntilMidnight = this.calculateMsUntilMidnight();
    console.log(`[TodayCompletedScheduler] ⏰ Next midnight conversion in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

    // 设置定时器，每天午夜执行
    this.midnightInterval = setInterval(() => {
      this.checkAndConvertExpired();

      // 重新计算下一次执行时间（处理时区变化等情况）
      this.reschedule();
    }, msUntilMidnight);

    this.isRunning = true;
    console.log('[TodayCompletedScheduler] ✅ Midnight conversion scheduler started');
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.midnightInterval) {
      clearInterval(this.midnightInterval);
      this.midnightInterval = null;
      this.isRunning = false;
      console.log('[TodayCompletedScheduler] 🛑 Midnight conversion scheduler stopped');
    }
  }

  /**
   * 启动时检查过期的 today_completed 状态
   * @returns 转换的数量
   */
  async checkOnStartup(): Promise<number> {
    console.log('[TodayCompletedScheduler] 🚀 Checking for expired today_completed todos on startup');

    try {
      const convertedCount = await this.todayCompletedManager.convertExpiredTodayCompleted();

      if (convertedCount > 0) {
        console.log(`[TodayCompletedScheduler] ✅ Converted ${convertedCount} expired todos on startup`);
      } else {
        console.log('[TodayCompletedScheduler] ℹ️ No expired today_completed todos found on startup');
      }

      return convertedCount;
    } catch (error) {
      console.error('[TodayCompletedScheduler] ❌ Startup check failed:', error);
      return 0;
    }
  }

  /**
   * 检查并转换过期的今日完成待办
   */
  private async checkAndConvertExpired(): Promise<void> {
    try {
      console.log('[TodayCompletedScheduler] 🕍 Running midnight conversion check');

      const convertedCount = await this.todayCompletedManager.convertExpiredTodayCompleted();

      if (convertedCount > 0) {
        console.log(`[TodayCompletedScheduler] ✅ Midnight conversion completed: ${convertedCount} todos converted`);

        // 发送事件到渲染进程，通知UI更新
        this.notifyRenderProcess(convertedCount);
      } else {
        console.log('[TodayCompletedScheduler] ℹ️ No expired todos to convert');
      }
    } catch (error) {
      console.error('[TodayCompletedScheduler] ❌ Midnight conversion failed:', error);
    }
  }

  /**
   * 计算距离下一个午夜的时间（毫秒）
   */
  private calculateMsUntilMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return tomorrow.getTime() - now.getTime();
  }

  /**
   * 重新调度定时任务
   */
  private reschedule(): void {
    if (!this.isRunning) return;

    // 清除现有定时器
    if (this.midnightInterval) {
      clearInterval(this.midnightInterval);
    }

    // 计算新的执行时间
    const msUntilMidnight = this.calculateMsUntilMidnight();

    // 设置新的定时器
    this.midnightInterval = setInterval(() => {
      this.checkAndConvertExpired();
      this.reschedule();
    }, msUntilMidnight);

    console.log(`[TodayCompletedScheduler] 🔄 Rescheduled next conversion in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
  }

  /**
   * 通知渲染进程更新UI
   */
  private notifyRenderProcess(convertedCount: number): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('today-completed:midnight-conversion', { convertedCount });
    }
  }

  /**
   * 更新主窗口引用
   */
  setMainWindow(mainWindow: BrowserWindow | undefined): void {
    this.mainWindow = mainWindow;
  }
}