// 文件系统监控服务 - 实时监控Markdown文件变化
import * as fs from 'fs';
import * as path from 'path';
import { HybridStorageManager } from './HybridStorageManager';
import { EventEmitter } from 'events';

/**
 * 文件变化事件类型
 */
export enum FileChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed'
}

/**
 * 文件变化事件
 */
export interface FileChangeEvent {
  type: FileChangeType;
  filePath: string;
  oldPath?: string; // 用于重命名事件
  timestamp: number;
  stats?: fs.Stats;
}

/**
 * 监控器状态
 */
export type WatcherStatus = 'idle' | 'watching' | 'paused' | 'error';

/**
 * 监控器配置
 */
export interface WatcherConfig {
  enabled: boolean;
  debounceDelay: number; // 防抖延迟（毫秒）
  ignorePatterns: RegExp[]; // 忽略的文件模式
  autoSync: boolean; // 检测到变化时自动同步
  notifyChanges: boolean; // 是否通知前端变化
}

/**
 * 监控器统计信息
 */
export interface WatcherStats {
  status: WatcherStatus;
  watchPath: string;
  filesWatched: number;
  changesDetected: number;
  lastChangeTime: number;
  uptime: number; // 监控运行时长（毫秒）
  errors: number;
}

/**
 * 文件系统监控服务
 */
export class FilesystemWatcher extends EventEmitter {
  private hybridStorage: HybridStorageManager;
  private config: WatcherConfig;
  private watchPath: string = '';
  private watcher: fs.FSWatcher | null = null;
  private status: WatcherStatus = 'idle';
  private startTime: number = 0;
  private stats: WatcherStats;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Set<string> = new Set();
  private watchedFiles: Set<string> = new Set();

  constructor(hybridStorage: HybridStorageManager, config: WatcherConfig) {
    super();
    this.hybridStorage = hybridStorage;
    this.config = config;

    this.stats = {
      status: 'idle',
      watchPath: '',
      filesWatched: 0,
      changesDetected: 0,
      lastChangeTime: 0,
      uptime: 0,
      errors: 0
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<WatcherConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // 如果启用状态改变，重新启动监控
    if (oldConfig.enabled !== this.config.enabled) {
      if (this.config.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): WatcherConfig {
    return { ...this.config };
  }

  /**
   * 获取监控状态
   */
  public getStatus(): WatcherStatus {
    return this.status;
  }

  /**
   * 获取统计信息
   */
  public getStats(): WatcherStats {
    return {
      ...this.stats,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0
    };
  }

  /**
   * 开始监控
   */
  public async start(): Promise<boolean> {
    if (this.status === 'watching') {
      console.log('[FilesystemWatcher] Already watching');
      return true;
    }

    try {
      // 获取文件存储路径
      const storageConfig = this.hybridStorage.getConfig();
      if (!storageConfig.filePath) {
        throw new Error('File storage path not configured');
      }

      this.watchPath = storageConfig.filePath;

      // 检查路径是否存在
      if (!fs.existsSync(this.watchPath)) {
        throw new Error(`Watch path does not exist: ${this.watchPath}`);
      }

      console.log(`[FilesystemWatcher] Starting to watch: ${this.watchPath}`);

      // 创建文件系统监控器
      this.watcher = fs.watch(this.watchPath, { recursive: false }, (eventType, filename) => {
        this.handleFileChange(eventType, filename);
      });

      // 初始化已监控的文件列表
      await this.scanWatchedFiles();

      // 更新状态
      this.status = 'watching';
      this.startTime = Date.now();
      this.stats.status = 'watching';
      this.stats.watchPath = this.watchPath;

      this.emit('started', this.watchPath);
      console.log('[FilesystemWatcher] Started successfully');

      return true;
    } catch (error) {
      console.error('[FilesystemWatcher] Failed to start:', error);
      this.status = 'error';
      this.stats.status = 'error';
      this.stats.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.status = 'idle';
    this.stats.status = 'idle';
    this.pendingChanges.clear();
    this.watchedFiles.clear();

    this.emit('stopped');
    console.log('[FilesystemWatcher] Stopped');
  }

  /**
   * 暂停监控
   */
  public pause(): void {
    if (this.status !== 'watching') {
      return;
    }

    this.status = 'paused';
    this.stats.status = 'paused';

    this.emit('paused');
    console.log('[FilesystemWatcher] Paused');
  }

  /**
   * 恢复监控
   */
  public resume(): void {
    if (this.status !== 'paused') {
      return;
    }

    this.status = 'watching';
    this.stats.status = 'watching';

    this.emit('resumed');
    console.log('[FilesystemWatcher] Resumed');
  }

  /**
   * 扫描当前监控的文件
   */
  private async scanWatchedFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.watchPath);
      const mdFiles = files.filter(file =>
        file.endsWith('.md') &&
        file !== '.multitodo-metadata' &&
        !this.shouldIgnore(file)
      );

      this.watchedFiles = new Set(mdFiles.map(file => path.join(this.watchPath, file)));
      this.stats.filesWatched = this.watchedFiles.size;

      console.log(`[FilesystemWatcher] Scanned ${this.watchedFiles.size} files to watch`);
    } catch (error) {
      console.error('[FilesystemWatcher] Error scanning files:', error);
    }
  }

  /**
   * 处理文件变化事件
   */
  private handleFileChange(eventType: string, filename: string | null): void {
    if (!filename) {
      return;
    }

    const filePath = path.join(this.watchPath, filename);

    // 检查是否应该忽略此文件
    if (this.shouldIgnore(filename)) {
      console.log(`[FilesystemWatcher] Ignoring file: ${filename}`);
      return;
    }

    // 如果不是Markdown文件，忽略
    if (!filename.endsWith('.md')) {
      return;
    }

    console.log(`[FilesystemWatcher] File change detected: ${eventType} - ${filename}`);

    // 添加到待处理变化列表
    this.pendingChanges.add(filePath);

    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.config.debounceDelay);
  }

  /**
   * 处理待处理的文件变化
   */
  private async processPendingChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    console.log(`[FilesystemWatcher] Processing ${this.pendingChanges.size} pending changes`);

    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    for (const filePath of changes) {
      await this.processFileChange(filePath);
    }

    // 更新统计信息
    this.stats.changesDetected += changes.length;
    this.stats.lastChangeTime = Date.now();

    // 如果启用自动同步，刷新混合存储缓存
    if (this.config.autoSync) {
      console.log('[FilesystemWatcher] Auto-syncing changes...');
      this.hybridStorage.invalidateCache();
    }

    // 发送变化通知
    if (this.config.notifyChanges) {
      this.emit('changes', changes);
    }
  }

  /**
   * 处理单个文件变化
   */
  private async processFileChange(filePath: string): Promise<void> {
    try {
      const exists = fs.existsSync(filePath);
      const filename = path.basename(filePath);

      if (!exists) {
        // 文件被删除
        console.log(`[FilesystemWatcher] File deleted: ${filename}`);
        this.handleFileDeleted(filePath);
        this.watchedFiles.delete(filePath);
      } else {
        // 文件被创建或修改
        const stats = fs.statSync(filePath);
        const wasWatched = this.watchedFiles.has(filePath);

        if (!wasWatched) {
          console.log(`[FilesystemWatcher] File created: ${filename}`);
          this.handleFileCreated(filePath, stats);
          this.watchedFiles.add(filePath);
        } else {
          console.log(`[FilesystemWatcher] File modified: ${filename}`);
          this.handleFileModified(filePath, stats);
        }
      }

      // 更新监控文件数量
      this.stats.filesWatched = this.watchedFiles.size;

    } catch (error) {
      console.error(`[FilesystemWatcher] Error processing file change ${filePath}:`, error);
      this.stats.errors++;
      this.emit('error', error);
    }
  }

  /**
   * 处理文件创建事件
   */
  private handleFileCreated(filePath: string, stats: fs.Stats): void {
    const event: FileChangeEvent = {
      type: FileChangeType.CREATED,
      filePath,
      timestamp: Date.now(),
      stats
    };

    this.emit('file-created', event);

    // 可以在这里触发自动导入或其他操作
    console.log(`[FilesystemWatcher] New file detected: ${path.basename(filePath)}`);
  }

  /**
   * 处理文件修改事件
   */
  private handleFileModified(filePath: string, stats: fs.Stats): void {
    const event: FileChangeEvent = {
      type: FileChangeType.MODIFIED,
      filePath,
      timestamp: Date.now(),
      stats
    };

    this.emit('file-modified', event);

    // 可以在这里触发自动更新或其他操作
    console.log(`[FilesystemWatcher] File modified: ${path.basename(filePath)}`);
  }

  /**
   * 处理文件删除事件
   */
  private handleFileDeleted(filePath: string): void {
    const event: FileChangeEvent = {
      type: FileChangeType.DELETED,
      filePath,
      timestamp: Date.now()
    };

    this.emit('file-deleted', event);

    // 可以在这里触发自动清理或其他操作
    console.log(`[FilesystemWatcher] File deleted: ${path.basename(filePath)}`);
  }

  /**
   * 检查是否应该忽略文件
   */
  private shouldIgnore(filename: string): boolean {
    return this.config.ignorePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * 手动刷新监控文件列表
   */
  public async refresh(): Promise<void> {
    if (this.status !== 'watching') {
      throw new Error('Watcher is not running');
    }

    console.log('[FilesystemWatcher] Refreshing watched files...');
    await this.scanWatchedFiles();

    this.emit('refreshed');
  }

  /**
   * 获取监控的文件列表
   */
  public getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles);
  }

  /**
   * 获取最近的变化事件
   */
  public getRecentChanges(limit: number = 10): FileChangeEvent[] {
    // 这里可以添加一个变化历史记录功能
    // 目前返回空数组
    return [];
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats.changesDetected = 0;
    this.stats.lastChangeTime = 0;
    this.stats.errors = 0;
    this.startTime = this.status === 'watching' ? Date.now() : 0;

    this.emit('stats-reset');
  }

  /**
   * 销毁监控器
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    console.log('[FilesystemWatcher] Destroyed');
  }
}