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

  // ✅ 新增：全量缓存系统，用于优化大量待办场景下的性能
  private todosCache: Map<string, Todo> = new Map();
  private cacheInitialized: boolean = false;
  private cacheDirty: boolean = false;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(app.getPath('userData'), 'todos');
    this.markdownParser = new MarkdownParser();
    this.markdownParser.setStoragePath(this.storagePath); // 设置存储路径用于相对路径转换
    this.fileIndexer = new FileIndexer(this.storagePath);
    this.initializeStorage();
  }

  /**
   * 初始化存储目录结构
   */
  private async initializeStorage(): Promise<void> {
    console.log('[FileStorageManager] 🚀 Initializing storage...');

    const dirs = [
      this.storagePath,
      path.join(this.storagePath, '.multitodo-metadata'),
      path.join(this.storagePath, '.multitodo-metadata', 'flowcharts'),
      path.join(this.storagePath, '.multitodo-metadata', 'templates')
    ];

    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
      console.log(`[FileStorageManager] ✅ Created directory: ${dir}`);
    }

    // 初始化索引（阻塞操作，确保索引构建完成）
    console.log('[FileStorageManager] 📊 Loading index...');
    await this.fileIndexer.loadIndex();
    console.log('[FileStorageManager] ✅ Index loaded successfully');

    // 在索引构建完成后启动文件监听（避免竞态条件）
    console.log('[FileStorageManager] 👀 Starting file watcher...');
    this.startFileWatcher();
    console.log('[FileStorageManager] ✅ File watcher started');

    // 启动时自动诊断和修复
    console.log('[FileStorageManager] 🔍 Running post-initialization diagnostic...');
    const diagnostic = await this.quickDiagnostic();

    if (!diagnostic.healthy) {
      console.warn('[FileStorageManager] ⚠️ Quick diagnostic found issues, attempting auto-repair...');

      if (diagnostic.issues.includes('UUID映射文件不存在') ||
          diagnostic.issues.some(i => i.includes('索引') || i.includes('映射'))) {
        console.log('[FileStorageManager] 🔧 Attempting to rebuild all metadata...');
        const repairResult = await this.rebuildAllMetadata();

        if (repairResult.success) {
          console.log(`[FileStorageManager] ✅ Auto-repair successful: ${repairResult.mappingsRepaired} mappings repaired`);
        } else {
          console.error('[FileStorageManager] ❌ Auto-repair failed:', repairResult.errors);
        }
      }
    }

    // ✅ 新增：预加载缓存以提升性能
    console.log('[FileStorageManager] 🚀 Preloading cache for performance optimization...');
    await this.preloadCache();

    console.log('[FileStorageManager] 🎉 Storage initialization completed');
  }

  // ==================== Todo CRUD 操作 ====================

  /**
   * 创建待办（Obsidian 风格）
   */
  async createTodo(todo: Omit<Todo, 'id'>): Promise<Todo> {
    const uuid = uuidv4();
    const newTodo: Todo = {
      ...todo,
      id: uuid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 🔧 改进：添加详细的错误分类和处理
    let fileName: string;
    let todoPath: string;
    let attachments: string[] = [];

    try {
      // 步骤 1: 生成文件名
      fileName = await this.generateFileName(newTodo.title, uuid);
      todoPath = path.join(this.storagePath, fileName);
      console.log(`[createTodo] 📝 Generated filename: ${fileName}`);

      // 步骤 2: 处理附件
      attachments = await this.processAttachments(newTodo, this.storagePath, fileName);

      if (attachments.length > 0) {
        console.log(`[createTodo] ✅ Created ${attachments.length} attachments for "${newTodo.title}":`, attachments);
      } else {
        console.log(`[createTodo] ℹ️ No attachments found for "${newTodo.title}"`);
        console.log(`[createTodo] todo.imageUrl: ${newTodo.imageUrl ? 'present' : 'absent'}`);
        console.log(`[createTodo] todo.images: ${newTodo.images ? 'present' : 'absent'}`);
      }

      // 步骤 3: 生成并保存 Markdown 文件（传递存储路径和文件名用于图片提取）
      const markdown = await this.markdownParser.generateTodo(newTodo, [], attachments, this.storagePath, fileName);
      await this.atomicWrite(todoPath, markdown);
      console.log(`[createTodo] ✅ Markdown file created: ${fileName}`);

      // 验证文件是否成功创建
      if (!fs.existsSync(todoPath)) {
        throw new Error(`File creation verification failed: ${todoPath}`);
      }

    } catch (error) {
      console.error(`[createTodo] ❌ Failed to create todo "${newTodo.title}":`, error);
      throw new Error(`Todo creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 🔧 改进：将 UUID 映射更新集成到原子操作中
    try {
      await this.updateUuidToFileMap(uuid, fileName);
      console.log(`[createTodo] 🗺️ UUID mapping updated: ${uuid} -> ${fileName}`);
    } catch (mappingError) {
      console.error(`[createTodo] ❌ Failed to update UUID mapping for ${uuid}:`, mappingError);
      // 🔧 改进：映射更新失败时，删除已创建的文件以保持一致性
      try {
        if (fs.existsSync(todoPath)) {
          await fs.promises.unlink(todoPath);
          console.log(`[createTodo] 🧹 Cleaned up file due to mapping update failure: ${fileName}`);
        }
      } catch (cleanupError) {
        console.error(`[createTodo] ❌ Failed to cleanup file: ${cleanupError}`);
      }
      throw new Error(`UUID mapping update failed: ${mappingError instanceof Error ? mappingError.message : String(mappingError)}`);
    }

    // 更新索引
    try {
      await this.fileIndexer.addTodo(newTodo);
      console.log(`[createTodo] 📊 Index updated for todo: ${newTodo.title}`);
    } catch (indexError) {
      console.warn(`[createTodo] ⚠️ Failed to update index (non-critical):`, indexError);
      // 索引更新失败不影响主要功能，继续执行
    }

    // 更新缓存
    this.updateCache(uuid, newTodo);

    console.log(`[createTodo] 🎉 Successfully created todo: "${newTodo.title}" (${uuid})`);
    return newTodo;
  }

  /**
   * 创建待办并设置显示顺序（手动排序模式专用）
   * 新待办将添加到列表顶部，所有现有待办的排序号依次递增
   */
  async createTodoWithDisplayOrder(
    todo: Omit<Todo, 'id'>,
    tabKey: string,
    position: 'top' | 'bottom' = 'top'
  ): Promise<Todo> {
    console.log(`[createTodoWithDisplayOrder] Creating todo at ${position} for tab: ${tabKey}`);
    const startTime = Date.now();

    // ✅ 性能优化：确保缓存已初始化，直接使用缓存避免文件读取
    if (!this.cacheInitialized) {
      console.log(`[createTodoWithDisplayOrder] 🚀 Cache not initialized, preloading...`);
      await this.preloadCache();
    }

    // 1. 从缓存中获取当前Tab下所有待办的排序号（O(n) but in-memory）
    const currentTabTodos = Array.from(this.todosCache.values()).filter(t =>
      t.displayOrders &&
      t.displayOrders[tabKey] != null
    );

    console.log(`[createTodoWithDisplayOrder] ✅ Found ${currentTabTodos.length} todos with display orders in tab ${tabKey} (from cache)`);

    // 2. 为新待办分配排序号
    let newTodoOrder: number;
    if (position === 'top') {
      // 插入到顶部：新待办排序号为0
      newTodoOrder = 0;
    } else {
      // 插入到底部：新待办排序号为当前最大值+1
      const maxOrder = currentTabTodos.length > 0
        ? Math.max(...currentTabTodos.map(t => t.displayOrders![tabKey]!))
        : -1;
      newTodoOrder = maxOrder + 1;
    }

    console.log(`[createTodoWithDisplayOrder] New todo will get order: ${newTodoOrder}`);

    // 3. 创建新待办并设置排序号
    const todoWithOrder: Omit<Todo, 'id'> = {
      ...todo,
      displayOrders: {
        ...todo.displayOrders,
        [tabKey]: newTodoOrder
      }
    };

    const newTodo = await this.createTodo(todoWithOrder);
    console.log(`[createTodoWithDisplayOrder] Created todo with ID: ${newTodo.id}`);

    // 4. 如果插入到顶部，需要调整所有其他待办的排序号
    if (position === 'top' && currentTabTodos.length > 0) {
      console.log(`[createTodoWithDisplayOrder] Adjusting display orders for ${currentTabTodos.length} existing todos`);

      // 构建批量更新列表
      const batchUpdates: Array<{ uuid: string; tabKey: string; displayOrder: number }> = [];

      // 所有现有待办的排序号+1
      currentTabTodos.forEach(todo => {
        const oldOrder = todo.displayOrders![tabKey]!;
        const newOrder = oldOrder + 1;
        batchUpdates.push({
          uuid: todo.id,
          tabKey: tabKey,
          displayOrder: newOrder
        });
        console.log(`[createTodoWithDisplayOrder] Todo ${todo.id}: ${oldOrder} -> ${newOrder}`);
      });

      // 批量更新排序号
      if (batchUpdates.length > 0) {
        await this.batchUpdateDisplayOrders(batchUpdates);
        console.log(`[createTodoWithDisplayOrder] Successfully updated ${batchUpdates.length} todos' display orders`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[createTodoWithDisplayOrder] 🎉 Completed in ${duration}ms`);

    return newTodo;
  }

  /**
   * 根据 UUID 获取待办（Obsidian 风格）
   */
  async getTodoById(uuid: string): Promise<Todo | null> {
    console.log(`[getTodoById] Looking up UUID: ${uuid}`);

    // 检查缓存
    const cached = this.getFromCache(uuid);
    if (cached) {
      console.log(`[getTodoById] ✅ Found in cache: ${cached.title}`);
      return cached;
    }

    // 根据 UUID 查找文件名
    const fileName = await this.getFileNameByUuid(uuid);
    if (!fileName) {
      console.error(`[getTodoById] ❌ UUID not found in map: ${uuid}`);
      return null;
    }

    console.log(`[getTodoById] Found file: ${fileName}`);
    const todoPath = path.join(this.storagePath, fileName);
    if (!fs.existsSync(todoPath)) {
      console.error(`[getTodoById] ❌ File not found: ${todoPath}`);
      return null;
    }

    try {
      console.log(`[getTodoById] Reading file: ${todoPath}`);
      const markdown = await fs.promises.readFile(todoPath, 'utf-8');
      const todo = this.markdownParser.parseTodo(markdown);

      console.log(`[getTodoById] ✅ Successfully parsed todo: ${todo.title}`);

      // 更新缓存
      this.updateCache(uuid, todo);

      return todo;
    } catch (error) {
      console.error(`[getTodoById] ❌ Error reading todo ${uuid}:`, error);
      return null;
    }
  }

  /**
   * 🔧 新增：根据UUID获取单个待办，用于增量刷新
   */
  async getTodoByUuid(uuid: string): Promise<Todo | null> {
    try {
      const todo = await this.getTodoById(uuid);
      return todo;
    } catch (error) {
      console.error(`[FileStorageManager] getTodoByUuid failed for ${uuid}:`, error);
      return null;
    }
  }

  /**
   * 获取所有待办（性能优化版本）
   */
  async getAllTodos(): Promise<Todo[]> {
    // ✅ 性能优化：优先使用全量缓存
    if (this.cacheInitialized && this.todosCache.size > 0) {
      console.log(`[getAllTodos] ✅ Using cache: ${this.todosCache.size} todos (O(1) operation)`);
      return Array.from(this.todosCache.values());
    }

    // 缓存未初始化，先加载缓存
    console.log(`[getAllTodos] 🚀 Cache not initialized, loading from files...`);
    await this.preloadCache();

    if (this.cacheInitialized && this.todosCache.size > 0) {
      console.log(`[getAllTodos] ✅ Cache loaded: ${this.todosCache.size} todos`);
      return Array.from(this.todosCache.values());
    }

    // Fallback: 如果缓存加载失败，使用原有的文件读取逻辑
    console.warn(`[getAllTodos] ⚠️ Cache load failed, falling back to file reading`);
    const entries = await this.fileIndexer.getAllTodos();
    const todos: Todo[] = [];
    const failures: Array<{ uuid: string; reason: string }> = [];

    if (process.env.NODE_ENV === 'development') {
      console.log(`[FileStorageManager] 🚀 getAllTodos: Starting`);
      console.log(`[FileStorageManager] 📊 Index contains ${entries.length} entries`);
      console.log(`[FileStorageManager] 📂 Storage path: ${this.storagePath}`);
    }

    // 性能优化：使用Promise.all并行加载待办，而不是串行
    const loadPromises = entries.map(async (entry) => {
      try {
        const todo = await this.getTodoById(entry.uuid);
        if (todo) {
          return { success: true, todo };
        } else {
          return { success: false, uuid: entry.uuid, reason: 'getTodoById returned null' };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === 'development') {
          console.error(`[FileStorageManager] ❌ Error loading: ${entry.uuid} - ${reason}`);
        }
        return { success: false, uuid: entry.uuid, reason };
      }
    });

    const results = await Promise.all(loadPromises);

    results.forEach(result => {
      if (result.success && result.todo) {
        todos.push(result.todo);
      } else if (!result.success && result.uuid && result.reason) {
        failures.push({ uuid: result.uuid, reason: result.reason });
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[FileStorageManager] 📊 getAllTodos: Completed`);
      console.log(`[FileStorageManager] ✅ Successfully loaded: ${todos.length} todos`);
      console.log(`[FileStorageManager] ❌ Failed to load: ${failures.length} entries`);

      if (failures.length > 0) {
        console.log('[FileStorageManager] 📋 Failure summary:');
        failures.slice(0, 10).forEach(f => {
          console.log(`   - ${f.uuid}: ${f.reason}`);
        });
        if (failures.length > 10) {
          console.log(`   ... and ${failures.length - 10} more failures`);
        }
      }

      console.log(`[FileStorageManager] 📋 Successfully loaded todos (first 3):`);
      todos.slice(0, 3).forEach(todo => {
        console.log(`   - ${todo.id}: ${todo.title || 'Untitled'}`);
      });
    }

    return todos;
  }

  /**
   * 批量获取待办（增量加载优化版本）
   * 优先使用缓存，只从文件系统加载未缓存的待办
   */
  async getMultipleTodosByUuids(uuids: string[]): Promise<Todo[]> {
    const cachedTodos: Todo[] = [];
    const uncachedUuids: string[] = [];

    // 首先检查缓存
    for (const uuid of uuids) {
      const cached = this.getFromCache(uuid);
      if (cached) {
        cachedTodos.push(cached);
      } else {
        uncachedUuids.push(uuid);
      }
    }

    // 并行加载未缓存的待办
    const uncachedTodos: Todo[] = [];
    if (uncachedUuids.length > 0) {
      const loadPromises = uncachedUuids.map(async (uuid) => {
        try {
          const todo = await this.getTodoById(uuid);
          return todo;
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[FileStorageManager] Error loading todo ${uuid}:`, error);
          }
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      results.forEach(result => {
        if (result) {
          uncachedTodos.push(result);
        }
      });
    }

    return [...cachedTodos, ...uncachedTodos];
  }

  /**
   * 更新待办（Obsidian 风格）
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

    // 根据 UUID 查找文件名
    let fileName = await this.getFileNameByUuid(uuid);
    if (!fileName) {
      throw new Error(`UUID not found in map: ${uuid}`);
    }

    // 🔧 新增：检查标题是否变更并处理文件重命名
    if (this.hasTitleChanged(currentTodo, updates)) {
      console.log(`[updateTodo] 📝 Title changed from "${currentTodo.title}" to "${updates.title}"`);

      // 检查是否需要重命名文件
      if (await this.shouldRenameFile(fileName, updates.title!, uuid)) {
        const newFileName = await this.generateFileName(updates.title!, uuid);
        console.log(`[updateTodo] 🔄 Renaming file: ${fileName} -> ${newFileName}`);

        try {
          await this.renameTodoFile(fileName, newFileName, uuid);
          fileName = newFileName; // 更新文件名引用
          console.log(`[updateTodo] ✅ File renamed successfully`);
        } catch (renameError) {
          console.error(`[updateTodo] ❌ File rename failed:`, renameError);
          // 文件重命名失败不应阻止内容更新，继续使用原文件名
          console.log(`[updateTodo] ⚠️ Continuing with original filename: ${fileName}`);
        }
      } else {
        console.log(`[updateTodo] ℹ️ No file rename needed`);
      }
    }

    const todoPath = path.join(this.storagePath, fileName);
    const markdown = await this.markdownParser.generateTodo(updatedTodo, [], [], this.storagePath, fileName);

    await this.atomicWrite(todoPath, markdown);

    // 更新索引
    await this.fileIndexer.updateTodo(updatedTodo);

    // 更新缓存
    this.updateCache(uuid, updatedTodo);
  }

  /**
   * 删除待办（Obsidian 风格）
   */
  async deleteTodo(uuid: string): Promise<void> {
    // 根据 UUID 查找文件名
    const fileName = await this.getFileNameByUuid(uuid);
    if (!fileName) {
      console.warn(`[deleteTodo] UUID not found in map: ${uuid}`);
      return;
    }

    const todoPath = path.join(this.storagePath, fileName);

    if (fs.existsSync(todoPath)) {
      await fs.promises.unlink(todoPath);
    }

    // 删除相关附件（与 md 文件同级的图片文件）
    const baseName = fileName.replace('.md', '');
    const files = await fs.promises.readdir(this.storagePath);
    for (const file of files) {
      if (file.startsWith(baseName) && file !== fileName) {
        const filePath = path.join(this.storagePath, file);
        await fs.promises.unlink(filePath).catch(() => {
          console.warn(`[deleteTodo] Failed to delete attachment: ${filePath}`);
        });
      }
    }

    // 从 UUID 映射中删除
    await this.removeFromUuidToFileMap(uuid);

    // 从索引中删除
    await this.fileIndexer.removeTodo(uuid);

    // 从缓存中删除
    this.cache.delete(uuid);

    // ✅ 新增：从全量缓存中删除
    this.deleteFromCache(uuid);
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
   * 批量更新显示顺序（性能优化版本）
   */
  async batchUpdateDisplayOrders(
    updates: Array<{uuid: string; tabKey: string; displayOrder: number}>
  ): Promise<{ success: boolean; updated: number; failed: number }> {
    console.log(`[batchUpdateDisplayOrders] 🚀 Starting batch update for ${updates.length} updates`);
    const startTime = Date.now();

    try {
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

      let updated = 0;
      let failed = 0;
      const updatedTodos: Todo[] = [];

      // ✅ 性能优化：从缓存中批量获取待办（避免文件读取）
      const todoIds = Array.from(groupedUpdates.keys());
      const todos: Todo[] = [];

      console.log(`[batchUpdateDisplayOrders] 📊 Fetching ${todoIds.length} todos from cache...`);
      for (const uuid of todoIds) {
        const todo = this.todosCache.get(uuid);
        if (todo) {
          todos.push(todo);
        } else {
          // Fallback: 如果缓存中没有，从文件读取
          console.warn(`[batchUpdateDisplayOrders] ⚠️ Todo ${uuid} not in cache, loading from file`);
          try {
            const fileTodo = await this.getTodoById(uuid);
            if (fileTodo) {
              todos.push(fileTodo);
            } else {
              failed++;
              console.warn(`[batchUpdateDisplayOrders] ❌ Todo not found: ${uuid}`);
            }
          } catch (error) {
            failed++;
            console.error(`[batchUpdateDisplayOrders] ❌ Error loading todo ${uuid}:`, error);
          }
        }
      }

      // ✅ 性能优化：批量准备更新数据（不触发单个 updateTodo）
      console.log(`[batchUpdateDisplayOrders] 📝 Preparing ${todos.length} todo updates...`);
      for (let i = 0; i < todos.length; i++) {
        const uuid = todos[i].id;
        const displayOrders = groupedUpdates.get(uuid)!;

        const newDisplayOrders = { ...todos[i].displayOrders };
        displayOrders.forEach(({ tabKey, displayOrder }) => {
          newDisplayOrders[tabKey] = displayOrder;
        });

        const updatedTodo: Todo = {
          ...todos[i],
          displayOrders: newDisplayOrders,
          updatedAt: new Date().toISOString()
        };

        updatedTodos.push(updatedTodo);
        updated++;

        // 同步更新缓存
        this.updateCache(uuid, updatedTodo);
      }

      // ✅ 性能优化：批量写入文件（并行执行）
      console.log(`[batchUpdateDisplayOrders] 💾 Writing ${updatedTodos.length} files in parallel...`);
      const writePromises = updatedTodos.map(async (todo) => {
        const fileName = await this.getFileNameByUuid(todo.id);
        if (!fileName) {
          throw new Error(`File name not found for todo: ${todo.id}`);
        }
        const todoPath = path.join(this.storagePath, fileName);
        const markdown = await this.markdownParser.generateTodo(todo, [], [], this.storagePath, fileName);
        await this.atomicWrite(todoPath, markdown);
      });

      await Promise.all(writePromises);
      console.log(`[batchUpdateDisplayOrders] ✅ All files written successfully`);

      // ✅ 性能优化：批量更新索引（一次性操作）
      console.log(`[batchUpdateDisplayOrders] 📊 Batch updating index for ${updatedTodos.length} todos...`);
      await this.fileIndexer.batchUpdateTodos(updatedTodos);

      const duration = Date.now() - startTime;
      console.log(`[batchUpdateDisplayOrders] 🎉 Batch update completed: ${updated} updated, ${failed} failed in ${duration}ms`);

      return { success: true, updated, failed };

    } catch (error) {
      console.error('[batchUpdateDisplayOrders] ❌ Batch display order update failed:', error);
      return { success: false, updated: 0, failed: updates.length };
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
      id: String(Date.now()),
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
  async deleteRelation(id: string): Promise<void> {
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
      const relations = JSON.parse(content);

      // 确保所有ID都是string类型，符合TodoRelation接口定义
      return relations.map((relation: any) => ({
        ...relation,
        id: relation.id !== undefined ? String(relation.id) : undefined,
        source_id: String(relation.source_id),
        target_id: String(relation.target_id)
      }));
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
   * 检查标题是否变更
   */
  private hasTitleChanged(currentTodo: Todo, updates: Partial<Todo>): boolean {
    return updates.title !== undefined && updates.title !== currentTodo.title;
  }

  /**
   * 检查是否需要重命名文件
   */
  private async shouldRenameFile(currentFileName: string, newTitle: string, uuid: string): Promise<boolean> {
    const newFileName = await this.generateFileName(newTitle, uuid);
    return newFileName !== currentFileName;
  }

  /**
   * 重命名待办文件（原子性操作）
   */
  private async renameTodoFile(oldFileName: string, newFileName: string, uuid: string): Promise<void> {
    console.log(`[renameTodoFile] 🔄 Starting rename operation: ${oldFileName} -> ${newFileName} (uuid: ${uuid})`);

    const oldPath = path.join(this.storagePath, oldFileName);
    const newPath = path.join(this.storagePath, newFileName);

    // 验证源文件存在
    if (!fs.existsSync(oldPath)) {
      throw new Error(`Source file does not exist: ${oldPath}`);
    }

    // 验证目标文件不存在（避免覆盖）
    if (fs.existsSync(newPath)) {
      console.warn(`[renameTodoFile] ⚠️ Target file already exists: ${newPath}`);
      // 文件名冲突，尝试添加后缀
      const baseName = newFileName.replace('.md', '');
      const timestamp = Date.now();
      const conflictFileName = `${baseName}_${timestamp}.md`;
      const conflictPath = path.join(this.storagePath, conflictFileName);

      console.log(`[renameTodoFile] 🔧 Using conflict resolution: ${conflictFileName}`);

      try {
        await fs.promises.rename(oldPath, conflictPath);
        await this.updateUuidToFileMap(uuid, conflictFileName);

        // 重命名附件
        await this.renameAttachments(oldFileName, conflictFileName);

        console.log(`[renameTodoFile] ✅ Successfully renamed to conflict file: ${conflictFileName}`);
      } catch (error) {
        throw new Error(`Failed to rename with conflict resolution: ${error instanceof Error ? error.message : String(error)}`);
      }

      return;
    }

    try {
      // 1. 重命名主文件
      await fs.promises.rename(oldPath, newPath);
      console.log(`[renameTodoFile] ✅ Successfully renamed main file: ${oldFileName} -> ${newFileName}`);

      // 2. 更新UUID映射
      await this.updateUuidToFileMap(uuid, newFileName);
      console.log(`[renameTodoFile] ✅ Updated UUID mapping: ${uuid} -> ${newFileName}`);

      // 3. 重命名附件
      await this.renameAttachments(oldFileName, newFileName);
      console.log(`[renameTodoFile] ✅ Renamed attachments for: ${newFileName}`);

      console.log(`[renameTodoFile] 🎉 Rename operation completed successfully`);
    } catch (error) {
      console.error(`[renameTodoFile] ❌ Rename operation failed:`, error);

      // 尝试回滚：如果重命名了主文件但映射更新失败，尝试恢复原文件名
      if (fs.existsSync(newPath) && !fs.existsSync(oldPath)) {
        try {
          await fs.promises.rename(newPath, oldPath);
          console.log(`[renameTodoFile] 🔄 Rolled back main file rename: ${newFileName} -> ${oldFileName}`);
        } catch (rollbackError) {
          console.error(`[renameTodoFile] ❌ Failed to rollback:`, rollbackError);
        }
      }

      throw new Error(`File rename failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 重命名附件文件
   */
  private async renameAttachments(oldFileName: string, newFileName: string): Promise<void> {
    const oldBaseName = oldFileName.replace('.md', '');
    const newBaseName = newFileName.replace('.md', '');
    const files = await fs.promises.readdir(this.storagePath);

    for (const file of files) {
      // 匹配附件文件：与旧文件同名但扩展名不是.md
      if (file.startsWith(oldBaseName) && file !== oldFileName) {
        const extension = path.extname(file);
        const oldAttachmentPath = path.join(this.storagePath, file);
        const newAttachmentName = `${newBaseName}${extension}`;
        const newAttachmentPath = path.join(this.storagePath, newAttachmentName);

        try {
          await fs.promises.rename(oldAttachmentPath, newAttachmentPath);
          console.log(`[renameAttachments] ✅ Renamed attachment: ${file} -> ${newAttachmentName}`);
        } catch (error) {
          console.warn(`[renameAttachments] ⚠️ Failed to rename attachment ${file}:`, error);
          // 附件重命名失败不是致命错误，继续处理其他附件
        }
      }
    }
  }

  /**
   * 启动文件监听（优化版：减少与文件操作的冲突）
   */
  private startFileWatcher(): void {
    if (this.fileWatcher) {
      return;
    }

    // 监听所有 .md 文件（仅监听待办文件，不监听元数据目录）
    this.fileWatcher = chokidar.watch(
      path.join(this.storagePath, '*.md'),
      {
        ignoreInitial: true,
        // Windows平台优化：降低轮询频率，减少文件锁冲突
        usePolling: process.platform === 'win32',
        interval: 300,      // 300ms检查一次（降低频率）
        binaryInterval: 1000, // 二进制文件1s检查一次
        // 添加防抖延迟
        awaitWriteFinish: {
          stabilityThreshold: 200,  // 200ms稳定期
          pollInterval: 100       // 100ms检查间隔
        }
      }
    );

    // 添加变化防抖机制
    let changeTimer: NodeJS.Timeout | null = null;
    const pendingChanges = new Set<string>();

    this.fileWatcher.on('change', (filePath: string) => {
      // 防抖：批量处理变化
      pendingChanges.add(filePath);

      if (changeTimer) {
        clearTimeout(changeTimer);
      }

      changeTimer = setTimeout(async () => {
        const changes = Array.from(pendingChanges);
        pendingChanges.clear();

        console.log(`[startFileWatcher] Processing ${changes.length} file changes`);

        for (const filePath of changes) {
          try {
            const markdown = await fs.promises.readFile(filePath, 'utf-8');
            const todo = this.markdownParser.parseTodo(markdown);

            if (!todo.id) {
              console.warn(`[startFileWatcher] Todo missing ID in file: ${filePath}`);
              continue;
            }

            const uuid = String(todo.id);
            this.updateCache(uuid, todo); // 这会同时更新旧的缓存和新的全量缓存
            await this.fileIndexer.updateTodo(todo);
          } catch (error) {
            console.error(`[startFileWatcher] Error processing file change ${filePath}:`, error);
          }
        }
      }, 300); // 300ms防抖延迟
    });

    console.log('[startFileWatcher] File watcher started with optimized configuration');
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

    // 根据 UUID 查找文件名
    const fileName = await this.getFileNameByUuid(uuid);
    if (!fileName) {
      console.error(`[updateTodoRelations] UUID not found in map: ${uuid}`);
      return;
    }

    const todoPath = path.join(this.storagePath, fileName);
    const markdown = await this.markdownParser.generateTodo(todo, relations, [], this.storagePath, fileName);

    await this.atomicWrite(todoPath, markdown);
  }

  /**
   * 原子性文件写入（增强版：支持Windows文件锁处理）
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const maxRetries = 5;
    const baseDelay = 50;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 预清理可能存在的旧临时文件
        if (fs.existsSync(tempPath)) {
          try {
            await fs.promises.unlink(tempPath);
            console.log(`[atomicWrite] Cleaned up existing temp file: ${tempPath}`);
          } catch (cleanupError) {
            console.warn(`[atomicWrite] Cleanup warning: ${cleanupError}`);
          }
        }

        await fs.promises.writeFile(tempPath, content, 'utf-8');

        // 短暂延迟，确保文件系统完成写入
        await new Promise(resolve => setTimeout(resolve, 10));

        await fs.promises.rename(tempPath, filePath);
        console.log(`[atomicWrite] Successfully wrote: ${filePath} (attempt ${attempt + 1}/${maxRetries})`);
        return; // 成功则退出

      } catch (error) {
        const isPermissionError = this.isPermissionError(error);

        if (isPermissionError && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[atomicWrite] Permission error on ${filePath}, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // 最终清理临时文件
        if (fs.existsSync(tempPath)) {
          try {
            await fs.promises.unlink(tempPath);
            console.log(`[atomicWrite] Final cleanup: ${tempPath}`);
          } catch (finalCleanupError) {
            console.error(`[atomicWrite] Final cleanup failed: ${finalCleanupError}`);
          }
        }

        console.error(`[atomicWrite] Failed after ${attempt + 1} attempts: ${filePath}`);
        throw error;
      }
    }
  }

  /**
   * 判断是否为权限相关错误
   */
  private isPermissionError(error: any): boolean {
    const errorMessage = error?.message || String(error);
    return errorMessage.includes('EPERM') ||
           errorMessage.includes('permission') ||
           errorMessage.includes('locked') ||
           errorMessage.includes('EBUSY') ||
           errorMessage.includes('ENOENT') ||
           errorMessage.includes('EACCES');
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

    // ✅ 同步更新全量缓存
    this.todosCache.set(uuid, todo);
  }

  /**
   * ✅ 新增：预加载全量缓存
   * 在初始化时加载所有待办到内存，避免重复文件读取
   */
  private async preloadCache(): Promise<void> {
    if (this.cacheInitialized) {
      console.log(`[Cache] ✅ Cache already initialized with ${this.todosCache.size} todos`);
      return;
    }

    console.log(`[Cache] 🚀 Starting to preload cache...`);
    const startTime = Date.now();

    try {
      const entries = await this.fileIndexer.getAllTodos();
      console.log(`[Cache] 📊 Found ${entries.length} entries in index`);

      let loaded = 0;
      let failed = 0;

      // 并行加载所有待办
      const loadPromises = entries.map(async (entry) => {
        try {
          const todo = await this.getTodoById(entry.uuid);
          if (todo) {
            this.todosCache.set(entry.uuid, todo);
            loaded++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          console.error(`[Cache] ❌ Failed to load todo ${entry.uuid}:`, error);
        }
      });

      await Promise.all(loadPromises);

      this.cacheInitialized = true;
      const duration = Date.now() - startTime;

      console.log(`[Cache] ✅ Preload completed: ${loaded} todos loaded, ${failed} failed in ${duration}ms`);
      console.log(`[Cache] 📈 Cache size: ${this.todosCache.size} todos`);
    } catch (error) {
      console.error(`[Cache] ❌ Preload failed:`, error);
      this.cacheInitialized = false;
    }
  }

  /**
   * ✅ 新增：使缓存失效
   */
  private invalidateCache(): void {
    console.log(`[Cache] 🗑️ Invalidating cache (${this.todosCache.size} todos cleared)`);
    this.todosCache.clear();
    this.cacheInitialized = false;
    this.cacheDirty = false;
  }

  /**
   * ✅ 新增：从缓存中删除待办
   */
  private deleteFromCache(uuid: string): void {
    this.todosCache.delete(uuid);
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

  // ==================== Obsidian 风格存储辅助方法 ====================

  /**
   * 生成安全的文件名（Obsidian 风格）
   */
  private async generateFileName(title: string, uuid: string): Promise<string> {
    // 1. 移除或替换特殊字符
    let safeTitle = title.replace(/[\/\\:*?"<>|]/g, '_');

    // 2. 限制长度（避免文件系统限制）
    if (safeTitle.length > 200) {
      safeTitle = safeTitle.substring(0, 200);
    }

    // 3. 获取现有文件列表
    const existingFiles = await this.getExistingMarkdownFiles();

    // 4. 检查重名并添加序号
    let fileName = `${safeTitle}.md`;
    let counter = 1;

    while (existingFiles.has(fileName)) {
      fileName = `${safeTitle}_${counter}.md`;
      counter++;
    }

    return fileName;
  }

  /**
   * 获取现有的 Markdown 文件列表
   */
  private async getExistingMarkdownFiles(): Promise<Set<string>> {
    const files = new Set<string>();

    try {
      const entries = await fs.promises.readdir(this.storagePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          files.add(entry.name);
        }
      }
    } catch (error) {
      console.error('[getExistingMarkdownFiles] Error reading directory:', error);
    }

    return files;
  }

  /**
   * 处理附件（Obsidian 风格：与 md 文件同级）
   */
  private async processAttachments(
    todo: Todo,
    storagePath: string,
    mdFileName: string
  ): Promise<string[]> {
    const attachments: string[] = [];
    const baseName = mdFileName.replace('.md', '');
    let attachmentIndex = 1;

    console.log(`[processAttachments] Processing attachments for "${todo.title}"`);
    console.log(`[processAttachments] Base name: ${baseName}, Storage path: ${storagePath}`);

    try {
      // 处理单张图片
      if (todo.imageUrl) {
        console.log(`[processAttachments] Found single image (imageUrl): ${todo.imageUrl.substring(0, 50)}...`);
        const attachmentFileName = await this.saveAttachment(
          todo.imageUrl,
          storagePath,
          `${baseName}_${attachmentIndex}.png`
        );
        if (attachmentFileName) {
          console.log(`[processAttachments] Successfully saved attachment: ${attachmentFileName}`);
          attachments.push(attachmentFileName);
          attachmentIndex++;
        } else {
          console.warn(`[processAttachments] Failed to save single image attachment`);
        }
      } else {
        console.log(`[processAttachments] No single image found (imageUrl is empty)`);
      }

      // 处理多张图片
      if (todo.images) {
        console.log(`[processAttachments] Found multiple images (images): ${todo.images.substring(0, 50)}...`);
        try {
          const images = JSON.parse(todo.images);
          console.log(`[processAttachments] Parsed ${images.length} images`);
          if (Array.isArray(images)) {
            for (const imageData of images) {
              console.log(`[processAttachments] Processing image ${attachmentIndex}: ${imageData.substring(0, 50)}...`);
              const attachmentFileName = await this.saveAttachment(
                imageData,
                storagePath,
                `${baseName}_${attachmentIndex}.png`
              );
              if (attachmentFileName) {
                console.log(`[processAttachments] Successfully saved attachment: ${attachmentFileName}`);
                attachments.push(attachmentFileName);
                attachmentIndex++;
              } else {
                console.warn(`[processAttachments] Failed to save image attachment ${attachmentIndex}`);
              }
            }
          }
        } catch (error) {
          console.error(`[processAttachments] Error parsing images array:`, error);
        }
      } else {
        console.log(`[processAttachments] No multiple images found (images is empty)`);
      }
    } catch (error) {
      console.error('[processAttachments] Error processing attachments:', error);
    }

    console.log(`[processAttachments] Total attachments processed: ${attachments.length}`);
    return attachments;
  }

  /**
   * 保存单个附件
   */
  private async saveAttachment(
    imageData: string,
    storagePath: string,
    fileName: string
  ): Promise<string | null> {
    try {
      const filePath = path.join(storagePath, fileName);
      console.log(`[saveAttachment] Attempting to save attachment: ${fileName}`);

      // 如果是 base64 数据
      if (imageData.startsWith('data:')) {
        console.log(`[saveAttachment] Detected base64 image data`);
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          console.warn(`[saveAttachment] Failed to match base64 pattern`);
          return null;
        }

        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        console.log(`[saveAttachment] Base64 image detected: ${ext}, size: ${buffer.length} bytes`);

        // 调整文件扩展名
        const adjustedFileName = fileName.replace('.png', `.${ext}`);
        const adjustedFilePath = path.join(storagePath, adjustedFileName);

        await fs.promises.writeFile(adjustedFilePath, buffer);
        console.log(`[saveAttachment] Successfully wrote base64 image to: ${adjustedFilePath}`);

        // 验证文件确实存在
        if (fs.existsSync(adjustedFilePath)) {
          const stats = fs.statSync(adjustedFilePath);
          console.log(`[saveAttachment] Verified file exists: ${adjustedFilePath}, size: ${stats.size} bytes`);
        } else {
          console.error(`[saveAttachment] File was not created: ${adjustedFilePath}`);
        }

        return `./${adjustedFileName}`;
      }
      // 如果是文件路径，复制文件
      else if (fs.existsSync(imageData)) {
        console.log(`[saveAttachment] Detected file path: ${imageData}`);
        await fs.promises.copyFile(imageData, filePath);
        console.log(`[saveAttachment] Successfully copied file to: ${filePath}`);

        // 验证文件确实存在
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`[saveAttachment] Verified file exists: ${filePath}, size: ${stats.size} bytes`);
        } else {
          console.error(`[saveAttachment] File was not copied: ${filePath}`);
        }

        return `./${fileName}`;
      } else {
        console.warn(`[saveAttachment] Unknown image data format, doesn't start with 'data:' and file doesn't exist`);
      }
    } catch (error) {
      console.error(`[saveAttachment] Error saving attachment ${fileName}:`, error);
    }

    return null;
  }

  /**
   * 更新 UUID 到文件名的映射（优化版：添加文件锁和改进重试策略）
   */
  private uuidMapLock: Promise<void> = Promise.resolve();

  private async updateUuidToFileMap(uuid: string, fileName: string): Promise<void> {
    // 等待之前的操作完成，实现简单的队列锁
    await this.uuidMapLock;

    // 创建新的锁
    const lock = this.withLock(async () => {
      const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');
      const maxRetries = 4; // 增加到4次重试

      console.log(`[updateUuidToFileMap] Starting update for ${uuid} -> ${fileName}`);

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          let uuidMap: Record<string, string> = {};

          // 读取现有映射
          if (fs.existsSync(mapPath)) {
            try {
              const content = await fs.promises.readFile(mapPath, 'utf-8');
              uuidMap = JSON.parse(content);
            } catch (readError) {
              console.error(`[updateUuidToFileMap] ⚠️ Error reading UUID map (attempt ${attempt + 1}):`, readError);
              // 如果文件损坏，重新开始
              uuidMap = {};
            }
          }

          // 更新映射
          uuidMap[uuid] = fileName;

          // 保存映射
          await this.atomicWrite(mapPath, JSON.stringify(uuidMap, null, 2));
          console.log(`[updateUuidToFileMap] ✅ Successfully updated mapping: ${uuid} -> ${fileName} (attempt ${attempt + 1}/${maxRetries})`);
          return; // 成功则返回

        } catch (error) {
          if (attempt >= maxRetries - 1) {
            console.error(`[updateUuidToFileMap] ❌ All retries exhausted for ${uuid}:`, error);
            throw new Error(`UUID mapping update failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
          }

          // 使用指数退避策略
          const delay = 100 * Math.pow(1.5, attempt); // 100ms, 150ms, 225ms, 337ms
          console.error(`[updateUuidToFileMap] ❌ Failed to update mapping (attempt ${attempt + 1}/${maxRetries}), retry after ${delay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    });

    // 更新全局锁
    this.uuidMapLock = lock;
    await lock;
  }

  /**
   * 锁包装器
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  /**
   * 从 UUID 映射中删除
   */
  private async removeFromUuidToFileMap(uuid: string): Promise<void> {
    const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');

    if (!fs.existsSync(mapPath)) {
      return;
    }

    try {
      const content = await fs.promises.readFile(mapPath, 'utf-8');
      const uuidMap: Record<string, string> = JSON.parse(content);

      // 删除映射
      delete uuidMap[uuid];

      // 保存映射
      await this.atomicWrite(mapPath, JSON.stringify(uuidMap, null, 2));
    } catch (error) {
      console.error('[removeFromUuidToFileMap] Error removing UUID from map:', error);
    }
  }

  /**
   * 根据 UUID 查找文件名
   */
  private async getFileNameByUuid(uuid: string): Promise<string | null> {
    const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');

    console.log(`[getFileNameByUuid] Looking up UUID: ${uuid} in map: ${mapPath}`);

    if (!fs.existsSync(mapPath)) {
      console.error(`[getFileNameByUuid] ❌ Map file not found: ${mapPath}`);
      return null;
    }

    try {
      const content = await fs.promises.readFile(mapPath, 'utf-8');
      const uuidMap: Record<string, string> = JSON.parse(content);
      const fileName = uuidMap[uuid] || null;

      if (!fileName) {
        console.warn(`[getFileNameByUuid] ⚠️ UUID ${uuid} not found in mapping file`);
        console.warn(`[getFileNameByUuid] Available UUIDs in map:`, Object.keys(uuidMap));
      } else {
        console.log(`[getFileNameByUuid] ✅ Found mapping: ${uuid} -> ${fileName}`);
      }

      return fileName;
    } catch (error) {
      console.error('[getFileNameByUuid] ❌ Error reading UUID map:', error);
      console.error('[getFileNameByUuid] Map path:', mapPath);
      console.error('[getFileNameByUuid] Error details:', error instanceof Error ? error.stack : String(error));
      return null;
    }
  }

  /**
   * 数据完整性验证
   */
  public async verifyDataIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    stats: {
      indexCount: number;
      mapCount: number;
      fileCount: number;
    };
  }> {
    const issues: string[] = [];

    console.log('[FileStorageManager] 🔍 Starting data integrity verification...');

    // 1. 检查索引数量
    const indexEntries = await this.fileIndexer.getAllTodos();
    const indexCount = indexEntries.length;
    console.log(`[FileStorageManager] Index entries: ${indexCount}`);

    // 2. 检查UUID映射数量
    const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');
    let mapCount = 0;

    if (fs.existsSync(mapPath)) {
      try {
        const content = await fs.promises.readFile(mapPath, 'utf-8');
        const uuidMap = JSON.parse(content);
        mapCount = Object.keys(uuidMap).length;
        console.log(`[FileStorageManager] UUID mapping entries: ${mapCount}`);
      } catch (error) {
        issues.push(`UUID映射文件损坏: ${error}`);
        console.error('[FileStorageManager] ❌ Failed to read UUID mapping file:', error);
      }
    } else {
      issues.push('UUID映射文件不存在');
      console.warn('[FileStorageManager] ⚠️ UUID mapping file does not exist');
    }

    // 3. 检查实际文件数量
    const files = await fs.promises.readdir(this.storagePath);
    const fileCount = files.filter(f => f.endsWith('.md') && !f.startsWith('.')).length;
    console.log(`[FileStorageManager] Markdown files: ${fileCount}`);

    // 4. 验证一致性
    if (indexCount !== mapCount) {
      const issue = `索引数量(${indexCount})与映射数量(${mapCount})不一致`;
      issues.push(issue);
      console.error(`[FileStorageManager] ❌ ${issue}`);
    }

    if (indexCount !== fileCount) {
      const issue = `索引数量(${indexCount})与文件数量(${fileCount})不一致`;
      issues.push(issue);
      console.error(`[FileStorageManager] ❌ ${issue}`);
    }

    const isValid = issues.length === 0;

    if (isValid) {
      console.log('[FileStorageManager] ✅ Data integrity verified successfully');
    } else {
      console.error(`[FileStorageManager] ❌ Found ${issues.length} integrity issues:`, issues);
    }

    return {
      isValid,
      issues,
      stats: { indexCount, mapCount, fileCount }
    };
  }

  /**
   * 修复UUID映射
   */
  public async repairUuidMapping(): Promise<{
    success: boolean;
    repaired: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let repaired = 0;

    try {
      // 🔧 防御性编程：备份现有映射文件
      const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');
      const backupPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json.backup');

      if (fs.existsSync(mapPath)) {
        try {
          await fs.promises.copyFile(mapPath, backupPath);
          console.log(`[FileStorageManager] 💾 Created backup: ${backupPath}`);
        } catch (backupError) {
          console.error('[FileStorageManager] ⚠️ Failed to create backup:', backupError);
          // 不中断修复流程，备份失败不是致命错误
        }
      }

      // 1. 获取所有markdown文件
      const files = await fs.promises.readdir(this.storagePath);
      const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

      console.log(`[FileStorageManager] 🛠️️ Found ${mdFiles.length} markdown files to process`);

      // 2. 为每个文件添加/验证UUID映射
      for (const fileName of mdFiles) {
        try {
          const filePath = path.join(this.storagePath, fileName);

          // 检查文件是否存在
          if (!fs.existsSync(filePath)) {
            console.warn(`[FileStorageManager] File does not exist: ${fileName}`);
            continue;
          }

          // 解析markdown文件
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const { data } = require('gray-matter')(content);

          if (!data.id) {
            errors.push(`文件 ${fileName} 缺少UUID`);
            console.warn(`[FileStorageManager] ⚠️ File ${fileName} is missing UUID`);
            continue;
          }

          const uuid = String(data.id);

          // 直接检查并更新映射（不依赖 getFileNameByUuid）
          const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');
          let uuidMap: Record<string, string> = {};

          if (fs.existsSync(mapPath)) {
            try {
              const mapContent = await fs.promises.readFile(mapPath, 'utf-8');
              uuidMap = JSON.parse(mapContent);
            } catch (mapError) {
              console.error(`[FileStorageManager] ⚠️ Error reading UUID map:`, mapError);
              uuidMap = {};
            }
          }

          const existingMapping = uuidMap[uuid];
          if (!existingMapping || existingMapping !== fileName) {
            uuidMap[uuid] = fileName;
            await this.atomicWrite(mapPath, JSON.stringify(uuidMap, null, 2));
            repaired++;
            console.log(`[FileStorageManager] ✅ Repaired mapping: ${uuid} -> ${fileName}`);
          } else {
            console.log(`[FileStorageManager] ℹ️ Mapping already exists: ${uuid} -> ${fileName}`);
          }
        } catch (error) {
          const errorMsg = `处理文件 ${fileName} 失败: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[FileStorageManager] ❌ ${errorMsg}`);
        }
      }

      const success = true;
      console.log(`[FileStorageManager] 🛠️️ UUID mapping repair completed: ${repaired} repaired, ${errors.length} errors`);

      return { success, repaired, errors };
    } catch (error) {
      const errorMsg = `修复过程失败: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[FileStorageManager] ❌ ${errorMsg}`);
      return { success: false, repaired, errors };
    }
  }

  /**
   * 快速诊断（启动时调用）
   */
  public async quickDiagnostic(): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    console.log('[FileStorageManager] 🔍 Running quick diagnostic...');

    try {
      // 1. 检查存储路径是否存在
      if (!fs.existsSync(this.storagePath)) {
        issues.push('存储路径不存在');
        recommendations.push('检查存储路径配置');
        return { healthy: false, issues, recommendations };
      }

      // 2. 检查索引文件是否存在并统计文件数量
      const indexPath = path.join(this.storagePath, '.multitodo-metadata', 'index.json');
      const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');

      // 先统计文件数量
      const files = await fs.promises.readdir(this.storagePath);
      const mdFileCount = files.filter(f => f.endsWith('.md') && !f.startsWith('.')).length;

      console.log(`[FileStorageManager] 📊 Found ${mdFileCount} markdown files`);

      if (!fs.existsSync(indexPath)) {
        issues.push('索引文件不存在');
        recommendations.push('调用 rebuildIndex() 重建索引');
      } else {
        // 检查索引文件数量
        try {
          const indexContent = await fs.promises.readFile(indexPath, 'utf-8');
          const indexData = JSON.parse(indexContent);
          const indexCount = indexData.metadata?.todoCount || 0;

          if (indexCount !== mdFileCount) {
            issues.push(`索引数量(${indexCount})与文件数量(${mdFileCount})不匹配`);
            recommendations.push('调用 rebuildAllMetadata() 重建所有元数据');
          }
        } catch (indexError) {
          issues.push('索引文件损坏');
          recommendations.push('调用 rebuildAllMetadata() 重建所有元数据');
        }
      }

      // 3. 检查UUID映射文件是否存在
      if (!fs.existsSync(mapPath)) {
        issues.push('UUID映射文件不存在');
        recommendations.push('调用 rebuildAllMetadata() 重建所有元数据');
      } else {
        // 检查映射数量是否与文件数量匹配
        try {
          const mapContent = await fs.promises.readFile(mapPath, 'utf-8');
          const uuidMap = JSON.parse(mapContent);
          const mapCount = Object.keys(uuidMap).length;

          if (mapCount !== mdFileCount) {
            issues.push(`UUID映射数量(${mapCount})与文件数量(${mdFileCount})不匹配`);
            recommendations.push('调用 rebuildAllMetadata() 重建所有元数据');
          }
        } catch (mapError) {
          issues.push('UUID映射文件损坏');
          recommendations.push('调用 rebuildAllMetadata() 重建所有元数据');
        }
      }

      // 4. 检查是否有任何文件
      if (mdFileCount === 0) {
        issues.push('没有找到任何markdown文件');
        recommendations.push('检查待办数据是否已迁移');
      }

      // 5. 检查缓存状态
      console.log(`[FileStorageManager] 🗄️ Cache size: ${this.cache.size}, TTL: ${this.CACHE_TTL}ms`);

      const healthy = issues.length === 0;

      if (healthy) {
        console.log('[FileStorageManager] ✅ Quick diagnostic passed');
      } else {
        console.warn('[FileStorageManager] ⚠️ Quick diagnostic found issues:', issues);
      }

      return { healthy, issues, recommendations };
    } catch (error) {
      const errorMsg = `诊断失败: ${error instanceof Error ? error.message : String(error)}`;
      issues.push(errorMsg);
      console.error('[FileStorageManager] ❌', errorMsg);
      return { healthy: false, issues, recommendations };
    }
  }

  /**
   * 从磁盘完全重建所有映射和索引
   * 用于迁移后修复缺失的映射
   */
  public async rebuildAllMetadata(): Promise<{
    success: boolean;
    mappingsRepaired: number;
    indexRebuilt: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let mappingsRepaired = 0;

    try {
      console.log('[FileStorageManager] 🔧 Rebuilding all metadata from disk...');

      const mapPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json');
      const backupPath = path.join(this.storagePath, '.multitodo-metadata', 'uuid-to-file.json.backup');

      if (fs.existsSync(mapPath)) {
        await fs.promises.copyFile(mapPath, backupPath);
        console.log('[FileStorageManager] 💾 Backed up UUID mapping');
      }

      const files = await fs.promises.readdir(this.storagePath);
      const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

      console.log(`[FileStorageManager] 📁 Found ${mdFiles.length} markdown files`);

      const newUuidMap: Record<string, string> = {};

      for (const fileName of mdFiles) {
        try {
          const filePath = path.join(this.storagePath, fileName);
          const content = await fs.promises.readFile(filePath, 'utf-8');

          const { data } = require('gray-matter')(content);

          if (!data.id) {
            errors.push(`文件 ${fileName} 缺少 UUID，跳过`);
            continue;
          }

          const uuid = String(data.id);
          newUuidMap[uuid] = fileName;
          mappingsRepaired++;

          console.log(`[FileStorageManager] ✅ Mapped: ${uuid} -> ${fileName}`);
        } catch (error) {
          const errorMsg = `处理文件 ${fileName} 失败: ${error}`;
          errors.push(errorMsg);
          console.error(`[FileStorageManager] ❌ ${errorMsg}`);
        }
      }

      await this.atomicWrite(mapPath, JSON.stringify(newUuidMap, null, 2));
      console.log(`[FileStorageManager] 💾 Saved ${mappingsRepaired} UUID mappings`);

      console.log('[FileStorageManager] 🔄 Rebuilding index...');
      await this.fileIndexer.buildIndex();

      return {
        success: true,
        mappingsRepaired,
        indexRebuilt: true,
        errors
      };
    } catch (error) {
      const errorMsg = `重建失败: ${error}`;
      errors.push(errorMsg);
      console.error(`[FileStorageManager] ❌ ${errorMsg}`);
      return {
        success: false,
        mappingsRepaired,
        indexRebuilt: false,
        errors
      };
    }
  }
}