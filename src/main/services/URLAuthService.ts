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
      let lastTitle = '';
      let capturedTitles: string[] = [];

      // Helper function to capture title from any source
      const captureTitle = (source: string) => {
        try {
          const currentTitle = authWindow.getTitle();
          const currentUrl = authWindow.webContents.getURL();

          console.log(`[URLAuthService] ${source} - Title: "${currentTitle}", URL: ${currentUrl}`);

          // Clean title before storing
          const cleanedTitle = this.cleanTitle(currentTitle);
          if (cleanedTitle && cleanedTitle.length > 0 && cleanedTitle !== lastTitle) {
            capturedTitles.push(cleanedTitle);
            lastTitle = cleanedTitle;
          }
        } catch (error) {
          console.error(`[URLAuthService] Error in ${source}:`, error);
        }
      };

      // Listen to multiple events for comprehensive title capture
      authWindow.webContents.on('did-finish-load', () => captureTitle('did-finish-load'));
      authWindow.webContents.on('dom-ready', () => captureTitle('dom-ready'));
      authWindow.webContents.on('page-title-updated', (_event, title) => {
        console.log(`[URLAuthService] page-title-updated - Title: "${title}"`);
        // Clean title before storing
        const cleanedTitle = this.cleanTitle(title);
        if (cleanedTitle && cleanedTitle.length > 0 && cleanedTitle !== lastTitle) {
          capturedTitles.push(cleanedTitle);
          lastTitle = cleanedTitle;
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

        // Use smart title selection: prefer non-generic, but accept any title
        let bestTitle: string | null = null;

        // Try to find a non-generic title
        for (const title of capturedTitles) {
          if (!this.isGenericTitle(title)) {
            bestTitle = title;
            break;
          }
        }

        // Fallback: use the last captured title even if generic
        if (!bestTitle && capturedTitles.length > 0) {
          bestTitle = capturedTitles[capturedTitles.length - 1];
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
   * 清理标题中的不可见 Unicode 字符和控制字符
   */
  private cleanTitle(title: string): string {
    if (!title) return '';

    // 移除零宽字符和其他不可见字符
    // U+200B-ZWS, U+200C-ZWNJ, U+200D-ZWJ, U+FEFF-ZWNBSP
    let cleaned = title.replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u180B-\u180D\u200B-\u200D\uFEFF]/g, '');

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

