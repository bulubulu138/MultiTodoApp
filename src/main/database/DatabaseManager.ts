// 数据库管理器 - 使用 better-sqlite3
import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { Todo, Settings, TodoRelation, Note } from '../../shared/types';

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
      
      console.log('Todos table migration completed');
    } catch (error) {
      console.error('Migration error:', error);
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
        const stmt = this.db!.prepare(
          `INSERT INTO todos (title, content, status, priority, tags, imageUrl, images, startTime, deadline)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        
        const result = stmt.run(
          todo.title,
          todo.content || '',
          todo.status,
          todo.priority,
          JSON.stringify(todo.tags || []),
          todo.imageUrl || null,
          JSON.stringify(todo.images || []),
          todo.startTime || null,
          todo.deadline || null
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
        if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
        if (updates.imageUrl !== undefined) { fields.push('imageUrl = ?'); values.push(updates.imageUrl); }
        if (updates.images !== undefined) { fields.push('images = ?'); values.push(JSON.stringify(updates.images)); }
        if (updates.startTime !== undefined) { fields.push('startTime = ?'); values.push(updates.startTime); }
        if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline); }

        fields.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`;
        this.db!.prepare(sql).run(...values);
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
        const settings: Settings = {};
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
      tags: row.tags ? JSON.parse(row.tags) : [],
      imageUrl: row.imageUrl,
      images: row.images ? JSON.parse(row.images) : [],
      startTime: row.startTime,
      deadline: row.deadline,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
