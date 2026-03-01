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
import { urlTitleService } from './services/URLTitleService';
import { URLAuthService } from './services/URLAuthService';
import { URLAuthorizationService } from './services/URLAuthorizationService';
import { AuthorizationRefreshScheduler } from './services/AuthorizationRefreshScheduler';
import { TodoRecommendation } from '../shared/types';

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

    // 流程图关联查询相关
    ipcMain.handle('flowchart:getAssociationsByTodoIds', async (_, todoIds: number[]) => {
      try {
        // 导入 FlowchartRepository
        const { FlowchartRepository } = await import('./database/FlowchartRepository');
        
        // 获取数据库实例
        const db = this.dbManager.getDb();
        if (!db) {
          console.error('Database not initialized');
          return {};
        }
        
        // 创建 FlowchartRepository 实例
        const flowchartRepo = new FlowchartRepository(db);
        
        // 将数字 ID 转换为字符串（因为 todoId 在节点中存储为字符串）
        const todoIdStrings = todoIds.map(id => id.toString());
        console.log('[IPC] Query todoIds (string):', todoIdStrings);
        
        // 批量查询关联数据
        const associations = flowchartRepo.queryNodesByTodoIds(todoIdStrings);
        
        // 转换 Map 为普通对象以便序列化
        // 关键修复：将 Map key 从 string 转换为 number，确保与前端 todo.id 类型一致
        const result: Record<number, Array<{
          flowchartId: string;
          flowchartName: string;
          nodeId: string;
          nodeLabel: string;
        }>> = {};
        
        associations.forEach((value, key) => {
          const numericKey = parseInt(key, 10);
          if (!isNaN(numericKey)) {
            result[numericKey] = value;
            console.log(`[IPC] Converted key: "${key}" (string) → ${numericKey} (number), associations:`, value.length);
          } else {
            console.warn(`[IPC] Invalid todoId key: ${key}, skipping`);
          }
        });
        
        console.log(`[Flowchart Associations] Queried ${todoIds.length} todos, found ${Object.keys(result).length} with associations`);
        console.log('[IPC] Result keys (number):', Object.keys(result).map(k => Number(k)));
        
        return result;
      } catch (error) {
        console.error('Error getting flowchart associations:', error);
        return {};
      }
    });

    // 流程图与待办关联（流程图级别）
    ipcMain.handle('flowchart-todo-association:create', async (_, flowchartId: string, todoId: number) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartTodoAssociationRepository(db);
        repo.create(flowchartId, todoId);
        console.log(`[FlowchartTodoAssociation] Created: flowchart=${flowchartId}, todo=${todoId}`);
        return { success: true };
      } catch (error) {
        console.error('Error creating flowchart-todo association:', error);
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
        console.log(`[FlowchartTodoAssociation] Deleted: flowchart=${flowchartId}, todo=${todoId}`);
        return { success: true };
      } catch (error) {
        console.error('Error deleting flowchart-todo association:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-todo-association:query-by-flowchart', async (_, flowchartId: string) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartTodoAssociationRepository(db);
        const todoIds = repo.queryByFlowchartId(flowchartId);
        console.log(`[FlowchartTodoAssociation] Query by flowchart ${flowchartId}: found ${todoIds.length} todos`);
        return todoIds;
      } catch (error) {
        console.error('Error querying flowchart-todo associations by flowchart:', error);
        return [];
      }
    });

    ipcMain.handle('flowchart-todo-association:query-by-todo', async (_, todoId: number) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartTodoAssociationRepository(db);
        const associations = repo.queryByTodoId(todoId);
        console.log(`[FlowchartTodoAssociation] Query by todo ${todoId}: found ${associations.length} flowcharts`);
        return associations;
      } catch (error) {
        console.error('Error querying flowchart-todo associations by todo:', error);
        return [];
      }
    });

    ipcMain.handle('flowchart-todo-association:query-by-todos', async (_, todoIds: number[]) => {
      try {
        const { FlowchartTodoAssociationRepository } = await import('./database/FlowchartTodoAssociationRepository');
        const db = this.dbManager.getDb();
        if (!db) {
          throw new Error('Database not initialized');
        }
        
        const repo = new FlowchartTodoAssociationRepository(db);
        const associationsMap = repo.queryByTodoIds(todoIds);
        
        // 转换 Map 为普通对象以便序列化
        const result: Record<number, any[]> = {};
        associationsMap.forEach((value, key) => {
          result[key] = value;
        });
        
        console.log(`[FlowchartTodoAssociation] Batch query ${todoIds.length} todos: found ${Object.keys(result).length} with associations`);
        return result;
      } catch (error) {
        console.error('Error batch querying flowchart-todo associations:', error);
        return {};
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

    // Flowchart migration handlers
    ipcMain.handle('flowchart-migration:getStatus', async () => {
      try {
        const { FlowchartMigrationService } = await import('./services/FlowchartMigrationService');
        const migrationService = new FlowchartMigrationService(this.dbManager);
        return await migrationService.getStatus();
      } catch (error) {
        console.error('Error getting migration status:', error);
        return {
          hasLegacyFlowcharts: false,
          flowchartCount: 0,
          totalNodes: 0,
          totalEdges: 0,
          canMigrate: false
        };
      }
    });

    ipcMain.handle('flowchart-migration:getFlowcharts', async () => {
      try {
        const { FlowchartMigrationService } = await import('./services/FlowchartMigrationService');
        const migrationService = new FlowchartMigrationService(this.dbManager);
        return await migrationService.getFlowchartsForMigration();
      } catch (error) {
        console.error('Error getting flowcharts for migration:', error);
        return [];
      }
    });

    ipcMain.handle('flowchart-migration:migrate', async (_, options) => {
      try {
        const { FlowchartMigrationService } = await import('./services/FlowchartMigrationService');
        const migrationService = new FlowchartMigrationService(this.dbManager);
        return await migrationService.migrate(options);
      } catch (error) {
        console.error('Error migrating flowcharts:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-migration:cleanup', async () => {
      try {
        const { FlowchartMigrationService } = await import('./services/FlowchartMigrationService');
        const migrationService = new FlowchartMigrationService(this.dbManager);
        return await migrationService.cleanupLegacyFlowcharts();
      } catch (error) {
        console.error('Error cleaning up legacy flowcharts:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('flowchart-migration:verify', async () => {
      try {
        const { FlowchartMigrationService } = await import('./services/FlowchartMigrationService');
        const migrationService = new FlowchartMigrationService(this.dbManager);
        return await migrationService.verifyMigration();
      } catch (error) {
        console.error('Error verifying migration:', error);
        return {
          success: false,
          message: (error as Error).message,
          remainingFlowcharts: -1
        };
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
        const title = await this.urlAuthService!.refreshUrlTitle(url);
        return { success: true, title };
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

      // Initialize URL auth service
      console.log('Initializing URL auth service...');
      this.urlAuthService = new URLAuthService();
      console.log('URL auth service initialized successfully');

      // Initialize URL authorization service
      console.log('Initializing URL authorization service...');
      const db = this.dbManager.getDb();
      if (db) {
        this.urlAuthorizationService = new URLAuthorizationService(db);
        this.urlAuthService.setURLAuthorizationService(this.urlAuthorizationService);
        console.log('URL authorization service initialized successfully');

        // Start authorization refresh scheduler
        console.log('Starting authorization refresh scheduler...');
        this.authorizationRefreshScheduler = new AuthorizationRefreshScheduler(this.urlAuthorizationService);
        this.authorizationRefreshScheduler.start();
        console.log('Authorization refresh scheduler started successfully');
      } else {
        console.error('Failed to initialize URL authorization service: database is null');
      }

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
