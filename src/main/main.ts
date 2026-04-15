import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from './database/DatabaseManager';
import { ImageManager } from './utils/ImageManager';
import { BackupManager } from './utils/BackupManager';
import { generateContentHash } from './utils/hashUtils';
import { KeywordProcessor } from './services/KeywordProcessor';
import { keywordExtractor, KeywordExtractor } from './services/KeywordExtractor';
import { aiService } from './services/AIService';
import { PromptTemplateService } from './services/PromptTemplateService';
import { urlTitleService } from './services/URLTitleService';
import { URLAuthService } from './services/URLAuthService';
import { URLAuthorizationService } from './services/URLAuthorizationService';
import { AuthorizationRefreshScheduler } from './services/AuthorizationRefreshScheduler';
import { TodoRecommendation } from '../shared/types';
import { aiConfigManager } from './config/AIConfigManager';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private dbManager: DatabaseManager;
  private imageManager: ImageManager;
  private backupManager: BackupManager | null = null;
  private keywordProcessor: KeywordProcessor | null = null;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;
  private hasShownTrayNotification: boolean = false;
  private urlAuthService: URLAuthService | null = null;
  private urlAuthorizationService: URLAuthorizationService | null = null;
  private authorizationRefreshScheduler: AuthorizationRefreshScheduler | null = null;
  private promptTemplateService: PromptTemplateService | null = null;

  // ✅ 新增：全局并发锁 - 用于AI建议任务的并发控制
  private activeAiRequest: null | {
    controller: AbortController;
    todoId: number;
    timestamp: number;
  } = null;

  constructor() {
    this.dbManager = new DatabaseManager();
    this.imageManager = new ImageManager();
  }

  private async checkNativeModuleCompatibility(): Promise<void> {
    try {
      console.log('=== MultiTodo Startup Diagnostics ===');
      console.log(`Platform: ${process.platform} ${process.arch}`);
      console.log(`Electron: ${process.versions.electron || 'Unknown'}`);
      console.log(`Node.js: ${process.version} (ABI ${process.versions.modules})`);
      console.log(`Packaged: ${app.isPackaged}`);
      console.log(`App Path: ${app.getAppPath()}`);

      // macOS 特定检查
      if (process.platform === 'darwin' && app.isPackaged) {
        console.log('=== macOS Environment Check ===');
        try {
          const { execSync } = require('child_process');
          const signatureInfo = execSync('codesign -dv --verbose=4 2>&1 || true', {
            cwd: app.getAppPath(),
            encoding: 'utf8'
          });
          console.log('Code signature info:');
          console.log(signatureInfo);
        } catch (error) {
          console.warn('Could not verify code signature (expected for ad-hoc signing)');
        }
      }

      // 检查 better-sqlite3 是否可加载
      const Database = require('better-sqlite3');

      // 创建内存数据库测试
      const testDb = new Database(':memory:');
      testDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      testDb.prepare('INSERT INTO test (name) VALUES (?)').run('test');
      const result = testDb.prepare('SELECT * FROM test').all();
      testDb.close();

      if (result.length === 1) {
        console.log('✅ Native module compatibility check PASSED');
      } else {
        throw new Error('Native module test failed: unexpected query result');
      }
    } catch (error) {
      console.error('❌ Native module compatibility check FAILED:', error);

      // 提供详细的诊断信息
      console.error('\n=== NATIVE MODULE ERROR DIAGNOSIS ===');
      console.error(`Platform: ${process.platform} ${process.arch}`);
      console.error(`Node.js: ${process.version} (ABI ${process.versions.modules})`);
      console.error(`Electron: ${process.versions.electron || 'Unknown'}`);
      console.error(`Error: ${(error as Error).message}`);
      if ((error as Error).stack) console.error(`Stack: ${(error as Error).stack}`);
      console.error('=====================================\n');

      throw new Error(`Native module compatibility check failed: ${(error as Error).message}`);
    }
  }

  private createWindow(): void {
    const isDev = !app.isPackaged;
    
    this.mainWindow = new BrowserWindow({
      height: 800,
      width: 1200,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        // 仅在开发模式下禁用 webSecurity
        webSecurity: !isDev,
        // 生产模式下启用沙箱
        sandbox: !isDev,
        // 允许运行不安全内容仅在开发模式
        allowRunningInsecureContent: isDev,
      },
      title: '多功能待办工具',
      show: false,
    });

    // 拦截新窗口打开，使用外部浏览器
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // 拦截导航，防止在应用内打开外部链接
    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      const currentUrl = this.mainWindow?.webContents.getURL() || '';
      // 允许本地开发服务器和本地文件导航
      if (url.startsWith('http://localhost') || url.startsWith('file://')) {
        return;
      }
      // 拦截其他外部链接
      if (url.startsWith('http://') || url.startsWith('https://')) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    // 动态设置 Content Security Policy
    this.setupContentSecurityPolicy(isDev);

    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`isDev: ${isDev}`);
    console.log(`app.isPackaged: ${app.isPackaged}`);
    
    if (isDev) {
      // 添加重试机制等待webpack dev server启动
      this.loadDevServer();
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Debug: Track loading events
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('=== Load failed ===', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('=== Load finished successfully ===');
    });

    // 修改窗口关闭行为：不退出应用，而是最小化到托盘
    this.mainWindow.on('close', (event) => {
      console.log('=== Window close event triggered ===');
      console.log('isQuitting:', this.isQuitting);
      console.log('Platform:', process.platform);
      
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
        console.log('Window hidden to tray');
        
        // 显示提示消息（仅首次）
        if (this.tray && !this.hasShownTrayNotification) {
          this.tray.displayBalloon?.({
            title: 'MultiTodo',
            content: '应用已最小化到系统托盘，点击图标可重新打开'
          });
          this.hasShownTrayNotification = true;
        }
      } else {
        console.log('Quitting application');
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private async loadDevServer(retries = 10): Promise<void> {
    const url = 'http://localhost:3000';
    
    for (let i = 0; i < retries; i++) {
      try {
        await this.mainWindow?.loadURL(url);
        console.log('Successfully connected to webpack dev server');
        return;
      } catch (error) {
        console.log(`Attempt ${i + 1}/${retries}: Waiting for webpack dev server...`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        }
      }
    }
    
    console.error('Failed to connect to webpack dev server after', retries, 'attempts');
    // 如果无法连接到dev server，尝试加载本地文件
    try {
      await this.mainWindow?.loadFile(path.join(__dirname, '../index.html'));
    } catch (fallbackError) {
      console.error('Failed to load fallback file:', fallbackError);
    }
  }

  private setupContentSecurityPolicy(isDev: boolean): void {
    if (!this.mainWindow) return;

    const devCSP = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*",
      "style-src 'self' 'unsafe-inline' http://localhost:*",
      "img-src 'self' data: blob: file: http://localhost:*",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* ws://localhost:*"
    ].join('; ');

    const prodCSP = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: file:",
      "font-src 'self' data:",
      "connect-src 'self'"
    ].join('; ');

    // 动态注入 CSP
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [isDev ? devCSP : prodCSP]
        }
      });
    });

    console.log(`CSP configured for ${isDev ? 'development' : 'production'} mode`);
  }

  private createTray(): void {
    try {
      // 判断是否为开发环境
      const isDev = !app.isPackaged;
      
      console.log('=== 创建系统托盘 ===');
      console.log('是否为开发环境:', isDev);
      console.log('当前平台:', process.platform);
      console.log('__dirname:', __dirname);
      console.log('process.resourcesPath:', process.resourcesPath);
      
      // 构建可能的图标路径列表（Windows 优先使用 .ico，macOS/Linux 使用 .png）
      const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon_32x32.png';
      
      const possiblePaths = isDev 
        ? [
            path.join(__dirname, '../../assets', iconFileName),
            path.join(process.cwd(), 'assets', iconFileName)
          ]
        : [
            path.join(process.resourcesPath, 'assets', iconFileName),
            path.join(process.resourcesPath, iconFileName),
            path.join(__dirname, '../../assets', iconFileName),
            path.join(app.getAppPath(), 'assets', iconFileName)
          ];
      
      console.log('尝试查找图标文件，候选路径:', possiblePaths);
      
      // 查找第一个存在的图标文件
      let iconPath = '';
      for (const testPath of possiblePaths) {
        console.log(`检查路径: ${testPath} - 存在: ${fs.existsSync(testPath)}`);
        if (fs.existsSync(testPath)) {
          iconPath = testPath;
          console.log('✓ 找到图标文件:', iconPath);
          break;
        }
      }
      
      // 如果没有找到图标文件，记录错误并返回
      if (!iconPath) {
        console.error('❌ 未找到托盘图标文件');
        console.error('已尝试的所有路径:', possiblePaths);
        return;
      }
      
      const icon = nativeImage.createFromPath(iconPath);
      
      // 验证图标是否成功加载
      if (icon.isEmpty()) {
        console.error('❌ 图标加载失败，图标为空');
        return;
      }
      
      console.log('图标尺寸:', icon.getSize());
      
      // Windows 托盘图标通常是 16x16，.ico 文件已包含多种尺寸
      // macOS/Linux 需要手动调整大小
      if (process.platform === 'win32') {
        this.tray = new Tray(icon);
      } else {
        this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
      }
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示窗口',
          click: () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
          }
        },
        {
          label: '快速创建待办 (Ctrl+Shift+T)',
          enabled: false
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            this.isQuitting = true;
            app.quit();
          }
        }
      ]);
      
      this.tray.setContextMenu(contextMenu);
      this.tray.setToolTip('MultiTodo - 待办管理');
      
      // 单击托盘图标显示窗口
      this.tray.on('click', () => {
        if (this.mainWindow?.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow?.show();
          this.mainWindow?.focus();
        }
      });
      
      console.log('✓ 系统托盘创建成功');
    } catch (error) {
      console.error('创建系统托盘失败:', error);
    }
  }

  private registerGlobalShortcuts(): void {
    try {
      // 注册快速创建待办快捷键
      const ret = globalShortcut.register('CommandOrControl+Shift+T', () => {
        this.handleQuickCreateTodo();
      });

      if (!ret) {
        console.error('全局快捷键注册失败');
      } else {
        console.log('全局快捷键 Ctrl/Cmd+Shift+T 注册成功');
      }
    } catch (error) {
      console.error('注册全局快捷键时出错:', error);
    }
  }

  private handleQuickCreateTodo(): void {
    try {
      console.log('触发快速创建待办...');
      
      // 1. 读取剪贴板内容
      const text = clipboard.readText();
      const image = clipboard.readImage();
      
      let content = '';
      
      // 2. 处理图片
      if (!image.isEmpty()) {
        console.log('检测到剪贴板中的图片');
        const imageDataUrl = image.toDataURL();
        content = `<img src="${imageDataUrl}" alt="粘贴的图片" style="max-width: 100%;" />`;
      }
      
      // 3. 处理文字（追加到图片后面，或单独使用）
      if (text.trim()) {
        console.log('检测到剪贴板中的文字:', text.substring(0, 50) + '...');
        if (content) {
          content += `<p>${text}</p>`;
        } else {
          content = `<p>${text}</p>`;
        }
      }
      
      // 4. 如果没有任何内容，提示用户
      if (!content) {
        console.log('剪贴板为空，无法创建待办');
        // 可以在这里发送系统通知
        return;
      }
      
      // 5. 显示窗口并发送内容
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        
        // 通过 IPC 发送内容到渲染进程
        this.mainWindow.webContents.send('quick-create-todo', { content });
        console.log('已发送快速创建事件到渲染进程');
      }
    } catch (error) {
      console.error('快速创建待办失败:', error);
    }
  }

  /**
   * 验证所有必需服务是否已正确初始化
   */
  private verifyServicesInitialization(): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查数据库管理器
    if (!this.dbManager) {
      errors.push('DatabaseManager is not initialized');
    }

    // 检查AI服务
    try {
      const config = aiService.getConfig();
      if (!config.enabled) {
        console.warn('AI service is disabled (this is OK if user has not configured it yet)');
      }
    } catch (error) {
      errors.push('AI service is not available');
    }

    // 检查Prompt模板服务（可选服务）
    if (!this.promptTemplateService) {
      console.warn('PromptTemplateService is not initialized - AI suggestions will use default prompts');
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * 安全地获取Prompt模板（带降级处理）
   * @param templateId 模板ID
   * @returns 模板内容或undefined（如果获取失败则使用默认提示词）
   */
  private async getPromptTemplateSafely(templateId?: number): Promise<string | undefined> {
    if (!templateId) {
      return undefined;
    }

    if (!this.promptTemplateService) {
      console.warn('PromptTemplateService not available, using default prompt');
      return undefined;
    }

    try {
      const template = await this.promptTemplateService.getById(templateId);
      if (template && template.content) {
        return template.content;
      }
      console.warn(`Template ${templateId} not found or empty, using default prompt`);
      return undefined;
    } catch (error) {
      console.error(`Failed to get template ${templateId}:`, error);
      return undefined;
    }
  }

  private setupIpcHandlers(): void {
    // 待办事项相关的IPC处理器
    ipcMain.handle('todo:getAll', async () => {
      return await this.dbManager.getAllTodos();
    });

    ipcMain.handle('todo:create', async (_, todo) => {
      const createdTodo = await this.dbManager.createTodo(todo);
      // 异步生成关键词（不阻塞创建流程）
      if (this.keywordProcessor && createdTodo.id) {
        this.keywordProcessor.queueTodoForKeywordExtraction(createdTodo).catch(err => {
          console.error('Failed to queue todo for keyword extraction:', err);
        });
      }
      return createdTodo;
    });

    ipcMain.handle('todo:createManualAtTop', async (_, todo, tabKey: string) => {
      const createdTodo = await this.dbManager.createTodoManualAtTop(todo, tabKey);
      // 异步生成关键词（不阻塞创建流程）
      if (this.keywordProcessor && createdTodo.id) {
        this.keywordProcessor.queueTodoForKeywordExtraction(createdTodo).catch(err => {
          console.error('Failed to queue todo for keyword extraction:', err);
        });
      }
      return createdTodo;
    });

    ipcMain.handle('todo:update', async (_, id, updates) => {
      await this.dbManager.updateTodo(id, updates);
      // 如果标题或内容更新，重新生成关键词
      if ((updates.title !== undefined || updates.content !== undefined) && this.keywordProcessor) {
        const todo = await this.dbManager.getTodoById(id);
        if (todo) {
          this.keywordProcessor.queueTodoForKeywordExtraction(todo).catch(err => {
            console.error('Failed to queue todo for keyword extraction:', err);
          });
        }
      }
    });

    ipcMain.handle('todo:delete', async (_, id) => {
      return await this.dbManager.deleteTodo(id);
    });

    ipcMain.handle('todo:generateHash', async (_, title: string, content: string) => {
      return generateContentHash(title, content);
    });

    ipcMain.handle('todo:findDuplicate', async (_, contentHash: string, excludeId?: number) => {
      return await this.dbManager.findDuplicateTodo(contentHash, excludeId);
    });

    ipcMain.handle('todo:batchUpdateDisplayOrder', async (_, updates: {id: number, displayOrder: number}[]) => {
      return await this.dbManager.batchUpdateDisplayOrder(updates);
    });

    ipcMain.handle('todo:batchUpdateDisplayOrders', async (_, updates: {id: number, tabKey: string, displayOrder: number}[]) => {
      return await this.dbManager.batchUpdateDisplayOrders(updates);
    });

    ipcMain.handle('todo:bulkUpdateTodos', async (_, updates: Array<{id: number; updates: any}>) => {
      return await this.dbManager.bulkUpdateTodos(updates);
    });

    ipcMain.handle('todo:bulkDeleteTodos', async (_, ids: number[]) => {
      return await this.dbManager.bulkDeleteTodos(ids);
    });

    // 设置相关
    ipcMain.handle('settings:get', async () => {
      return await this.dbManager.getSettings();
    });

    ipcMain.handle('settings:update', async (_, settings) => {
      return await this.dbManager.updateSettings(settings);
    });

    // 图片相关
    ipcMain.handle('image:upload', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const buffer = await fs.promises.readFile(filePath);
        const savedPath = await this.imageManager.saveImage(buffer, path.basename(filePath));
        return savedPath;
      }
      return null;
    });

    ipcMain.handle('image:delete', async (_, filepath) => {
      return await this.imageManager.deleteImage(filepath);
    });

    ipcMain.handle('image:readLocalFile', async (_, filepath: string) => {
      const fs = require('fs');
      // 移除 file:// 前缀并处理 URL 编码
      let cleanPath = filepath.replace('file://', '').replace('file:', '');
      // Windows路径处理：移除开头的 /
      if (process.platform === 'win32' && cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
      // 解码URL编码的路径
      cleanPath = decodeURIComponent(cleanPath);
      
      console.log('Reading local file:', cleanPath);
      const buffer = fs.readFileSync(cleanPath);
      return buffer.buffer;
    });

    // 文件存在性检查
    ipcMain.handle('file:exists', async (_, filepath: string) => {
      try {
        // 移除 file:// 前缀并处理 URL 编码
        let cleanPath = filepath.replace('file://', '').replace('file:', '');
        // Windows路径处理：移除开头的 /
        if (process.platform === 'win32' && cleanPath.startsWith('/')) {
          cleanPath = cleanPath.substring(1);
        }
        // 解码URL编码的路径
        cleanPath = decodeURIComponent(cleanPath);
        
        return fs.existsSync(cleanPath);
      } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
      }
    });

    // 关系相关的IPC处理器
    ipcMain.handle('relations:getAll', async () => {
      return await this.dbManager.getAllRelations();
    });

    ipcMain.handle('relations:getByTodoId', async (_, todoId) => {
      return await this.dbManager.getRelationsByTodoId(todoId);
    });

    ipcMain.handle('relations:getByType', async (_, relationType) => {
      return await this.dbManager.getRelationsByType(relationType);
    });

    ipcMain.handle('relations:create', async (_, relation) => {
      return await this.dbManager.createRelation(relation);
    });

    ipcMain.handle('relations:delete', async (_, id) => {
      return await this.dbManager.deleteRelation(id);
    });

    ipcMain.handle('relations:deleteByTodoId', async (_, todoId) => {
      return await this.dbManager.deleteRelationsByTodoId(todoId);
    });

    ipcMain.handle('relations:deleteSpecific', async (_, sourceId, targetId, relationType) => {
      return await this.dbManager.deleteSpecificRelation(sourceId, targetId, relationType);
    });

    ipcMain.handle('relations:exists', async (_, sourceId, targetId, relationType) => {
      return await this.dbManager.relationExists(sourceId, targetId, relationType);
    });

    ipcMain.handle('relations:buildTree', async () => {
      return await this.dbManager.buildTree();
    });

    // Notes CRUD
    ipcMain.handle('notes:getAll', async () => {
      return await this.dbManager.getAllNotes();
    });

    ipcMain.handle('notes:create', async (_, noteData) => {
      return await this.dbManager.createNote(noteData);
    });

    ipcMain.handle('notes:update', async (_, id, updates) => {
      return await this.dbManager.updateNote(id, updates);
    });

    ipcMain.handle('notes:delete', async (_, id) => {
      return await this.dbManager.deleteNote(id);
    });

    // Backup operations
    ipcMain.handle('backup:list', async () => {
      return await this.backupManager?.listBackups() || [];
    });

    ipcMain.handle('backup:create', async () => {
      return await this.backupManager?.createBackup();
    });

    ipcMain.handle('backup:restore', async (_, backupPath: string) => {
      await this.backupManager?.restoreBackup(backupPath);
      // 重新加载数据库
      this.dbManager.close();
      await this.dbManager.initialize();
    });

    // Settings - Data folder operations
    ipcMain.handle('settings:getDbPath', async () => {
      return this.dbManager.getDbPath();
    });

    ipcMain.handle('settings:openDataFolder', async () => {
      try {
        const dbPath = this.dbManager.getDbPath();
        const dataFolder = path.dirname(dbPath);
        await shell.openPath(dataFolder);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 关键词和推荐相关
    ipcMain.handle('keywords:getRecommendations', async (_, title: string, content: string, excludeId?: number) => {
      try {
        // 提取当前待办的关键词
        const keywords = keywordExtractor.extractKeywords(title, content);
        
        if (keywords.length === 0) {
          return [];
        }
        
        // 获取相似待办
        const similarTodos = await this.dbManager.getSimilarTodos(keywords, excludeId, 10);
        
        // 构建推荐结果
        const recommendations: TodoRecommendation[] = similarTodos.map(todo => {
          const todoKeywords = todo.keywords || [];
          const similarity = KeywordExtractor.calculateSimilarity(keywords, todoKeywords);
          const matchedKeywords = KeywordExtractor.getMatchedKeywords(keywords, todoKeywords);
          
          return {
            todo,
            similarity,
            matchedKeywords
          };
        });
        
        return recommendations;
      } catch (error) {
        console.error('Error getting recommendations:', error);
        return [];
      }
    });

    ipcMain.handle('keywords:batchGenerate', async () => {
      try {
        if (!this.keywordProcessor) {
          return { success: false, error: 'Keyword processor not initialized' };
        }
        
        const result = await this.keywordProcessor.generateKeywordsForAllTodos();
        return { success: true, ...result };
      } catch (error) {
        console.error('Error in batch keyword generation:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // AI 相关
    ipcMain.handle('ai:testConnection', async () => {
      return await aiService.testConnection();
    });

    ipcMain.handle('ai:configure', async (_, provider: string, apiKey: string, endpoint?: string, model?: string) => {
      try {
        console.log('[ai:configure] 接收到配置请求:', { provider, apiKey: apiKey ? '***' : '(empty)', endpoint, model });

        // ✅ 添加参数验证
        if (!provider || provider === 'disabled') {
          console.log('[ai:configure] Provider is disabled');
          aiService.configure('disabled', '');
          aiConfigManager.updateProvider('disabled', '', '', '');
          return { success: true };
        }

        if (!apiKey || apiKey.length === 0) {
          console.warn('[ai:configure] API Key is empty, AI service will be disabled');
          aiService.configure(provider as any, '', endpoint, model);
          aiConfigManager.updateProvider(provider as any, '', endpoint || '', model || '');
          return { success: true };
        }

        // 配置AI服务（内存）
        aiService.configure(provider as any, apiKey, endpoint, model);

        // ✅ 验证配置是否生效
        const configAfter = aiService.getConfig();
        console.log('[ai:configure] 配置后的状态:', {
          ...configAfter,
          apiKey: configAfter.enabled ? '***' : '(empty)'
        });

        if (!configAfter.enabled) {
          console.error('[ai:configure] ⚠️  警告：配置后AI服务仍未启用！provider:', provider, 'apiKeyLength:', apiKey.length);
        }

        // 保存到配置文件（持久化）
        console.log('[ai:configure] 准备保存到配置文件');
        aiConfigManager.updateProvider(
          provider as any,
          apiKey,
          endpoint || '',
          model || ''
        );
        console.log('[ai:configure] 配置文件保存成功');

        // 同时保存到数据库（兼容旧版本）
        const settingsToSave = {
          ai_provider: provider,
          ai_api_key: apiKey,
          ai_api_endpoint: endpoint || '',
          ai_model: model || '',
          ai_enabled: provider !== 'disabled' && apiKey ? 'true' : 'false'
        };
        await this.dbManager.updateSettings(settingsToSave);

        return { success: true };
      } catch (error) {
        console.error('[ai:configure] 保存失败:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('ai:getConfig', async () => {
      return aiService.getConfig();
    });

    ipcMain.handle('ai:getSupportedProviders', async () => {
      const { AIService } = await import('./services/AIService');
      return AIService.getSupportedProviders();
    });

    ipcMain.handle('ai:getAvailableModels', async (_, provider: string) => {
      const { AIService } = await import('./services/AIService');
      return AIService.getAvailableModels(provider as any);
    });

    ipcMain.handle('ai:fetchModels', async (_, provider: string, apiKey: string, endpoint?: string) => {
      const { AIService } = await import('./services/AIService');
      return await AIService.fetchAvailableModels(provider as any, apiKey, endpoint);
    });

    // 获取所有已配置的providers
    ipcMain.handle('ai:getAllProviders', async () => {
      try {
        const providers = aiConfigManager.getAllProviders();
        return {
          success: true,
          providers: providers.map(({ provider, config }) => ({
            provider,
            apiKey: config.apiKey ? '***' : '', // 隐藏实际key
            endpoint: config.endpoint,
            model: config.model,
            enabled: config.enabled,
            updatedAt: config.updatedAt
          }))
        };
      } catch (error) {
        console.error('[ai:getAllProviders] 获取provider列表失败:', error);
        return {
          success: false,
          providers: [],
          error: (error as Error).message
        };
      }
    });

    // 切换当前provider
    ipcMain.handle('ai:switchProvider', async (_, provider: string) => {
      try {
        aiConfigManager.switchProvider(provider as any);

        // 重新配置AI服务
        const config = aiConfigManager.getProviderConfig(provider as any);
        if (config) {
          aiService.configure(provider as any, config.apiKey, config.endpoint, config.model);
        } else {
          aiService.configure('disabled', '');
        }

        return { success: true };
      } catch (error) {
        console.error('[ai:switchProvider] 切换provider失败:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 删除provider配置
    ipcMain.handle('ai:deleteProvider', async (_, provider: string) => {
      try {
        aiConfigManager.deleteProvider(provider as any);

        // 如果删除的是当前provider，重新配置
        const { provider: currentProvider, config } = aiConfigManager.getCurrentProviderConfig();
        if (currentProvider === 'disabled' || !config) {
          aiService.configure('disabled', '');
        } else {
          aiService.configure(currentProvider, config.apiKey, config.endpoint, config.model);
        }

        return { success: true };
      } catch (error) {
        console.error('[ai:deleteProvider] 删除provider失败:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 获取配置文件路径
    ipcMain.handle('ai:getConfigPath', async () => {
      return {
        success: true,
        path: aiConfigManager.getConfigPath()
      };
    });

    // AI 建议相关
    ipcMain.handle('ai-suggestion:generate', async (_, todoId: number, templateId?: number) => {
      try {
        console.log('=== AI Suggestion Generation Debug ===');
        console.log('todoId:', todoId, 'templateId:', templateId);
        console.log('promptTemplateService initialized:', !!this.promptTemplateService);

        // ✅ 新增：并发检查
        if (this.activeAiRequest) {
          console.warn('[AI Suggestion] 已有AI任务正在运行，拒绝新请求');
          return { success: false, error: '已有AI任务正在运行，请稍后' };
        }

        const todo = await this.dbManager.getTodoById(todoId);
        if (!todo) {
          console.error('Todo not found:', todoId);
          return { success: false, error: '待办不存在' };
        }
        console.log('Todo found:', todo.title);

        // 使用安全的模板获取方法（带降级处理）
        const prompt = await this.getPromptTemplateSafely(templateId);
        if (prompt) {
          console.log('Using custom template for AI suggestion');
        } else {
          console.log('Using default prompt for AI suggestion');
        }

        // ✅ 新增：创建 AbortController 用于取消功能
        const controller = new AbortController();
        this.activeAiRequest = {
          controller,
          todoId,
          timestamp: Date.now()
        };
        console.log('[AI Suggestion] Active AI request created:', todoId);

        try {
          console.log('Calling aiService.generateSuggestionWithRetry');
          const result = await aiService.generateSuggestionWithRetry(
            todo.title,
            todo.content,
            prompt,
            3,  // maxRetries
            controller.signal  // ✅ 新增：传递取消信号
          );

          if (result.success && result.content) {
            console.log('AI suggestion generated successfully, saving to database');

            // ✅ 新增：获取AI配置信息
            const aiConfig = aiService.getConfig();
            const templateName = prompt ? (this.promptTemplateService?.getTemplateById(templateId)?.name || '自定义模板') : '默认模板';

            console.log('[AI Suggestion] 保存元数据:', {
              template: templateName,
              provider: aiConfig.provider,
              model: aiConfig.model
            });

            await this.dbManager.updateTodoAISuggestion(
              todoId,
              result.content,
              templateName,
              aiConfig.provider,
              aiConfig.model
            );
          } else {
            console.error('AI suggestion generation failed:', result.error);
          }

          // ✅ 修复：将content字段映射为suggestion字段，与AISuggestionResponse接口保持一致
          // 这样可以确保返回的结构符合TypeScript类型定义
          return {
            success: result.success,
            suggestion: result.success ? result.content : undefined,
            error: result.error
          };
        } finally {
          // ✅ 新增：确保锁释放（try...finally保证）
          console.log('[AI Suggestion] Releasing active AI request lock');
          this.activeAiRequest = null;
        }
      } catch (error: any) {
        console.error('Failed to generate AI suggestion:', error);
        console.error('Error stack:', error.stack);
        // ✅ 新增：确保异常时也释放锁
        this.activeAiRequest = null;
        return { success: false, error: error.message || '生成失败' };
      }
    });

    ipcMain.handle('ai-suggestion:save', async (_, todoId: number, suggestion: string) => {
      try {
        await this.dbManager.updateTodoAISuggestion(todoId, suggestion);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to save AI suggestion:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('ai-suggestion:delete', async (_, todoId: number) => {
      try {
        // 删除时也清除元数据
        await this.dbManager.updateTodoAISuggestion(todoId, '', null, null, null);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to delete AI suggestion:', error);
        return { success: false, error: error.message };
      }
    });

    // ✅ 新增：取消AI建议生成
    ipcMain.handle('ai-suggestion:cancel', async () => {
      try {
        console.log('[AI Suggestion] Cancel requested, activeAiRequest:', !!this.activeAiRequest);

        if (!this.activeAiRequest) {
          console.warn('[AI Suggestion] No active AI request to cancel');
          return { success: false, error: '没有正在运行的任务' };
        }

        console.log('[AI Suggestion] Aborting active AI request');
        this.activeAiRequest.controller.abort();  // 发送中止信号
        this.activeAiRequest = null;  // 立即释放锁

        return { success: true };
      } catch (error: any) {
        console.error('Failed to cancel AI suggestion:', error);
        return { success: false, error: error.message };
      }
    });

    // Prompt 模板相关
    ipcMain.handle('prompt-templates:getAll', async () => {
      try {
        return await this.promptTemplateService?.getAll() || [];
      } catch (error: any) {
        console.error('Failed to get all prompt templates:', error);
        return [];
      }
    });

    ipcMain.handle('prompt-templates:getById', async (_, id: number) => {
      try {
        return await this.promptTemplateService?.getById(id) || null;
      } catch (error: any) {
        console.error('Failed to get prompt template by id:', error);
        return null;
      }
    });

    ipcMain.handle('prompt-templates:create', async (_, template) => {
      try {
        return await this.promptTemplateService!.create(template);
      } catch (error: any) {
        console.error('Failed to create prompt template:', error);
        throw error;
      }
    });

    ipcMain.handle('prompt-templates:update', async (_, id: number, updates) => {
      try {
        await this.promptTemplateService!.update(id, updates);
      } catch (error: any) {
        console.error('Failed to update prompt template:', error);
        throw error;
      }
    });

    ipcMain.handle('prompt-templates:delete', async (_, id: number) => {
      try {
        await this.promptTemplateService!.delete(id);
      } catch (error: any) {
        console.error('Failed to delete prompt template:', error);
        throw error;
      }
    });

    // 打开外部链接
    ipcMain.handle('shell:openExternal', async (_, url: string) => {
      try {
        // 处理 HTTP/HTTPS URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
          await shell.openExternal(url);
          return { success: true };
        }
        
        // 处理 file:// 协议（本地文件）
        if (url.startsWith('file://')) {
          // 解析 file:// URL 获取实际路径
          let filePath = url.replace('file:///', '').replace('file://', '');
          
          // Windows 路径处理
          if (process.platform === 'win32') {
            // file:///C:/path/file -> C:/path/file
            filePath = filePath.replace(/^\//, '');
          }
          
          // 解码 URL 编码的路径（处理中文路径）
          filePath = decodeURIComponent(filePath);
          
          // 将正斜杠转换为反斜杠（Windows）
          if (process.platform === 'win32') {
            filePath = filePath.replace(/\//g, '\\');
          }
          
          console.log('Opening local file:', filePath);
          
          // 使用 shell.openPath 打开本地文件
          const result = await shell.openPath(filePath);
          
          if (result) {
            // result 非空表示出错
            console.error('Failed to open file:', result);
            return { success: false, error: result };
          }
          
          return { success: true };
        }
        
        return { success: false, error: 'Unsupported protocol' };
      } catch (error) {
        console.error('Error opening external:', error);
        return { success: false, error: (error as Error).message };
      }
    });


    // 流程图数据库操作
    ipcMain.handle('flowchart:save', async (_, flowchartData: any) => {
      try {
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartRepository(db);
        
        // 检查流程图是否已存在
        const existing = repo.load(flowchartData.schema.id);
        
        if (existing) {
          // 更新现有流程图 - 先删除再重新创建
          console.log(`[Flowchart] Updating existing flowchart: ${flowchartData.schema.id}`);
          
          // 删除旧的流程图（会级联删除节点和边）
          repo.delete(flowchartData.schema.id);
          
          // 重新创建流程图
          repo.create(flowchartData.schema);
          
          // 添加所有节点和边
          const patches: any[] = [];
          
          flowchartData.nodes.forEach((node: any) => {
            patches.push({ type: 'addNode', node });
          });
          
          flowchartData.edges.forEach((edge: any) => {
            patches.push({ type: 'addEdge', edge });
          });
          
          if (patches.length > 0) {
            repo.savePatches(flowchartData.schema.id, patches);
          }
          
          console.log(`[Flowchart] Updated flowchart with ${flowchartData.nodes.length} nodes and ${flowchartData.edges.length} edges`);
        } else {
          // 创建新流程图
          console.log(`[Flowchart] Creating new flowchart: ${flowchartData.schema.id}`);
          repo.create(flowchartData.schema);
          
          // 添加所有节点和边
          const patches: any[] = [];
          
          flowchartData.nodes.forEach((node: any) => {
            patches.push({ type: 'addNode', node });
          });
          
          flowchartData.edges.forEach((edge: any) => {
            patches.push({ type: 'addEdge', edge });
          });
          
          if (patches.length > 0) {
            repo.savePatches(flowchartData.schema.id, patches);
          }
          
          console.log(`[Flowchart] Created flowchart with ${flowchartData.nodes.length} nodes and ${flowchartData.edges.length} edges`);
        }
        
        return { success: true };
      } catch (error) {
        console.error('Error saving flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:load', async (_, flowchartId: string) => {
      try {
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }

        const repo = new FlowchartRepository(db);
        const flowchart = repo.load(flowchartId);

        if (!flowchart) {
          return null;
        }

        // 保持嵌套结构，与数据库层和组件层的期望结构一致
        console.log(`[Flowchart] Loaded flowchart: ${flowchartId}, nodes: ${flowchart.nodes.length}, edges: ${flowchart.edges.length}`);
        return {
          schema: flowchart.schema,
          nodes: flowchart.nodes,
          edges: flowchart.edges
        };
      } catch (error) {
        console.error('Error loading flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:list', async () => {
      try {
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartRepository(db);
        const flowcharts = repo.list();
        
        console.log(`[Flowchart] Listed ${flowcharts.length} flowcharts`);
        return flowcharts;
      } catch (error) {
        console.error('Error listing flowcharts:', error);
        return [];
      }
    });

    ipcMain.handle('flowchart:delete', async (_, flowchartId: string) => {
      try {
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartRepository(db);
        repo.delete(flowchartId);
        
        console.log(`[Flowchart] Deleted flowchart: ${flowchartId}`);
        return { success: true };
      } catch (error) {
        console.error('Error deleting flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:savePatches', async (_, flowchartId: string, patches: any[]) => {
      try {
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }

        const repo = new FlowchartRepository(db);
        repo.savePatches(flowchartId, patches);

        console.log(`[Flowchart] Saved ${patches.length} patches for flowchart: ${flowchartId}`);
        return { success: true };
      } catch (error) {
        console.error('Error saving flowchart patches:', error);
        throw error;
      }
    });

    // 流程图待办关联API
    ipcMain.handle('flowchart-todo-association:queryByFlowchart', async (_, flowchartId: string) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }

        const repo = new FlowchartTodoAssociationRepository(db);
        const todoIds = repo.queryByFlowchartId(flowchartId);

        console.log(`[FlowchartAssociation] Queried ${todoIds.length} todos for flowchart: ${flowchartId}`);
        return todoIds;
      } catch (error) {
        console.error('Error querying flowchart associations:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-todo-association:create', async (_, flowchartId: string, todoId: number) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }

        const repo = new FlowchartTodoAssociationRepository(db);
        repo.create(flowchartId, todoId);

        console.log(`[FlowchartAssociation] Created association: flowchart=${flowchartId}, todo=${todoId}`);
      } catch (error) {
        console.error('Error creating flowchart association:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-todo-association:delete', async (_, flowchartId: string, todoId: number) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }

        const repo = new FlowchartTodoAssociationRepository(db);
        repo.delete(flowchartId, todoId);

        console.log(`[FlowchartAssociation] Deleted association: flowchart=${flowchartId}, todo=${todoId}`);
      } catch (error) {
        console.error('Error deleting flowchart association:', error);
        throw error;
      }
    });

    // URL标题获取
    ipcMain.handle('url-titles:fetch-batch', async (_, urls: string[]) => {
      try {
        const result = await urlTitleService.fetchBatchTitles(urls);
        return Object.fromEntries(result) as Record<string, string>;
      } catch (error) {
        console.error('Failed to fetch URL titles:', error);
        return {};
      }
    });

    // URL授权相关
    ipcMain.handle('url:authorize', async (_, url: string) => {
      try {
        console.log(`[IPC] Authorizing URL: ${url}`);
        const title = await this.urlAuthService!.authorizeUrl(url);

        if (title) {
          return { success: true, title };
        } else {
          return { success: false, error: '未能获取页面标题，请确保登录完成后页面已完全加载再关闭窗口' };
        }
      } catch (error) {
        console.error('Failed to authorize URL:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('url:refreshTitle', async (_, url: string) => {
      try {
        console.log(`[IPC] Refreshing title for URL: ${url}`);
        const result = await this.urlAuthService!.refreshUrlTitle(url);
        return {
          success: true,
          title: result.title,
          source: result.source,
          unchanged: result.unchanged
        };
      } catch (error) {
        console.error('Failed to refresh URL title:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // URL授权管理相关
    ipcMain.handle('url-auth:getAll', async () => {
      try {
        return await this.urlAuthorizationService!.getAllAuthorizations();
      } catch (error) {
        console.error('Failed to get authorizations:', error);
        return [];
      }
    });

    ipcMain.handle('url-auth:refresh', async () => {
      try {
        const result = await this.urlAuthorizationService!.batchRefreshAuthorizations();
        return { success: true, successCount: result.success, failedCount: result.failed };
      } catch (error) {
        console.error('Failed to refresh authorizations:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('url-auth:cleanup', async () => {
      try {
        const count = await this.urlAuthorizationService!.cleanupExpiredAuthorizations();
        return { success: true, count };
      } catch (error) {
        console.error('Failed to cleanup authorizations:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('url-auth:delete', async (_, url: string) => {
      try {
        const success = await this.urlAuthorizationService!.deleteAuthorization(url);
        return { success };
      } catch (error) {
        console.error('Failed to delete authorization:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 批量获取授权记录中的标题
    ipcMain.handle('url-auth:getTitles', async (_, urls: string[]) => {
      try {
        const titleMap = await this.urlAuthorizationService!.getAuthorizationsByUrls(urls);
        // Convert Map to plain object for IPC serialization
        return Object.fromEntries(titleMap);
      } catch (error) {
        console.error('Failed to get authorization titles:', error);
        return {};
      }
    });

    // 初始化授权数据库（从现有待办事项迁移）
    ipcMain.handle('url-auth:initialize', async () => {
      try {
        const count = await this.urlAuthorizationService!.initializeFromExistingTodos();
        return { success: true, count };
      } catch (error) {
        console.error('Failed to initialize authorizations:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 获取所有待办事项中的URL（包括未授权的）
    ipcMain.handle('url-auth:getAllUrls', async () => {
      try {
        const db = this.dbManager.getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }

        // 获取所有待办事项的content
        const todos = db
          .prepare('SELECT id, content FROM todos WHERE content IS NOT NULL AND LENGTH(content) > 0')
          .all() as Array<{ id: number; content: string }>;

        // 提取所有URL
        const urlPattern = /(https?:\/\/[^\s<>"]+)/g;
        const urlMap = new Map<string, { todoId: number; url: string }>();

        todos.forEach(todo => {
          let match: RegExpExecArray | null;
          // Reset regex state for each todo
          urlPattern.lastIndex = 0;
          while ((match = urlPattern.exec(todo.content)) !== null) {
            const url = match[1];
            // 去重（保留第一次出现）
            if (!urlMap.has(url)) {
              urlMap.set(url, { todoId: todo.id, url });
            }
          }
        });

        // 获取已授权的URL
        const authRecords = await this.urlAuthorizationService!.getAllAuthorizations();
        const authorizedRecords = new Map<string, any>();
        authRecords.forEach(record => {
          authorizedRecords.set(record.url, record);
        });

        // 合并数据，标记状态
        const allUrls = Array.from(urlMap.values()).map(item => {
          const authRecord = authorizedRecords.get(item.url);
          return {
            url: item.url,
            todoId: item.todoId,
            hasAuthorization: !!authRecord,
            authorization: authRecord || null,
          };
        });

        return { success: true, data: allUrls };
      } catch (error) {
        console.error('Failed to get all URLs:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 单链接授权（用于失败链接的重新授权）
    ipcMain.handle('url-auth:authorizeSingle', async (_, url: string) => {
      try {
        console.log(`[IPC] Authorizing single URL: ${url}`);

        if (!this.urlAuthService) {
          return { success: false, error: 'URL authorization service not available' };
        }

        // 获取 BatchAuthorizationService 实例
        const { BatchAuthorizationService } = await import('./services/BatchAuthorizationService');
        const db = this.dbManager.getDb();

        if (!db) {
          return { success: false, error: 'Database not available' };
        }

        // 创建临时 BatchAuthorizationService 实例
        const batchAuthService = new BatchAuthorizationService(db, this.urlAuthService.getAuthSession());

        const result = await batchAuthService.authorizeSingleUrl(
          url,
          (progress) => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('url-auth:single-progress', progress);
            }
          }
        );

        return result;
      } catch (error) {
        console.error('Failed to authorize single URL:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 查询批量授权任务状态
    ipcMain.handle('url-auth:getBatchTaskStatus', async (_, domain: string) => {
      try {
        if (!this.urlAuthService) {
          return { success: false, error: 'Service not available' };
        }

        const { BatchAuthorizationService } = await import('./services/BatchAuthorizationService');
        const db = this.dbManager.getDb();

        if (!db) {
          return { success: false, error: 'Database not available' };
        }

        // 创建临时 BatchAuthorizationService 实例
        const batchAuthService = new BatchAuthorizationService(db, this.urlAuthService.getAuthSession());

        const task = await batchAuthService.getActiveTask(domain);
        return { success: true, task };
      } catch (error) {
        console.error('Failed to get batch task status:', error);
        return { success: false, error: (error as Error).message };
      }
    });
  }

  public async initialize(): Promise<void> {
    try {
      // 添加全局错误处理
      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        if (process.platform === 'darwin' && app.isPackaged) {
          dialog.showErrorBox(
            'MultiTodo 意外错误',
            `应用发生未捕获的异常：\n\n${error.message}\n\n请检查控制台日志或报告此问题。`
          );
        }
      });

      // 硬件加速控制
      // 在 macOS 上默认启用硬件加速以获得更好的性能
      // 在其他平台上可以通过环境变量 MULTI_TODO_DISABLE_HW_ACC=1 禁用
      const disableHardwareAcceleration = process.env.MULTI_TODO_DISABLE_HW_ACC === '1' || process.platform !== 'darwin';

      if (disableHardwareAcceleration) {
        console.log('Hardware acceleration is disabled');
        app.disableHardwareAcceleration();
      } else {
        console.log('Hardware acceleration is enabled (default on macOS)');
      }

      console.log('Waiting for app ready...');
      await app.whenReady();
      console.log('App is ready');

      // === 原生模块兼容性检查 ===
      console.log('Running native module compatibility check...');
      await this.checkNativeModuleCompatibility();

      // 初始化数据库（增强错误处理）
      console.log('Initializing database...');
      try {
        await this.dbManager.initialize();
        console.log('Database initialized successfully');
      } catch (dbError) {
        console.error('Database initialization failed:', dbError);

        // 提供详细的错误信息
        console.error('\n=== DATABASE INITIALIZATION ERROR ===');
        console.error(`Database path: ${this.dbManager.getDbPath()}`);
        console.error(`Error: ${(dbError as Error).message}`);
        if ((dbError as Error).stack) console.error(`Stack: ${(dbError as Error).stack}`);
        console.error('======================================\n');

        // 尝试备份损坏的数据库
        try {
          const dbPath = this.dbManager.getDbPath();
          if (fs.existsSync(dbPath)) {
            const backupPath = dbPath + '.corrupt.' + Date.now();
            fs.copyFileSync(dbPath, backupPath);
            console.log(`Corrupted database backed up to: ${backupPath}`);
          }
        } catch (backupError) {
          console.error('Failed to backup database:', backupError);
        }

        throw dbError;
      }

      // 初始化备份管理器
      console.log('Initializing backup manager...');
      const dbPath = this.dbManager.getDbPath();
      this.backupManager = new BackupManager(dbPath);
      this.backupManager.startAutoBackup();
      console.log('Backup manager initialized successfully');

      // 初始化关键词处理器
      console.log('Initializing keyword processor...');
      this.keywordProcessor = new KeywordProcessor(this.dbManager);
      console.log('Keyword processor initialized successfully');

      // 初始化 AI 服务（从配置文件加载）
      console.log('Initializing AI service from config file...');
      try {
        const { provider, config } = aiConfigManager.getCurrentProviderConfig();

        console.log('[AI Init] 从配置文件读取的配置:', {
          provider,
          hasConfig: !!config,
          apiKey: config?.apiKey ? '***' : '(empty)',
          endpoint: config?.endpoint,
          model: config?.model,
          enabled: config?.enabled
        });

        // 如果有有效配置，初始化AI服务
        if (provider !== 'disabled' && config && config.enabled && config.apiKey) {
          console.log('[AI Init] 配置有效，开始初始化AI服务');
          aiService.configure(
            provider,
            config.apiKey,
            config.endpoint,
            config.model
          );
          console.log('[AI Init] AI服务配置成功');
        } else {
          console.log('[AI Init] 配置无效或为空，AI服务保持禁用状态');
        }
      } catch (error) {
        console.error('[AI Init] AI服务配置失败:', error);
      }
      console.log('AI service initialization completed');

      // 初始化 Prompt 模板服务
      console.log('Initializing prompt template service...');
      try {
        const dbForPrompt = this.dbManager.getDb();
        if (dbForPrompt) {
          this.promptTemplateService = new PromptTemplateService(dbForPrompt);
          console.log('Prompt template service initialized successfully');

          // 验证服务是否可用
          const testAccess = await this.promptTemplateService.getAll();
          console.log(`Prompt template service verified: ${testAccess.length} templates loaded`);
        } else {
          console.error('Failed to initialize prompt template service: database is null');
          this.promptTemplateService = null;
        }
      } catch (error) {
        console.error('Failed to initialize prompt template service:', error);
        this.promptTemplateService = null;
      }

      // Initialize URL auth service
      console.log('Initializing URL auth service...');
      this.urlAuthService = new URLAuthService();
      console.log('URL auth service initialized successfully');

      // Initialize URL authorization service
      console.log('Initializing URL authorization service...');
      const db = this.dbManager.getDb();
      if (db) {
        this.urlAuthorizationService = new URLAuthorizationService(db);
        this.urlAuthService.setURLAuthorizationService(this.urlAuthorizationService, db);
        console.log('URL authorization service initialized successfully');

        // Start authorization refresh scheduler
        console.log('Starting authorization refresh scheduler...');
        this.authorizationRefreshScheduler = new AuthorizationRefreshScheduler(this.urlAuthorizationService);
        this.authorizationRefreshScheduler.start();
        console.log('Authorization refresh scheduler started successfully');
      } else {
        console.error('Failed to initialize URL authorization service: database is null');
      }

      // 验证服务初始化
      console.log('Verifying services initialization...');
      const serviceCheck = this.verifyServicesInitialization();
      if (!serviceCheck.success) {
        console.error('Service initialization errors detected:', serviceCheck.errors);
        console.error('Some features may not work correctly');
      } else {
        console.log('All required services initialized successfully');
      }

      // 设置IPC处理器
      console.log('Setting up IPC handlers...');
      this.setupIpcHandlers();
      console.log('IPC handlers set up successfully');

      // 创建主窗口
      console.log('Creating main window...');
      this.createWindow();
      console.log('Main window created successfully');

      // 设置主窗口引用到URLAuthService（用于发送批量授权事件）
      if (this.mainWindow && this.urlAuthService) {
        this.urlAuthService.setMainWindow(this.mainWindow);
        console.log('Main window reference set to URLAuthService');
      }

      // 创建系统托盘
      console.log('Creating system tray...');
      this.createTray();
      console.log('System tray created successfully');

      // 注册全局快捷键
      console.log('Registering global shortcuts...');
      this.registerGlobalShortcuts();
      console.log('Global shortcuts registered successfully');

    } catch (error) {
      console.error('Application initialization failed:', error);

      // macOS 特定的用户友好错误提示
      if (process.platform === 'darwin' && app.isPackaged) {
        dialog.showErrorBox(
          'MultiTodo 启动失败',
          '应用启动失败。可能的原因：\n\n' +
          '1. 原生模块加载失败（架构不匹配）\n' +
          '2. 应用文件损坏\n\n' +
          '解决方案：\n' +
          '• 重新下载安装包\n' +
          '• 如果问题持续，请报告此问题\n\n' +
          `错误详情：\n${(error as Error).message}`
        );
      }

      throw error;
    }

    // 退出前清理
    app.on('before-quit', () => {
      console.log('=== Before quit event ===');
      this.isQuitting = true;
      console.log('isQuitting set to true');
    });

    // 注销全局快捷键并停止备份
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.backupManager?.stopAutoBackup();
      this.authorizationRefreshScheduler?.stop();
      console.log('Global shortcuts unregistered, backup stopped, and authorization scheduler stopped');
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      } else {
        // macOS 上点击 Dock 图标时显示窗口
        this.mainWindow?.show();
        this.mainWindow?.focus();
      }
    });

    // 处理所有窗口关闭事件
    app.on('window-all-closed', () => {
      console.log('=== All windows closed ===');
      console.log('Platform:', process.platform);
      console.log('isQuitting:', this.isQuitting);
      
      // 不自动退出应用
      // - Windows/Linux: 应用保留在系统托盘中
      // - macOS: 应用保留在 Dock 中
      // 用户需要从托盘菜单或 Dock 菜单选择"退出"才能真正退出
      if (process.platform !== 'darwin') {
        // Windows/Linux: 有托盘图标，不退出
        console.log('Keeping app running in system tray');
      } else {
        // macOS: 保持在 Dock，不退出
        console.log('Keeping app running in Dock');
      }
    });
  }
}

const application = new Application();

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 启动应用
console.log('Starting application...');
application.initialize().catch((error) => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
