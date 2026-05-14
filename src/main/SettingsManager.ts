import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Settings } from '../shared/types';

/**
 * 基于文件的设置管理器
 * 替代 DatabaseManager 的设置存储功能
 */
export class SettingsManager {
  private settingsPath: string;
  private settings: Settings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.settings = this.loadSettings();
  }

  /**
   * 加载设置
   */
  private loadSettings(): Settings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    // 返回默认设置
    return this.getDefaultSettings();
  }

  /**
   * 获取默认设置
   */
  private getDefaultSettings(): Settings {
    return {
      storageMode: 'file',
      storagePath: '',
      theme: 'purple',
      language: 'zh-CN',
      aiProvider: 'disabled',
      aiApiKey: '',
      aiModel: ''
    };
  }

  /**
   * 保存设置
   */
  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * 获取所有设置
   */
  public getSettings(): Settings {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  public updateSettings(updates: Partial<Settings>): Settings {
    this.settings = {
      ...this.settings,
      ...updates
    } as Settings;
    this.saveSettings();
    return this.getSettings();
  }

  /**
   * 获取单个设置值
   */
  public getSetting<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  /**
   * 设置单个值
   */
  public setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  /**
   * 获取设置文件路径 (用于兼容旧代码)
   */
  public getDbPath(): string {
    return this.settingsPath;
  }

  /**
   * 关闭设置管理器 (用于兼容旧代码)
   */
  public close(): void {
    // 不需要任何操作，因为我们没有打开的连接
  }

  /**
   * 初始化 (用于兼容旧代码)
   */
  public async initialize(): Promise<void> {
    // 不需要任何操作，设置在构造函数中已加载
  }
}