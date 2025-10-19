// 数据库管理器 - 使用统一类型定义
const sqlite3 = require('sqlite3').verbose();
import * as path from 'path';
import { app } from 'electron';
import { Todo, Settings, TodoRelation, Note } from '../../shared/types';

export class DatabaseManager {
  private db: any = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'todo_app.db');
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err: any) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables()
            .then(() => this.initializeDefaultSettings())
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
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
      await this.runQuery(sql);
    }
    
    // 执行表迁移
    await this.migrateTodosTable();
  }

  private async migrateTodosTable(): Promise<void> {
    try {
      // 检查列是否存在
      const tableInfo: any[] = await this.allQuery("PRAGMA table_info(todos)");
      
      const hasStartTime = tableInfo.some((col: any) => col.name === 'startTime');
      const hasDeadline = tableInfo.some((col: any) => col.name === 'deadline');
      
      if (!hasStartTime) {
        console.log('Adding startTime column to todos table...');
        await this.runQuery('ALTER TABLE todos ADD COLUMN startTime TEXT');
        // 设置现有数据的默认开始时间为创建时间
        await this.runQuery('UPDATE todos SET startTime = createdAt WHERE startTime IS NULL');
        console.log('startTime column added successfully');
      }
      
      if (!hasDeadline) {
        console.log('Adding deadline column to todos table...');
        await this.runQuery('ALTER TABLE todos ADD COLUMN deadline TEXT');
        console.log('deadline column added successfully');
      }
      
      console.log('Todos table migration completed');
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(this: any, err: any) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  private getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: any, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings: { key: string; value: string }[] = [
      { key: 'theme', value: 'light' }, // 添加默认主题设置
      { key: 'calendarViewSize', value: 'compact' }, // 日历视图大小设置
    ];

    for (const setting of defaultSettings) {
      try {
        await this.runQuery(
          'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
          [setting.key, setting.value]
        );
      } catch (error) {
        console.error('Error initializing setting:', setting.key, error);
      }
    }
  }

  // Todo CRUD operations
  public async createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const result = await this.runQuery(
      `INSERT INTO todos (title, content, status, priority, tags, imageUrl, images, startTime, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        todo.title, 
        todo.content, 
        todo.status, 
        todo.priority, 
        todo.tags, 
        todo.imageUrl, 
        todo.images,
        todo.startTime || new Date().toISOString(),
        todo.deadline || null
      ]
    );
    return result.lastID;
  }

  public async getAllTodos(): Promise<Todo[]> {
    return this.allQuery('SELECT * FROM todos ORDER BY createdAt DESC');
  }

  public async getTodoById(id: number): Promise<Todo | null> {
    return this.getQuery('SELECT * FROM todos WHERE id = ?', [id]);
  }

  public async updateTodo(id: number, updates: Partial<Todo>): Promise<void> {
    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ');
    const values = Object.keys(updates).filter(key => key !== 'id').map(key => updates[key as keyof Todo]);
    
    await this.runQuery(
      `UPDATE todos SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  public async deleteTodo(id: number): Promise<void> {
    // Relations will be automatically deleted due to CASCADE
    await this.runQuery('DELETE FROM todos WHERE id = ?', [id]);
  }

  public async searchTodos(query: string): Promise<Todo[]> {
    return this.allQuery(
      `SELECT * FROM todos 
       WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
       ORDER BY createdAt DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
  }

  // Settings
  public async getSetting(key: string): Promise<string | null> {
    const result = await this.getQuery('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  }

  public async setSetting(key: string, value: string): Promise<void> {
    await this.runQuery(
      'INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
  }

  public async getSettings(): Promise<Settings[]> {
    return this.allQuery('SELECT * FROM settings ORDER BY key');
  }

  public async updateSettings(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.setSetting(key, value);
    }
  }

  public async toggleFishingMode(isEnabled?: boolean): Promise<boolean> {
    let newMode: string;
    
    if (typeof isEnabled === 'boolean') {
      newMode = isEnabled ? 'true' : 'false';
    } else {
      const currentMode = await this.getSetting('fishingMode');
      newMode = currentMode === 'true' ? 'false' : 'true';
    }
    
    await this.setSetting('fishingMode', newMode);
    return newMode === 'true';
  }

  // Export data
  public async exportAllData(): Promise<any> {
    const [todos, settings, relations, notes] = await Promise.all([
      this.getAllTodos(),
      this.getSettings(),
      this.getAllRelations(),
      this.getAllNotes()
    ]);

    return {
      todos,
      settings,
      relations,
      notes,
      exportedAt: new Date().toISOString()
    };
  }

  // TodoRelation CRUD operations
  public async createRelation(relation: Omit<TodoRelation, 'id' | 'created_at'>): Promise<number> {
    try {
      const result = await this.runQuery(
        `INSERT INTO todo_relations (source_id, target_id, relation_type)
         VALUES (?, ?, ?)`,
        [relation.source_id, relation.target_id, relation.relation_type]
      );
      return result.lastID;
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        throw new Error('This relation already exists');
      }
      throw error;
    }
  }

  public async getAllRelations(): Promise<TodoRelation[]> {
    return this.allQuery('SELECT * FROM todo_relations ORDER BY created_at DESC');
  }

  public async getRelationsByTodoId(todoId: number): Promise<TodoRelation[]> {
    return this.allQuery(
      'SELECT * FROM todo_relations WHERE source_id = ? OR target_id = ?',
      [todoId, todoId]
    );
  }

  public async getRelationsByType(relationType: string): Promise<TodoRelation[]> {
    return this.allQuery(
      'SELECT * FROM todo_relations WHERE relation_type = ?',
      [relationType]
    );
  }

  public async deleteRelation(id: number): Promise<void> {
    await this.runQuery('DELETE FROM todo_relations WHERE id = ?', [id]);
  }

  public async deleteRelationsByTodoId(todoId: number): Promise<void> {
    await this.runQuery(
      'DELETE FROM todo_relations WHERE source_id = ? OR target_id = ?',
      [todoId, todoId]
    );
  }

  public async deleteSpecificRelation(sourceId: number, targetId: number, relationType: string): Promise<void> {
    await this.runQuery(
      'DELETE FROM todo_relations WHERE source_id = ? AND target_id = ? AND relation_type = ?',
      [sourceId, targetId, relationType]
    );
  }

  public async relationExists(sourceId: number, targetId: number, relationType: string): Promise<boolean> {
    const result = await this.getQuery(
      'SELECT id FROM todo_relations WHERE source_id = ? AND target_id = ? AND relation_type = ?',
      [sourceId, targetId, relationType]
    );
    return !!result;
  }

  // ============ Notes CRUD ============
  
  public async getAllNotes(): Promise<Note[]> {
    return this.allQuery(
      'SELECT id, title, content, created_at as createdAt, updated_at as updatedAt FROM notes ORDER BY updated_at DESC',
      []
    );
  }

  public async createNote(noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const now = new Date().toISOString();
    const result: any = await this.runQuery(
      'INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [noteData.title, noteData.content, now, now]
    );
    return {
      id: result.lastID,
      ...noteData,
      createdAt: now,
      updatedAt: now
    };
  }

  public async updateNote(id: number, updates: Partial<Note>): Promise<Note> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await this.runQuery(
      `UPDATE notes SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const result = await this.getQuery(
      'SELECT id, title, content, created_at as createdAt, updated_at as updatedAt FROM notes WHERE id = ?',
      [id]
    );
    return result as Note;
  }

  public async deleteNote(id: number): Promise<void> {
    await this.runQuery('DELETE FROM notes WHERE id = ?', [id]);
  }

  public close(): void {
    if (this.db) {
      this.db.close((err: any) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}