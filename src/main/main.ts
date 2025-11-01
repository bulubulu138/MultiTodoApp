import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from './database/DatabaseManager';
import { ImageManager } from './utils/ImageManager';
import { generateContentHash } from './utils/hashUtils';
import { KeywordProcessor } from './services/KeywordProcessor';
import { keywordExtractor, KeywordExtractor } from './services/KeywordExtractor';
import { aiService } from './services/AIService';
import { TodoRecommendation } from '../shared/types';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private dbManager: DatabaseManager;
  private imageManager: ImageManager;
  private keywordProcessor: KeywordProcessor | null = null;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;

  constructor() {
    this.dbManager = new DatabaseManager();
    this.imageManager = new ImageManager();
  }

  private createWindow(): void {
    const isDev = process.env.NODE_ENV === 'development';
    
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

    // 修改窗口关闭行为：不退出应用，而是最小化到托盘
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
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
      // 尝试使用项目中的图标
      let iconPath = path.join(__dirname, '../../assets/icon.png');
      
      // 如果找不到，使用备用图标
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(__dirname, '../../assets/icon_32x32.png');
      }
      
      const icon = nativeImage.createFromPath(iconPath);
      this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
      
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
      
      console.log('系统托盘创建成功');
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

    ipcMain.handle('ai:configure', async (_, provider: string, apiKey: string, endpoint?: string) => {
      try {
        aiService.configure(provider as any, apiKey, endpoint);
        // 保存到数据库
        await this.dbManager.updateSettings({
          ai_provider: provider,
          ai_api_key: apiKey,
          ai_api_endpoint: endpoint || '',
          ai_enabled: provider !== 'disabled' && apiKey ? 'true' : 'false'
        });
        return { success: true };
      } catch (error) {
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
  }

  public async initialize(): Promise<void> {
    try {
      // 根据用户反馈，硬件加速可能导致启动白屏和卡顿
      // 暂时禁用，后续可通过环境变量控制
      app.disableHardwareAcceleration();
      
      console.log('Waiting for app ready...');
      await app.whenReady();
      console.log('App is ready');
      
      // 初始化数据库
      console.log('Initializing database...');
      await this.dbManager.initialize();
      console.log('Database initialized successfully');
      
      // 初始化关键词处理器
      console.log('Initializing keyword processor...');
      this.keywordProcessor = new KeywordProcessor(this.dbManager);
      console.log('Keyword processor initialized successfully');
      
      // 初始化 AI 服务
      console.log('Initializing AI service...');
      const settings = await this.dbManager.getSettings();
      if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {
        aiService.configure(
          settings.ai_provider as any,
          settings.ai_api_key || '',
          settings.ai_api_endpoint || undefined
        );
      }
      console.log('AI service initialized successfully');
      
      // 设置IPC处理器
      console.log('Setting up IPC handlers...');
      this.setupIpcHandlers();
      console.log('IPC handlers set up successfully');
      
      // 创建主窗口
      console.log('Creating main window...');
      this.createWindow();
      console.log('Main window created successfully');
      
      // 创建系统托盘
      console.log('Creating system tray...');
      this.createTray();
      console.log('System tray created successfully');
      
      // 注册全局快捷键
      console.log('Registering global shortcuts...');
      this.registerGlobalShortcuts();
      console.log('Global shortcuts registered successfully');
      
    } catch (error) {
      console.error('Error during initialization:', error);
      throw error;
    }

    // 退出前清理
    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    // 注销全局快捷键
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      console.log('Global shortcuts unregistered');
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

    // Windows/Linux: 关闭所有窗口后退出（但托盘除外）
    app.on('window-all-closed', () => {
      // 不自动退出，因为有托盘图标
      // 用户需要从托盘菜单选择"退出"
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
