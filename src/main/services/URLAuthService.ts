import { BrowserWindow, Session, session } from 'electron';
import { URLTitleService } from './URLTitleService';

/**
 * URL授权服务
 * 使用Electron的BrowserWindow提供应用内授权，让用户可以登录需要身份验证的网站
 */
export class URLAuthService {
  private authWindows: Map<string, BrowserWindow> = new Map();
  private urlTitleService: URLTitleService;
  private authSession: Session;

  constructor() {
    this.urlTitleService = new URLTitleService();
    // 创建独立的session用于授权窗口，不应用CSP限制
    this.authSession = session.fromPartition('persist:auth-session');
  }

  /**
   * 打开授权窗口让用户登录
   * @param url 需要授权的URL
   * @returns Promise<string | null> 成功返回标题，失败返回null
   */
  async authorizeUrl(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      // 如果已经有授权窗口打开，先关闭它
      const existingWindow = this.authWindows.get(url);
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.close();
      }

      const authWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: 'URL授权 - 请登录以获取标题',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // 使用独立的session，不受主窗口CSP限制
          session: this.authSession,
          // 允许运行JavaScript以支持登录流程
          javascript: true,
        },
      });

      // Track ALL titles, not just non-generic ones
      interface CapturedTitle {
        title: string;
        url: string;
        timestamp: number;
      }
      let lastTitle = '';
      let capturedTitles: CapturedTitle[] = [];

      // Helper function to capture title from any source
      const captureTitle = (source: string) => {
        try {
          const currentTitle = authWindow.getTitle();
          const currentUrl = authWindow.webContents.getURL();

          console.log(`[URLAuthService] ${source} - Title: "${currentTitle}", URL: ${currentUrl}`);

          // Clean title before storing
          const cleanedTitle = this.cleanTitle(currentTitle);
          if (cleanedTitle && cleanedTitle.length > 0) {
            capturedTitles.push({
              title: cleanedTitle,
              url: currentUrl,
              timestamp: Date.now()
            });
            lastTitle = cleanedTitle;
          }
        } catch (error) {
          console.error(`[URLAuthService] Error in ${source}:`, error);
        }
      };

      // Helper function to determine if we should auto-close the window
      const shouldAutoClose = (title: string): boolean => {
        const cleaned = this.cleanTitle(title);
        const finalUrl = this.extractFinalUrl(url);

        // 如果有redirect_uri，不自动关闭（等待跳转到最终页面）
        if (finalUrl) {
          console.log(`[URLAuthService] Has redirect_uri, disabling auto-close`);
          return false;
        }

        // Auto-close when we get a title that's sufficiently long and non-generic
        return cleaned.length >= 5 && !this.isGenericTitle(cleaned);
      };

      // Listen to multiple events for comprehensive title capture
      authWindow.webContents.on('did-finish-load', () => captureTitle('did-finish-load'));
      authWindow.webContents.on('dom-ready', () => captureTitle('dom-ready'));
      authWindow.webContents.on('page-title-updated', (_event, title) => {
        console.log(`[URLAuthService] page-title-updated - Title: "${title}"`);
        // Clean title before storing
        const cleanedTitle = this.cleanTitle(title);
        if (cleanedTitle && cleanedTitle.length > 0) {
          capturedTitles.push({
            title: cleanedTitle,
            url: authWindow.webContents.getURL(),
            timestamp: Date.now()
          });
          lastTitle = cleanedTitle;

          // DISABLED: Auto-close after capturing a valid non-generic title
          // 用户需要手动关闭窗口，确保页面完全加载并捕获实际文档标题
          // 保留 shouldAutoClose 检查的日志用于调试
          if (shouldAutoClose(cleanedTitle)) {
            console.log(`[URLAuthService] Valid title captured: "${cleanedTitle}" (waiting for user to close window)`);
            // Auto-close disabled to allow dynamic content to load fully
            // setTimeout(() => {
            //   if (!authWindow.isDestroyed()) {
            //     console.log(`[URLAuthService] Auto-closing authorization window`);
            //     authWindow.close();
            //   }
            // }, 500);
          }
        }
      });

      // Safety timeout: auto-close after 5 minutes if user forgets
      const safetyTimeout = setTimeout(() => {
        if (!authWindow.isDestroyed()) {
          console.log('[URLAuthService] Authorization timeout (5 minutes), closing window');
          authWindow.close();
        }
      }, 5 * 60 * 1000);

      // Listen to window close (user manually closes window or timeout)
      authWindow.on('closed', () => {
        clearTimeout(safetyTimeout);
        this.authWindows.delete(url);

        let bestTitle: string | null = null;
        const finalUrl = this.extractFinalUrl(url);

        // 优先级1: 选择来自最终URL的标题
        if (finalUrl) {
          const finalUrlTitles = capturedTitles
            .filter(t => t.url === finalUrl || t.url.startsWith(finalUrl))
            .filter(t => !this.isGenericTitle(t.title));

          if (finalUrlTitles.length > 0) {
            // 选择最后一个（最新的）
            bestTitle = finalUrlTitles[finalUrlTitles.length - 1].title;
            console.log(`[URLAuthService] Using title from final URL: "${bestTitle}"`);
          }
        }

        // 优先级2: 选择非通用标题（优先选择最新的标题）
        if (!bestTitle) {
          const nonGenericTitles = capturedTitles.filter(entry => !this.isGenericTitle(entry.title));
          if (nonGenericTitles.length > 0) {
            // 按时间戳排序，选择最新的标题（动态网页的实际标题通常最后加载）
            nonGenericTitles.sort((a, b) => b.timestamp - a.timestamp);
            bestTitle = nonGenericTitles[0].title;
            console.log(`[URLAuthService] Using non-generic title (selected from ${nonGenericTitles.length} candidates): "${bestTitle}" from ${nonGenericTitles[0].url}`);
          }
        }

        // 优先级3: 使用最后捕获的标题
        if (!bestTitle && capturedTitles.length > 0) {
          bestTitle = capturedTitles[capturedTitles.length - 1].title;
          console.log(`[URLAuthService] Using last captured title as fallback: "${bestTitle}"`);
          console.log(`[URLAuthService] Using generic title as fallback: "${bestTitle}"`);
        }

        if (bestTitle) {
          console.log(`[URLAuthService] Window closed, returning title: "${bestTitle}"`);
        } else {
          console.log('[URLAuthService] Window closed, no title captured');
        }

        // Final cleaning before returning
        const finalTitle = bestTitle ? this.cleanTitle(bestTitle) : null;
        resolve(finalTitle);
      });

      // 添加开发者工具支持（开发模式）
      if (process.env.NODE_ENV === 'development') {
        authWindow.webContents.openDevTools();
      }

      // 加载URL
      authWindow.loadURL(url);
      this.authWindows.set(url, authWindow);

      console.log(`[URLAuthService] Opened authorization window for: ${url}`);
    });
  }

  /**
   * 从登录URL中提取最终目标URL（从redirect_uri参数）
   * @param url 登录页面URL
   * @returns 最终目标URL，如果无redirect_uri则返回null
   */
  private extractFinalUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const redirectUri = urlObj.searchParams.get('redirect_uri');
      if (redirectUri) {
        // redirect_uri 可能是 URL 编码的
        const decodedUri = decodeURIComponent(redirectUri);
        console.log(`[URLAuthService] Extracted final URL: ${decodedUri}`);
        return decodedUri;
      }
    } catch (error) {
      console.error('[URLAuthService] Failed to extract redirect_uri:', error);
    }
    return null;
  }

  /**
   * 清理标题中的不可见 Unicode 字符和控制字符
   * 增强版正则表达式，覆盖更多不可见字符类型
   */
  private cleanTitle(title: string): string {
    if (!title) return '';

    // 移除零宽字符和其他不可见字符（增强版）
    // - 零宽字符: U+200B-U+200D (ZWSP, ZWNJ, ZWJ)
    // - 零宽非断空格: U+FEFF (ZWNBSP, BOM)
    // - 软连字符: U+00AD
    // - 组合用符号: U+034F
    // - 蒙古文字符变体: U+180B-U+180D
    // - 双向文本控制: U+202A-U+202E (LRE, RLE, PDF, LRO, RLO)
    // - 其他格式控制: U+2060-U+206F
    // - 对象替换字符等: U+FFFC, U+FFFD
    // - 其他特殊控制字符: U+FFF9-U+FFFB
    let cleaned = title.replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u180B-\u180D\u202A-\u202E\u2060-\u206F\uFFF9-\uFFFB\uFFFC\uFFFD]/g, '');

    // 移除其他控制字符（保留换行、制表符）
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // 移除多余的空格
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    return cleaned;
  }

  /**
   * 检查是否为通用标题（复制自URLTitleService的逻辑）
   * 采用更宽松的策略：仅匹配非常具体的登录相关标题
   */
  private isGenericTitle(title: string): boolean {
    if (!title || title.trim().length === 0) {
      return true;
    }

    const trimmedTitle = title.trim();

    // Very short titles are likely generic
    if (trimmedTitle.length < 5) {
      return true;
    }

    // 通用平台标题 - 这些是平台级别的通用标题，不是实际文档标题
    const GENERIC_PLATFORM_TITLES = [
      '飞书云文档',
      'Lark云文档',
      '腾讯文档',
      '钉钉文档',
      '石墨文档',
      '语雀',
      '金山文档',
      'WPS云文档',
      '在线文档',
      '云文档',
      'Docs',
      '文档',
      '在线预览',
    ];

    // Check if title contains generic platform terms
    if (GENERIC_PLATFORM_TITLES.some(generic => trimmedTitle.includes(generic))) {
      console.log(`[URLAuthService] Title "${trimmedTitle}" contains generic platform term`);
      return true;
    }

    // Only match specific login-related titles, not general terms
    const SPECIFIC_LOGIN_TITLES: (string | RegExp)[] = [
      '钉钉文档 - 钉钉统一身份认证',
      '登录 - 钉钉',
      '统一身份认证',
      /登录.*访问/i,
      /请.*登录/i,
    ];

    return SPECIFIC_LOGIN_TITLES.some(pattern =>
      typeof pattern === 'string' ? trimmedTitle === pattern : pattern.test(trimmedTitle)
    );
  }

  /**
   * 获取授权窗口当前页面的标题（使用 webContents.executeJavaScript）
   * 用于在授权成功后直接从已登录的页面获取标题
   */
  async getCurrentPageTitle(url: string): Promise<string | null> {
    const authWindow = this.authWindows.get(url);
    if (!authWindow || authWindow.isDestroyed()) {
      return null;
    }

    try {
      const title = await authWindow.webContents.executeJavaScript(`
        document.title || null
      `);
      const cleanedTitle = this.cleanTitle(title);
      console.log(`[URLAuthService] getCurrentPageTitle: "${cleanedTitle}"`);
      return cleanedTitle;
    } catch (error) {
      console.error('[URLAuthService] Failed to get current page title:', error);
      return null;
    }
  }

  /**
   * 刷新单个URL的标题
   * @param url 要刷新的URL
   * @returns Promise<string | null> 成功返回标题，失败返回null
   */
  async refreshUrlTitle(url: string): Promise<string | null> {
    try {
      console.log(`[URLAuthService] Refreshing title for: ${url}`);
      return await this.urlTitleService.fetchTitle(url);
    } catch (error) {
      console.error(`[URLAuthService] Failed to refresh title for ${url}:`, error);
      return null;
    }
  }

  /**
   * 关闭所有授权窗口
   */
  closeAllAuthWindows(): void {
    this.authWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.authWindows.clear();
  }
}

