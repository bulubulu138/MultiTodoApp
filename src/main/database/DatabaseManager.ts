// Database manager - using better-sqlite3
import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { Todo, Settings, TodoRelation, Note } from '../../shared/types';
import { generateContentHash } from '../utils/hashUtils';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'todo_app.db');
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public getDb(): Database.Database | null {
    return this.db;
  }

  public async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      console.log('Connected to SQLite database');
      
      await this.createTables();
      await this.initializeDefaultSettings();
    } catch (err) {
          console.error('Database connection error:', err);
      throw err;
    }
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        tags TEXT,
        imageUrl TEXT,
        images TEXT,
        startTime TEXT,
        deadline TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS todo_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relation_type TEXT NOT NULL CHECK(relation_type IN ('extends', 'background', 'parallel')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES todos(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES todos(id) ON DELETE CASCADE,
        UNIQUE(source_id, target_id, relation_type)
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_relations_source ON todo_relations(source_id)`,
      `CREATE INDEX IF NOT EXISTS idx_relations_target ON todo_relations(target_id)`,
      `CREATE INDEX IF NOT EXISTS idx_relations_type ON todo_relations(relation_type)`,

      // 优化：为搜索字段添加索引，提升搜索性能
      `CREATE INDEX IF NOT EXISTS idx_todos_title ON todos(title)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_content ON todos(content)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(createdAt)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completedAt)`,
      
      `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      
      // 流程图相关表
      `CREATE TABLE IF NOT EXISTS flowcharts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        viewport TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_flowcharts_updated_at ON flowcharts(updated_at)`,
      
      `CREATE TABLE IF NOT EXISTS flowchart_nodes (
        id TEXT PRIMARY KEY,
        flowchart_id TEXT NOT NULL,
        type TEXT NOT NULL,
        position TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_flowchart_nodes_flowchart_id ON flowchart_nodes(flowchart_id)`,
      `CREATE INDEX IF NOT EXISTS idx_flowchart_nodes_updated_at ON flowchart_nodes(updated_at)`,
      
      `CREATE TABLE IF NOT EXISTS flowchart_edges (
        id TEXT PRIMARY KEY,
        flowchart_id TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        source_handle TEXT,
        target_handle TEXT,
        type TEXT DEFAULT 'default',
        label TEXT,
        style TEXT,
        connection_hash TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_flowchart_edges_flowchart_id ON flowchart_edges(flowchart_id)`,
      `CREATE INDEX IF NOT EXISTS idx_flowchart_edges_connection_hash ON flowchart_edges(connection_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_flowchart_edges_updated_at ON flowchart_edges(updated_at)`,
      
      // 流程图与待办关联表
      `CREATE TABLE IF NOT EXISTS flowchart_todo_associations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flowchart_id TEXT NOT NULL,
        todo_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE,
        FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
        UNIQUE(flowchart_id, todo_id)
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_flowchart_todo_assoc_flowchart ON flowchart_todo_associations(flowchart_id)`,
      `CREATE INDEX IF NOT EXISTS idx_flowchart_todo_assoc_todo ON flowchart_todo_associations(todo_id)`
    ];

    for (const sql of tables) {
      this.db!.prepare(sql).run();
    }
    
    // 执行表迁移
    await this.migrateTodosTable();
    
    // 创建流程图查询索引
    await this.createFlowchartIndexes();
  }

  private async createFlowchartIndexes(): Promise<void> {
    try {
      const { FlowchartRepository } = await import('./FlowchartRepository');
      const flowchartRepo = new FlowchartRepository(this.db!);
      flowchartRepo.createIndexes();
      console.log('Flowchart query indexes created');
    } catch (error) {
      console.error('Error creating flowchart indexes:', error);
      // 不抛出错误，因为这不是致命错误
    }
  }

  private async migrateTodosTable(): Promise<void> {
    try {
      // 检查列是否存在
      const tableInfo = this.db!.pragma('table_info(todos)') as any[];
      
      const hasStartTime = tableInfo.some((col: any) => col.name === 'startTime');
      const hasDeadline = tableInfo.some((col: any) => col.name === 'deadline');
      const hasDisplayOrder = tableInfo.some((col: any) => col.name === 'displayOrder');
      const hasContentHash = tableInfo.some((col: any) => col.name === 'contentHash');
      const hasKeywords = tableInfo.some((col: any) => col.name === 'keywords');
      const hasCompletedAt = tableInfo.some((col: any) => col.name === 'completedAt');
      
      if (!hasStartTime) {
        console.log('Adding startTime column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN startTime TEXT').run();
        // 设置现有数据的默认开始时间为创建时间
        this.db!.prepare('UPDATE todos SET startTime = createdAt WHERE startTime IS NULL').run();
        console.log('startTime column added successfully');
      }
      
      if (!hasDeadline) {
        console.log('Adding deadline column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN deadline TEXT').run();
        console.log('deadline column added successfully');
      }
      
      if (!hasDisplayOrder) {
        console.log('Adding displayOrder column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN displayOrder INTEGER').run();
        console.log('displayOrder column added successfully');
      }

      if (!hasContentHash) {
        console.log('Adding contentHash column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN contentHash TEXT').run();
        // 为现有数据生成哈希值
        await this.generateHashesForExistingTodos();
        console.log('contentHash column added successfully');
      }

      if (!hasKeywords) {
        console.log('Adding keywords column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN keywords TEXT').run();
        // 设置默认值为空数组的JSON字符串
        this.db!.prepare("UPDATE todos SET keywords = '[]' WHERE keywords IS NULL").run();
        console.log('keywords column added successfully');
      }

      // 添加 completedAt 列用于准确记录完成时间
      if (!hasCompletedAt) {
        console.log('Adding completedAt column to todos table...');
        this.db!.prepare('ALTER TABLE todos ADD COLUMN completedAt TEXT').run();
        // 为现有已完成的待办，使用 updatedAt 作为 completedAt 的初始值（数据迁移）
        this.db!.prepare('UPDATE todos SET completedAt = updatedAt WHERE status = "completed"').run();
        console.log('completedAt column added successfully');
      }
      
      // 迁移 displayOrders
      await this.migrateDisplayOrdersToJSON();
      
      console.log('Todos table migration completed');
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private async migrateDisplayOrdersToJSON(): Promise<void> {
    try {
      const tableInfo = this.db!.pragma('table_info(todos)') as any[];
      const hasDisplayOrders = tableInfo.some((col: any) => col.name === 'displayOrders');
      const hasDisplayOrder = tableInfo.some((col: any) => col.name === 'displayOrder');
      
      if (!hasDisplayOrders) {
        console.log('Adding displayOrders column and migrating data...');
        
        // 1. 添加新列
        this.db!.prepare('ALTER TABLE todos ADD COLUMN displayOrders TEXT').run();
        
        // 2. 迁移数据（使用事务保证数据安全）
        const transaction = this.db!.transaction(() => {
          if (hasDisplayOrder) {
            const todosWithOrder = this.db!.prepare(
              'SELECT id, displayOrder FROM todos WHERE displayOrder IS NOT NULL'
            ).all() as any[];
            
            console.log(`Migrating ${todosWithOrder.length} todos with displayOrder to displayOrders...`);
            
            const updateStmt = this.db!.prepare(
              'UPDATE todos SET displayOrders = ? WHERE id = ?'
            );
            
            for (const row of todosWithOrder) {
              const orders = JSON.stringify({ all: row.displayOrder });
              updateStmt.run(orders, row.id);
            }
          }
          
          // 3. 设置默认值（空对象）
          this.db!.prepare(
            "UPDATE todos SET displayOrders = '{}' WHERE displayOrders IS NULL"
          ).run();
        });
        
        transaction();
        console.log('displayOrders column added and data migrated successfully');
      }
    } catch (error) {
      console.error('Error migrating displayOrders:', error);
      throw error;
    }
  }

  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = {
      theme: 'light',
      language: 'zh-CN',
      notifications: 'true',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      // AI 相关设置
      ai_provider: 'disabled',
      ai_api_key: '',
      ai_api_endpoint: '',
      ai_enabled: 'false'
    };

    try {
      const existingSettings = this.db!.prepare('SELECT key FROM settings').all() as any[];
      const existingKeys = new Set(existingSettings.map((s: any) => s.key));

      for (const [key, value] of Object.entries(defaultSettings)) {
        if (!existingKeys.has(key)) {
          this.db!.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
        }
      }
    } catch (error) {
      console.error('Error initializing default settings:', error);
    }
  }

  // 批量操作
  public bulkUpdateTodos(updates: Array<{id: number; updates: Partial<Todo>}>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(() => {
          const updateStmt = this.db!.prepare(`
            UPDATE todos
            SET
              title = COALESCE(?, title),
              content = COALESCE(?, content),
              status = COALESCE(?, status),
              priority = COALESCE(?, priority),
              tags = COALESCE(?, tags),
              imageUrl = COALESCE(?, imageUrl),
              images = COALESCE(?, images),
              startTime = COALESCE(?, startTime),
              deadline = COALESCE(?, deadline),
              displayOrders = COALESCE(?, displayOrders),
              completedAt = CASE
                WHEN COALESCE(?, status) = 'completed' THEN COALESCE(?, completedAt)
                WHEN COALESCE(?, status) != 'completed' THEN NULL
                ELSE completedAt
              END,
              updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          updates.forEach(({ id, updates }) => {
            updateStmt.run(
              updates.title || null,
              updates.content || null,
              updates.status || null,
              updates.priority || null,
              updates.tags || null,
              updates.imageUrl || null,
              updates.images || null,
              updates.startTime || null,
              updates.deadline || null,
              updates.displayOrders ? JSON.stringify(updates.displayOrders) : null,
              updates.status || null,
              updates.status === 'completed' ? (updates.completedAt || new Date().toISOString()) : null,
              updates.status || null,
              id
            );
          });
        });

        transaction();
        console.log(`[批量更新] 成功更新 ${updates.length} 个待办事项`);
        resolve();
      } catch (error) {
        console.error('[批量更新] 更新失败:', error);
        reject(error);
      }
    });
  }

  public bulkUpdateDisplayOrders(updates: Array<{id: number; tabKey: string; displayOrder: number}>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(() => {
          updates.forEach(({ id, tabKey, displayOrder }) => {
            // 获取当前的 displayOrders
            const currentTodo = this.db!.prepare('SELECT displayOrders FROM todos WHERE id = ?').get(id) as any;
            let displayOrders: {[key: string]: number} = {};

            if (currentTodo && currentTodo.displayOrders) {
              try {
                displayOrders = JSON.parse(currentTodo.displayOrders);
              } catch (e) {
                console.error('解析 displayOrders 失败:', e);
              }
            }

            // 更新指定 tab 的序号
            displayOrders[tabKey] = displayOrder;

            // 保存更新
            this.db!.prepare('UPDATE todos SET displayOrders = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
              .run(JSON.stringify(displayOrders), id);
          });
        });

        transaction();
        console.log(`[批量更新] 成功更新 ${updates.length} 个待办事项的显示序号`);
        resolve();
      } catch (error) {
        console.error('[批量更新] 更新显示序号失败:', error);
        reject(error);
      }
    });
  }

  public bulkDeleteTodos(ids: number[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db!.transaction(() => {
          // 首先删除相关的关联关系
          const deleteRelationsStmt = this.db!.prepare('DELETE FROM todo_relations WHERE source_id = ? OR target_id = ?');
          ids.forEach(id => {
            deleteRelationsStmt.run(id, id);
          });

          // 然后删除待办事项
          const deleteStmt = this.db!.prepare('DELETE FROM todos WHERE id = ?');
          ids.forEach(id => {
            deleteStmt.run(id);
          });
        });

        transaction();
        console.log(`[批量删除] 成功删除 ${ids.length} 个待办事项`);
        
        // 异步清理流程图节点引用（不阻塞删除操作）
        try {
          const { FlowchartRepository } = await import('./FlowchartRepository');
          const flowchartRepo = new FlowchartRepository(this.db!);
          for (const id of ids) {
            await flowchartRepo.cleanupInvalidTodoReferences(String(id));
          }
          console.log(`[数据一致性] 已清理 ${ids.length} 个待办的流程图节点引用`);
        } catch (cleanupError) {
          // 清理失败不影响删除操作
          console.error('[数据一致性] 批量清理流程图节点引用失败:', cleanupError);
        }
        
        resolve();
      } catch (error) {
        console.error('[批量删除] 删除失败:', error);
        reject(error);
      }
    });
  }

  // Todo操作
  public createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    return new Promise((resolve, reject) => {
      try {
        const now = new Date().toISOString();
        // 生成内容哈希
        const contentHash = todo.contentHash || generateContentHash(todo.title, todo.content);
        // 处理 displayOrders
        const displayOrdersJSON = todo.displayOrders ? JSON.stringify(todo.displayOrders) : '{}';
        // 处理 keywords
        const keywordsJSON = todo.keywords ? JSON.stringify(todo.keywords) : '[]';
        // 处理 completedAt：如果状态为 completed，设置完成时间
        const completedAt = todo.status === 'completed' ? (todo.completedAt || now) : null;
        
        const stmt = this.db!.prepare(
          `INSERT INTO todos (title, content, status, priority, tags, imageUrl, images, startTime, deadline, displayOrder, displayOrders, contentHash, keywords, completedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        
        const result = stmt.run(
          todo.title,
          todo.content || '',
          todo.status,
          todo.priority,
          todo.tags || '',
          todo.imageUrl || null,
          todo.images || '',
          todo.startTime || null,
          todo.deadline || null,
          todo.displayOrder !== undefined ? todo.displayOrder : null,
          displayOrdersJSON,
          contentHash,
          keywordsJSON,
          completedAt,
          now,
          now
        );

        const newTodo = this.db!.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid) as any;
        resolve(this.parseTodo(newTodo));
      } catch (error) {
        reject(error);
      }
    });
  }

  public getTodoById(id: number): Promise<Todo | null> {
    return new Promise((resolve, reject) => {
      try {
        const row = this.db!.prepare('SELECT * FROM todos WHERE id = ?').get(id) as any;
        resolve(row ? this.parseTodo(row) : null);
      } catch (error) {
        reject(error);
      }
    });
  }

  public getAllTodos(): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare('SELECT * FROM todos ORDER BY createdAt DESC').all() as any[];
        resolve(rows.map(row => this.parseTodo(row)));
      } catch (error) {
        reject(error);
      }
    });
  }

  public updateTodo(id: number, updates: Partial<Todo>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const fields = [];
        const values = [];

        if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
        if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
        if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
        if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
        if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(updates.tags); }
        if (updates.imageUrl !== undefined) { fields.push('imageUrl = ?'); values.push(updates.imageUrl); }
        if (updates.images !== undefined) { fields.push('images = ?'); values.push(updates.images); }
        if (updates.startTime !== undefined) { fields.push('startTime = ?'); values.push(updates.startTime); }
        if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }
        if (updates.displayOrder !== undefined) { fields.push('displayOrder = ?'); values.push(updates.displayOrder); }
        if (updates.displayOrders !== undefined) { fields.push('displayOrders = ?'); values.push(JSON.stringify(updates.displayOrders)); }
        if (updates.contentHash !== undefined) { fields.push('contentHash = ?'); values.push(updates.contentHash); }
        if (updates.keywords !== undefined) { fields.push('keywords = ?'); values.push(JSON.stringify(updates.keywords)); }
        
        // 处理 completedAt 字段
        if (updates.completedAt !== undefined) { 
          fields.push('completedAt = ?'); 
          values.push(updates.completedAt); 
        } else if (updates.status !== undefined) {
          // 如果状态改为 completed，自动设置 completedAt
          if (updates.status === 'completed') {
            fields.push('completedAt = ?');
            values.push(new Date().toISOString());
          } else {
            // 如果从 completed 改为其他状态，清除 completedAt
            fields.push('completedAt = ?');
            values.push(null);
          }
        }

        // 如果标题或内容被更新，重新生成哈希
        if ((updates.title !== undefined || updates.content !== undefined) && updates.contentHash === undefined) {
          const todo = this.db!.prepare('SELECT * FROM todos WHERE id = ?').get(id) as any;
          if (todo) {
            const newTitle = updates.title !== undefined ? updates.title : todo.title;
            const newContent = updates.content !== undefined ? updates.content : todo.content;
            const newHash = generateContentHash(newTitle, newContent);
            fields.push('contentHash = ?');
            values.push(newHash);
          }
        }

        fields.push('updatedAt = ?');
        values.push(new Date().toISOString());
        values.push(id);

        const sql = `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`;
        this.db!.prepare(sql).run(...values);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // 批量更新显示序号（旧方法，保留向后兼容）
  public batchUpdateDisplayOrder(updates: {id: number, displayOrder: number}[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db!.prepare('UPDATE todos SET displayOrder = ?, updatedAt = ? WHERE id = ?');
        const transaction = this.db!.transaction(() => {
          const now = new Date().toISOString();
          for (const update of updates) {
            stmt.run(update.displayOrder, now, update.id);
          }
        });
        transaction();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // 批量更新多Tab独立显示序号
  public batchUpdateDisplayOrders(updates: {id: number, tabKey: string, displayOrder: number}[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(() => {
          const selectStmt = this.db!.prepare('SELECT displayOrders FROM todos WHERE id = ?');
          const updateStmt = this.db!.prepare('UPDATE todos SET displayOrders = ?, updatedAt = ? WHERE id = ?');
          const now = new Date().toISOString();
          
          for (const update of updates) {
            const row = selectStmt.get(update.id) as any;
            if (row) {
              const orders = row.displayOrders ? JSON.parse(row.displayOrders) : {};
              orders[update.tabKey] = update.displayOrder;
              updateStmt.run(JSON.stringify(orders), now, update.id);
            }
          }
        });
        
        transaction();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public deleteTodo(id: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // 使用事务确保原子性
        const transaction = this.db!.transaction(() => {
          // 1. 删除待办事项
          this.db!.prepare('DELETE FROM todos WHERE id = ?').run(id);
          
          // 2. 清理流程图节点中的 todoId 引用
          // 注意：这里不删除节点，只是清除 todoId 引用
          // 节点会显示 "(任务已删除)" 提示
        });
        
        transaction();
        
        // 3. 异步清理流程图节点引用（不阻塞删除操作）
        try {
          const { FlowchartRepository } = await import('./FlowchartRepository');
          const flowchartRepo = new FlowchartRepository(this.db!);
          await flowchartRepo.cleanupInvalidTodoReferences(String(id));
          console.log(`[数据一致性] 已清理待办 ${id} 的流程图节点引用`);
        } catch (cleanupError) {
          // 清理失败不影响删除操作
          console.error('[数据一致性] 清理流程图节点引用失败:', cleanupError);
        }
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public searchTodos(keyword: string): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        // 性能优化：限制搜索关键词长度
        if (!keyword || keyword.trim().length === 0) {
          resolve([]);
          return;
        }

        const searchKeyword = keyword.trim();
        const query = `%${searchKeyword}%`;

        // Optimize query: use more efficient SQL and limit results
        const rows = this.db!.prepare(
          `SELECT * FROM todos
           WHERE title LIKE ? OR content LIKE ?
           ORDER BY
             CASE WHEN title LIKE ? THEN 1 ELSE 2 END
             createdAt DESC
           LIMIT 1000`
        ).all(query, query, query) as any[];

        resolve(rows.map(row => this.parseTodo(row)));
      } catch (error) {
        console.error('Search failed:', error);
        reject(error);
      }
    });
  }

  // 新增：高级搜索方法（支持多条件过滤）
  public advancedSearch(options: {
    keyword?: string;
    status?: string;
    priority?: string;
    tags?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
    limit?: number;
  }): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        const conditions = [];
        const params = [];

        // 关键词搜索
        if (options.keyword && options.keyword.trim()) {
          const keyword = options.keyword.trim();
          const query = `%${keyword}%`;
          conditions.push('(title LIKE ? OR content LIKE ?)');
          params.push(query, query);
        }

        // 状态过滤
        if (options.status) {
          conditions.push('status = ?');
          params.push(options.status);
        }

        // 优先级过滤
        if (options.priority) {
          conditions.push('priority = ?');
          params.push(options.priority);
        }

        // 标签过滤
        if (options.tags && options.tags.length > 0) {
          const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
          conditions.push(`(${tagConditions})`);
          options.tags.forEach(tag => params.push(`%${tag}%`));
        }

        // 日期范围过滤
        if (options.dateRange) {
          if (options.dateRange.start) {
            conditions.push('createdAt >= ?');
            params.push(options.dateRange.start);
          }
          if (options.dateRange.end) {
            conditions.push('createdAt <= ?');
            params.push(options.dateRange.end);
          }
        }

        // 构建完整查询
        let query = 'SELECT * FROM todos';
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }

        // 添加排序和限制
        query += ' ORDER BY createdAt DESC';
        const limit = options.limit || 1000;
        query += ` LIMIT ${limit}`;

        const rows = this.db!.prepare(query).all(...params) as any[];
        resolve(rows.map(row => this.parseTodo(row)));
      } catch (error) {
        console.error('高级搜索失败:', error);
        reject(error);
      }
    });
  }

  // 设置操作
  public getSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare('SELECT key, value FROM settings').all() as any[];
        const settings: Record<string, string> = {};
        rows.forEach((row: any) => {
          settings[row.key] = row.value;
        });
        resolve(settings);
      } catch (error) {
        reject(error);
      }
    });
  }

  public updateSettings(settings: Partial<Settings>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db!.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = CURRENT_TIMESTAMP'
        );

        for (const [key, value] of Object.entries(settings)) {
          stmt.run(key, value, value);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // 关系操作
  public createRelation(relation: Omit<TodoRelation, 'id' | 'created_at'>): Promise<TodoRelation> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.db!.prepare(
          'INSERT INTO todo_relations (source_id, target_id, relation_type) VALUES (?, ?, ?)'
        ).run(relation.source_id, relation.target_id, relation.relation_type);

        const newRelation = this.db!.prepare('SELECT * FROM todo_relations WHERE id = ?').get(result.lastInsertRowid) as any;
        resolve(newRelation);
      } catch (error) {
        reject(error);
      }
    });
  }

  public getRelationsByTodoId(todoId: number): Promise<TodoRelation[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare(
          'SELECT * FROM todo_relations WHERE source_id = ? OR target_id = ?'
        ).all(todoId, todoId) as any[];
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  public deleteRelation(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db!.prepare('DELETE FROM todo_relations WHERE id = ?').run(id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public deleteRelationsByTodoId(todoId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db!.prepare('DELETE FROM todo_relations WHERE source_id = ? OR target_id = ?').run(todoId, todoId);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public getAllRelations(): Promise<TodoRelation[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare('SELECT * FROM todo_relations').all() as any[];
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  public getRelationsByType(relationType: string): Promise<TodoRelation[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare('SELECT * FROM todo_relations WHERE relation_type = ?').all(relationType) as any[];
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  public deleteSpecificRelation(sourceId: number, targetId: number, relationType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db!.prepare('DELETE FROM todo_relations WHERE source_id = ? AND target_id = ? AND relation_type = ?')
          .run(sourceId, targetId, relationType);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public relationExists(sourceId: number, targetId: number, relationType: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const row = this.db!.prepare('SELECT COUNT(*) as count FROM todo_relations WHERE source_id = ? AND target_id = ? AND relation_type = ?')
          .get(sourceId, targetId, relationType) as any;
        resolve(row.count > 0);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 笔记操作
  public createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    return new Promise((resolve, reject) => {
      try {
        const now = new Date().toISOString();
        const result = this.db!.prepare(
          'INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).run(note.title, note.content, now, now);

        const newNote = this.db!.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as Note;
        resolve(newNote);
      } catch (error) {
        reject(error);
      }
    });
  }

  public getNoteById(id: number): Promise<Note | null> {
    return new Promise((resolve, reject) => {
      try {
        const row = this.db!.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined;
        resolve(row || null);
      } catch (error) {
        reject(error);
      }
    });
  }

  public getAllNotes(): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as Note[];
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  public updateNote(id: number, updates: Partial<Note>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
    const now = new Date().toISOString();
        const fields = [];
        const values = [];

        if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
        if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

        const sql = `UPDATE notes SET ${fields.join(', ')} WHERE id = ?`;
        this.db!.prepare(sql).run(...values);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public deleteNote(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db!.prepare('DELETE FROM notes WHERE id = ?').run(id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private parseTodo(row: any): Todo {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      status: row.status,
      priority: row.priority,
      tags: row.tags || '',
      imageUrl: row.imageUrl,
      images: row.images || '',
      startTime: row.startTime,
      deadline: row.deadline,
      displayOrder: row.displayOrder !== null ? row.displayOrder : undefined,
      displayOrders: row.displayOrders ? JSON.parse(row.displayOrders) : {},
      contentHash: row.contentHash,
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  // 为现有待办生成哈希值
  private async generateHashesForExistingTodos(): Promise<void> {
    try {
      const todos = this.db!.prepare('SELECT * FROM todos WHERE contentHash IS NULL').all() as any[];
      
      for (const todo of todos) {
        const hash = generateContentHash(todo.title, todo.content);
        this.db!.prepare('UPDATE todos SET contentHash = ? WHERE id = ?').run(hash, todo.id);
      }
      
      console.log(`Generated hashes for ${todos.length} existing todos`);
    } catch (error) {
      console.error('Error generating hashes for existing todos:', error);
    }
  }

  // 根据哈希值查找重复的待办
  public findDuplicateTodo(contentHash: string, excludeId?: number): Promise<Todo | null> {
    return new Promise((resolve, reject) => {
      try {
        let query = 'SELECT * FROM todos WHERE contentHash = ?';
        const params: any[] = [contentHash];
        
        if (excludeId) {
          query += ' AND id != ?';
          params.push(excludeId);
        }
        
        query += ' LIMIT 1';
        
        const row = this.db!.prepare(query).get(...params) as any;
        resolve(row ? this.parseTodo(row) : null);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 更新待办关键词
  public updateTodoKeywords(id: number, keywords: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const keywordsJSON = JSON.stringify(keywords);
        this.db!.prepare('UPDATE todos SET keywords = ?, updatedAt = ? WHERE id = ?')
          .run(keywordsJSON, new Date().toISOString(), id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // 获取所有待办用于批量关键词生成
  public getTodosWithoutKeywords(): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.db!.prepare(
          "SELECT * FROM todos WHERE keywords IS NULL OR keywords = '[]'"
        ).all() as any[];
        resolve(rows.map(row => this.parseTodo(row)));
      } catch (error) {
        reject(error);
      }
    });
  }

  // 根据关键词获取相似待办
  public getSimilarTodos(keywords: string[], excludeId?: number, limit: number = 10): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        // 获取所有待办（除了当前待办）
        let query = 'SELECT * FROM todos WHERE keywords IS NOT NULL AND keywords != ?';
        const params: any[] = ['[]'];
        
        if (excludeId) {
          query += ' AND id != ?';
          params.push(excludeId);
        }
        
        const rows = this.db!.prepare(query).all(...params) as any[];
        const todos = rows.map(row => this.parseTodo(row));
        
        // 如果没有关键词，直接返回空数组
        if (!keywords || keywords.length === 0) {
          resolve([]);
          return;
        }
        
        // 计算相似度并排序
        const todosWithSimilarity = todos.map(todo => {
          const todoKeywords = todo.keywords || [];
          const similarity = this.calculateJaccardSimilarity(keywords, todoKeywords);
          return { todo, similarity };
        });
        
        // 过滤相似度 > 0.2 的待办，按相似度降序排序
        const filtered = todosWithSimilarity
          .filter(item => item.similarity > 0.2)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit)
          .map(item => item.todo);
        
        resolve(filtered);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 计算 Jaccard 相似度
  private calculateJaccardSimilarity(keywords1: string[], keywords2: string[]): number {
    if (!keywords1 || !keywords2 || keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    // 交集
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    // 并集
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
