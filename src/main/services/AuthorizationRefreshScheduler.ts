// URL授权自动刷新调度器
import { URLAuthorizationService } from './URLAuthorizationService';

/**
 * 授权刷新调度器
 * 定时自动刷新URL授权的标题
 */
export class AuthorizationRefreshScheduler {
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

  constructor(
    private urlAuthService: URLAuthorizationService
  ) {}

  /**
   * 启动定时任务
   */
  start(): void {
    console.log('[AuthorizationRefreshScheduler] Starting scheduler...');

    // 立即执行一次刷新
    this.performRefresh();

    // 每24小时执行一次
    this.refreshInterval = setInterval(() => {
      this.performRefresh();
    }, this.REFRESH_INTERVAL);

    console.log(`[AuthorizationRefreshScheduler] Scheduler started (interval: ${this.REFRESH_INTERVAL / 1000 / 60 / 60} hours)`);
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[AuthorizationRefreshScheduler] Scheduler stopped');
    }
  }

  /**
   * 执行刷新（静默模式，不抛出异常）
   */
  private async performRefresh(): Promise<void> {
    try {
      console.log('[AuthorizationRefreshScheduler] Performing scheduled refresh...');
      const result = await this.urlAuthService.batchRefreshAuthorizations();
      console.log(`[AuthorizationRefreshScheduler] Scheduled refresh completed: success=${result.success}, failed=${result.failed}`);
    } catch (error) {
      // 静默失败：只记录日志，不抛出异常
      console.error('[AuthorizationRefreshScheduler] Scheduled refresh failed (silent):', error);
    }
  }

  /**
   * 手动触发刷新（用于测试或用户手动刷新）
   */
  async manualRefresh(): Promise<{ success: number; failed: number }> {
    console.log('[AuthorizationRefreshScheduler] Manual refresh triggered...');
    try {
      const result = await this.urlAuthService.batchRefreshAuthorizations();
      console.log(`[AuthorizationRefreshScheduler] Manual refresh completed: success=${result.success}, failed=${result.failed}`);
      return result;
    } catch (error) {
      console.error('[AuthorizationRefreshScheduler] Manual refresh failed:', error);
      throw error;
    }
  }
}
