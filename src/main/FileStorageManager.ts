import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as chokidar from 'chokidar';
import MiniSearch from 'minisearch';
import { Todo, TodoRelation, Settings } from '../shared/types';
import { MarkdownParser } from './MarkdownParser';
import { FileIndexer, TodoIndexEntry } from './FileIndexer';

/**
 * 文件存储管理器
 * 替代 DatabaseManager，提供基于文件系统的数据存储
 */
export class FileStorageManager {
  private storagePath: string;
  private markdownParser: MarkdownParser;
  private fileIndexer: FileIndexer;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private cache: Map<string, { todo: Todo; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 100;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(app.getPath('userData'), 'todos');
    this.markdownParser = new MarkdownParser();
    this.fileIndexer = new FileIndexer(this.storagePath);
    this.initializeStorage();
  }

  /**
   * 初始化存储目录结构
   */
  private async initializeStorage(): Promise<void> {
    const dirs = [
      this.storagePath,
      path.join(this.storagePath, '.multitodo-metadata'),
      path.join(this.storagePath, '.multitodo-metadata', 'flowcharts'),
      path.join(this.storagePath, '.multitodo-metadata', 'templates')
    ];

    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // 初始化索引
    await this.fileIndexer.loadIndex();

    // 启动文件监听
    this.startFileWatcher();
  }

  // ==================== Todo CRUD 操作 ====================

  /**
   * 创建待办
   */
  async createTodo(todo: Omit<Todo, 'id'>): Promise<Todo> {
    const uuid = uuidv4();
    const newTodo: Todo = {
      ...todo,
      id: uuid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const todoDir = path.join(this.storagePath, `todo-${uuid}`);
    await fs.promises.mkdir(todoDir, { recursive: true });

    // 创建 assets 目录
    const assetsDir = path.join(todoDir, 'assets');
    await fs.promises.mkdir(assetsDir, { recursive: true });

    // 生成并保存 Markdown 文件
    const markdown = this.markdownParser.generateTodo(newTodo);
    const todoPath = path.join(todoDir, 'todo.md');
    await this.atomicWrite(todoPath, markdown);

    // 保存元数据
    await this.saveMetadata(todoDir, newTodo);

    // 更新索引
    await this.fileIndexer.addTodo(newTodo);

    // 更新缓存
    this.updateCache(uuid, newTodo);

    return newTodo;
  }

  /**
   * 根据 UUID 获取待办
   */
  async getTodoById(uuid: string): Promise<Todo | null> {
    // 检查缓存
    const cached = this.getFromCache(uuid);
    if (cached) {
      return cached;
    }

    const todoPath = path.join(this.storagePath, `todo-${uuid}`, 'todo.md');
    if (!fs.existsSync(todoPath)) {
      return null;
    }

    try {
      const markdown = await fs.promises.readFile(todoPath, 'utf-8');
      const todo = this.markdownParser.parseTodo(markdown);

      // 更新缓存
      this.updateCache(uuid, todo);

      return todo;
    } catch (error) {
      console.error(`Error reading todo ${uuid}:`, error);
      return null;
    }
  }

  /**
   * 获取所有待办
   */
  async getAllTodos(): Promise<Todo[]> {
    const entries = await this.fileIndexer.getAllTodos();
    const todos: Todo[] = [];

    for (const entry of entries) {
      const todo = await this.getTodoById(entry.uuid);
      if (todo) {
        todos.push(todo);
      }
    }

    return todos;
  }

  /**
   * 更新待办
   */
  async updateTodo(uuid: string, updates: Partial<Todo>): Promise<void> {
    const currentTodo = await this.getTodoById(uuid);
    if (!currentTodo) {
      throw new Error(`Todo not found: ${uuid}`);
    }

    const updatedTodo: Todo = {
      ...currentTodo,
      ...updates,
      id: uuid, // 确保 ID 不被覆盖
      updatedAt: new Date().toISOString()
    };

    const todoPath = path.join(this.storagePath, `todo-${uuid}`, 'todo.md');
    const markdown = this.markdownParser.generateTodo(updatedTodo);

    await this.atomicWrite(todoPath, markdown);
    await this.saveMetadata(path.dirname(todoPath), updatedTodo);

    // 更新索引
    await this.fileIndexer.updateTodo(updatedTodo);

    // 更新缓存
    this.updateCache(uuid, updatedTodo);
  }

  /**
   * 删除待办
   */
  async deleteTodo(uuid: string): Promise<void> {
    const todoDir = path.join(this.storagePath, `todo-${uuid}`);

    if (fs.existsSync(todoDir)) {
      await fs.promises.rm(todoDir, { recursive: true, force: true });
    }

    // 从索引中删除
    await this.fileIndexer.removeTodo(uuid);

    // 从缓存中删除
    this.cache.delete(uuid);
  }

  // ==================== 批量操作 ====================

  /**
   * 批量更新待办
   */
  async bulkUpdateTodos(updates: Array<{uuid: string; updates: Partial<Todo>}>): Promise<void> {
    for (const { uuid, updates: todoUpdates } of updates) {
      await this.updateTodo(uuid, todoUpdates);
    }
  }

  /**
   * 批量删除待办
   */
  async bulkDeleteTodos(uuids: string[]): Promise<void> {
    for (const uuid of uuids) {
      await this.deleteTodo(uuid);
    }
  }

  /**
   * 批量更新显示顺序
   */
  async batchUpdateDisplayOrders(
    updates: Array<{uuid: string; tabKey: string; displayOrder: number}>
  ): Promise<void> {
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
      const todo = await this.getTodoById(uuid);
      if (todo) {
        const newDisplayOrders = todo.displayOrders || {};
        displayOrders.forEach(({ tabKey, displayOrder }) => {
          newDisplayOrders[tabKey] = displayOrder;
        });

        await this.updateTodo(uuid, { displayOrders: newDisplayOrders });
      }
    }
  }

  // ==================== 搜索操作 ====================

  /**
   * 搜索待办
   */
  async searchTodos(keyword: string): Promise<Todo[]> {
    const results = await this.fileIndexer.search(keyword);
    const todos: Todo[] = [];

    for (const result of results) {
      const todo = await this.getTodoById(result.uuid);
      if (todo) {
        todos.push(todo);
      }
    }

    return todos;
  }

  /**
   * 高级搜索
   */
  async advancedSearch(options: {
    keyword?: string;
    status?: string;
    priority?: string;
    tags?: string[];
    dateRange?: { start?: string; end?: string };
  }): Promise<Todo[]> {
    let results = await this.fileIndexer.getAllTodos();

    // 关键词搜索
    if (options.keyword) {
      const searchResults = await this.fileIndexer.search(options.keyword);
      const searchUuids = new Set(searchResults.map(r => r.uuid));
      results = results.filter(r => searchUuids.has(r.uuid));
    }

    // 状态过滤
    if (options.status) {
      results = results.filter(r => r.status === options.status);
    }

    // 优先级过滤
    if (options.priority) {
      results = results.filter(r => r.priority === options.priority);
    }

    // 标签过滤
    if (options.tags && options.tags.length > 0) {
      results = results.filter(r =>
        options.tags!.some(tag => r.tags.includes(tag))
      );
    }

    // 日期范围过滤
    if (options.dateRange) {
      if (options.dateRange.start) {
        const startDate = new Date(options.dateRange.start);
        results = results.filter(r => new Date(r.createdAt) >= startDate);
      }
      if (options.dateRange.end) {
        const endDate = new Date(options.dateRange.end);
        results = results.filter(r => new Date(r.createdAt) <= endDate);
      }
    }

    // 加载完整的待办数据
    const todos: Todo[] = [];
    for (const entry of results) {
      const todo = await this.getTodoById(entry.uuid);
      if (todo) {
        todos.push(todo);
      }
    }

    return todos;
  }

  // ==================== 关系管理 ====================

  /**
   * 创建关系
   */
  async createRelation(relation: TodoRelation): Promise<TodoRelation> {
    const relations = await this.getAllRelations();

    // 检查是否已存在相同关系
    const exists = relations.some(
      r => r.source_id === relation.source_id &&
           r.target_id === relation.target_id &&
           r.relation_type === relation.relation_type
    );

    if (exists) {
      throw new Error('Relation already exists');
    }

    // 添加新关系
    const newRelation: TodoRelation = {
      ...relation,
      id: Date.now(),
      created_at: new Date().toISOString()
    };

    relations.push(newRelation);
    await this.saveRelations(relations);

    // 更新相关待办的 Markdown 文件
    await this.updateTodoRelations(relation.source_id.toString());
    await this.updateTodoRelations(relation.target_id.toString());

    return newRelation;
  }

  /**
   * 获取待办的所有关系
   */
  async getRelationsByTodoId(uuid: string): Promise<TodoRelation[]> {
    const relations = await this.getAllRelations();
    return relations.filter(
      r => r.source_id.toString() === uuid || r.target_id.toString() === uuid
    );
  }

  /**
   * 删除关系
   */
  async deleteRelation(id: number): Promise<void> {
    const relations = await this.getAllRelations();
    const filtered = relations.filter(r => r.id !== id);

    if (relations.length === filtered.length) {
      throw new Error('Relation not found');
    }

    await this.saveRelations(filtered);

    // 更新相关待办的 Markdown 文件
    const deletedRelation = relations.find(r => r.id === id);
    if (deletedRelation) {
      await this.updateTodoRelations(deletedRelation.source_id.toString());
      await this.updateTodoRelations(deletedRelation.target_id.toString());
    }
  }

  /**
   * 获取所有关系
   */
  async getAllRelations(): Promise<TodoRelation[]> {
    const relationsPath = path.join(this.storagePath, '.multitodo-metadata', 'relations.json');

    if (!fs.existsSync(relationsPath)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(relationsPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  // ==================== 设置管理 ====================

  /**
   * 获取设置
   */
  async getSettings(): Promise<Settings> {
    const settingsPath = path.join(this.storagePath, '.multitodo-metadata', 'settings.json');

    if (!fs.existsSync(settingsPath)) {
      return {};
    }

    try {
      const content = await fs.promises.readFile(settingsPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(settings: Partial<Settings>): Promise<void> {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...settings };

    const settingsPath = path.join(this.storagePath, '.multitodo-metadata', 'settings.json');
    await this.atomicWrite(settingsPath, JSON.stringify(newSettings, null, 2));
  }

  // ==================== 索引管理 ====================

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<void> {
    await this.fileIndexer.buildIndex();
  }

  // ==================== 辅助方法 ====================

  /**
   * 启动文件监听
   */
  private startFileWatcher(): void {
    if (this.fileWatcher) {
      return;
    }

    this.fileWatcher = chokidar.watch(
      path.join(this.storagePath, 'todo-*/todo.md'),
      {
        ignoreInitial: true,
        usePolling: process.platform === 'win32'
      }
    );

    this.fileWatcher.on('change', async (filePath: string) => {
      const uuid = this.extractUuidFromPath(filePath);
      if (uuid) {
        try {
          const markdown = await fs.promises.readFile(filePath, 'utf-8');
          const todo = this.markdownParser.parseTodo(markdown);

          // 更新缓存和索引
          this.updateCache(uuid, todo);
          await this.fileIndexer.updateTodo(todo);
        } catch (error) {
          console.error(`Error processing file change for ${uuid}:`, error);
        }
      }
    });
  }

  /**
   * 停止文件监听
   */
  async stopWatching(): Promise<void> {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }

  /**
   * 保存元数据
   */
  private async saveMetadata(todoDir: string, todo: Todo): Promise<void> {
    const metaPath = path.join(todoDir, '.meta.json');
    const metadata = {
      content_hash: todo.contentHash,
      display_orders: todo.displayOrders,
      ai_metadata: {
        suggestion_generated_at: todo.aiSuggestionGeneratedAt,
        template: todo.aiSuggestionTemplate,
        provider: todo.aiSuggestionProvider,
        model: todo.aiSuggestionModel
      },
      internal_metadata: {
        version: 1,
        migrated_from_sqlite: false,
        updated_at: new Date().toISOString()
      }
    };

    await this.atomicWrite(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * 保存关系
   */
  private async saveRelations(relations: TodoRelation[]): Promise<void> {
    const relationsPath = path.join(this.storagePath, '.multitodo-metadata', 'relations.json');
    await this.atomicWrite(relationsPath, JSON.stringify(relations, null, 2));
  }

  /**
   * 更新待办关系（更新 Markdown 文件）
   */
  private async updateTodoRelations(uuid: string): Promise<void> {
    const todo = await this.getTodoById(uuid);
    if (!todo) return;

    const relations = await this.getRelationsByTodoId(uuid);
    const markdown = this.markdownParser.generateTodo(todo, relations);

    const todoPath = path.join(this.storagePath, `todo-${uuid}`, 'todo.md');
    await this.atomicWrite(todoPath, markdown);
  }

  /**
   * 原子性文件写入
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * 从文件路径提取 UUID
   */
  private extractUuidFromPath(filePath: string): string | null {
    const match = filePath.match(/todo-([a-f0-9-]+)\/todo\.md$/);
    return match ? match[1] : null;
  }

  /**
   * 缓存管理
   */
  private updateCache(uuid: string, todo: Todo): void {
    // 清理过期缓存
    this.cleanExpiredCache();

    // 限制缓存大小
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(uuid, {
      todo,
      timestamp: Date.now()
    });
  }

  private getFromCache(uuid: string): Todo | null {
    const cached = this.cache.get(uuid);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(uuid);
      return null;
    }

    return cached.todo;
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [uuid, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(uuid);
      }
    }
  }

  /**
   * 获取存储路径
   */
  getStoragePath(): string {
    return this.storagePath;
  }
}