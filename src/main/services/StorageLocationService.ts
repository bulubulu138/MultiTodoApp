// 存储位置服务 - 处理存储位置的业务逻辑
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { DatabaseManager } from '../database/DatabaseManager';
import { BackupManager } from '../utils/BackupManager';
import { appConfigManager, StorageLocation } from '../config/AppConfig';

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  availableSpace?: number; // 可用磁盘空间（字节）
}

/**
 * 移动结果
 */
export interface MoveResult {
  success: boolean;
  error?: string;
  backupPath?: string;
  newPath?: string;
}

/**
 * 恢复选项
 */
export type RecoveryOption = 'relocate' | 'change' | 'restore' | 'backup-manager';

/**
 * 恢复选项详情
 */
export interface RecoveryOptions {
  relocate: boolean;
  change: boolean;
  restore: boolean;
  backupManager: boolean;
  backupCount?: number;
  lastBackupPath?: string;
}

/**
 * 存储位置服务
 */
export class StorageLocationService {
  private dbManager: DatabaseManager | null = null;
  private backupManager: BackupManager | null = null;

  constructor(dbManager?: DatabaseManager) {
    if (dbManager) {
      this.dbManager = dbManager;
    }
  }

  /**
   * 设置数据库管理器
   */
  public setDatabaseManager(dbManager: DatabaseManager): void {
    this.dbManager = dbManager;
  }

  /**
   * 设置备份管理器
   */
  public setBackupManager(backupManager: BackupManager): void {
    this.backupManager = backupManager;
  }

  /**
   * 验证路径是否可用
   */
  public validatePath(targetPath: string): ValidationResult {
    const warnings: string[] = [];

    try {
      console.log('[StorageLocationService] Validating path:', targetPath);

      // 1. 检查路径是否存在
      if (!fs.existsSync(targetPath)) {
        return {
          valid: false,
          error: `路径不存在: ${targetPath}`
        };
      }

      // 2. 检查是否是目录
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        return {
          valid: false,
          error: `指定的路径不是目录: ${targetPath}`
        };
      }

      // 3. 检查是否有写入权限
      const testFile = path.join(targetPath, '.write-test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        return {
          valid: false,
          error: `没有写入权限: ${targetPath}`
        };
      }

      // 4. 检查磁盘空间（至少需要 10MB）
      try {
        const availableSpace = this.getAvailableDiskSpace(targetPath);
        const minSpace = 10 * 1024 * 1024; // 10MB

        if (availableSpace < minSpace) {
          return {
            valid: false,
            error: `磁盘空间不足，至少需要 10MB，当前可用: ${this.formatBytes(availableSpace)}`
          };
        }

        if (availableSpace < 100 * 1024 * 1024) { // 100MB
          warnings.push(`磁盘空间较少，建议至少保留 100MB，当前可用: ${this.formatBytes(availableSpace)}`);
        }
      } catch (error) {
        warnings.push(`无法检查磁盘空间: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 5. 检查是否是网络驱动器
      if (this.isNetworkDrive(targetPath)) {
        warnings.push('网络驱动器可能会影响性能，建议使用本地驱动器');
      }

      // 6. 检查路径长度
      if (targetPath.length > 200) {
        warnings.push('路径较长，可能会导致兼容性问题');
      }

      // 7. 检查是否已经有数据库文件
      const existingDbPath = path.join(targetPath, 'todo_app.db');
      if (fs.existsSync(existingDbPath)) {
        warnings.push('目标位置已存在数据库文件，操作时会覆盖现有文件');
      }

      console.log('[StorageLocationService] ✅ Path validation passed');
      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('[StorageLocationService] ❌ Path validation error:', error);
      return {
        valid: false,
        error: `路径验证失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 获取推荐的路径列表
   */
  public getRecommendedPaths(): string[] {
    const paths: string[] = [];

    try {
      // 1. Documents 目录
      const documentsPath = app.getPath('documents');
      const multiTodoDocsPath = path.join(documentsPath, 'MultiTodo');
      paths.push(multiTodoDocsPath);

      // 2. 用户主目录
      const homePath = app.getPath('home');
      const multiTodoHomePath = path.join(homePath, 'MultiTodo');
      paths.push(multiTodoHomePath);

      // 3. App Data 目录（默认位置）
      const userDataPath = app.getPath('userData');
      paths.push(userDataPath);

      // 4. 桌面目录（不推荐，但提供选项）
      const desktopPath = app.getPath('desktop');
      const multiTodoDesktopPath = path.join(desktopPath, 'MultiTodo');
      paths.push(multiTodoDesktopPath);

      console.log('[StorageLocationService] Recommended paths generated:', paths);
    } catch (error) {
      console.error('[StorageLocationService] Error generating recommended paths:', error);
    }

    return paths;
  }

  /**
   * 移动存储到新位置
   */
  public async moveStorage(newPath: string, currentPath: string): Promise<MoveResult> {
    try {
      console.log('[StorageLocationService] Starting storage move operation');
      console.log('[StorageLocationService] Current path:', currentPath);
      console.log('[StorageLocationService] New path:', newPath);

      // 1. 验证新路径
      const validation = this.validatePath(newPath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // 2. 构建新数据库文件路径
      const newDbPath = path.join(newPath, 'todo_app.db');

      // 3. 创建备份（如果存在数据库管理器）
      let backupPath: string | undefined;
      if (this.dbManager && this.backupManager) {
        try {
          console.log('[StorageLocationService] Creating backup before move...');
          const backupInfo = await this.backupManager.createBackup();
          backupPath = backupInfo.filepath;
          console.log('[StorageLocationService] ✅ Backup created:', backupPath);
        } catch (error) {
          console.warn('[StorageLocationService] ⚠️ Failed to create backup:', error);
          // 继续操作，备份失败不阻止移动
        }
      }

      // 4. 移动数据库
      if (this.dbManager) {
        const moveSuccess = await this.dbManager.moveDatabase(newDbPath);
        if (!moveSuccess) {
          return {
            success: false,
            error: '数据库移动失败',
            backupPath
          };
        }
      } else {
        return {
          success: false,
          error: '数据库管理器未初始化'
        };
      }

      // 5. 验证数据完整性
      if (this.dbManager && !this.dbManager.verifyDatabase()) {
        // 如果验证失败，尝试恢复
        if (backupPath) {
          console.warn('[StorageLocationService] ⚠️ Database verification failed, attempting rollback...');
          // 这里可以实现恢复逻辑
        }

        return {
          success: false,
          error: '数据库完整性验证失败',
          backupPath
        };
      }

      console.log('[StorageLocationService] ✅ Storage moved successfully');
      return {
        success: true,
        backupPath,
        newPath: newDbPath
      };
    } catch (error) {
      console.error('[StorageLocationService] ❌ Storage move error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 处理数据库丢失的情况
   */
  public async handleMissingDatabase(currentConfig: StorageLocation): Promise<RecoveryOptions> {
    console.log('[StorageLocationService] Handling missing database scenario');

    const options: RecoveryOptions = {
      relocate: true,
      change: true,
      restore: false,
      backupManager: true
    };

    // 检查是否有可用的备份
    if (this.backupManager) {
      try {
        const backups = await this.backupManager.listBackups();
        if (backups.length > 0) {
          options.restore = true;
          options.backupCount = backups.length;

          // 获取最新的备份路径
          const latestBackup = backups[0];
          options.lastBackupPath = latestBackup.filepath;

          console.log('[StorageLocationService] Found', backups.length, 'backup(s)');
        }
      } catch (error) {
        console.warn('[StorageLocationService] Error checking backups:', error);
      }
    }

    return options;
  }

  /**
   * 验证数据完整性
   */
  public verifyDataIntegrity(dbPath: string): boolean {
    try {
      console.log('[StorageLocationService] Verifying data integrity:', dbPath);

      // 检查文件是否存在
      if (!fs.existsSync(dbPath)) {
        console.error('[StorageLocationService] Database file does not exist');
        return false;
      }

      // 尝试打开数据库并执行完整性检查
      const Database = require('better-sqlite3');
      const tempDb = new Database(dbPath, { readonly: true });

      try {
        const result = tempDb.pragma('integrity_check') as any[];
        if (result && result.length > 0 && result[0].integrity_check !== 'ok') {
          console.error('[StorageLocationService] Database integrity check failed:', result);
          return false;
        }

        console.log('[StorageLocationService] ✅ Data integrity verified');
        return true;
      } finally {
        tempDb.close();
      }
    } catch (error) {
      console.error('[StorageLocationService] ❌ Data integrity verification error:', error);
      return false;
    }
  }

  /**
   * 创建备份
   */
  public async createBackup(): Promise<string | null> {
    try {
      if (!this.backupManager) {
        console.warn('[StorageLocationService] BackupManager not initialized');
        return null;
      }

      console.log('[StorageLocationService] Creating backup...');
      const backupInfo = await this.backupManager.createBackup();
      console.log('[StorageLocationService] ✅ Backup created:', backupInfo.filepath);
      return backupInfo.filepath;
    } catch (error) {
      console.error('[StorageLocationService] ❌ Backup creation error:', error);
      return null;
    }
  }

  /**
   * 获取可用磁盘空间
   */
  private getAvailableDiskSpace(targetPath: string): number {
    try {
      // 在Node.js中获取磁盘空间比较复杂，这里使用简化版本
      // 在实际实现中可能需要使用平台特定的API
      const stats = fs.statSync(targetPath);
      return stats.dev || 1024 * 1024 * 1024; // 默认返回1GB
    } catch (error) {
      return 1024 * 1024 * 1024; // 默认返回1GB
    }
  }

  /**
   * 检查是否是网络驱动器
   */
  private isNetworkDrive(targetPath: string): boolean {
    try {
      // 简化的网络驱动器检测
      // Windows: 检查 UNC 路径 (\\server\share)
      if (process.platform === 'win32' && targetPath.startsWith('\\\\')) {
        return true;
      }

      // Unix: 检查 /mnt/ 或 /media/ 或 /Volumes/
      if (process.platform !== 'win32') {
        const networkPaths = ['/mnt/', '/media/', '/Volumes/'];
        return networkPaths.some(networkPath => targetPath.includes(networkPath));
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 从存储位置配置获取实际数据库路径
   */
  public getDatabasePathFromConfig(storageLocation: StorageLocation): string {
    switch (storageLocation.type) {
      case 'documents':
        const documentsPath = app.getPath('documents');
        return path.join(documentsPath, 'MultiTodo', 'todo_app.db');

      case 'home':
        const homePath = app.getPath('home');
        return path.join(homePath, 'MultiTodo', 'todo_app.db');

      case 'custom':
        if (storageLocation.customPath) {
          return path.join(storageLocation.customPath, 'todo_app.db');
        }
        // fallback to default
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'todo_app.db');

      case 'default':
      default:
        const defaultUserDataPath = app.getPath('userData');
        return path.join(defaultUserDataPath, 'todo_app.db');
    }
  }
}