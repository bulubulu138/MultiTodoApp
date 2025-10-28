// AI 服务抽象层 - 支持多个 AI 提供商
import * as https from 'https';
import * as http from 'http';
import { AIProvider } from '../../shared/types';

// AI 提供商配置
interface AIProviderConfig {
  name: string;
  defaultEndpoint: string;
  supportsStreaming: boolean;
}

// AI 提供商配置映射
const AI_PROVIDERS: Record<AIProvider, AIProviderConfig | null> = {
  'disabled': null,
  'kimi': {
    name: 'Kimi (月之暗面)',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    supportsStreaming: true
  },
  'deepseek': {
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    supportsStreaming: true
  },
  'doubao': {
    name: '豆包 (字节跳动)',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    supportsStreaming: true
  },
  'custom': {
    name: '自定义',
    defaultEndpoint: '',
    supportsStreaming: true
  }
};

// AI 请求参数
interface AICompletionRequest {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// AI 响应
interface AICompletionResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class AIService {
  private provider: AIProvider = 'disabled';
  private apiKey: string = '';
  private apiEndpoint: string = '';
  private enabled: boolean = false;

  /**
   * 配置 AI 服务
   */
  public configure(provider: AIProvider, apiKey: string, customEndpoint?: string): void {
    this.provider = provider;
    this.apiKey = apiKey;
    this.enabled = provider !== 'disabled' && apiKey.length > 0;

    // 设置 API 端点
    const providerConfig = AI_PROVIDERS[provider];
    if (providerConfig) {
      this.apiEndpoint = customEndpoint || providerConfig.defaultEndpoint;
    } else {
      this.apiEndpoint = '';
      this.enabled = false;
    }

    console.log(`AI Service configured: provider=${provider}, enabled=${this.enabled}`);
  }

  /**
   * 检查服务是否已启用
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取当前配置
   */
  public getConfig(): { provider: AIProvider; endpoint: string; enabled: boolean } {
    return {
      provider: this.provider,
      endpoint: this.apiEndpoint,
      enabled: this.enabled
    };
  }

  /**
   * 测试 API 连接
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.enabled) {
      return { success: false, message: 'AI服务未启用' };
    }

    if (!this.apiKey) {
      return { success: false, message: 'API Key未配置' };
    }

    try {
      // 发送一个简单的测试请求
      const response = await this.sendCompletionRequest({
        messages: [
          { role: 'user', content: '你好' }
        ],
        max_tokens: 10,
        temperature: 0.7
      });

      if (response.success) {
        return { success: true, message: '连接成功！' };
      } else {
        return { success: false, message: response.error || '连接失败' };
      }
    } catch (error: any) {
      return { success: false, message: `连接错误: ${error.message}` };
    }
  }

  /**
   * 发送文本补全请求（OpenAI 兼容格式）
   */
  private async sendCompletionRequest(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.enabled || !this.apiEndpoint) {
      return { success: false, error: 'AI服务未配置' };
    }

    return new Promise((resolve) => {
      try {
        const url = new URL(`${this.apiEndpoint}/chat/completions`);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const postData = JSON.stringify({
          model: request.model || 'default',
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000,
          stream: false
        });

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = client.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);
                const content = response.choices?.[0]?.message?.content || '';
                resolve({ success: true, content });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
              }
            } catch (error: any) {
              resolve({ success: false, error: `解析响应失败: ${error.message}` });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });

        req.write(postData);
        req.end();

      } catch (error: any) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * 未来扩展：智能提取待办关键信息
   */
  public async extractTodoKeyInfo(title: string, content: string): Promise<string[]> {
    // TODO: 使用 AI 提取关键信息
    // 当前返回空数组，待未来实现
    console.log('AI keyword extraction not yet implemented');
    return [];
  }

  /**
   * 未来扩展：生成待办摘要
   */
  public async generateSummary(content: string): Promise<string> {
    // TODO: 使用 AI 生成摘要
    console.log('AI summary generation not yet implemented');
    return '';
  }

  /**
   * 获取支持的 AI 提供商列表
   */
  public static getSupportedProviders(): Array<{ value: AIProvider; label: string; endpoint: string }> {
    return Object.entries(AI_PROVIDERS)
      .filter(([key]) => key !== 'disabled')
      .map(([key, config]) => ({
        value: key as AIProvider,
        label: config?.name || key,
        endpoint: config?.defaultEndpoint || ''
      }));
  }
}

// 导出单例
export const aiService = new AIService();

