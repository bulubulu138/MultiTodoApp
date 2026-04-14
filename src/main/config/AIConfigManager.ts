// AI配置文件管理器 - 持久化AI配置到本地文件
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AIProvider } from '../../shared/types';

/**
 * 单个provider的配置
 */
export interface AIProviderConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  enabled: boolean;
  updatedAt: string; // ISO timestamp
}

/**
 * AI配置文件结构
 */
export interface AIConfigFile {
  version: number;
  currentProvider: AIProvider;
  providers: Record<string, AIProviderConfig>;
}

/**
 * AI配置管理器
 */
export class AIConfigManager {
  private configPath: string;
  private config: AIConfigFile;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'ai-config.json');
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AIConfigFile {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data) as AIConfigFile;

        // 验证版本
        if (config.version === 1) {
          console.log('[AIConfigManager] 已加载AI配置文件:', {
            path: this.configPath,
            currentProvider: config.currentProvider,
            providersCount: Object.keys(config.providers).length
          });
          return config;
        } else {
          console.warn('[AIConfigManager] 配置文件版本不匹配，将创建新配置');
        }
      }
    } catch (error) {
      console.error('[AIConfigManager] 加载配置文件失败:', error);
    }

    // 返回默认配置
    return this.createDefaultConfig();
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): AIConfigFile {
    return {
      version: 1,
      currentProvider: 'disabled',
      providers: {}
    };
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
      console.log('[AIConfigManager] 配置文件已保存:', {
        path: this.configPath,
        currentProvider: this.config.currentProvider
      });
    } catch (error) {
      console.error('[AIConfigManager] 保存配置文件失败:', error);
      throw error;
    }
  }

  /**
   * 更新provider配置
   */
  public updateProvider(
    provider: AIProvider,
    apiKey: string,
    endpoint: string,
    model: string
  ): void {
    const enabled = provider !== 'disabled' && apiKey.length > 0;

    if (provider === 'disabled') {
      this.config.currentProvider = 'disabled';
    } else {
      // 更新当前provider
      this.config.currentProvider = provider;

      // 保存provider配置
      this.config.providers[provider] = {
        apiKey,
        endpoint,
        model,
        enabled,
        updatedAt: new Date().toISOString()
      };
    }

    this.saveConfig();
  }

  /**
   * 获取当前provider的配置
   */
  public getCurrentProviderConfig(): {
    provider: AIProvider;
    config: AIProviderConfig | null;
  } {
    const provider = this.config.currentProvider;

    if (provider === 'disabled') {
      return {
        provider: 'disabled',
        config: null
      };
    }

    const config = this.config.providers[provider] || null;
    return {
      provider,
      config
    };
  }

  /**
   * 获取指定provider的配置
   */
  public getProviderConfig(provider: AIProvider): AIProviderConfig | null {
    if (provider === 'disabled') {
      return null;
    }
    return this.config.providers[provider] || null;
  }

  /**
   * 获取所有已配置的providers
   */
  public getAllProviders(): Array<{
    provider: AIProvider;
    config: AIProviderConfig;
  }> {
    return Object.entries(this.config.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider, config]) => ({
        provider: provider as AIProvider,
        config
      }));
  }

  /**
   * 切换当前provider
   */
  public switchProvider(provider: AIProvider): void {
    if (provider === 'disabled' || this.config.providers[provider]) {
      this.config.currentProvider = provider;
      this.saveConfig();
    } else {
      console.warn('[AIConfigManager] 无法切换到未配置的provider:', provider);
    }
  }

  /**
   * 删除provider配置
   */
  public deleteProvider(provider: AIProvider): void {
    delete this.config.providers[provider];

    // 如果删除的是当前provider，切换到disabled
    if (this.config.currentProvider === provider) {
      this.config.currentProvider = 'disabled';
    }

    this.saveConfig();
  }

  /**
   * 清除所有配置（用于重置）
   */
  public clearAll(): void {
    this.config = this.createDefaultConfig();
    this.saveConfig();
  }

  /**
   * 导出配置（用于备份）
   */
  public exportConfig(): string {
    // 导出时隐藏API key
    const sanitized = {
      ...this.config,
      providers: Object.entries(this.config.providers).reduce((acc, [key, value]) => {
        acc[key] = {
          ...value,
          apiKey: value.apiKey ? '***' : ''
        };
        return acc;
      }, {} as Record<string, AIProviderConfig>)
    };
    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.configPath;
  }
}

// 导出单例
export const aiConfigManager = new AIConfigManager();
