// 数据库管理器 - 使用 better-sqlite3
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
      
      `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ];

    for (const sql of tables) {
      this.db!.prepare(sql).run();
    }
    
    // 执行表迁移
    await this.migrateTodosTable();
  }

  private async migrateTodosTable(): Promise<void> {
    try {
      // 检查列是否存在
      const tableInfo = this.db!.pragma('table_info(todos)') as any[];
      
      const hasStartTime = tableInfo.some((col: any) => col.name === 'startTime');
      const hasDeadline = tableInfo.some((col: any) => col.name === 'deadline');
      const hasDisplayOrder = tableInfo.some((col: any) => col.name === 'displayOrder');
      const hasContentHash = tableInfo.some((col: any) => col.name === 'contentHash');
      
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
      sortOrder: 'desc'
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

  // Todo操作
  public createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    return new Promise((resolve, reject) => {
      try {
        const now = new Date().toISOString();
        // 生成内容哈希
        const contentHash = todo.contentHash || generateContentHash(todo.title, todo.content);
        // 处理 displayOrders
        const displayOrdersJSON = todo.displayOrders ? JSON.stringify(todo.displayOrders) : '{}';
        
        const stmt = this.db!.prepare(
          `INSERT INTO todos (title, content, status, priority, tags, imageUrl, images, startTime, deadline, displayOrder, displayOrders, contentHash, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    return new Promise((resolve, reject) => {
      try {
        this.db!.prepare('DELETE FROM todos WHERE id = ?').run(id);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public searchTodos(keyword: string): Promise<Todo[]> {
    return new Promise((resolve, reject) => {
      try {
        const query = `%${keyword}%`;
        const rows = this.db!.prepare(
          'SELECT * FROM todos WHERE title LIKE ? OR content LIKE ? ORDER BY createdAt DESC'
        ).all(query, query) as any[];
        
        resolve(rows.map(row => this.parseTodo(row)));
      } catch (error) {
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

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
