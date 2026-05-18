import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Todo, TodoRelation, TodoTreeNode, TreeRelationData } from '../shared/types';
import { SettingsManager } from './SettingsManager';
import { FlowchartFileManager } from './FlowchartFileManager';
import { FlowchartTodoAssociationManager } from './FlowchartTodoAssociationManager';
import { FileStorageManager } from './FileStorageManager';
import { ImageManager } from './utils/ImageManager';
import { BackupManager } from './utils/BackupManager';
import { generateContentHash } from './utils/hashUtils';
import { keywordExtractor, KeywordExtractor } from './services/KeywordExtractor';
import { urlTitleService } from './services/URLTitleService';
import { URLAuthService } from './services/URLAuthServiceStub';
import { URLAuthorizationService } from './services/URLAuthorizationServiceStub';
// import { AuthorizationRefreshScheduler } from './services/AuthorizationRefreshScheduler';
import { databaseManager } from './services/DatabaseManager';
import { appConfigManager } from './config/AppConfig';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private settingsManager: SettingsManager; // 用于设置
  private fileStorageManager: FileStorageManager; // 用于主要业务数据
  private flowchartFileManager: FlowchartFileManager;
  private flowchartTodoAssociationManager: FlowchartTodoAssociationManager;
  private imageManager: ImageManager;
  private backupManager: BackupManager | null = null;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;
  private hasShownTrayNotification: boolean = false;
  private urlAuthService: URLAuthService | null = null;
  private urlAuthorizationService: URLAuthorizationService | null = null;
  // private authorizationRefreshScheduler: AuthorizationRefreshScheduler | null = null;


  // ✅ 新增：存储位置管理
  private appConfig: any = null;
  private storageLocationService: any = null;
  private databaseManager = databaseManager; // 数据库管理器

  constructor() {
    this.settingsManager = new SettingsManager(); // 用于设置
    this.fileStorageManager = new FileStorageManager(); // 用于主要业务数据
    this.flowchartFileManager = new FlowchartFileManager();
    this.flowchartTodoAssociationManager = new FlowchartTodoAssociationManager();
    this.imageManager = new ImageManager();
  }

  private async checkFileStorageCompatibility(): Promise<void> {
    try {
      console.log('=== MultiTodo Startup Diagnostics ===');
      console.log(`Platform: ${process.platform} ${process.arch}`);
      console.log(`Electron: ${process.versions.electron || 'Unknown'}`);
      console.log(`Node.js: ${process.version}`);
      console.log(`Packaged: ${app.isPackaged}`);
      console.log(`App Path: ${app.getAppPath()}`);
      console.log('✅ File storage compatibility check PASSED');
    } catch (error) {
      console.error('❌ File storage compatibility check FAILED:', error);
      throw new Error(`File storage compatibility check failed: ${(error as Error).message}`);
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

    // 设置DatabaseManager的主窗口引用
    this.databaseManager.setMainWindow(this.mainWindow);
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

  /**
    try {
      // 从设置中获取存储模式
      const settings = await this.settingsManager.getSettings();
      const storageMode = settings.storageMode || 'database';
      const storagePath = settings.storagePath;

      console.log(`[initializeFileStorage] Current storage mode: '${storageMode}'`);
      console.log(`[initializeFileStorage] Storage path: ${storagePath || 'not configured'}`);

      // 只有在文件存储模式下才初始化文件存储
      if (storageMode !== 'file') {
        console.log('[initializeFileStorage] ✅ Using database storage mode');
        this.useFileStorage = false;
        return;
      }

      if (!storagePath) {
        console.warn('[initializeFileStorage] ⚠️ Storage mode is file but no storage path configured, falling back to database');
        this.useFileStorage = false;
        return;
      }

      // 验证存储路径是否存在
      if (!fs.existsSync(storagePath)) {
        console.error(`[initializeFileStorage] ❌ Storage path does not exist: ${storagePath}`);
        console.warn('[initializeFileStorage] ⚠️ Falling back to database mode');
        this.useFileStorage = false;
        return;
      }

      console.log(`[initializeFileStorage] 🔄 Initializing file storage at: ${storagePath}`);
      this.useFileStorage = true;

      // 初始化 FileStorageManager
      this.fileStorageManager = new FileStorageManager(storagePath);

      console.log('[initializeFileStorage] ✅ File storage initialized successfully');
    } catch (error) {
      console.error('[initializeFileStorage] ❌ Error initializing file storage:', error);
      console.warn('[initializeFileStorage] ⚠️ Falling back to database mode');
      this.useFileStorage = false;
      this.fileStorageManager = null;
    }
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

    // 检查文件存储管理器
    if (!this.fileStorageManager) {
      errors.push('FileStorageManager is not initialized');
    }

    // 检查设置管理器
    if (!this.settingsManager) {
      errors.push('SettingsManager is not initialized');
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * 获取今日完成管理器
   * @returns TodayCompletedManager实例或null
   */
  private getTodayCompletedManager(): any {
    return this.databaseManager.getTodayCompletedManager();
  }

  /**
   * 安全地获取Prompt模板（带降级处理）
   * @param templateId 模板ID
   * @returns 模板内容或undefined（如果获取失败则使用默认提示词）
   */
  private setupIpcHandlers(): void {
    // 待办事项相关的IPC处理器
    ipcMain.handle('todo:getAll', async () => {
      return await this.databaseManager.getStorageManager().getAllTodos();
    });

    ipcMain.handle('todo:getById', async (_, uuid: string) => {
      // 🔧 新增：根据UUID获取单个待办，用于增量刷新
      return await this.databaseManager.getStorageManager().getTodoByUuid(uuid);
    });

    ipcMain.handle('todo:create', async (_, todo) => {
      return await this.databaseManager.getStorageManager().createTodo(todo);
    });

    ipcMain.handle('todo:createManualAtTop', async (_, todo, tabKey: string) => {
      // 使用新的创建方法，新待办将被添加到顶部并自动调整其他待办的排序号
      return await this.databaseManager.getStorageManager().createTodoWithDisplayOrder(todo, tabKey, 'top');
    });

    ipcMain.handle('todo:update', async (_, uuid: string, updates) => {
      await this.databaseManager.getStorageManager().updateTodo(uuid, updates);
    });

    ipcMain.handle('todo:delete', async (_, uuid: string) => {
      await this.databaseManager.getStorageManager().deleteTodo(uuid);
    });

    ipcMain.handle('todo:generateHash', async (_, title: string, content: string) => {
      return generateContentHash(title, content);
    });

    ipcMain.handle('todo:findDuplicate', async (_, contentHash: string, excludeUuid?: string) => {
      // 简化实现：直接返回null，让前端处理重复检查
      return null;
    });

    ipcMain.handle('todo:batchUpdateDisplayOrder', async (_, updates: {uuid: string, displayOrder: number}[]) => {
      // 简化实现：逐个更新
      for (const update of updates) {
        try {
          await this.databaseManager.getStorageManager().updateTodo(update.uuid, { displayOrder: update.displayOrder });
        } catch (error) {
          console.error('Failed to update display order:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('todo:batchUpdateDisplayOrders', async (_, updates: {uuid: string, tabKey: string, displayOrder: number}[]) => {
      // 按待办分组更新
      const groupedUpdates = new Map<string, Array<{tabKey: string; displayOrder: number}>>();

      for (const update of updates) {
        if (!groupedUpdates.has(update.uuid)) {
          groupedUpdates.set(update.uuid, []);
        }
        groupedUpdates.get(update.uuid)!.push({
          tabKey: update.tabKey,
          displayOrder: update.displayOrder
        });
      }

      // 批量更新
      for (const [uuid, displayOrders] of groupedUpdates) {
        const todo = await this.databaseManager.getStorageManager().getTodoById(uuid);
        if (todo) {
          const newDisplayOrders = todo.displayOrders || {};
          displayOrders.forEach(({ tabKey, displayOrder }) => {
            newDisplayOrders[tabKey] = displayOrder;
          });

          await this.databaseManager.getStorageManager().updateTodo(uuid, { displayOrders: newDisplayOrders });
        }
      }

      return { success: true };
    });

    ipcMain.handle('todo:bulkUpdateTodos', async (_, updates: Array<{uuid: string; updates: any}>) => {
      // 简化实现：逐个更新
      for (const { uuid, updates: todoUpdates } of updates) {
        try {
          await this.databaseManager.getStorageManager().updateTodo(uuid, todoUpdates);
        } catch (error) {
          console.error('Failed to update todo:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('todo:bulkDeleteTodos', async (_, uuids: string[]) => {
      // 简化实现：逐个删除
      for (const uuid of uuids) {
        try {
          await this.databaseManager.getStorageManager().deleteTodo(uuid);
        } catch (error) {
          console.error('Failed to delete todo:', error);
        }
      }
      return { success: true };
    });

    ipcMain.handle('todo:toggleTodayCompleted', async (_, uuid: string, currentState: string) => {
      try {
        const todayCompletedManager = this.getTodayCompletedManager();
        if (!todayCompletedManager) {
          return { success: false, error: 'Today completed manager not initialized' };
        }

        await todayCompletedManager.toggleTodayCompleted(uuid, currentState);
        return { success: true };
      } catch (error) {
        console.error('[IPC] Failed to toggle today_completed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 设置相关
    ipcMain.handle('settings:get', async () => {
      return await this.settingsManager.getSettings();
    });

    ipcMain.handle('settings:update', async (_, settings) => {
      return await this.settingsManager.updateSettings(settings);
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

    // 文件选择相关处理器
    ipcMain.handle('file:openDirectory', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths[0];
      } catch (error) {
        console.error('Error opening directory:', error);
        return null;
      }
    });

    ipcMain.handle('file:selectDirectory', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          title: '选择存储位置',
          properties: ['openDirectory', 'createDirectory'],
          message: '选择一个文件夹来存储待办数据'
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        const selectedPath = result.filePaths[0];

        // 检查目录权限
        try {
          await fs.promises.access(selectedPath, fs.constants.W_OK);
        } catch {
          throw new Error('选择的目录没有写入权限');
        }

        return selectedPath;
      } catch (error) {
        console.error('Error selecting directory:', error);
        throw error;
      }
    });

    // 存储位置相关 IPC 处理器
    ipcMain.handle('storageLocation:getConfig', async () => {
      try {
        const { appConfigManager } = await import('./config/AppConfig');
        return {
          success: true,
          config: {
            firstRun: appConfigManager.isFirstRun(),
            storageLocation: appConfigManager.getStorageLocation()
          }
        };
      } catch (error) {
        console.error('Error getting storage location config:', error);
        return {
          success: true,
          config: {
            firstRun: true,
            storageLocation: {
              type: 'default',
              lastUpdated: new Date().toISOString()
            }
          }
        };
      }
    });

    ipcMain.handle('storageLocation:setStorageLocation', async (_, type: string, customPath?: string) => {
      try {
        const { appConfigManager } = await import('./config/AppConfig');
        appConfigManager.setStorageLocation(type as any, customPath);
        return { success: true };
      } catch (error) {
        console.error('Error setting storage location:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('storageLocation:validatePath', async (_, targetPath: string) => {
      try {
        // 临时简化实现
        const fs = require('fs');
        const exists = fs.existsSync(targetPath);
        return {
          valid: exists,
          error: exists ? null : 'Path does not exist'
        };
      } catch (error) {
        console.error('Error validating path:', error);
        return {
          valid: false,
          error: (error as Error).message
        };
      }
    });

    ipcMain.handle('storageLocation:getRecommendedPaths', async () => {
      try {
        // 返回一些推荐的存储路径
        const os = require('os');
        const path = require('path');
        return [
          path.join(os.homedir(), 'Documents', 'MultiTodo'),
          path.join(os.homedir(), 'Desktop', 'MultiTodo')
        ];
      } catch (error) {
        console.error('Error getting recommended paths:', error);
        return [];
      }
    });

    ipcMain.handle('storageLocation:moveStorage', async (_, newPath: string) => {
      try {
        // 临时简化实现 - 不支持移动存储
        return {
          success: false,
          error: 'Storage move not supported in Markdown mode'
        };
      } catch (error) {
        console.error('Error moving storage:', error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    });

    ipcMain.handle('storageLocation:selectFolder', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          properties: ['openDirectory', 'createDirectory'],
          title: '选择存储位置'
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        const selectedPath = result.filePaths[0];

        // 检查目录权限
        try {
          await fs.promises.access(selectedPath, fs.constants.W_OK);
        } catch {
          throw new Error('选择的目录没有写入权限');
        }

        return selectedPath;
      } catch (error) {
        console.error('Error selecting folder:', error);
        throw error;
      }
    });

    ipcMain.handle('storageLocation:openInExplorer', async (_, targetPath: string) => {
      try {
        const dirPath = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()
          ? path.dirname(targetPath)
          : targetPath;

        await shell.openPath(dirPath);
        return { success: true };
      } catch (error) {
        console.error('Error opening in explorer:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 新增：数据库管理 IPC 处理器
    ipcMain.handle('storageLocation:getRecentDatabases', async () => {
      try {
        const databases = await this.databaseManager.getRecentDatabases();
        return {
          success: true,
          databases
        };
      } catch (error) {
        console.error('[IPC] Error getting recent databases:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('storageLocation:validateDatabase', async (_, dbPath: string) => {
      try {
        const isValid = await this.databaseManager.validateDatabase(dbPath);
        return {
          valid: isValid,
          error: isValid ? undefined : 'Invalid database'
        };
      } catch (error) {
        console.error('[IPC] Error validating database:', error);
        return {
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('storageLocation:initializeDatabase', async (_, dbPath: string) => {
      try {
        const success = await this.databaseManager.initializeDatabase(dbPath);
        return {
          success,
          error: success ? undefined : 'Initialization failed'
        };
      } catch (error) {
        console.error('[IPC] Error initializing database:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('storageLocation:switchDatabase', async (_, dbPath: string) => {
      try {
        await this.databaseManager.switchDatabase(dbPath, false);
        return {
          success: true,
          error: undefined
        };
      } catch (error) {
        console.error('[IPC] Error switching database:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // 关系相关的IPC处理器
    ipcMain.handle('relations:getAll', async () => {
      return await this.databaseManager.getStorageManager().getAllRelations();
    });

    ipcMain.handle('relations:getByTodoId', async (_, todoId) => {
      const relations = await this.databaseManager.getStorageManager().getAllRelations();
      return relations.filter(r => String(r.source_id) === String(todoId) || String(r.target_id) === String(todoId));
    });

    ipcMain.handle('relations:getByType', async (_, relationType) => {
      const relations = await this.databaseManager.getStorageManager().getAllRelations();
      return relations.filter(r => r.relation_type === relationType);
    });

    ipcMain.handle('relations:create', async (_, relation) => {
      return await this.databaseManager.getStorageManager().createRelation(relation);
    });

    ipcMain.handle('relations:delete', async (_, id) => {
      return await this.databaseManager.getStorageManager().deleteRelation(id);
    });

    ipcMain.handle('relations:deleteByTodoId', async (_, todoId) => {
      // 简化实现：获取相关的关系然后删除
      const relations = await this.databaseManager.getStorageManager().getAllRelations();
      const todoRelations = relations.filter(r => String(r.source_id) === String(todoId) || String(r.target_id) === String(todoId));

      for (const relation of todoRelations) {
        if (relation.id !== undefined) {
          await this.databaseManager.getStorageManager().deleteRelation(String(relation.id));
        }
      }
    });

    ipcMain.handle('relations:deleteSpecific', async (_, sourceId, targetId, relationType) => {
      // 简化实现：查找并删除特定的关系
      const relations = await this.databaseManager.getStorageManager().getAllRelations();
      const targetRelation = relations.find(r =>
        String(r.source_id) === String(sourceId) &&
        String(r.target_id) === String(targetId) &&
        r.relation_type === relationType
      );

      if (targetRelation && targetRelation.id !== undefined) {
        await this.databaseManager.getStorageManager().deleteRelation(String(targetRelation.id));
      }
    });

    ipcMain.handle('relations:exists', async (_, sourceId, targetId, relationType) => {
      const relations = await this.databaseManager.getStorageManager().getAllRelations();
      return relations.some(r =>
        String(r.source_id) === String(sourceId) &&
        String(r.target_id) === String(targetId) &&
        r.relation_type === relationType
      );
    });

    ipcMain.handle('relations:buildTree', async () => {
      try {
        const storageManager = this.databaseManager.getStorageManager();

        // 获取所有待办和关系
        const allTodos = await storageManager.getAllTodos();
        const allRelations = await storageManager.getAllRelations();

        // 构建待办映射，便于快速查找
        const todoMap = new Map<string, Todo>();
        allTodos.forEach(todo => {
          todoMap.set(String(todo.id), todo);
        });

        // 构建邻接表：child_id -> parent_ids (background关系)
        const childToParents = new Map<string, string[]>();
        // 构建邻接表：parent_id -> child_ids (extends关系)
        const parentToChildren = new Map<string, string[]>();

        allRelations.forEach(rel => {
          const sourceId = String(rel.source_id);
          const targetId = String(rel.target_id);

          if (rel.relation_type === 'background') {
            // target以source为背景，即source是target的父节点
            if (!childToParents.has(targetId)) {
              childToParents.set(targetId, []);
            }
            childToParents.get(targetId)!.push(sourceId);
          } else if (rel.relation_type === 'extends') {
            // source延伸了target，即target是source的父节点
            if (!parentToChildren.has(targetId)) {
              parentToChildren.set(targetId, []);
            }
            parentToChildren.get(targetId)!.push(sourceId);
          }
          // parallel关系暂不处理
        });

        // 识别根节点：没有background父节点的待办
        const rootIds = new Set<string>();
        allTodos.forEach(todo => {
          const todoId = String(todo.id);
          if (!childToParents.has(todoId) || childToParents.get(todoId)!.length === 0) {
            rootIds.add(todoId);
          }
        });

        // 使用迭代算法（BFS）构建树，避免递归栈溢出
        const roots: TodoTreeNode[] = [];
        const visited = new Set<string>();
        const maxDepth = 50;
        const maxNodes = 1000;

        for (const rootId of rootIds) {
          if (visited.has(rootId)) continue;

          const queue: Array<{ id: string; depth: number; parentArray: TodoTreeNode[] }> = [];
          queue.push({ id: rootId, depth: 0, parentArray: roots });

          while (queue.length > 0 && roots.length < maxNodes) {
            const { id, depth, parentArray } = queue.shift()!;

            // 防止循环依赖和过深树
            if (visited.has(id) || depth >= maxDepth) {
              continue;
            }

            visited.add(id);

            const todo = todoMap.get(id);
            if (!todo) continue;

            // 创建树节点
            const treeNode: TodoTreeNode = {
              key: id,
              title: todo.title,
              todo: todo,
              children: []
            };

            parentArray.push(treeNode);

            // 查找子节点（通过extends关系）
            const childIds = parentToChildren.get(id) || [];
            for (const childId of childIds) {
              if (!visited.has(childId)) {
                queue.push({
                  id: childId,
                  depth: depth + 1,
                  parentArray: treeNode.children!
                });
              }
            }
          }
        }

        return {
          roots: roots,
          relations: allRelations
        };
      } catch (error) {
        console.error('[buildTree] Error building tree:', error);
        // 出错时返回空树，避免前端崩溃
        return {
          roots: [],
          relations: []
        };
      }
    });

    // Backup operations
    ipcMain.handle('backup:list', async () => {
      return await this.backupManager?.listBackups() || [];
    });

    ipcMain.handle('backup:create', async () => {
      return await this.backupManager?.createBackup();
    });

    ipcMain.handle('backup:getCurrentBackupStatus', async () => {
      if (!this.backupManager) {
        return {
          lastBackupTime: '',
          nextBackupTime: '',
          backupEnabled: false
        };
      }

      return await this.backupManager.getBackupStatus();
    });

    // Settings - Data folder operations
    ipcMain.handle('settings:getDbPath', async () => {
      return this.settingsManager.getDbPath();
    });

    // Settings - Data folder operations

    ipcMain.handle('storage:getMode', async () => {
      return {
        mode: 'file', // Simplified: always use file storage
        path: this.fileStorageManager?.getStoragePath() || null
      };
    });

    ipcMain.handle('storage:setMode', async (_, mode: 'database' | 'file', storagePath?: string) => {
      try {
        if (mode === 'file' && !storagePath) {
          throw new Error('Storage path is required for file storage mode');
        }

        // 更新设置
        await this.settingsManager.updateSettings({
          storageMode: mode,
          ...(mode === 'file' && storagePath ? { storagePath } : {})
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Settings - Data folder operations
    ipcMain.handle('settings:openDataFolder', async () => {
      try {
        const settingsPath = this.settingsManager.getDbPath();
        const dataFolder = path.dirname(settingsPath);
        await shell.openPath(dataFolder);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 调试工具相关
    ipcMain.handle('debug:checkDataIntegrity', async () => {
      console.log('[debug:checkDataIntegrity] Data integrity check requested');
      if (!this.fileStorageManager) {
        console.warn('[debug:checkDataIntegrity] File storage not initialized');
        return { success: false, error: 'File storage not initialized' };
      }

      // TODO: Implement actual data integrity check
      return { success: true, message: 'Data integrity check not yet implemented' };
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


    // 流程图文件操作
    ipcMain.handle('flowchart:save', async (_, flowchartData: any) => {
      try {
        // 直接保存流程图数据
        this.flowchartFileManager.saveFlowchartData(flowchartData.schema.id, flowchartData);
        console.log(`[Flowchart] Saved flowchart: ${flowchartData.schema.id} with ${flowchartData.nodes.length} nodes and ${flowchartData.edges.length} edges`);
        return { success: true };
      } catch (error) {
        console.error('Error saving flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:load', async (_, flowchartId: string) => {
      try {
        const flowchartData = this.flowchartFileManager.getFlowchartData(flowchartId);

        if (!flowchartData) {
          return null;
        }

        console.log(`[Flowchart] Loaded flowchart: ${flowchartId}, nodes: ${flowchartData.nodes.length}, edges: ${flowchartData.edges.length}`);
        return flowchartData;
      } catch (error) {
        console.error('Error loading flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:list', async () => {
      try {
        const flowcharts = this.flowchartFileManager.getAllFlowcharts();
        console.log(`[Flowchart] Listed ${flowcharts.length} flowcharts`);
        return flowcharts;
      } catch (error) {
        console.error('Error listing flowcharts:', error);
        return [];
      }
    });

    ipcMain.handle('flowchart:delete', async (_, flowchartId: string) => {
      try {
        this.flowchartFileManager.deleteFlowchart(flowchartId);
        this.flowchartTodoAssociationManager.deleteAssociationsByFlowchart(flowchartId);
        console.log(`[Flowchart] Deleted flowchart: ${flowchartId}`);
        return { success: true };
      } catch (error) {
        console.error('Error deleting flowchart:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart:savePatches', async (_, flowchartId: string, patches: any[]) => {
      try {
        // 获取当前流程图数据
        const flowchartData = this.flowchartFileManager.getFlowchartData(flowchartId);
        if (!flowchartData) {
          throw new Error(`Flowchart not found: ${flowchartId}`);
        }

        // 手动处理每个patch
        for (const patch of patches) {
          switch (patch.action) {
            case 'upsert':
              if (patch.type === 'node') {
                const nodeIndex = flowchartData.nodes.findIndex(n => n.id === patch.data.id);
                if (nodeIndex !== -1) {
                  flowchartData.nodes[nodeIndex] = { ...flowchartData.nodes[nodeIndex], ...patch.data };
                } else {
                  flowchartData.nodes.push(patch.data);
                }
              } else if (patch.type === 'edge') {
                const edgeIndex = flowchartData.edges.findIndex(e => e.id === patch.data.id);
                if (edgeIndex !== -1) {
                  flowchartData.edges[edgeIndex] = { ...flowchartData.edges[edgeIndex], ...patch.data };
                } else {
                  flowchartData.edges.push(patch.data);
                }
              }
              break;
            case 'delete':
              if (patch.type === 'node') {
                flowchartData.nodes = flowchartData.nodes.filter(n => n.id !== patch.data.id);
              } else if (patch.type === 'edge') {
                flowchartData.edges = flowchartData.edges.filter(e => e.id !== patch.data.id);
              }
              break;
          }
        }

        // 保存更新后的数据
        this.flowchartFileManager.saveFlowchartData(flowchartId, flowchartData);

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
        const associations = this.flowchartTodoAssociationManager.getAssociationsByFlowchart(flowchartId);
        const todoIds = associations.map(a => a.todo_id);

        console.log(`[FlowchartAssociation] Queried ${associations.length} todos for flowchart: ${flowchartId}`);
        return todoIds;
      } catch (error) {
        console.error('Error querying flowchart associations:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-todo-association:create', async (_, flowchartId: string, todoId: string) => {
      try {
        this.flowchartTodoAssociationManager.createAssociation({
          flowchart_id: flowchartId,
          todo_id: todoId
        });

        console.log(`[FlowchartAssociation] Created association: flowchart=${flowchartId}, todo=${todoId}`);
      } catch (error) {
        console.error('Error creating flowchart association:', error);
        throw error;
      }
    });

    ipcMain.handle('flowchart-todo-association:delete', async (_, flowchartId: string, todoId: string) => {
      try {
        const associations = this.flowchartTodoAssociationManager.getAssociationsByFlowchart(flowchartId);
        const association = associations.find(a => a.todo_id === todoId);
        if (association) {
          this.flowchartTodoAssociationManager.deleteAssociation(association.id);
        }

        console.log(`[FlowchartAssociation] Deleted association: flowchart=${flowchartId}, todo=${todoId}`);
      } catch (error) {
        console.error('Error deleting flowchart association:', error);
        throw error;
      }
    });

    // 流程图待办关联查询
    ipcMain.handle('flowchart:getAssociationsByTodoIds', async (_, todoIds: number[]) => {
      try {
        // 获取所有相关的关联关系
        const allAssociations = await Promise.all(
          todoIds.map(todoId => this.flowchartTodoAssociationManager.getAssociationsByTodo(todoId.toString()))
        );

        // 构建associationsMap
        const associationsMap = new Map<number, any[]>();
        todoIds.forEach((todoId, index) => {
          associationsMap.set(todoId, allAssociations[index]);
        });

        // 获取流程图名称映射
        const flowchartMap = new Map<string, string>();
        const flowcharts = this.flowchartFileManager.getAllFlowcharts();
        for (const flowchart of flowcharts) {
          flowchartMap.set(flowchart.id, flowchart.name);
        }

        // 将Map转换为Record<number, Array<...>>格式，使用实际可用的字段
        const result: Record<number, Array<{
          flowchartId: string;
          flowchartName: string;
          nodeId: string;
          nodeLabel: string;
        }>> = {};

        associationsMap.forEach((associations, todoId) => {
          result[todoId] = associations.map(assoc => ({
            flowchartId: assoc.flowchart_id,
            flowchartName: flowchartMap.get(assoc.flowchart_id) || '',
            nodeId: assoc.flowchart_id, // 使用flowchartId作为nodeId
            nodeLabel: flowchartMap.get(assoc.flowchart_id) || '' // 使用flowchartName作为nodeLabel
          }));
        });

        console.log(`[Flowchart] Retrieved associations for ${todoIds.length} todos`);

        return result;
      } catch (error) {
        console.error('Error getting flowchart associations by todo ids:', error);
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
          source: 'database' as const,
          unchanged: false
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
        return { success: true, successCount: result.successCount || 0, failedCount: result.failedCount || 0 };
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
        // 获取所有待办事项
        const todos = await this.databaseManager.getStorageManager().getAllTodos();

        // 提取所有URL
        const urlPattern = /(https?:\/\/[^\s<>"]+)/g;
        const urlMap = new Map<string, { todoId: string; url: string }>();

        todos.forEach(todo => {
          if (!todo.content) return;

          let match: RegExpExecArray | null;
          // Reset regex state for each todo
          urlPattern.lastIndex = 0;
          while ((match = urlPattern.exec(todo.content)) !== null) {
            const url = match[1];
            // 去重（保留第一次出现）
            if (!urlMap.has(url)) {
              urlMap.set(url, { todoId: String(todo.id || 'unknown'), url });
            }
          }
        });

        // 获取已授权的URL（临时简化实现）
        const authorizedRecords = new Map<string, any>();

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
        const { BatchAuthorizationService } = await import('./services/BatchAuthorizationServiceFile');

        // 创建临时 BatchAuthorizationService 实例
        const batchAuthService = new BatchAuthorizationService(this.urlAuthService.getAuthSession());

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

        const { BatchAuthorizationService } = await import('./services/BatchAuthorizationServiceFile');

        // 创建临时 BatchAuthorizationService 实例
        const batchAuthService = new BatchAuthorizationService(this.urlAuthService.getAuthSession());

        const task = await batchAuthService.getActiveTask(domain);
        return { success: true, task };
      } catch (error) {
        console.error('Failed to get batch task status:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 更多 IPC 处理器将在这里添加
  }

  /**
   * ✅ 新增：加载应用配置
   */
  private async loadAppConfig(): Promise<void> {
    try {
      const { appConfigManager } = await import('./config/AppConfig');
      this.appConfig = appConfigManager;
      console.log('[Startup] App config loaded:', {
        firstRun: appConfigManager.isFirstRun(),
        storageLocation: appConfigManager.getStorageLocation()
      });
    } catch (error) {
      console.error('[Startup] Failed to load app config:', error);
      // 如果配置加载失败，创建默认配置
      const { appConfigManager } = await import('./config/AppConfig');
      this.appConfig = appConfigManager;
    }
  }

  /**
   * ✅ 新增：显示首次运行对话框（已禁用，将在React组件中实现）
   * 注意：此功能暂时禁用，首次运行用户将使用默认配置
   * 未来将在App.tsx中通过React组件实现首次运行对话框
   */
  private async showFirstRunDialog(): Promise<any> {
    // 临时修复：直接返回默认配置，不显示对话框
    // TODO: 在React组件中实现真正的首次运行对话框
    console.log('[Startup] First run detected, using default configuration...');
    return {
      type: 'default',
      customPath: undefined
    };
  }

  /**
   * ✅ 新增：验证存储位置
   */
  private async validateStorageLocation(): Promise<boolean> {
    try {
      if (!this.appConfig) {
        console.warn('[Startup] App config not loaded, skipping validation');
        return true;
      }

      // 在 Markdown 模式下，存储位置由 FileStorageManager 管理
      console.log('[Startup] Using Markdown file storage, storage location validation skipped');
      return true;
    } catch (error) {
      console.error('[Startup] Failed to validate storage location:', error);
      return false;
    }
  }

  /**
   * ✅ 新增：处理存储位置问题（已简化）
   * 注意：此功能已简化，数据库丢失时将创建新数据库
   * 未来将在React组件中实现完整的恢复对话框
   */
  private async handleStorageLocationIssue(): Promise<void> {
    try {
      console.log('[Startup] Handling storage location issue...');

      if (!this.appConfig || !this.storageLocationService) {
        console.error('[Startup] Required services not available');
        return;
      }

      const storageLocation = this.appConfig.getStorageLocation();
      console.log('[Startup] Current storage location:', storageLocation);

      // 简化处理：记录警告日志，让应用继续启动
      // 数据库管理器会自动创建新的数据库文件
      console.warn('[Startup] Database file not found, will create new database on initialization');

      // TODO: 在React组件中实现完整的恢复对话框
      // 包括：从备份恢复、重新定位数据库、更改存储位置等选项

    } catch (error) {
      console.error('[Startup] Failed to handle storage location issue:', error);
      // 即使处理失败，也让应用继续启动
    }
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

      // === 文件存储兼容性检查 ===
      console.log('Running file storage compatibility check...');
      await this.checkFileStorageCompatibility();

      // ✅ 新增：加载应用配置
      console.log('Loading app configuration...');
      await this.loadAppConfig();

      // ✅ 新增：检查首次运行（已简化）
      if (this.appConfig && this.appConfig.isFirstRun()) {
        console.log('[Startup] First run detected, using default configuration...');

        // 使用默认配置
        const defaultConfig = {
          type: 'default',
          customPath: undefined
        };

        this.appConfig.setStorageLocation(defaultConfig.type, defaultConfig.customPath);
        this.appConfig.setFirstRunComplete();
        console.log('[Startup] First-run setup completed with default configuration');

        // TODO: 在React组件的App.tsx中实现真正的首次运行对话框
        // 用户可以在应用运行时通过设置页面更改存储位置
      }

      // ✅ 新增：验证存储位置（已简化）
      if (this.appConfig && !this.appConfig.isFirstRun()) {
        console.log('[Startup] Validating storage location...');
        const isValid = await this.validateStorageLocation();

        if (!isValid) {
          console.warn('[Startup] Storage location validation failed, will create new database...');
          await this.handleStorageLocationIssue();
        }
      }

      // 初始化设置管理器（轻量级，仅用于设置）
      console.log('Initializing settings manager...');
      try {
        await this.settingsManager.initialize();
        console.log('Settings manager initialized successfully');
      } catch (settingsError) {
        console.error('Settings manager initialization failed:', settingsError);
        throw settingsError;
      }

      // 初始化数据库管理器
      console.log('Initializing database manager...');
      try {
        await this.databaseManager.initialize();
        this.backupManager = this.databaseManager.getCurrentBackupManager();
        console.log('Database manager initialized successfully');
      } catch (dbError) {
        console.error('Database manager initialization failed:', dbError);
        // 降级为简单的备份管理器
        const storagePath = this.databaseManager.getStorageManager().getStoragePath();
        this.backupManager = new BackupManager(storagePath, this.fileStorageManager);
        this.backupManager.startAutoBackup();
        console.log('Fallback backup manager initialized');
      }




      // Initialize URL auth service (simplified)
      console.log('Initializing URL auth service...');
      this.urlAuthService = new URLAuthService();
      console.log('URL auth service initialized successfully');

      // Initialize URL authorization service (stub)
      console.log('Initializing URL authorization service...');
      this.urlAuthorizationService = new URLAuthorizationService(this.fileStorageManager);
      this.urlAuthService.setURLAuthorizationService(this.urlAuthorizationService, this.fileStorageManager);
      console.log('URL authorization service initialized successfully');

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
      // TODO: createTray方法调用暂时禁用
      // this.createTray();
      console.log('System tray created successfully');

      // 注册全局快捷键
      console.log('Registering global shortcuts...');
      // TODO: registerGlobalShortcuts方法调用暂时禁用
      // this.registerGlobalShortcuts();
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
    app.on('will-quit', async () => {
      globalShortcut.unregisterAll();
      this.backupManager?.stopAutoBackup();

      // 清理数据库管理器
      await this.databaseManager.shutdown();

      // this.authorizationRefreshScheduler?.stop(); // 暂时禁用
      console.log('Global shortcuts unregistered and backup stopped');
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
