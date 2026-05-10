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
 * 应用配置文件结构
 */
export interface AppConfigFile {
  version: number;
  firstRun: boolean;
  storageLocation: StorageLocation;
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

        // 验证版本
        if (config.version === 1) {
          console.log('[AppConfig] 已加载应用配置文件:', {
            path: this.configPath,
            firstRun: config.firstRun,
            storageLocation: config.storageLocation
          });
          return config;
        } else {
          console.warn('[AppConfig] 配置文件版本不匹配，将创建新配置');
        }
      }
    } catch (error) {
      console.error('[AppConfig] 加载配置文件失败:', error);
    }

    // 返回默认配置
    return this.createDefaultConfig();
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): AppConfigFile {
    return {
      version: 1,
      firstRun: true,
      storageLocation: {
        type: 'default',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      console.log('[AppConfig] 配置文件已保存:', {
        path: this.configPath,
        firstRun: this.config.firstRun,
        storageLocation: this.config.storageLocation
      });
    } catch (error) {
      console.error('[AppConfig] 保存配置文件失败:', error);
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
}

// 导出单例
export const appConfigManager = new AppConfigManager();