// AI 服务抽象层 - 支持多个 AI 提供商
import * as https from 'https';
import * as http from 'http';
import { AIProvider } from '../../shared/types';

// AI 提供商配置
interface AIProviderConfig {
  name: string;
  defaultEndpoint: string;
  supportsStreaming: boolean;
  modelsEndpoint?: string; // 模型列表API端点
}

// AI 提供商配置映射
const AI_PROVIDERS: Record<AIProvider, AIProviderConfig | null> = {
  'disabled': null,
  'kimi': {
    name: 'Kimi (月之暗面)',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    supportsStreaming: true,
    modelsEndpoint: 'https://api.moonshot.cn/v1/models'
  },
  'deepseek': {
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    supportsStreaming: true,
    modelsEndpoint: 'https://api.deepseek.com/v1/models'
  },
  'doubao': {
    name: '豆包 (字节跳动)',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    supportsStreaming: true,
    modelsEndpoint: undefined // 豆包不支持公共的模型列表API
  },
  'openai': {
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    supportsStreaming: true,
    modelsEndpoint: 'https://api.openai.com/v1/models'
  },
  'glm': {
    name: 'GLM (智谱AI)',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    supportsStreaming: true,
    modelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/models'
  },
  'claude': {
    name: 'Claude (Anthropic)',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    supportsStreaming: true,
    modelsEndpoint: undefined // Claude使用不同的API格式
  },
  'qwen': {
    name: 'Qwen (通义千问)',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    supportsStreaming: true,
    modelsEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
  },
  'custom': {
    name: '自定义',
    defaultEndpoint: '',
    supportsStreaming: true
  }
};

// AI 模型目录配置（静态fallback）
export const MODEL_CATALOG: Record<AIProvider, Array<{ id: string; name: string; description?: string }>> = {
  'disabled': [],
  'kimi': [
    { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', description: '基础版本，8K上下文' },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', description: '长上下文，32K' },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', description: '超长上下文，128K' }
  ],
  'deepseek': [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话模型' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码专用模型' }
  ],
  'doubao': [
    { id: 'ep-20241029160614-q0t8p', name: 'Doubao Pro', description: '专业版' },
    { id: 'ep-20241126172739-8mcpz', name: 'Doubao Lite', description: '轻量版，快速响应' }
  ],
  'openai': [
    { id: 'gpt-4o', name: 'GPT-4o', description: '最新旗舰模型' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '快速经济' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能版' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '经济实惠' }
  ],
  'glm': [
    { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '最强模型' },
    { id: 'glm-4', name: 'GLM-4', description: '通用模型' },
    { id: 'glm-4-air', name: 'GLM-4 Air', description: '快速响应' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash', description: '超快速' }
  ],
  'claude': [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '最新模型，平衡性能' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最高质量' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速经济' }
  ],
  'qwen': [
    { id: 'qwen-max', name: 'Qwen Max', description: '最强模型' },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '通用模型' },
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '快速响应' }
  ],
  'custom': []
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

// 模型响应适配器接口
interface ModelAdapter {
  parseModels(response: any): Array<{ id: string; name: string }>;
}

// OpenAI格式适配器（适用于大多数OpenAI兼容的API）
class OpenAIModelAdapter implements ModelAdapter {
  parseModels(response: any): Array<{ id: string; name: string }> {
    if (!response || !response.data || !Array.isArray(response.data)) {
      return [];
    }

    return response.data
      .filter((model: any) => model.id)
      .map((model: any) => ({
        id: model.id,
        name: model.id // 使用id作为name，因为API返回的可能没有友好的name
      }));
  }
}

// 模型适配器映射
const MODEL_ADAPTERS: Record<string, ModelAdapter> = {
  'openai': new OpenAIModelAdapter(),
  'kimi': new OpenAIModelAdapter(),
  'deepseek': new OpenAIModelAdapter(),
  'glm': new OpenAIModelAdapter(),
  'qwen': new OpenAIModelAdapter()
};

export class AIService {
  private provider: AIProvider = 'disabled';
  private apiKey: string = '';
  private apiEndpoint: string = '';
  private model: string = '';
  private enabled: boolean = false;

  // 模型列表缓存
  private static modelCache = new Map<string, Array<{ id: string; name: string }>>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private static cacheTimestamps = new Map<string, number>();

  /**
   * 配置 AI 服务
   */
  public configure(provider: AIProvider, apiKey: string, customEndpoint?: string, model?: string): void {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model || this.getDefaultModel(provider);

    // 计算enabled状态
    const shouldEnable = provider !== 'disabled' && apiKey.length > 0;
    this.enabled = shouldEnable;

    console.log(`[AIService.configure] 配置参数:`, {
      provider,
      apiKey: apiKey ? '***' : '(empty)',
      apiKeyLength: apiKey.length,
      model: this.model,
      customEndpoint,
      shouldEnable
    });

    // 设置 API 端点
    const providerConfig = AI_PROVIDERS[provider];
    if (providerConfig) {
      this.apiEndpoint = customEndpoint || providerConfig.defaultEndpoint;
      console.log(`[AIService.configure] API端点已设置:`, {
        endpoint: this.apiEndpoint,
        usingCustom: !!customEndpoint
      });
    } else {
      this.apiEndpoint = '';
      this.enabled = false;
      console.error(`[AIService.configure] ⚠️  警告：Provider配置不存在，已禁用AI服务:`, provider);
    }

    console.log(`[AIService.configure] 配置完成:`, {
      provider: this.provider,
      model: this.model,
      endpoint: this.apiEndpoint,
      enabled: this.enabled,
      finalApiKeyLength: this.apiKey.length
    });
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
  public getConfig(): { provider: AIProvider; endpoint: string; model: string; enabled: boolean } {
    return {
      provider: this.provider,
      endpoint: this.apiEndpoint,
      model: this.model,
      enabled: this.enabled
    };
  }

  /**
   * 获取提供商的默认模型
   */
  private getDefaultModel(provider: AIProvider): string {
    const models = MODEL_CATALOG[provider];
    return models?.[0]?.id || 'default';
  }

  /**
   * 获取可用的模型列表（静态）
   */
  public static getAvailableModels(provider: AIProvider): Array<{ id: string; name: string; description?: string }> {
    return MODEL_CATALOG[provider] || [];
  }

  /**
   * 动态获取模型列表（从API）
   */
  public static async fetchAvailableModels(
    provider: AIProvider,
    apiKey: string,
    customEndpoint?: string
  ): Promise<{ success: boolean; models: Array<{ id: string; name: string }>; error?: string }> {
    // 1. 参数验证
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        models: [],
        error: 'API Key不能为空'
      };
    }

    if (provider === 'disabled' || provider === 'custom') {
      return {
        success: false,
        models: MODEL_CATALOG[provider] || [],
        error: provider === 'disabled' ? 'AI服务已禁用' : '自定义端点不支持动态获取模型'
      };
    }

    // 2. 检查提供商是否支持模型列表API
    const providerConfig = AI_PROVIDERS[provider];
    if (!providerConfig || !providerConfig.modelsEndpoint) {
      console.warn(`Provider ${provider} does not support models API, using static catalog`);
      return {
        success: true,
        models: MODEL_CATALOG[provider] || []
      };
    }

    // 3. 检查缓存
    const endpoint = customEndpoint || providerConfig.defaultEndpoint;
    const cacheKey = `${provider}:${endpoint}:${apiKey.substring(0, 10)}`;

    if (this.modelCache.has(cacheKey)) {
      const cacheTime = this.cacheTimestamps.get(cacheKey) || 0;
      const now = Date.now();

      if (now - cacheTime < this.CACHE_TTL) {
        console.log(`Using cached models for ${cacheKey}`);
        return {
          success: true,
          models: this.modelCache.get(cacheKey)!
        };
      } else {
        // 缓存过期，清除
        this.modelCache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }
    }

    // 4. 调用API获取模型列表
    try {
      const modelsEndpoint = providerConfig.modelsEndpoint;
      const result = await this.fetchModelsFromAPI(modelsEndpoint, apiKey, provider);

      if (result.success && result.models.length > 0) {
        // 缓存结果
        this.modelCache.set(cacheKey, result.models);
        this.cacheTimestamps.set(cacheKey, Date.now());
        console.log(`Successfully fetched ${result.models.length} models for ${provider}`);
      }

      return result;
    } catch (error: any) {
      console.error(`Failed to fetch models for ${provider}:`, error.message);

      // Fallback到静态列表
      return {
        success: true,
        models: MODEL_CATALOG[provider] || [],
        error: `获取模型列表失败，使用默认列表: ${error.message}`
      };
    }
  }

  /**
   * 从API获取模型列表
   */
  private static async fetchModelsFromAPI(
    modelsEndpoint: string,
    apiKey: string,
    provider: AIProvider
  ): Promise<{ success: boolean; models: Array<{ id: string; name: string }>; error?: string }> {
    return new Promise((resolve) => {
      try {
        const url = new URL(modelsEndpoint);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        };

        const timeoutId = setTimeout(() => {
          resolve({
            success: false,
            models: [],
            error: '请求超时'
          });
        }, options.timeout);

        const req = client.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            clearTimeout(timeoutId);

            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);

                // 使用适配器解析响应
                const adapter = MODEL_ADAPTERS[provider] || new OpenAIModelAdapter();
                const models = adapter.parseModels(response);

                if (models.length === 0) {
                  console.warn(`No models found in response for ${provider}`);
                  resolve({
                    success: true,
                    models: MODEL_CATALOG[provider] || [],
                    error: 'API返回的模型列表为空，使用默认列表'
                  });
                } else {
                  resolve({
                    success: true,
                    models
                  });
                }
              } else if (res.statusCode === 401) {
                resolve({
                  success: false,
                  models: [],
                  error: 'API Key无效或已过期'
                });
              } else if (res.statusCode === 403) {
                resolve({
                  success: false,
                  models: [],
                  error: '无权访问模型列表'
                });
              } else if (res.statusCode === 404) {
                resolve({
                  success: false,
                  models: MODEL_CATALOG[provider] || [],
                  error: '该提供商不支持模型列表API，使用默认列表'
                });
              } else {
                resolve({
                  success: false,
                  models: [],
                  error: `HTTP ${res.statusCode}: ${data}`
                });
              }
            } catch (error: any) {
              console.error('Failed to parse models response:', error);
              resolve({
                success: false,
                models: MODEL_CATALOG[provider] || [],
                error: `解析响应失败: ${error.message}`
              });
            }
          });
        });

        req.on('error', (error) => {
          clearTimeout(timeoutId);
          console.error('Failed to fetch models:', error);
          resolve({
            success: false,
            models: MODEL_CATALOG[provider] || [],
            error: `网络请求失败: ${error.message}`
          });
        });

        req.on('timeout', () => {
          clearTimeout(timeoutId);
          req.destroy();
          resolve({
            success: false,
            models: [],
            error: '请求超时'
          });
        });

        req.end();
      } catch (error: any) {
        resolve({
          success: false,
          models: MODEL_CATALOG[provider] || [],
          error: `发起请求失败: ${error.message}`
        });
      }
    });
  }

  /**
   * 清除模型缓存
   */
  public static clearModelCache(): void {
    this.modelCache.clear();
    this.cacheTimestamps.clear();
    console.log('Model cache cleared');
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
          model: request.model || this.model || this.getDefaultModel(this.provider),
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
          },
          timeout: 30000 // 30秒超时
        };

        const timeoutId = setTimeout(() => {
          resolve({
            success: false,
            error: '请求超时'
          });
        }, options.timeout);

        const req = client.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            clearTimeout(timeoutId);

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
          clearTimeout(timeoutId);
          resolve({ success: false, error: error.message });
        });

        req.on('timeout', () => {
          clearTimeout(timeoutId);
          req.destroy();
          resolve({
            success: false,
            error: '请求超时'
          });
        });

        req.write(postData);
        req.end();

      } catch (error: any) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * 生成AI建议
   */
  public async generateSuggestion(
    title: string,
    content: string,
    promptTemplate?: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    console.log(`[AIService.generateSuggestion] 开始生成AI建议:`, {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      hasCustomPrompt: !!promptTemplate,
      title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      contentLength: content.length
    });

    if (!this.enabled) {
      console.warn(`[AIService.generateSuggestion] AI服务未启用，无法生成建议:`, {
        provider: this.provider,
        apiKeyLength: this.apiKey.length,
        endpoint: this.apiEndpoint
      });
      return { success: false, error: 'AI未配置' };
    }

    const systemPrompt = promptTemplate ||
      '你是一个专业的任务助手。请根据以下待办事项，提供详细的解决方案建议，包括具体步骤、注意事项和可能的解决方案。';

    const userMessage = `待办事项标题：${title}\n\n待办事项内容：${content}\n\n请为这个待办提供具体的解决方案建议。`;

    console.log(`[AIService.generateSuggestion] 准备发送API请求:`, {
      endpoint: this.apiEndpoint,
      model: this.model,
      systemPromptLength: systemPrompt.length,
      userMessageLength: userMessage.length
    });

    try {
      const response = await this.sendCompletionRequest({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      console.log(`[AIService.generateSuggestion] API响应:`, {
        success: response.success,
        contentLength: response.content?.length || 0,
        error: response.error
      });

      return response;
    } catch (error: any) {
      console.error(`[AIService.generateSuggestion] 生成建议失败:`, {
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  private getErrorMessage(error: any): string {
    const errorMsg = error?.error || error?.message || '';
    if (errorMsg.includes('API key') || errorMsg.includes('api_key') || errorMsg.includes('401') || errorMsg.includes('403')) {
      return 'API Key未配置或已失效，请在设置中重新配置';
    }
    if (errorMsg.includes('network') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED')) {
      return '网络连接失败，请检查网络设置';
    }
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
      return '请求超时，请稍后重试';
    }
    if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
      return '请求过于频繁，请稍后重试';
    }
    return errorMsg || '生成失败，请稍后重试';
  }

  /**
   * 生成AI建议（带重试）
   */
  public async generateSuggestionWithRetry(
    title: string,
    content: string,
    promptTemplate?: string,
    maxRetries: number = 3
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.generateSuggestion(title, content, promptTemplate);
        if (result.success) {
          return result;
        }

        // 如果是最后一次重试，返回友好的错误消息
        if (i === maxRetries - 1) {
          return { success: false, error: this.getErrorMessage(result) };
        }

        // 指数退避等待
        const waitTime = Math.pow(2, i) * 1000;
        console.log(`AI建议生成失败，${waitTime}ms后重试 (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (error: any) {
        if (i === maxRetries - 1) {
          return { success: false, error: this.getErrorMessage(error) };
        }
      }
    }

    return { success: false, error: '未知错误' };
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
