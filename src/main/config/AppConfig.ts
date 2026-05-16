// 应用配置文件管理器 - 持久化应用配置到本地文件
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * 存储位置类型
 */
export type StorageLocationType = 'default' | 'documents' | 'home' | 'custom';

/**
 * 存储位置配置
 */
export interface StorageLocation {
  type: StorageLocationType;
  customPath?: string;
  lastUpdated: string; // ISO timestamp
}

/**
 * 数据库记录
 */
export interface DatabaseRecord {
  path: string;
  name: string;
  lastUsed: string;
  todoCount: number;
  isValid: boolean;
}

/**
 * 应用配置文件结构
 */
export interface AppConfigFile {
  version: number;
  firstRun: boolean;
  storageLocation: StorageLocation;
  recentDatabases: DatabaseRecord[];
  currentDatabasePath: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 应用配置管理器
 */
class AppConfigManager {
  private configPath: string;
  private config: AppConfigFile;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'app-config.json');
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AppConfigFile {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data) as AppConfigFile;

        // 验证版本并迁移
        if (config.version === 1) {
          console.log('[AppConfig] 检测到版本1配置，正在迁移到版本2...');
          const migratedConfig = this.migrateV1ToV2(config);
          this.saveConfigToFile(migratedConfig);
          return migratedConfig;
        } else if (config.version === 2) {
          console.log('[AppConfig] ✅ 已加载应用配置文件 (v2):', {
            path: this.configPath,
            firstRun: config.firstRun,
            storageLocation: config.storageLocation,
            databasesCount: config.recentDatabases?.length || 0
          });
          return config;
        } else {
          console.warn('[AppConfig] ⚠️ 配置文件版本不匹配，将创建新配置');
        }
      }
    } catch (error) {
      console.error('[AppConfig] ❌ 加载配置文件失败:', error);
    }

    // 返回默认配置
    return this.createDefaultConfig();
  }

  /**
   * 迁移版本1配置到版本2
   */
  private migrateV1ToV2(oldConfig: any): AppConfigFile {
    console.log('[AppConfig] 🔄 Migrating v1 to v2 config...');

    const newConfig: AppConfigFile = {
      version: 2,
      firstRun: oldConfig.firstRun || false,
      storageLocation: oldConfig.storageLocation || {
        type: 'default',
        lastUpdated: new Date().toISOString()
      },
      recentDatabases: [],
      currentDatabasePath: path.join(app.getPath('userData'), 'todos')
    };

    // 如果有自定义路径，添加到数据库历史记录
    if (oldConfig.storageLocation?.customPath) {
      newConfig.currentDatabasePath = oldConfig.storageLocation.customPath;
      newConfig.recentDatabases.push({
        path: oldConfig.storageLocation.customPath,
        name: path.basename(oldConfig.storageLocation.customPath),
        lastUsed: oldConfig.storageLocation.lastUpdated || new Date().toISOString(),
        todoCount: 0,
        isValid: true
      });
    }

    console.log('[AppConfig] ✅ Migration completed');
    return newConfig;
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): AppConfigFile {
    return {
      version: 2, // 升级版本号以支持多数据库
      firstRun: true,
      storageLocation: {
        type: 'default',
        lastUpdated: new Date().toISOString()
      },
      recentDatabases: [],
      currentDatabasePath: path.join(app.getPath('userData'), 'todos')
    };
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      console.log('[AppConfig] 💾 配置文件已保存:', {
        path: this.configPath,
        firstRun: this.config.firstRun,
        storageLocation: this.config.storageLocation,
        databasesCount: this.config.recentDatabases?.length || 0
      });
    } catch (error) {
      console.error('[AppConfig] ❌ 保存配置文件失败:', error);
      throw error;
    }
  }

  /**
   * 保存配置到文件（用于迁移）
   */
  private saveConfigToFile(config: AppConfigFile): void {
    try {
      const data = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      console.log('[AppConfig] 💾 配置文件已保存到文件');
    } catch (error) {
      console.error('[AppConfig] ❌ 保存配置文件到文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 检查是否首次运行
   */
  public isFirstRun(): boolean {
    return this.config.firstRun;
  }

  /**
   * 标记首次运行完成
   */
  public setFirstRunComplete(): void {
    this.config.firstRun = false;
    this.saveConfig();
    console.log('[AppConfig] 已标记首次运行完成');
  }

  /**
   * 获取存储位置配置
   */
  public getStorageLocation(): StorageLocation {
    return this.config.storageLocation;
  }

  /**
   * 设置存储位置
   */
  public setStorageLocation(type: StorageLocationType, customPath?: string): void {
    this.config.storageLocation = {
      type,
      customPath: type === 'custom' ? customPath : undefined,
      lastUpdated: new Date().toISOString()
    };
    this.saveConfig();
    console.log('[AppConfig] 已更新存储位置:', this.config.storageLocation);
  }

  /**
   * 验证配置
   */
  public validateConfig(): ValidationResult {
    try {
      // 检查存储位置配置
      const { type, customPath } = this.config.storageLocation;

      if (type === 'custom' && !customPath) {
        return {
          valid: false,
          error: '自定义存储位置需要指定路径'
        };
      }

      // 验证自定义路径是否存在（如果指定了）
      if (type === 'custom' && customPath) {
        if (!fs.existsSync(customPath)) {
          return {
            valid: false,
            error: `指定的存储路径不存在: ${customPath}`
          };
        }

        // 检查是否是目录
        const stats = fs.statSync(customPath);
        if (!stats.isDirectory()) {
          return {
            valid: false,
            error: `指定的路径不是目录: ${customPath}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `配置验证失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 重置配置（用于调试或重置）
   */
  public resetConfig(): void {
    this.config = this.createDefaultConfig();
    this.saveConfig();
    console.log('[AppConfig] 已重置配置');
  }

  /**
   * 导出配置（用于备份）
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // ==================== 数据库管理方法 ====================

  /**
   * 添加数据库到历史记录
   */
  public addDatabaseToHistory(dbPath: string, todoCount: number): void {
    const record: DatabaseRecord = {
      path: dbPath,
      name: path.basename(dbPath),
      lastUsed: new Date().toISOString(),
      todoCount,
      isValid: true
    };

    // 避免重复
    this.config.recentDatabases = this.config.recentDatabases.filter(
      db => db.path !== dbPath
    );
    this.config.recentDatabases.unshift(record);

    // 限制历史记录数量（最多 10 个）
    if (this.config.recentDatabases.length > 10) {
      this.config.recentDatabases = this.config.recentDatabases.slice(0, 10);
    }

    this.saveConfig();
    console.log(`[AppConfig] ✅ Database added to history: ${dbPath}`);
  }

  /**
   * 获取数据库历史记录
   */
  public getRecentDatabases(): DatabaseRecord[] {
    return this.config.recentDatabases || [];
  }

  /**
   * 设置当前数据库路径
   */
  public setCurrentDatabasePath(dbPath: string): void {
    this.config.currentDatabasePath = dbPath;
    this.saveConfig();
    console.log(`[AppConfig] ✅ Current database path set to: ${dbPath}`);
  }

  /**
   * 获取当前数据库路径
   */
  public getCurrentDatabasePath(): string {
    return this.config.currentDatabasePath || path.join(app.getPath('userData'), 'todos');
  }

  /**
   * 验证数据库有效性
   */
  public async validateDatabase(dbPath: string): Promise<boolean> {
    try {
      // 检查文件夹是否存在
      if (!fs.existsSync(dbPath)) {
        console.warn(`[AppConfig] ⚠️ Database path does not exist: ${dbPath}`);
        return false;
      }

      // 检查是否是目录
      const stats = fs.statSync(dbPath);
      if (!stats.isDirectory()) {
        console.warn(`[AppConfig] ⚠️ Database path is not a directory: ${dbPath}`);
        return false;
      }

      // 检查是否包含必要的元数据文件夹
      const metadataPath = path.join(dbPath, '.multitodo-metadata');
      if (!fs.existsSync(metadataPath)) {
        console.warn(`[AppConfig] ⚠️ Database does not contain metadata folder: ${dbPath}`);
        return false;
      }

      // 检查是否至少有一个 Markdown 文件（允许空数据库）
      const files = fs.readdirSync(dbPath);
      const hasMarkdownFiles = files.some(file => file.endsWith('.md') && !file.startsWith('.'));

      console.log(`[AppConfig] ✅ Database validation passed: ${dbPath} (has markdown files: ${hasMarkdownFiles})`);
      return true;
    } catch (error) {
      console.error(`[AppConfig] ❌ Database validation failed for ${dbPath}:`, error);
      return false;
    }
  }

  /**
   * 初始化数据库
   */
  public async initializeDatabase(dbPath: string): Promise<boolean> {
    try {
      console.log(`[AppConfig] 🚀 Initializing database at: ${dbPath}`);

      const dirs = [
        dbPath,
        path.join(dbPath, '.multitodo-metadata'),
        path.join(dbPath, '.multitodo-metadata', 'flowcharts'),
        path.join(dbPath, '.multitodo-metadata', 'templates'),
        path.join(dbPath, '.backup')
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`[AppConfig] ✅ Created directory: ${dir}`);
        }
      }

      console.log(`[AppConfig] ✅ Database initialization completed: ${dbPath}`);
      return true;
    } catch (error) {
      console.error(`[AppConfig] ❌ Database initialization failed for ${dbPath}:`, error);
      return false;
    }
  }

  /**
   * 从历史记录中移除数据库
   */
  public removeDatabaseFromHistory(dbPath: string): void {
    this.config.recentDatabases = this.config.recentDatabases.filter(db => db.path !== dbPath);
    this.saveConfig();
    console.log(`[AppConfig] 🗑️ Database removed from history: ${dbPath}`);
  }
}

// 导出单例
export const appConfigManager = new AppConfigManager();