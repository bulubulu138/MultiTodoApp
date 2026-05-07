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
   * 构建索引
   */
  async buildIndex(): Promise<void> {
    console.log('Building index...');

    // 清空现有索引
    this.index = this.createEmptyIndex();

    // 扫描所有待办目录
    const todoDirs = await this.scanTodoDirectories();

    for (const todoDir of todoDirs) {
      const uuid = this.extractUuidFromPath(todoDir);
      if (!uuid) continue;

      const todoPath = path.join(todoDir, 'todo.md');
      if (!fs.existsSync(todoPath)) continue;

      try {
        const entry = await this.createIndexEntry(uuid, todoPath);
        this.addToIndex(entry);
      } catch (error) {
        console.error(`Error indexing ${uuid}:`, error);
      }
    }

    // 更新元数据
    this.index.metadata.lastUpdated = Date.now();
    this.index.metadata.todoCount = this.index.todos.size;

    // 保存索引
    await this.saveIndex();

    console.log(`Index built: ${this.index.metadata.todoCount} todos`);
  }

  /**
   * 添加待办到索引
   */
  addTodo(todo: Todo): Promise<void> {
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
      filePath: path.join(this.storagePath, `todo-${todo.id}`, 'todo.md')
    };

    this.addToIndex(entry);
    return this.saveIndex();
  }

  /**
   * 更新待办索引
   */
  updateTodo(todo: Todo): Promise<void> {
    return this.addTodo(todo);
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
   * 扫描待办目录
   */
  private async scanTodoDirectories(): Promise<string[]> {
    const todoDirs: string[] = [];

    try {
      const entries = await fs.promises.readdir(this.storagePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('todo-')) {
          const fullPath = path.join(this.storagePath, entry.name);
          todoDirs.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Error scanning todo directories:', error);
    }

    return todoDirs;
  }

  /**
   * 创建索引条目
   */
  private async createIndexEntry(uuid: string, todoPath: string): Promise<TodoIndexEntry> {
    const content = await fs.promises.readFile(todoPath, 'utf-8');

    // 简单解析 YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    const frontmatter = frontmatterMatch ? this.parseYaml(frontmatterMatch[1]) : {};

    return {
      uuid,
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
   * 从路径提取 UUID
   */
  private extractUuidFromPath(filePath: string): string | null {
    const match = filePath.match(/todo-([a-f0-9-]+)$/);
    return match ? match[1] : null;
  }

  /**
   * 生成日期键（按月）
   */
  private getDateKey(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}