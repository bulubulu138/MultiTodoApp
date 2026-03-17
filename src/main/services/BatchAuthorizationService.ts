// 批量授权服务 - 复用持久化Session批量获取同类链接的标题
import { BrowserWindow, Session } from 'electron';
import Database from 'better-sqlite3';

/**
 * 批量授权结果
 */
export interface BatchAuthorizationResult {
  domain: string;
  totalUrls: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: Array<{
    url: string;
    success: boolean;
    title?: string;
    error?: string;
  }>;
}

/**
 * 批量授权进度
 */
export interface BatchAuthorizationProgress {
  domain: string;
  current: number;
  total: number;
  stage: 'extracting' | 'filtering' | 'fetching' | 'saving' | 'completed';
  currentUrl?: string;
  succeeded: number;
  failed: number;
}

/**
 * 进度回调函数
 */
export interface ProgressCallback {
  (progress: BatchAuthorizationProgress): void;
}

/**
 * 批量授权任务接口
 */
export interface BatchAuthorizationTask {
  taskId: number;
  status: string;
  startTime?: number;
}

/**
 * 批量授权服务
 * 用户授权一个链接后，自动为该域名下的所有其他链接完成授权
 */
export class BatchAuthorizationService {
  private db: Database.Database | null = null;
  private authSession: Session;
  private activeTasks: Map<string, BatchAuthorizationTask> = new Map();
  private readonly TASK_COOLDOWN_MS = 5 * 60 * 1000; // 5分钟冷却时间

  constructor(db: Database.Database | null, authSession: Session) {
    this.db = db;
    this.authSession = authSession;
  }

  /**
   * 检查是否可以启动批量任务（防重复机制）
   */
  async canStartBatchTask(domain: string): Promise<boolean> {
    // 检查是否有正在运行的任务
    if (this.activeTasks.has(domain)) {
      console.log(`[BatchAuthorizationService] Task already running for domain: ${domain}`);
      return false;
    }

    // 检查数据库中最近的任务状态
    const recentTask = this.db?.prepare(`
      SELECT id, status, created_at
      FROM batch_authorization_tasks
      WHERE domain = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(domain) as any;

    if (recentTask) {
      const timeSinceLastAttempt = Date.now() - new Date(recentTask.created_at).getTime();

      // 如果在冷却时间内，不允许启动新任务
      if (timeSinceLastAttempt < this.TASK_COOLDOWN_MS) {
        console.log(`[BatchAuthorizationService] Domain ${domain} in cooldown period (${Math.ceil((this.TASK_COOLDOWN_MS - timeSinceLastAttempt) / 1000)}s remaining)`);
        return false;
      }
    }

    return true;
  }

  /**
   * 创建批量授权任务记录
   */
  async createTask(domain: string): Promise<number> {
    const result = this.db?.prepare(`
      INSERT INTO batch_authorization_tasks (domain, status, started_at)
      VALUES (?, 'running', CURRENT_TIMESTAMP)
    `).run(domain);

    const taskId = result?.lastInsertRowid as number;
    console.log(`[BatchAuthorizationService] Created batch task ${taskId} for domain: ${domain}`);
    return taskId;
  }

  /**
   * 更新批量授权任务状态
   */
  async updateTaskStatus(
    taskId: number,
    status: string,
    result?: BatchAuthorizationResult,
    error?: any
  ): Promise<void> {
    const completedAt = (status === 'completed' || status === 'failed') ? 'CURRENT_TIMESTAMP' : null;
    const errorMessage = error ? (error.message || String(error)) : null;

    this.db?.prepare(`
      UPDATE batch_authorization_tasks
      SET status = ?,
          total_urls = COALESCE(?, total_urls),
          succeeded = COALESCE(?, succeeded),
          failed = COALESCE(?, failed),
          completed_at = ${completedAt},
          error_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status,
      result?.totalUrls,
      result?.succeeded,
      result?.failed,
      errorMessage,
      taskId
    );

    console.log(`[BatchAuthorizationService] Updated batch task ${taskId} to status: ${status}`);
  }

  /**
   * 获取活动的批量授权任务
   */
  async getActiveTask(domain: string): Promise<BatchAuthorizationTask | null> {
    const task = this.activeTasks.get(domain);
    return task || null;
  }

  /**
   * 授权单个链接（用于失败链接的重新授权或已授权链接的刷新）
   */
  async authorizeSingleUrl(
    url: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; title?: string; error?: string }> {
    try {
      const progress: BatchAuthorizationProgress = {
        domain: this.extractDomain(url),
        current: 0,
        total: 1,
        stage: 'fetching',
        succeeded: 0,
        failed: 0
      };

      onProgress?.(progress);

      const title = await this.fetchTitleWithSession(url);

      if (title && !this.isGenericTitle(title)) {
        // 检查是否已存在授权记录
        const existing = this.db?.prepare('SELECT url FROM url_authorizations WHERE url = ?').get(url) as any;

        if (existing) {
          // 更新现有记录
          const now = new Date().toISOString();
          this.db?.prepare(`
            UPDATE url_authorizations
            SET title = ?, last_refreshed_at = ?, refresh_count = refresh_count + 1,
                status = 'active', error_message = NULL, updated_at = ?
            WHERE url = ?
          `).run(title, now, now, url);
          console.log(`[BatchAuthorizationService] Updated authorization for ${url}: "${title}"`);
        } else {
          // 创建新授权记录
          await this.saveAuthorizationRecords([{ url, title }]);
          console.log(`[BatchAuthorizationService] Created authorization for ${url}: "${title}"`);
        }

        progress.current = 1;
        progress.succeeded = 1;
        progress.stage = 'completed';
        onProgress?.(progress);

        return { success: true, title };
      } else {
        progress.current = 1;
        progress.failed = 1;
        progress.stage = 'completed';
        onProgress?.(progress);

        return { success: false, error: 'Invalid or generic title' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BatchAuthorizationService] Error authorizing single URL ${url}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 批量授权指定域名下的所有URL
   * @param domain 域名
   * @param authorizedUrl 已授权的URL（将被排除）
   * @param authorizedTitle 已授权的标题
   * @param onProgress 可选的进度回调函数
   */
  async batchAuthorizeByDomain(
    domain: string,
    authorizedUrl: string,
    authorizedTitle: string,
    onProgress?: ProgressCallback
  ): Promise<BatchAuthorizationResult> {
    // 1. 检查是否可以启动新任务（防重复机制）
    if (!await this.canStartBatchTask(domain)) {
      console.log(`[BatchAuthorizationService] Batch task skipped for domain: ${domain} (already running or in cooldown)`);
      return {
        domain,
        totalUrls: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: []
      };
    }

    // 2. 创建任务记录
    const taskId = await this.createTask(domain);
    this.activeTasks.set(domain, {
      taskId,
      status: 'running',
      startTime: Date.now()
    });

    console.log(`[BatchAuthorizationService] Starting batch authorization for domain: ${domain} (task ${taskId})`);

    const result: BatchAuthorizationResult = {
      domain,
      totalUrls: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    try {
      // 步骤1：从所有待办中提取指定域名的URL
      onProgress?.({
        domain,
        current: 0,
        total: 0,
        stage: 'extracting',
        succeeded: 0,
        failed: 0
      });

      const allUrls = await this.extractUrlsByDomain(domain);
      console.log(`[BatchAuthorizationService] Domain scan results:`, {
        domain,
        totalCount: allUrls.length,
        sampleUrls: allUrls.slice(0, 5), // 只打印前5个避免日志过长
        message: allUrls.length === 0
          ? `No URLs found for domain ${domain}. This is normal if you only have one link from this domain.`
          : `Found ${allUrls.length} URLs for batch authorization`
      });

      if (allUrls.length === 0) {
        console.log(`[BatchAuthorizationService] No URLs found for domain ${domain}`);

        // 发送进度更新（即使是空结果），让前端知道已经完成扫描
        onProgress?.({
          domain,
          current: 0,
          total: 0,
          stage: 'completed',
          succeeded: 0,
          failed: 0
        });

        // 更新任务状态为完成
        await this.updateTaskStatus(taskId, 'completed', result);
        return result;
      }

      result.totalUrls = allUrls.length;

      // 步骤2：过滤出未授权的URL（排除已授权的URL）
      onProgress?.({
        domain,
        current: allUrls.length,
        total: allUrls.length,
        stage: 'filtering',
        succeeded: 0,
        failed: 0
      });

      const unauthorizedUrls = await this.filterUnauthorizedUrls(allUrls, authorizedUrl);
      console.log(`[BatchAuthorizationService] ${unauthorizedUrls.length} URLs need authorization`);

      if (unauthorizedUrls.length === 0) {
        console.log(`[BatchAuthorizationService] All URLs already authorized`);
        result.skipped = allUrls.length;
        onProgress?.({
          domain,
          current: allUrls.length,
          total: allUrls.length,
          stage: 'completed',
          succeeded: 0,
          failed: 0
        });

        // 更新任务状态为完成
        await this.updateTaskStatus(taskId, 'completed', result);
        return result;
      }

      // 步骤3：使用隐藏窗口批量获取标题
      const batchResult = await this.fetchBatchTitles(unauthorizedUrls, domain, onProgress);

      // 步骤4：保存授权记录
      onProgress?.({
        domain,
        current: unauthorizedUrls.length,
        total: unauthorizedUrls.length,
        stage: 'saving',
        succeeded: batchResult.succeeded,
        failed: batchResult.failed
      });

      // 步骤5：合并结果
      result.succeeded = batchResult.succeeded;
      result.failed = batchResult.failed;
      result.skipped = allUrls.length - unauthorizedUrls.length;
      result.details = batchResult.details;

      console.log(`[BatchAuthorizationService] Batch authorization completed:`, result);

      onProgress?.({
        domain,
        current: unauthorizedUrls.length,
        total: unauthorizedUrls.length,
        stage: 'completed',
        succeeded: result.succeeded,
        failed: result.failed
      });

      // 更新任务状态为完成
      await this.updateTaskStatus(taskId, 'completed', result);
      return result;
    } catch (error) {
      console.error('[BatchAuthorizationService] Batch authorization failed:', error);
      result.failed = result.totalUrls - result.succeeded - result.skipped;

      // 更新任务状态为失败（不自动重试）
      await this.updateTaskStatus(taskId, 'failed', result, error);
      throw error;
    } finally {
      this.activeTasks.delete(domain);
    }
  }

  /**
   * 从所有待办中提取指定域名的URL（支持根域名匹配）
   */
  private async extractUrlsByDomain(domain: string): Promise<string[]> {
    if (!this.db) {
      console.warn('[BatchAuthorizationService] Database not initialized');
      return [];
    }

    try {
      const urlPattern = /(https?:\/\/[^\s<>"]+)/g;
      const urlSet = new Set<string>();

      // 从所有待办的content中提取URL
      const todos = this.db
        .prepare('SELECT content FROM todos WHERE content IS NOT NULL AND LENGTH(content) > 0')
        .all() as Array<{ content: string }>;

      for (const todo of todos) {
        if (!todo.content) continue;

        // 重置正则表达式的lastIndex
        urlPattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = urlPattern.exec(todo.content)) !== null) {
          const url = match[1];
          try {
            const urlObj = new URL(url);
            const normalizedUrlDomain = this.normalizeDomain(urlObj.hostname);
            // 检查完整域名或根域名是否匹配
            if (urlObj.hostname === domain || normalizedUrlDomain === domain) {
              urlSet.add(url);
            }
          } catch {
            // 忽略无效URL
          }
        }
      }

      return Array.from(urlSet);
    } catch (error) {
      console.error('[BatchAuthorizationService] Failed to extract URLs by domain:', error);
      return [];
    }
  }

  /**
   * 过滤出未授权的URL
   * @param urls 所有URL
   * @param authorizedUrl 已授权的URL（将被排除）
   */
  private async filterUnauthorizedUrls(urls: string[], authorizedUrl: string): Promise<string[]> {
    if (!this.db) {
      return urls;
    }

    try {
      const unauthorized: string[] = [];

      for (const url of urls) {
        // 跳过已授权的URL
        if (url === authorizedUrl) {
          continue;
        }

        // 检查是否已授权
        const existing = this.db
          .prepare('SELECT url FROM url_authorizations WHERE url = ? AND status = ?')
          .get(url, 'active') as { url: string } | undefined;

        if (!existing) {
          unauthorized.push(url);
        }
      }

      return unauthorized;
    } catch (error) {
      console.error('[BatchAuthorizationService] Failed to filter unauthorized URLs:', error);
      return urls;
    }
  }

  /**
   * 使用隐藏窗口批量获取标题（复用session）
   */
  private async fetchBatchTitles(
    urls: string[],
    domain: string,
    onProgress?: ProgressCallback
  ): Promise<BatchAuthorizationResult> {
    const result: BatchAuthorizationResult = {
      domain,
      totalUrls: urls.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    const CONCURRENCY_LIMIT = 3;
    const successRecords: Array<{ url: string; title: string }> = [];

    // 分批处理，每批最多3个并发请求
    for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
      const batch = urls.slice(i, i + CONCURRENCY_LIMIT);

      const promises = batch.map(async (url) => {
        try {
          const title = await this.fetchTitleWithSession(url);

          if (title && !this.isGenericTitle(title)) {
            console.log(`[BatchAuthorizationService] Captured title for ${url}: "${title}"`);
            return { url, title, success: true };
          } else {
            console.log(`[BatchAuthorizationService] Failed to get valid title for ${url}`);
            return { url, success: false, error: 'Invalid or generic title' };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[BatchAuthorizationService] Error fetching title for ${url}:`, errorMessage);
          return { url, success: false, error: errorMessage };
        }
      });

      const results = await Promise.allSettled(promises);

      for (const settledResult of results) {
        if (settledResult.status === 'fulfilled') {
          const item = settledResult.value;
          result.details.push(item);

          if (item.success && item.title) {
            result.succeeded++;
            successRecords.push({ url: item.url, title: item.title });
          } else {
            result.failed++;
          }
        } else {
          result.failed++;
          result.details.push({
            url: batch[results.indexOf(settledResult)],
            success: false,
            error: 'Promise rejected'
          });
        }
      }

      // 每批完成后发送进度更新
      const completedCount = i + batch.length;
      onProgress?.({
        domain,
        current: completedCount,
        total: urls.length,
        stage: 'fetching',
        succeeded: result.succeeded,
        failed: result.failed
      });
    }

    // 批量保存成功的授权记录
    if (successRecords.length > 0) {
      await this.saveAuthorizationRecords(successRecords);
      console.log(`[BatchAuthorizationService] Saved ${successRecords.length} authorization records`);
    }

    return result;
  }

  /**
   * 使用隐藏窗口获取单个URL标题（复用session）
   */
  private async fetchTitleWithSession(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      let capturedTitle: string | null = null;
      let titleCaptured = false;

      const hiddenWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          session: this.authSession, // 复用持久化session
          nodeIntegration: false,
          contextIsolation: true,
          javascript: true,
        },
      });

      // 监听标题更新
      hiddenWindow.webContents.on('page-title-updated', (_event, title) => {
        const cleanedTitle = this.cleanTitle(title);
        if (cleanedTitle && cleanedTitle.length > 0) {
          capturedTitle = cleanedTitle;
          console.log(`[BatchAuthorizationService] Title captured: "${cleanedTitle}"`);
        }
      });

      // 页面加载完成后检查标题
      hiddenWindow.webContents.on('did-finish-load', () => {
        const title = hiddenWindow.getTitle();
        const cleanedTitle = this.cleanTitle(title);

        if (cleanedTitle && !this.isGenericTitle(cleanedTitle) && !titleCaptured) {
          capturedTitle = cleanedTitle;
          titleCaptured = true;

          // 标题捕获成功，关闭窗口
          setTimeout(() => {
            if (!hiddenWindow.isDestroyed()) {
              hiddenWindow.close();
            }
          }, 1000); // 等待1秒确保页面完全加载
        }
      });

      // 超时处理（10秒）
      const timeout = setTimeout(() => {
        if (!hiddenWindow.isDestroyed()) {
          console.log(`[BatchAuthorizationService] Timeout for ${url}, closing window`);
          hiddenWindow.close();
        }
      }, 10000);

      // 窗口关闭时返回结果
      hiddenWindow.on('closed', () => {
        clearTimeout(timeout);
        resolve(capturedTitle);
      });

      // 加载URL
      hiddenWindow.loadURL(url).catch((error) => {
        console.error(`[BatchAuthorizationService] Failed to load URL ${url}:`, error);
        clearTimeout(timeout);
        if (!hiddenWindow.isDestroyed()) {
          hiddenWindow.close();
        }
      });
    });
  }

  /**
   * 批量保存授权记录
   */
  private async saveAuthorizationRecords(records: Array<{ url: string; title: string }>): Promise<void> {
    if (!this.db || records.length === 0) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const insert = this.db.prepare(`
        INSERT INTO url_authorizations (url, domain, title, first_authorized_at, last_refreshed_at, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `);

      // 使用事务批量插入
      const insertMany = this.db.transaction((items: Array<{ url: string; title: string }>) => {
        for (const item of items) {
          try {
            const domain = this.extractDomain(item.url);
            insert.run(item.url, domain, item.title, now, now);
          } catch (error) {
            // 单条插入失败不影响其他记录
            console.error(`[BatchAuthorizationService] Failed to insert ${item.url}:`, error);
          }
        }
      });

      insertMany(records);
    } catch (error) {
      console.error('[BatchAuthorizationService] Failed to save authorization records:', error);
    }
  }

  /**
   * 从URL中提取域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * 规范化域名，提取根域名用于批量授权匹配
   * 例如：docs.dingtalk.com -> dingtalk.com
   *       login.dingtalk.com -> dingtalk.com
   */
  private normalizeDomain(domain: string): string {
    try {
      const parts = domain.split('.');
      // 对于常见的域名结构，提取最后两个部分作为根域名
      // 例如：docs.dingtalk.com -> dingtalk.com
      if (parts.length >= 2) {
        // 处理特殊情况：如 .com.cn、.co.uk 等
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];

        // 如果是常见的多级后缀，返回最后三个部分
        if (['com.cn', 'co.uk', 'org.cn', 'net.cn', 'gov.cn'].includes(`${secondLastPart}.${lastPart}`)) {
          return parts.slice(-3).join('.');
        }

        // 默认返回最后两个部分
        return parts.slice(-2).join('.');
      }
      return domain;
    } catch {
      return domain;
    }
  }

  /**
   * 清理标题中的不可见字符
   */
  private cleanTitle(title: string): string {
    if (!title) return '';

    // 移除零宽字符和其他不可见字符
    let cleaned = title.replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u180B-\u180D\u202A-\u202E\u2060-\u206F\uFFF9-\uFFFB\uFFFC\uFFFD]/g, '');

    // 移除其他控制字符
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // 移除多余的空格
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    return cleaned;
  }

  /**
   * 检查是否为通用标题
   */
  private isGenericTitle(title: string): boolean {
    if (!title || title.trim().length < 5) {
      return true;
    }

    const trimmedTitle = title.trim();

    const GENERIC_PLATFORM_TITLES = [
      '飞书云文档',
      'Lark云文档',
      '腾讯文档',
      '钉钉文档',
      '石墨文档',
      '语雀',
      '金山文档',
      'WPS云文档',
      '在线文档',
      '云文档',
      'Docs',
      '文档',
      '在线预览',
    ];

    if (GENERIC_PLATFORM_TITLES.some((generic) => trimmedTitle.includes(generic))) {
      return true;
    }

    const SPECIFIC_LOGIN_TITLES: (string | RegExp)[] = [
      '钉钉文档 - 钉钉统一身份认证',
      '登录 - 钉钉',
      '统一身份认证',
      /登录.*访问/i,
      /请.*登录/i,
    ];

    return SPECIFIC_LOGIN_TITLES.some((pattern) =>
      typeof pattern === 'string' ? trimmedTitle === pattern : pattern.test(trimmedTitle)
    );
  }
}
