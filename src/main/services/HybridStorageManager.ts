// 混合存储管理器 - 支持双存储模式（数据库 + Markdown文件）
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { FileStorageManager } from '../FileStorageManager';
import { Todo } from '../../shared/types';

/**
 * 存储模式类型
 */
export type StorageMode = 'database' | 'file';

/**
 * 存储统计信息
 */
export interface StorageStats {
  mode: StorageMode;
  databaseCount: number;
  fileCount: number;
  totalCount: number;
  databasePath: string;
  filePath: string;
}

/**
 * 文件变化事件
 */
export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  filePath: string;
  todo?: Todo;
}

/**
 * 混合存储管理器配置
 */
export interface HybridStorageConfig {
  currentMode: StorageMode;
  databasePath: string;
  filePath: string;
  enableFileSync: boolean;
  conflictResolution: 'latest' | 'database' | 'file';
}

/**
 * 混合存储管理器 - 核心实现
 */
export class HybridStorageManager {
  private dbManager: DatabaseManager;
  private fileManager: FileStorageManager | null = null;
  private config: HybridStorageConfig;
  private fileWatcher: any = null;
  private cache: Map<number, Todo> = new Map();
  private cacheTimestamp: number = 0;

  constructor(dbManager: DatabaseManager, config: HybridStorageConfig) {
    this.dbManager = dbManager;
    this.config = config;

    // 如果是文件模式，初始化文件管理器
    if (config.filePath) {
      this.initializeFileManager();
    }
  }

  /**
   * 初始化文件管理器
   */
  private async initializeFileManager(): Promise<void> {
    try {
      if (this.config.filePath && fs.existsSync(this.config.filePath)) {
        this.fileManager = new FileStorageManager(this.config.filePath);
        console.log('[HybridStorage] File manager initialized');
      }
    } catch (error) {
      console.error('[HybridStorage] Failed to initialize file manager:', error);
      this.fileManager = null;
    }
  }

  /**
   * 更新配置
   */
  public async updateConfig(newConfig: Partial<HybridStorageConfig>): Promise<void> {
    const oldMode = this.config.currentMode;
    this.config = { ...this.config, ...newConfig };

    // 如果存储模式改变，需要重新初始化
    if (newConfig.currentMode && newConfig.currentMode !== oldMode) {
      console.log(`[HybridStorage] Storage mode changed: ${oldMode} -> ${newConfig.currentMode}`);
      await this.initializeFileManager();

      // 新增：当切换到file模式时，触发索引重建
      if (newConfig.currentMode === 'file') {
        await this.rebuildFileIndex();
      }
    }

    // 如果文件路径改变，重新初始化文件管理器并重建索引
    if (newConfig.filePath) {
      await this.initializeFileManager();
      await this.rebuildFileIndex();
    }
  }

  /**
   * 重建文件索引
   * 用于配置变更时确保现有MD文件被正确加载
   */
  private async rebuildFileIndex(): Promise<void> {
    try {
      if (!this.config.filePath) {
        console.warn('[HybridStorage] File path not configured, skipping index rebuild');
        return;
      }

      console.log('[HybridStorage] Rebuilding file index...');
      console.log(`[HybridStorage] Indexing path: ${this.config.filePath}`);

      // 使用FileIndexer重建索引
      const { FileIndexer } = await import('../FileIndexer');
      const tempIndexer = new FileIndexer(this.config.filePath);
      await tempIndexer.buildIndex();

      console.log('[HybridStorage] ✅ File index rebuilt successfully');
    } catch (error) {
      console.error('[HybridStorage] ❌ Failed to rebuild file index:', error);
      // 不抛出错误，避免阻塞配置切换
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): HybridStorageConfig {
    return { ...this.config };
  }

  /**
   * 创建待办（只使用当前存储类型）
   */
  public async createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    console.log(`[HybridStorage] Creating todo in ${this.config.currentMode} mode`);

    if (this.config.currentMode === 'database') {
      // 数据库模式：使用数据库管理器
      const result = await this.dbManager.createTodo(todo);
      this.invalidateCache();
      return result;
    } else {
      // 文件模式：使用文件管理器
      if (!this.fileManager) {
        throw new Error('File manager not initialized');
      }
      // FileStorageManager使用uuid（string）而不是id（number）
      const fileTodo = { ...todo, id: undefined as any };
      const result = await this.fileManager.createTodo(fileTodo as any);
      this.invalidateCache();
      return result;
    }
  }

  /**
   * 更新待办（只使用当前存储类型）
   */
  public async updateTodo(id: number, updates: Partial<Todo>): Promise<void> {
    console.log(`[HybridStorage] Updating todo ${id} in ${this.config.currentMode} mode`);

    if (this.config.currentMode === 'database') {
      await this.dbManager.updateTodo(id, updates);
    } else {
      if (this.fileManager) {
        // FileStorageManager使用uuid（string），需要转换
        const fileTodo = await this.dbManager.getTodoById(id);
        if (fileTodo && fileTodo.contentHash) {
          // 使用contentHash作为uuid
          await this.fileManager.updateTodo(fileTodo.contentHash, updates);
        } else {
          throw new Error(`Todo ${id} not found or has no contentHash`);
        }
      } else {
        // 降级到数据库
        await this.dbManager.updateTodo(id, updates);
      }
    }
    this.invalidateCache();
  }

  /**
   * 删除待办（两个存储都删除）
   */
  public async deleteTodo(id: number): Promise<void> {
    console.log(`[HybridStorage] Deleting todo ${id} from both storages`);

    // 从数据库删除
    await this.dbManager.deleteTodo(id);

    // 从文件存储删除（如果存在）
    if (this.fileManager) {
      try {
        // FileStorageManager使用uuid（string），需要转换
        const fileTodo = await this.dbManager.getTodoById(id);
        if (fileTodo && fileTodo.contentHash) {
          await this.fileManager.deleteTodo(fileTodo.contentHash);
        }
      } catch (error) {
        console.warn(`[HybridStorage] Failed to delete todo ${id} from file storage:`, error);
      }
    }

    this.invalidateCache();
  }

  /**
   * 获取所有待办（双存储合并）
   */
  public async getAllTodos(): Promise<Todo[]> {
    // 检查缓存（5秒有效期）
    if (this.cache.size > 0 && Date.now() - this.cacheTimestamp < 5000) {
      console.log('[HybridStorage] Returning cached todos');
      return Array.from(this.cache.values());
    }

    console.log('[HybridStorage] Fetching todos from both storages');

    try {
      // 从数据库获取
      const dbTodos = await this.dbManager.getAllTodos();
      const dbTodoMap = new Map(dbTodos.map(todo => [Number(todo.id), todo]));

      // 从文件存储获取（如果可用）
      let fileTodos: Todo[] = [];
      if (this.fileManager) {
        try {
          fileTodos = await this.fileManager.getAllTodos();
        } catch (error) {
          console.warn('[HybridStorage] Failed to get todos from file storage:', error);
        }
      }
      const fileTodoMap = new Map(fileTodos.map(todo => [Number(todo.id), todo]));

      // 合并数据
      const mergedTodos = this.mergeTodos(dbTodoMap, fileTodoMap);

      // 更新缓存
      this.cache = new Map(mergedTodos.map(todo => [Number(todo.id), todo]));
      this.cacheTimestamp = Date.now();

      console.log(`[HybridStorage] Merged ${dbTodoMap.size} DB todos + ${fileTodoMap.size} file todos = ${mergedTodos.length} total`);

      return mergedTodos;
    } catch (error) {
      console.error('[HybridStorage] Error getting all todos:', error);
      // 降级：只返回数据库数据
      return await this.dbManager.getAllTodos();
    }
  }

  /**
   * 根据ID获取待办（双存储查找）
   */
  public async getTodoById(id: number): Promise<Todo | null> {
    // 先检查缓存
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    console.log(`[HybridStorage] Getting todo ${id} from both storages`);

    try {
      // 从数据库获取
      const dbTodo = await this.dbManager.getTodoById(id);

      // 从文件存储获取（如果可用）
      let fileTodo: Todo | null = null;
      if (this.fileManager) {
        try {
          // FileStorageManager使用uuid（string），需要转换
          const dbTodoForUuid = await this.dbManager.getTodoById(id);
          if (dbTodoForUuid && dbTodoForUuid.contentHash) {
            fileTodo = await this.fileManager.getTodoById(dbTodoForUuid.contentHash);
          }
        } catch (error) {
          console.warn(`[HybridStorage] Failed to get todo ${id} from file storage:`, error);
        }
      }

      // 冲突解决：选择最新的数据
      if (dbTodo && fileTodo) {
        const resolved = this.resolveConflict(dbTodo, fileTodo);
        this.cache.set(id, resolved);
        return resolved;
      } else if (dbTodo) {
        this.cache.set(id, dbTodo);
        return dbTodo;
      } else if (fileTodo) {
        this.cache.set(id, fileTodo);
        return fileTodo;
      }

      return null;
    } catch (error) {
      console.error(`[HybridStorage] Error getting todo ${id}:`, error);
      return null;
    }
  }

  /**
   * 合并两个存储源的数据
   */
  private mergeTodos(
    dbTodoMap: Map<number, Todo>,
    fileTodoMap: Map<number, Todo>
  ): Todo[] {
    const allIds = new Set([...dbTodoMap.keys(), ...fileTodoMap.keys()]);
    const mergedTodos: Todo[] = [];

    for (const id of allIds) {
      const dbTodo = dbTodoMap.get(id);
      const fileTodo = fileTodoMap.get(id);

      if (dbTodo && fileTodo) {
        // 两个存储都存在：冲突解决
        const resolved = this.resolveConflict(dbTodo, fileTodo);
        mergedTodos.push(resolved);
      } else if (dbTodo) {
        // 只在数据库中存在
        mergedTodos.push(dbTodo);
      } else if (fileTodo) {
        // 只在文件中存在
        mergedTodos.push(fileTodo);
      }
    }

    // 按更新时间排序
    return mergedTodos.sort((a, b) => {
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return timeB - timeA;
    });
  }

  /**
   * 冲突解决：选择最新的数据
   */
  private resolveConflict(dbTodo: Todo, fileTodo: Todo): Todo {
    const dbTime = new Date(dbTodo.updatedAt).getTime();
    const fileTime = new Date(fileTodo.updatedAt).getTime();

    // 根据配置决定冲突解决策略
    switch (this.config.conflictResolution) {
      case 'database':
        return dbTodo;
      case 'file':
        return fileTodo;
      case 'latest':
      default:
        // 默认：选择最新修改的数据
        return dbTime >= fileTime ? dbTodo : fileTodo;
    }
  }

  /**
   * 获取存储统计信息
   */
  public async getStorageStats(): Promise<StorageStats> {
    try {
      const dbTodos = await this.dbManager.getAllTodos();
      let fileTodos: Todo[] = [];

      if (this.fileManager) {
        try {
          fileTodos = await this.fileManager.getAllTodos();
        } catch (error) {
          console.warn('[HybridStorage] Failed to get file storage stats:', error);
        }
      }

      return {
        mode: this.config.currentMode,
        databaseCount: dbTodos.length,
        fileCount: fileTodos.length,
        totalCount: Math.max(dbTodos.length, fileTodos.length),
        databasePath: this.dbManager.getDbPath(),
        filePath: this.config.filePath || 'Not configured'
      };
    } catch (error) {
      console.error('[HybridStorage] Error getting storage stats:', error);
      return {
        mode: this.config.currentMode,
        databaseCount: 0,
        fileCount: 0,
        totalCount: 0,
        databasePath: this.dbManager.getDbPath(),
        filePath: this.config.filePath || 'Not configured'
      };
    }
  }

  /**
   * 刷新缓存
   */
  public invalidateCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
    console.log('[HybridStorage] Cache invalidated');
  }

  /**
   * 扫描Markdown文件
   */
  public async scanMarkdownFiles(): Promise<string[]> {
    if (!this.config.filePath || !fs.existsSync(this.config.filePath)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.config.filePath);
      const mdFiles = files.filter(file => file.endsWith('.md') && file !== '.multitodo-metadata');

      console.log(`[HybridStorage] Found ${mdFiles.length} markdown files`);
      return mdFiles.map(file => path.join(this.config.filePath, file));
    } catch (error) {
      console.error('[HybridStorage] Error scanning markdown files:', error);
      return [];
    }
  }

  /**
   * 导入Markdown文件
   */
  public async importMarkdownFile(filePath: string): Promise<Todo> {
    if (!this.fileManager) {
      throw new Error('File manager not initialized');
    }

    console.log(`[HybridStorage] Importing markdown file: ${filePath}`);

    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');

      // 解析Markdown为Todo
      const todo = this.parseMarkdownToTodo(content, filePath);

      // 创建待办
      const result = await this.createTodo(todo);

      console.log(`[HybridStorage] Imported todo ${result.id} from markdown file`);
      return result;
    } catch (error) {
      console.error(`[HybridStorage] Error importing markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 解析Markdown为Todo
   */
  private parseMarkdownToTodo(content: string, filePath: string): Omit<Todo, 'id' | 'createdAt' | 'updatedAt'> {
    const lines = content.split('\n');
    const frontMatter: Record<string, string> = {};
    let title = '';
    let description = '';
    let inFrontMatter = true;

    // 解析Front Matter
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#') && !inFrontMatter) {
        // 标题行
        title = line.replace(/^#+\s*/, '');
        inFrontMatter = false;
      } else if (line.includes('::') && inFrontMatter) {
        // Front Matter 属性
        const [key, ...valueParts] = line.split('::');
        const value = valueParts.join('::').trim();
        frontMatter[key.trim()] = value;
      } else if (line.trim() === '' && inFrontMatter) {
        // Front Matter 结束
        inFrontMatter = false;
      } else if (!inFrontMatter) {
        // 描述内容
        description += line + '\n';
      }
    }

    // 如果没有标题，使用文件名
    if (!title) {
      title = path.basename(filePath, '.md');
    }

    return {
      title: title || 'Untitled',
      content: description.trim(),
      status: (frontMatter['状态'] as any) || 'pending',
      priority: (frontMatter['优先级'] as any) || 'medium',
      tags: frontMatter['标签'] || '',
      startTime: frontMatter['开始时间'] || undefined,
      deadline: frontMatter['截止日期'] || undefined,
      displayOrder: undefined,
      displayOrders: {},
      contentHash: '',
      keywords: [],
      completedAt: undefined
    };
  }

  /**
   * 导出待办为Markdown文件
   */
  public async exportTodoAsMarkdown(todoId: number): Promise<string> {
    const todo = await this.getTodoById(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    if (!this.config.filePath) {
      throw new Error('File storage path not configured');
    }

    // 生成Markdown内容
    const markdown = this.generateMarkdownFromTodo(todo);

    // 保存到文件
    const fileName = `${todo.title.replace(/[<>:"/\\|?*]/g, '_')}.md`;
    const filePath = path.join(this.config.filePath, fileName);

    fs.writeFileSync(filePath, markdown, 'utf-8');

    console.log(`[HybridStorage] Exported todo ${todoId} to ${filePath}`);
    return filePath;
  }

  /**
   * 从Todo生成Markdown
   */
  private generateMarkdownFromTodo(todo: Todo): string {
    let markdown = '';

    // Front Matter
    markdown += '---\n';
    if (todo.status) markdown += `状态:: ${todo.status}\n`;
    if (todo.priority) markdown += `优先级:: ${todo.priority}\n`;
    if (todo.tags) markdown += `标签:: ${todo.tags}\n`;
    if (todo.startTime) markdown += `开始时间:: ${todo.startTime}\n`;
    if (todo.deadline) markdown += `截止日期:: ${todo.deadline}\n`;
    markdown += '---\n\n';

    // 标题
    markdown += `# ${todo.title}\n\n`;

    // 内容
    if (todo.content) {
      markdown += `${todo.content}\n`;
    }

    return markdown;
  }

  /**
   * 关闭管理器
   */
  public close(): void {
    this.invalidateCache();
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }
}