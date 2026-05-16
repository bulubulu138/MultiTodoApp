/**
 * 数据库管理器
 * 管理多个数据库的创建、切换、验证和初始化
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileStorageManager } from '../FileStorageManager';
import { BackupManager } from '../utils/BackupManager';
import { appConfigManager, DatabaseRecord } from '../config/AppConfig';

export interface DatabaseInfo {
  path: string;
  name: string;
  lastUsed: string;
  todoCount: number;
  isValid: boolean;
  createdAt?: string;
}

export class DatabaseManager {
  private currentStorageManager: FileStorageManager | null = null;
  private currentBackupManager: BackupManager | null = null;
  private currentDatabasePath: string = '';
  private isInitialized: boolean = false;

  /**
   * 初始化数据库管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[DatabaseManager] ✅ Already initialized, skipping...');
      return;
    }

    try {
      console.log('[DatabaseManager] 🚀 Initializing database manager...');

      // 获取当前数据库路径
      const currentPath = appConfigManager.getCurrentDatabasePath();
      console.log(`[DatabaseManager] 📂 Current database path: ${currentPath}`);

      // 验证并初始化当前数据库
      const isValid = await appConfigManager.validateDatabase(currentPath);

      if (!isValid) {
        console.warn('[DatabaseManager] ⚠️ Current database is invalid, initializing...');
        await appConfigManager.initializeDatabase(currentPath);
      }

      // 切换到当前数据库
      await this.switchDatabase(currentPath, false);

      this.isInitialized = true;
      console.log('[DatabaseManager] ✅ Database manager initialized successfully');
    } catch (error) {
      console.error('[DatabaseManager] ❌ Failed to initialize database manager:', error);
      throw error;
    }
  }

  /**
   * 切换数据库
   */
  async switchDatabase(dbPath: string, reloadApp: boolean = true): Promise<void> {
    try {
      console.log(`[DatabaseManager] 🔄 Switching to database: ${dbPath}`);

      // 1. 停止当前的备份管理器
      if (this.currentBackupManager) {
        this.currentBackupManager.stopAutoBackup();
        this.currentBackupManager = null;
        console.log('[DatabaseManager] 🛑 Stopped current backup manager');
      }

      // 2. 停止当前的存储管理器
      if (this.currentStorageManager) {
        await this.currentStorageManager.stopWatching();
        this.currentStorageManager = null;
        console.log('[DatabaseManager] 🛑 Stopped current storage manager');
      }

      // 3. 验证数据库
      const isValid = await appConfigManager.validateDatabase(dbPath);
      if (!isValid) {
        throw new Error(`Invalid database: ${dbPath}`);
      }

      // 4. 创建新的存储管理器
      this.currentStorageManager = new FileStorageManager(dbPath);
      this.currentDatabasePath = dbPath;

      // 5. 创建新的备份管理器
      this.currentBackupManager = new BackupManager(dbPath, this.currentStorageManager);
      this.currentBackupManager.startAutoBackup();

      // 6. 更新配置
      appConfigManager.setStorageLocation('custom', dbPath);
      appConfigManager.setCurrentDatabasePath(dbPath);

      // 7. 更新数据库历史记录
      const todos = await this.currentStorageManager.getAllTodos();
      appConfigManager.addDatabaseToHistory(dbPath, todos.length);

      console.log(`[DatabaseManager] ✅ Database switched successfully: ${dbPath} (${todos.length} todos)`);
    } catch (error) {
      console.error('[DatabaseManager] ❌ Failed to switch database:', error);
      throw error;
    }
  }

  /**
   * 验证数据库
   */
  async validateDatabase(dbPath: string): Promise<boolean> {
    return await appConfigManager.validateDatabase(dbPath);
  }

  /**
   * 初始化数据库
   */
  async initializeDatabase(dbPath: string): Promise<boolean> {
    return await appConfigManager.initializeDatabase(dbPath);
  }

  /**
   * 获取数据库信息
   */
  async getDatabaseInfo(dbPath: string): Promise<DatabaseInfo | null> {
    try {
      const isValid = await this.validateDatabase(dbPath);
      if (!isValid) {
        return null;
      }

      const stats = fs.statSync(dbPath);
      const name = path.basename(dbPath);

      // 创建临时存储管理器以获取待办数量
      const tempStorage = new FileStorageManager(dbPath);
      const todoCount = await tempStorage.getAllTodos().then(todos => todos.length);
      await tempStorage.stopWatching();

      return {
        path: dbPath,
        name,
        lastUsed: stats.mtime.toISOString(),
        todoCount,
        isValid,
        createdAt: stats.birthtime.toISOString()
      };
    } catch (error) {
      console.error(`[DatabaseManager] ❌ Failed to get database info for ${dbPath}:`, error);
      return null;
    }
  }

  /**
   * 获取最近的数据库列表
   */
  async getRecentDatabases(): Promise<DatabaseInfo[]> {
    try {
      const records = appConfigManager.getRecentDatabases();
      const databases: DatabaseInfo[] = [];

      for (const record of records) {
        const info = await this.getDatabaseInfo(record.path);
        if (info) {
          databases.push(info);
        }
      }

      console.log(`[DatabaseManager] 📋 Loaded ${databases.length} recent databases`);
      return databases;
    } catch (error) {
      console.error('[DatabaseManager] ❌ Failed to get recent databases:', error);
      return [];
    }
  }

  /**
   * 获取当前存储管理器
   */
  getCurrentStorageManager(): FileStorageManager | null {
    return this.currentStorageManager;
  }

  /**
   * 获取当前数据库路径
   */
  getCurrentDatabasePath(): string {
    return this.currentDatabasePath;
  }

  /**
   * 获取当前备份管理器
   */
  getCurrentBackupManager(): BackupManager | null {
    return this.currentBackupManager;
  }

  /**
   * 关闭数据库管理器
   */
  async shutdown(): Promise<void> {
    try {
      console.log('[DatabaseManager] 🛑 Shutting down database manager...');

      if (this.currentBackupManager) {
        this.currentBackupManager.stopAutoBackup();
        this.currentBackupManager = null;
      }

      if (this.currentStorageManager) {
        await this.currentStorageManager.stopWatching();
        this.currentStorageManager = null;
      }

      this.isInitialized = false;
      console.log('[DatabaseManager] ✅ Database manager shut down successfully');
    } catch (error) {
      console.error('[DatabaseManager] ❌ Failed to shutdown database manager:', error);
    }
  }
}

// 导出单例
export const databaseManager = new DatabaseManager();
