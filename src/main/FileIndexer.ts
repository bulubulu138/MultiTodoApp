import * as fs from 'fs';
import * as path from 'path';
import MiniSearch from 'minisearch';
import { Todo } from '../shared/types';

/**
 * 待办索引条目
 */
export interface TodoIndexEntry {
  uuid: string;
  title: string;
  contentPreview: string;
  status: string;
  priority: string;
  tags: string[];
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  filePath: string;
}

/**
 * 索引结构
 */
interface TodoIndex {
  metadata: {
    version: number;
    lastUpdated: number;
    todoCount: number;
  };
  todos: Map<string, TodoIndexEntry>;
  indexes: {
    byStatus: Map<string, Set<string>>;
    byPriority: Map<string, Set<string>>;
    byTags: Map<string, Set<string>>;
    byDateRange: Map<string, Set<string>>;
  };
  fullText: MiniSearch;
}

/**
 * 文件索引器
 * 提供高性能的搜索和过滤功能
 */
export class FileIndexer {
  private storagePath: string;
  private indexPath: string;
  private index: TodoIndex;
  private updateQueue: Set<string> = new Set();
  private updateTimer: NodeJS.Timeout | null = null;
  private readonly UPDATE_DELAY = 500; // 500ms 防抖

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.indexPath = path.join(storagePath, '.multitodo-metadata', 'index.json');
    this.index = this.createEmptyIndex();
  }

  /**
   * 创建空索引
   */
  private createEmptyIndex(): TodoIndex {
    return {
      metadata: {
        version: 1,
        lastUpdated: Date.now(),
        todoCount: 0
      },
      todos: new Map(),
      indexes: {
        byStatus: new Map(),
        byPriority: new Map(),
        byTags: new Map(),
        byDateRange: new Map()
      },
      fullText: new MiniSearch({
        fields: ['title', 'contentPreview', 'tags', 'keywords'],
        storeFields: ['uuid', 'title', 'status', 'priority', 'tags'],
        searchOptions: {
          boost: { title: 2, tags: 1.5, keywords: 1.3 },
          fuzzy: 0.2
        }
      })
    };
  }

  /**
   * 加载索引
   */
  async loadIndex(): Promise<void> {
    try {
      if (fs.existsSync(this.indexPath)) {
        const content = await fs.promises.readFile(this.indexPath, 'utf-8');
        const data = JSON.parse(content);

        // 重建索引结构
        this.index = this.deserializeIndex(data);

        console.log(`Index loaded: ${this.index.metadata.todoCount} todos`);
      } else {
        // 首次运行，构建索引
        await this.buildIndex();
      }
    } catch (error) {
      console.error('Error loading index:', error);
      // 加载失败，重建索引
      await this.buildIndex();
    }
  }

  /**
   * 确保索引已加载，避免重复加载
   */
  async ensureIndexLoaded(): Promise<void> {
    // 通过检查 todo 数量判断索引是否已加载
    if (this.index.metadata.todoCount > 0 || this.index.todos.size > 0) {
      console.log('[FileIndexer] Index already loaded, skipping');
      return;
    }

    console.log('[FileIndexer] Index not loaded, loading now...');
    await this.loadIndex();
  }

  /**
   * 保存索引
   */
  async saveIndex(): Promise<void> {
    try {
      const data = this.serializeIndex();
      await fs.promises.writeFile(
        this.indexPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving index:', error);
    }
  }

  /**
   * 构建索引（支持 Obsidian 风格）
   */
  async buildIndex(): Promise<void> {
    console.log('[FileIndexer] Building index...');
    console.log(`[FileIndexer] 📂 Storage path: ${this.storagePath}`);

    // 清空现有索引
    this.index = this.createEmptyIndex();

    // 扫描所有待办文件（支持新旧两种格式）
    const todoFiles = await this.scanTodoFiles();
    console.log(`[FileIndexer] 📁 Found ${todoFiles.length} todo files to index`);

    if (todoFiles.length === 0) {
      console.warn('[FileIndexer] ⚠️ No todo files found in directory');
    }

    let successCount = 0;
    let failCount = 0;

    for (const todoFile of todoFiles) {
      try {
        const entry = await this.createIndexEntryFromFile(todoFile);
        if (entry) {
          this.addToIndex(entry);
          console.log(`[FileIndexer] ✅ Indexed: "${entry.title}" (${entry.uuid})`);
          successCount++;
        } else {
          failCount++;
          console.warn(`[FileIndexer] ⚠️ Skipped (no entry returned): ${todoFile}`);
        }
      } catch (error) {
        failCount++;
        console.error(`[FileIndexer] ❌ Error indexing ${todoFile}:`, error);
      }
    }

    // 对失败的文件进行二次尝试（Phase 3.2: 失败文件恢复机制）
    if (failCount > 0) {
      console.log(`[FileIndexer] 🔄 Attempting to recover ${failCount} failed files...`);

      for (const todoFile of todoFiles) {
        try {
          const entry = await this.createIndexEntryFromFile(todoFile);
          // 只处理之前失败但现在成功的文件
          if (entry && !this.index.todos.has(entry.uuid)) {
            this.addToIndex(entry);
            successCount++;
            failCount--;
            console.log(`[FileIndexer] ✅ Recovered: "${entry.title}" (${entry.uuid})`);
          }
        } catch (error) {
          console.error(`[FileIndexer] ❌ Recovery failed for ${todoFile}:`, error);
        }
      }

      // 更新统计
      this.index.metadata.lastUpdated = Date.now();
      this.index.metadata.todoCount = this.index.todos.size;

      console.log(`[FileIndexer] 🔄 Recovery completed: ${successCount} total, ${failCount} failed`);
    }

    // 更新元数据（确保准确反映实际索引的数量）
    this.index.metadata.lastUpdated = Date.now();
    this.index.metadata.todoCount = this.index.todos.size;

    // 保存索引
    await this.saveIndex();

    console.log(`[FileIndexer] 📊 Index build complete: ${successCount} success, ${failCount} failed`);
    console.log(`[FileIndexer] ✅ Total indexed todos: ${this.index.metadata.todoCount}`);
  }

  /**
   * 添加待办到索引（Obsidian 风格）
   */
  addTodo(todo: Todo): Promise<void> {
    // 对于 Obsidian 风格，filePath 不重要，因为索引基于文件内容
    // UUID 从 frontmatter 中读取，而不是从路径提取
    const entry: TodoIndexEntry = {
      uuid: String(todo.id!), // 转换为字符串
      title: todo.title,
      contentPreview: this.generateContentPreview(todo.content),
      status: todo.status,
      priority: todo.priority,
      tags: this.parseTags(todo.tags),
      keywords: todo.keywords || [],
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      filePath: '' // Obsidian 风格不需要特定路径，基于 UUID 映射
    };

    this.addToIndex(entry);
    return this.saveIndex();
  }

  /**
   * 更新待办索引（增强版：添加并发控制和幂等性）
   */
  async updateTodo(todo: Todo): Promise<void> {
    const uuid = String(todo.id);
    const updateKey = `${uuid}_${todo.updatedAt}`; // 使用UUID和更新时间作为唯一键

    console.log(`[FileIndexer] 🔄 Updating index for todo: ${uuid} (version: ${todo.updatedAt})`);

    // 🔧 防御性编程：检查是否已经在更新队列中
    if (this.updateQueue.has(updateKey)) {
      console.log(`[FileIndexer] ⚠️ Update already in queue for ${updateKey}, skipping`);
      return;
    }

    // 添加到更新队列
    this.updateQueue.add(updateKey);

    try {
      // 先删除旧的索引条目（解决MiniSearch重复ID问题）
      this.removeTodoSilently(uuid);

      // 再添加新的索引条目
      await this.addTodo(todo);

      console.log(`[FileIndexer] ✅ Successfully updated index for todo: ${uuid}`);
    } finally {
      // 确保从队列中移除，即使操作失败
      this.updateQueue.delete(updateKey);
    }
  }

  /**
   * ✅ 新增：批量更新待办索引
   * 将多次索引更新合并为一次操作，大幅提升性能
   */
  async batchUpdateTodos(todos: Todo[]): Promise<void> {
    console.log(`[FileIndexer] 🔄 Batch updating ${todos.length} todos`);
    const startTime = Date.now();

    try {
      // 批量删除旧的索引条目
      todos.forEach(todo => {
        this.removeTodoSilently(String(todo.id));
      });

      // 批量添加新的索引条目
      todos.forEach(todo => {
        this.addToIndex({
          uuid: String(todo.id),
          title: todo.title,
          contentPreview: this.generateContentPreview(todo.content),
          status: todo.status,
          priority: todo.priority,
          tags: this.parseTags(todo.tags),
          keywords: todo.keywords || [],
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
          filePath: '' // Obsidian 风格不需要特定路径
        });
      });

      // 一次性保存索引
      await this.saveIndex();

      const duration = Date.now() - startTime;
      console.log(`[FileIndexer] ✅ Batch update completed in ${duration}ms (${todos.length} todos)`);
    } catch (error) {
      console.error(`[FileIndexer] ❌ Batch update failed:`, error);
      throw error;
    }
  }

  /**
   * 静默删除待办（不抛出异常）
   */
  private removeTodoSilently(uuid: string): void {
    try {
      const entry = this.index.todos.get(uuid);
      if (!entry) return;

      // 从主索引中删除
      this.index.todos.delete(uuid);

      // 从辅助索引中删除
      this.removeFromIndexes(uuid, entry);

      // 从全文搜索中删除
      try {
        this.index.fullText.remove({ id: uuid });
      } catch (error) {
        // MiniSearch.remove() 可能因为ID不存在而抛出异常，忽略
        console.debug(`[FileIndexer] ID ${uuid} not found in MiniSearch, skipping removal`);
      }

      // 更新元数据
      this.index.metadata.todoCount = this.index.todos.size;
    } catch (error) {
      console.warn(`[FileIndexer] Silent removal failed for ${uuid}:`, error);
      // 静默处理，不抛出异常
    }
  }

  /**
   * 从索引中删除待办
   */
  removeTodo(uuid: string): Promise<void> {
    const entry = this.index.todos.get(uuid);
    if (!entry) return Promise.resolve();

    // 从主索引中删除
    this.index.todos.delete(uuid);

    // 从辅助索引中删除
    this.removeFromIndexes(uuid, entry);

    // 从全文搜索中删除
    this.index.fullText.remove({ id: uuid });

    // 更新元数据
    this.index.metadata.todoCount = this.index.todos.size;

    return this.saveIndex();
  }

  /**
   * 搜索待办
   */
  async search(query: string): Promise<TodoIndexEntry[]> {
    const results = this.index.fullText.search(query);
    const entries: TodoIndexEntry[] = [];

    for (const result of results) {
      const entry = this.index.todos.get(result.id);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * 获取所有待办
   */
  async getAllTodos(): Promise<TodoIndexEntry[]> {
    return Array.from(this.index.todos.values());
  }

  /**
   * 按状态过滤
   */
  filterByStatus(status: string): TodoIndexEntry[] {
    const uuids = this.index.indexes.byStatus.get(status);
    if (!uuids) return [];

    return Array.from(uuids)
      .map(uuid => this.index.todos.get(uuid))
      .filter(Boolean) as TodoIndexEntry[];
  }

  /**
   * 按优先级过滤
   */
  filterByPriority(priority: string): TodoIndexEntry[] {
    const uuids = this.index.indexes.byPriority.get(priority);
    if (!uuids) return [];

    return Array.from(uuids)
      .map(uuid => this.index.todos.get(uuid))
      .filter(Boolean) as TodoIndexEntry[];
  }

  /**
   * 按标签过滤
   */
  filterByTags(tags: string[]): TodoIndexEntry[] {
    const results = new Set<string>();

    for (const tag of tags) {
      const uuids = this.index.indexes.byTags.get(tag);
      if (uuids) {
        uuids.forEach(uuid => results.add(uuid));
      }
    }

    return Array.from(results)
      .map(uuid => this.index.todos.get(uuid))
      .filter(Boolean) as TodoIndexEntry[];
  }

  // ==================== 辅助方法 ====================

  /**
   * 扫描待办文件（支持 Obsidian 风格 + 向后兼容旧格式）
   */
  private async scanTodoFiles(): Promise<string[]> {
    const todoFiles: string[] = [];

    try {
      const entries = await fs.promises.readdir(this.storagePath, { withFileTypes: true });

      // 1. 扫描 Obsidian 风格的 .md 文件
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          const fullPath = path.join(this.storagePath, entry.name);
          todoFiles.push(fullPath);
        }
      }

      // 2. 向后兼容：扫描旧格式的 todo-{uuid}/todo.md 目录
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('todo-')) {
          const todoPath = path.join(this.storagePath, entry.name, 'todo.md');
          if (fs.existsSync(todoPath)) {
            todoFiles.push(todoPath);
          }
        }
      }

      console.log(`[FileIndexer] scanTodoFiles: Found ${todoFiles.length} todo files`);
    } catch (error) {
      console.error('[FileIndexer] Error scanning todo files:', error);
    }

    return todoFiles;
  }

  /**
   * 创建索引条目（从文件读取 UUID）
   */
  private async createIndexEntryFromFile(todoPath: string): Promise<TodoIndexEntry | null> {
    const content = await fs.promises.readFile(todoPath, 'utf-8');

    // 解析 YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    const frontmatter = frontmatterMatch ? this.parseYaml(frontmatterMatch[1]) : {};

    // 从 frontmatter 中提取 UUID
    const uuid = frontmatter.id;
    if (uuid) {
      // 已有ID，正常处理
      return {
        uuid: String(uuid),
        title: frontmatter.title || 'Untitled',
        contentPreview: this.generateContentPreview(content),
        status: frontmatter.status || 'pending',
        priority: frontmatter.priority || 'medium',
        tags: this.parseTags(frontmatter.tags),
        keywords: frontmatter.keywords || [],
        createdAt: frontmatter.created_at || new Date().toISOString(),
        updatedAt: frontmatter.updated_at || new Date().toISOString(),
        filePath: todoPath
      };
    }

    // ID缺失，调用规范化器
    console.log(`[FileIndexer] No UUID found in ${todoPath}, normalizing...`);
    const { TodoFileNormalizer } = await import('./TodoFileNormalizer');
    const normalizer = new TodoFileNormalizer(this.storagePath);
    const result = await normalizer.normalizeFile(todoPath, content);

    if (result.success && result.todo) {
      // 规范化成功，使用新UUID创建索引条目
      console.log(`[FileIndexer] ✅ Successfully normalized ${todoPath}, UUID: ${result.todo.id}`);
      return this.buildIndexEntryFromTodo(result.todo, todoPath);
    }

    // 规范化失败，记录详细错误并跳过
    console.error(`[FileIndexer] ❌ Failed to normalize ${todoPath}:`, result.error);
    console.error(`[FileIndexer] Normalization result details:`, {
      filePath: todoPath,
      success: result.success,
      wasNormalized: result.wasNormalized,
      error: result.error,
      hasTodo: !!result.todo
    });
    return null;
  }

  /**
   * 从Todo对象构建索引条目
   */
  private buildIndexEntryFromTodo(todo: any, todoPath: string): TodoIndexEntry {
    return {
      uuid: String(todo.id),
      title: todo.title || 'Untitled',
      contentPreview: this.generateContentPreview(todo.content || ''),
      status: todo.status || 'pending',
      priority: todo.priority || 'medium',
      tags: this.parseTags(todo.tags),
      keywords: todo.keywords || [],
      createdAt: todo.createdAt || new Date().toISOString(),
      updatedAt: todo.updatedAt || new Date().toISOString(),
      filePath: todoPath
    };
  }

  /**
   * 添加到索引
   */
  private addToIndex(entry: TodoIndexEntry): void {
    // 添加到主索引
    this.index.todos.set(entry.uuid, entry);

    // 添加到辅助索引
    this.addToIndexes(entry);

    // 添加到全文搜索
    this.index.fullText.add({
      id: entry.uuid,
      title: entry.title,
      contentPreview: entry.contentPreview,
      tags: entry.tags.join(' '),
      keywords: entry.keywords.join(' ')
    });
  }

  /**
   * 添加到辅助索引
   */
  private addToIndexes(entry: TodoIndexEntry): void {
    // 按状态索引
    if (!this.index.indexes.byStatus.has(entry.status)) {
      this.index.indexes.byStatus.set(entry.status, new Set());
    }
    this.index.indexes.byStatus.get(entry.status)!.add(entry.uuid);

    // 按优先级索引
    if (!this.index.indexes.byPriority.has(entry.priority)) {
      this.index.indexes.byPriority.set(entry.priority, new Set());
    }
    this.index.indexes.byPriority.get(entry.priority)!.add(entry.uuid);

    // 按标签索引
    for (const tag of entry.tags) {
      if (!this.index.indexes.byTags.has(tag)) {
        this.index.indexes.byTags.set(tag, new Set());
      }
      this.index.indexes.byTags.get(tag)!.add(entry.uuid);
    }

    // 按日期范围索引（按月）
    const dateKey = this.getDateKey(entry.createdAt);
    if (!this.index.indexes.byDateRange.has(dateKey)) {
      this.index.indexes.byDateRange.set(dateKey, new Set());
    }
    this.index.indexes.byDateRange.get(dateKey)!.add(entry.uuid);
  }

  /**
   * 从辅助索引中删除
   */
  private removeFromIndexes(uuid: string, entry: TodoIndexEntry): void {
    // 从状态索引中删除
    const statusSet = this.index.indexes.byStatus.get(entry.status);
    if (statusSet) {
      statusSet.delete(uuid);
      if (statusSet.size === 0) {
        this.index.indexes.byStatus.delete(entry.status);
      }
    }

    // 从优先级索引中删除
    const prioritySet = this.index.indexes.byPriority.get(entry.priority);
    if (prioritySet) {
      prioritySet.delete(uuid);
      if (prioritySet.size === 0) {
        this.index.indexes.byPriority.delete(entry.priority);
      }
    }

    // 从标签索引中删除
    for (const tag of entry.tags) {
      const tagSet = this.index.indexes.byTags.get(tag);
      if (tagSet) {
        tagSet.delete(uuid);
        if (tagSet.size === 0) {
          this.index.indexes.byTags.delete(tag);
        }
      }
    }

    // 从日期索引中删除
    const dateKey = this.getDateKey(entry.createdAt);
    const dateSet = this.index.indexes.byDateRange.get(dateKey);
    if (dateSet) {
      dateSet.delete(uuid);
      if (dateSet.size === 0) {
        this.index.indexes.byDateRange.delete(dateKey);
      }
    }
  }

  /**
   * 序列化索引
   */
  private serializeIndex(): any {
    return {
      metadata: this.index.metadata,
      todos: Array.from(this.index.todos.entries()),
      indexes: {
        byStatus: Array.from(this.index.indexes.byStatus.entries()).map(([k, v]) => [k, Array.from(v)]),
        byPriority: Array.from(this.index.indexes.byPriority.entries()).map(([k, v]) => [k, Array.from(v)]),
        byTags: Array.from(this.index.indexes.byTags.entries()).map(([k, v]) => [k, Array.from(v)]),
        byDateRange: Array.from(this.index.indexes.byDateRange.entries()).map(([k, v]) => [k, Array.from(v)])
      },
      fullText: JSON.stringify(this.index.fullText)
    };
  }

  /**
   * 反序列化索引
   */
  private deserializeIndex(data: any): TodoIndex {
    const index: TodoIndex = {
      metadata: data.metadata,
      todos: new Map(data.todos),
      indexes: {
        byStatus: new Map(data.indexes.byStatus.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
        byPriority: new Map(data.indexes.byPriority.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
        byTags: new Map(data.indexes.byTags.map(([k, v]: [string, string[]]) => [k, new Set(v)])),
        byDateRange: new Map(data.indexes.byDateRange.map(([k, v]: [string, string[]]) => [k, new Set(v)]))
      },
      fullText: this.createEmptyIndex().fullText // 重新创建 MiniSearch 实例
    };

    return index;
  }

  /**
   * 生成内容预览
   */
  private generateContentPreview(content: string): string {
    if (!content) return '';

    // 移除 HTML 标签
    const text = content.replace(/<[^>]*>/g, '');

    // 提取前 200 个字符
    const preview = text.substring(0, 200);

    // 如果超过 200 字符，添加省略号
    return text.length > 200 ? preview + '...' : preview;
  }

  /**
   * 解析标签
   */
  private parseTags(tags: any): string[] {
    if (Array.isArray(tags)) {
      return tags.map(String);
    }
    if (typeof tags === 'string') {
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * 解析 YAML（简化版）
   */
  private parseYaml(yaml: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        result[key] = this.parseYamlValue(value);
      }
    }

    return result;
  }

  /**
   * 解析 YAML 值
   */
  private parseYamlValue(value: string): any {
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // 解析数组
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      return arrayContent.split(',').map(item => this.parseYamlValue(item.trim()));
    }

    // 解析布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;

    // 解析数字
    const num = Number(value);
    if (!isNaN(num)) return num;

    return value;
  }

  /**
   * 生成日期键（按月）
   */
  private getDateKey(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}