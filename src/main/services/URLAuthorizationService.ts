// URL授权记录管理服务
import { URLTitleService } from './URLTitleService';
import Database from 'better-sqlite3';

/**
 * URL授权记录接口
 */
export interface URLAuthorizationRecord {
  id: number;
  url: string;
  domain: string;
  title: string | null;
  first_authorized_at: string;
  last_refreshed_at: string;
  refresh_count: number;
  status: 'active' | 'expired' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * URL授权服务
 * 管理URL授权记录的持久化和自动刷新
 */
export class URLAuthorizationService {
  private urlTitleService: URLTitleService;
  private db: Database.Database | null = null;

  constructor(db: any) {
    this.urlTitleService = new URLTitleService();
    this.db = db;
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
   * 记录或更新授权信息
   * @param url 授权的URL
   * @param title 获取的标题
   */
  async recordAuthorization(url: string, title: string): Promise<void> {
    if (!this.db) {
      console.warn('[URLAuthorizationService] Database not initialized');
      return;
    }

    try {
      const domain = this.extractDomain(url);
      const now = new Date().toISOString();

      // 检查是否已存在
      const existing = this.db
        .prepare('SELECT * FROM url_authorizations WHERE url = ?')
        .get(url) as URLAuthorizationRecord | undefined;

      if (existing) {
        // 更新现有记录
        this.db
          .prepare(`
            UPDATE url_authorizations
            SET title = ?, last_refreshed_at = ?, refresh_count = refresh_count + 1,
                status = 'active', error_message = NULL, updated_at = ?
            WHERE url = ?
          `)
          .run(title, now, now, url);

        console.log(`[URLAuthorizationService] Updated authorization: ${url} -> "${title}"`);
      } else {
        // 创建新记录
        this.db
          .prepare(`
            INSERT INTO url_authorizations (url, domain, title, first_authorized_at, last_refreshed_at, status)
            VALUES (?, ?, ?, ?, ?, 'active')
          `)
          .run(url, domain, title, now, now);

        console.log(`[URLAuthorizationService] Created authorization: ${url} -> "${title}"`);
      }
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to record authorization:', error);
    }
  }

  /**
   * 获取所有需要自动刷新的授权记录（active状态）
   */
  async getActiveAuthorizations(): Promise<URLAuthorizationRecord[]> {
    if (!this.db) {
      return [];
    }

    try {
      const records = this.db
        .prepare(`
          SELECT * FROM url_authorizations
          WHERE status = 'active'
          ORDER BY last_refreshed_at DESC
        `)
        .all() as URLAuthorizationRecord[];

      return records;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to get active authorizations:', error);
      return [];
    }
  }

  /**
   * 获取所有授权记录
   */
  async getAllAuthorizations(): Promise<URLAuthorizationRecord[]> {
    if (!this.db) {
      return [];
    }

    try {
      const records = this.db
        .prepare(`
          SELECT * FROM url_authorizations
          ORDER BY last_refreshed_at DESC
        `)
        .all() as URLAuthorizationRecord[];

      return records;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to get all authorizations:', error);
      return [];
    }
  }

  /**
   * 刷新单个授权的标题
   * @param url 要刷新的URL
   * @returns 是否成功
   */
  async refreshAuthorization(url: string): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      console.log(`[URLAuthorizationService] Refreshing authorization: ${url}`);

      // 使用 URLTitleService 获取标题
      const title = await this.urlTitleService.fetchTitle(url);
      const now = new Date().toISOString();

      if (title) {
        // 成功获取标题，更新记录
        this.db
          .prepare(`
            UPDATE url_authorizations
            SET title = ?, last_refreshed_at = ?, refresh_count = refresh_count + 1,
                status = 'active', error_message = NULL, updated_at = ?
            WHERE url = ?
          `)
          .run(title, now, now, url);

        console.log(`[URLAuthorizationService] Refresh successful: ${url} -> "${title}"`);
        return true;
      } else {
        // 获取失败，更新状态但不删除记录（静默失败）
        this.db
          .prepare(`
            UPDATE url_authorizations
            SET status = 'failed', error_message = 'Failed to fetch title', updated_at = ?
            WHERE url = ?
          `)
          .run(now, url);

        console.log(`[URLAuthorizationService] Refresh failed (silent): ${url}`);
        return false;
      }
    } catch (error) {
      const now = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 静默失败：只更新错误状态，不抛出异常
      try {
        this.db
          .prepare(`
            UPDATE url_authorizations
            SET status = 'failed', error_message = ?, updated_at = ?
            WHERE url = ?
          `)
          .run(errorMessage, now, url);
      } catch (updateError) {
        console.error('[URLAuthorizationService] Failed to update error status:', updateError);
      }

      console.error(`[URLAuthorizationService] Refresh failed with error (silent): ${url}`, error);
      return false;
    }
  }

  /**
   * 批量刷新授权（静默模式）
   * 并发限制为3个，与 URLTitleService 一致
   * @returns 刷新结果统计
   */
  async batchRefreshAuthorizations(): Promise<{ success: number; failed: number }> {
    console.log('[URLAuthorizationService] Starting batch refresh...');

    const records = await this.getActiveAuthorizations();
    console.log(`[URLAuthorizationService] Found ${records.length} active authorizations to refresh`);

    if (records.length === 0) {
      return { success: 0, failed: 0 };
    }

    const CONCURRENCY_LIMIT = 3;
    let success = 0;
    let failed = 0;

    // 分批处理，每批最多3个并发请求
    for (let i = 0; i < records.length; i += CONCURRENCY_LIMIT) {
      const batch = records.slice(i, i + CONCURRENCY_LIMIT);

      const promises = batch.map(async (record) => {
        const result = await this.refreshAuthorization(record.url);
        return result;
      });

      const results = await Promise.allSettled(promises);

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
        }
      });
    }

    console.log(`[URLAuthorizationService] Batch refresh completed: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  }

  /**
   * 清理过期的授权记录（超过30天未刷新）
   * @returns 清理的记录数
   */
  async cleanupExpiredAuthorizations(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = this.db
        .prepare(`
          DELETE FROM url_authorizations
          WHERE last_refreshed_at < ? AND status != 'active'
        `)
        .run(thirtyDaysAgo.toISOString());

      console.log(`[URLAuthorizationService] Cleaned up ${result.changes} expired authorizations`);
      return result.changes;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to cleanup expired authorizations:', error);
      return 0;
    }
  }

  /**
   * 删除单个授权记录
   * @param url 要删除的URL
   */
  async deleteAuthorization(url: string): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      const result = this.db
        .prepare('DELETE FROM url_authorizations WHERE url = ?')
        .run(url);

      console.log(`[URLAuthorizationService] Deleted authorization: ${url}`);
      return result.changes > 0;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to delete authorization:', error);
      return false;
    }
  }

  /**
   * 清空所有授权记录（慎用）
   */
  async clearAllAuthorizations(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const result = this.db
        .prepare('DELETE FROM url_authorizations')
        .run();

      console.log(`[URLAuthorizationService] Cleared all authorizations: ${result.changes} records`);
      return result.changes;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to clear all authorizations:', error);
      return 0;
    }
  }

  /**
   * 初始化授权数据库 - 从现有的待办事项中提取已授权的URL
   * 这会扫描所有待办事项的content字段，提取URL和嵌入的标题
   * @returns 迁移的记录数
   */
  async initializeFromExistingTodos(): Promise<number> {
    if (!this.db) {
      console.warn('[URLAuthorizationService] Database not initialized');
      return 0;
    }

    try {
      console.log('[URLAuthorizationService] Starting initialization from existing todos...');

      // 获取所有待办事项 - 使用LENGTH函数检查非空内容
      const todos = this.db
        .prepare('SELECT id, content FROM todos WHERE content IS NOT NULL AND LENGTH(content) > 0')
        .all() as Array<{ id: number; content: string }>;

      console.log(`[URLAuthorizationService] Found ${todos.length} todos with content`);

      // 正则表达式提取 URL 和嵌入的标题
      // 格式: <!-- URL_TITLE:url:title -->
      const titlePattern = /<!--\s*URL_TITLE:([^:]+):([^>]+?)\s*-->/g;

      let migrated = 0;

      for (const todo of todos) {
        if (!todo.content) continue;

        // 提取所有嵌入的标题
        const embeddedTitles = new Map<string, string>();
        let match: RegExpExecArray | null;

        while ((match = titlePattern.exec(todo.content)) !== null) {
          const [, url, title] = match;
          try {
            // 解码URL和标题
            const decodedUrl = decodeURIComponent(url);
            const decodedTitle = decodeURIComponent(title);
            embeddedTitles.set(decodedUrl, decodedTitle);
          } catch (e) {
            console.warn('[URLAuthorizationService] Failed to decode embedded title:', e);
          }
        }

        // 为每个找到的URL创建授权记录
        embeddedTitles.forEach((title, url) => {
          try {
            const domain = this.extractDomain(url);
            const now = new Date().toISOString();

            // 检查是否已存在
            const existing = this.db!
              .prepare('SELECT * FROM url_authorizations WHERE url = ?')
              .get(url) as URLAuthorizationRecord | undefined;

            if (!existing) {
              // 创建新记录
              this.db!
                .prepare(`
                  INSERT INTO url_authorizations (url, domain, title, first_authorized_at, last_refreshed_at, status)
                  VALUES (?, ?, ?, ?, ?, 'active')
                `)
                .run(url, domain, title, now, now);

              console.log(`[URLAuthorizationService] Migrated authorization: ${url} -> "${title}"`);
              migrated++;
            }
          } catch (error) {
            console.error('[URLAuthorizationService] Failed to migrate URL:', url, error);
          }
        });
      }

      console.log(`[URLAuthorizationService] Initialization complete: migrated ${migrated} authorizations`);
      return migrated;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to initialize from existing todos:', error);
      return 0;
    }
  }

  /**
   * 根据 URL 列表批量获取授权记录
   * @param urls URL列表
   * @returns URL -> 标题的映射
   */
  async getAuthorizationsByUrls(urls: string[]): Promise<Map<string, string>> {
    if (!this.db || urls.length === 0) {
      return new Map();
    }

    try {
      const placeholders = urls.map(() => '?').join(',');

      // 使用更安全的SQL查询，避免IN子句为空
      let records: Array<{ url: string; title: string }>;
      if (urls.length === 1) {
        // 单个URL使用 = 而不是 IN
        records = this.db
          .prepare(`
            SELECT url, title FROM url_authorizations
            WHERE url = ?
            AND status = 'active'
            AND title IS NOT NULL
          `)
          .all(urls[0]) as Array<{ url: string; title: string }>;
      } else {
        // 多个URL使用 IN 子句
        records = this.db
          .prepare(`
            SELECT url, title FROM url_authorizations
            WHERE url IN (${placeholders})
            AND status = 'active'
            AND title IS NOT NULL
          `)
          .all(...urls) as Array<{ url: string; title: string }>;
      }

      const titleMap = new Map<string, string>();
      records.forEach(record => {
        titleMap.set(record.url, record.title);
      });

      console.log(`[URLAuthorizationService] Found ${records.length} authorization titles for ${urls.length} URLs`);
      return titleMap;
    } catch (error) {
      console.error('[URLAuthorizationService] Failed to get authorizations by URLs:', error);
      return new Map();
    }
  }
}
