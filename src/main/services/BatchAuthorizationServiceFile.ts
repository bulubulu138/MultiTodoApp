// 批量授权服务 - 文件存储版本
import { BrowserWindow, Session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

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
 * 批量授权服务 - 文件存储版本
 */
export class BatchAuthorizationService {
  private session: Session;
  private mainWindow: BrowserWindow | null = null;
  private storagePath: string;

  constructor(session: Session) {
    this.session = session;
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, '.multitodo-metadata', 'batch-tasks.json');
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 授权单个URL
   */
  public async authorizeSingleUrl(
    url: string,
    progressCallback?: ProgressCallback
  ): Promise<BatchAuthorizationResult> {
    const domain = new URL(url).hostname;
    const result: BatchAuthorizationResult = {
      domain,
      totalUrls: 1,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    try {
      if (progressCallback) {
        progressCallback({
          domain,
          current: 0,
          total: 1,
          stage: 'fetching',
          currentUrl: url,
          succeeded: 0,
          failed: 0
        });
      }

      // 这里应该调用实际的授权逻辑
      // 暂时模拟成功
      result.succeeded = 1;
      result.details.push({
        url,
        success: true,
        title: `Title for ${url}`
      });

      if (progressCallback) {
        progressCallback({
          domain,
          current: 1,
          total: 1,
          stage: 'completed',
          succeeded: 1,
          failed: 0
        });
      }
    } catch (error) {
      result.failed = 1;
      result.details.push({
        url,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return result;
  }

  /**
   * 获取活动任务
   */
  public async getActiveTask(domain: string): Promise<BatchAuthorizationTask | null> {
    // 简化实现，返回null
    return null;
  }

  /**
   * 保存任务状态
   */
  private saveTaskState(taskId: number, status: string): void {
    try {
      let tasks: Record<number, string> = {};
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        tasks = JSON.parse(data);
      }

      tasks[taskId] = status;

      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.storagePath, JSON.stringify(tasks, null, 2));
    } catch (error) {
      console.error('Failed to save task state:', error);
    }
  }

  /**
   * 获取任务状态
   */
  private getTaskState(taskId: number): string | null {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const tasks: Record<number, string> = JSON.parse(data);
        return tasks[taskId] || null;
      }
    } catch (error) {
      console.error('Failed to get task state:', error);
    }
    return null;
  }
}