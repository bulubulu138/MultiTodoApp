// 简化的数据库管理器 - 仅用于设置和元数据
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { Settings } from '../../shared/types';

export interface TodoRelation {
  id: number;
  source_id: number;
  target_id: number;
  relation_type: string;
  created_at: string;
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'settings.db');
    }
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
      this.db.pragma('foreign_keys = ON');
      console.log('Connected to SQLite database for settings');

      await this.createTables();
      await this.initializeDefaultSettings();
    } catch (err) {
      console.error('Database connection error:', err);
      throw err;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // 创建设置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建简单的元数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async initializeDefaultSettings(): Promise<void> {
    if (!this.db) return;

    const defaultSettings: Settings = {
      storageMode: 'file',
      storagePath: '',
      theme: 'purple',
      language: 'zh-CN',
      aiProvider: 'disabled',
      aiApiKey: '',
      aiModel: ''
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      const existing = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      if (!existing) {
        this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
      }
    }
  }

  public async getSettings(): Promise<Settings> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: any = {};

    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return settings as Settings;
  }

  public async updateSettings(settings: Partial<Settings>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const [key, value] of Object.entries(settings)) {
      this.db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
      `).run(key, JSON.stringify(value), JSON.stringify(value));
    }
  }

  // 简化的todo和relations方法（主要使用FileStorageManager，这些仅用于兼容）
  public async getAllTodos(): Promise<any[]> {
    return []; // 主要数据存储在文件系统
  }

  public async getTodoById(id: number): Promise<any | null> {
    return null; // 主要数据存储在文件系统
  }

  public async getAllRelations(): Promise<TodoRelation[]> {
    return []; // 关系数据主要使用文件系统
  }

  public async getRelationsByTodoId(todoId: number): Promise<TodoRelation[]> {
    return []; // 关系数据主要使用文件系统
  }

  public async createRelation(relation: TodoRelation): Promise<TodoRelation> {
    return { ...relation, id: Math.random(), created_at: new Date().toISOString() };
  }

  public async deleteRelation(id: number): Promise<void> {
    // 删除关系主要使用文件系统
  }

  public async updateTodo(id: number, updates: any): Promise<void> {
    // 更新todo主要使用文件系统
  }

  public async deleteTodo(id: number): Promise<void> {
    // 删除todo主要使用文件系统
  }

  public async findDuplicateTodo(contentHash: string, excludeId?: number): Promise<any | null> {
    return null; // 主要数据存储在文件系统
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  public databaseExists(): boolean {
    return fs.existsSync(this.dbPath);
  }

  public verifyDatabase(): boolean {
    try {
      if (!this.databaseExists()) return false;
      const testDb = new Database(this.dbPath, { readonly: true });
      testDb.prepare('SELECT 1').get();
      testDb.close();
      return true;
    } catch {
      return false;
    }
  }

  public getDatabaseSize(): number {
    try {
      return fs.statSync(this.dbPath).size;
    } catch {
      return 0;
    }
  }
}
