// URL标题获取服务 - 使用Node.js原生http/https模块获取网页标题
import * as https from 'https';
import * as http from 'http';

/**
 * URL标题服务
 * 使用原生http/https模块获取网页标题，避免依赖第三方库
 */
export class URLTitleService {
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly DEFAULT_TIMEOUT = 10000; // 10秒
  private readonly MAX_REDIRECTS = 10; // 最大重定向次数（增加到10以支持企业服务的多次跳转）
  private readonly MAX_TITLE_LENGTH = 100; // 标题最大长度

  /**
   * 获取单个URL的标题
   * @param url 目标URL
   * @returns 标题文本，失败返回null
   */
  async fetchTitle(url: string): Promise<string | null> {
    try {
      const html = await this.fetchHTML(url, this.DEFAULT_TIMEOUT);
      return this.extractTitle(html);
    } catch (error) {
      console.warn(`Failed to fetch title for ${url}:`, (error as Error).message);
      return null;
    }
  }

  /**
   * 批量获取URL标题（并发限制3个）
   * @param urls URL数组
   * @returns URL到标题的映射
   */
  async fetchBatchTitles(urls: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const CONCURRENCY_LIMIT = 3;

    // 分批处理，每批最多3个并发请求
    for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
      const batch = urls.slice(i, i + CONCURRENCY_LIMIT);
      const promises = batch.map(async (url) => {
        try {
          const title = await this.fetchTitle(url);
          if (title) {
            return { url, title };
          }
          return null;
        } catch (error) {
          console.warn(`Failed to fetch title for ${url}:`, (error as Error).message);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach((batchResult) => {
        if (batchResult.status === 'fulfilled' && batchResult.value) {
          result.set(batchResult.value.url, batchResult.value.title);
        }
      });
    }

    return result;
  }

  /**
   * 从HTML中提取标题
   * @param html HTML内容
   * @returns 清理后的标题
   */
  private extractTitle(html: string): string | null {
    if (!html) return null;

    // 使用正则提取 <title> 标签内容
    const titleRegex = /<title[^>]*>([^<]*)<\/title>/i;
    const match = html.match(titleRegex);

    if (!match || !match[1]) return null;

    // 清理标题：去除多余空白，解码HTML实体
    let title = match[1]
      .trim()
      .replace(/\s+/g, ' ') // 多个空白字符替换为单个空格
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // 截断过长的标题
    if (title.length > this.MAX_TITLE_LENGTH) {
      title = title.substring(0, this.MAX_TITLE_LENGTH) + '...';
    }

    return title || null;
  }

  /**
   * 发送HTTP请求获取HTML
   * @param url 目标URL
   * @param timeout 超时时间（毫秒）
   * @param redirectCount 当前重定向次数
   * @returns HTML内容
   */
  private async fetchHTML(url: string, timeout: number, redirectCount: number = 0): Promise<string> {
    // 防止无限重定向循环
    if (redirectCount >= this.MAX_REDIRECTS) {
      throw new Error('Maximum redirects exceeded');
    }

    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': this.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'close',
          },
          timeout: timeout,
        };

        const req = client.request(options, (res) => {
          // 处理重定向
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              // 处理相对路径重定向
              const absoluteUrl = new URL(redirectUrl, url).toString();
              console.log(`[URLTitleService] Redirect ${redirectCount + 1}/${this.MAX_REDIRECTS}: ${url} -> ${absoluteUrl}`);
              return resolve(this.fetchHTML(absoluteUrl, timeout, redirectCount + 1));
            }
          }

          // 只处理成功响应
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }

          // 处理gzip/deflate/brotli编码
          const zlib = require('zlib');
          let stream = res;

          if (res.headers['content-encoding'] === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (res.headers['content-encoding'] === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          } else if (res.headers['content-encoding'] === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          }

          let data = '';
          stream.on('data', (chunk: Buffer) => {
            data += chunk.toString('utf-8');
          });

          stream.on('end', () => {
            resolve(data);
          });

          stream.on('error', (error: Error) => {
            reject(error);
          });
        });

        req.on('error', (error: Error) => {
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// 导出单例
export const urlTitleService = new URLTitleService();
