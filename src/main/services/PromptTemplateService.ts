// Prompt 模板服务 - 管理 Prompt 模板的 CRUD 操作
import Database from 'better-sqlite3';
import { PromptTemplate } from '../../shared/types';

export class PromptTemplateService {
  constructor(private db: Database.Database) {}

  /**
   * 获取所有 Prompt 模板
   */
  public async getAll(): Promise<PromptTemplate[]> {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM prompt_templates ORDER BY category, created_at DESC'
      ).all() as any[];
      return rows.map(row => this.parseTemplate(row));
    } catch (error) {
      console.error('Failed to get all prompt templates:', error);
      return [];
    }
  }

  /**
   * 根据 ID 获取 Prompt 模板
   */
  public async getById(id: number): Promise<PromptTemplate | null> {
    try {
      const row = this.db.prepare(
        'SELECT * FROM prompt_templates WHERE id = ?'
      ).get(id) as any;
      return row ? this.parseTemplate(row) : null;
    } catch (error) {
      console.error('Failed to get prompt template by id:', error);
      return null;
    }
  }

  /**
   * 创建新的 Prompt 模板
   */
  public async create(
    template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PromptTemplate> {
    try {
      const now = new Date().toISOString();
      const result = this.db.prepare(
        'INSERT INTO prompt_templates (name, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(template.name, template.content, template.category, now, now);

      const newTemplate = await this.getById(result.lastInsertRowid as number);
      if (!newTemplate) {
        throw new Error('Failed to create template');
      }
      return newTemplate;
    } catch (error) {
      console.error('Failed to create prompt template:', error);
      throw error;
    }
  }

  /**
   * 更新 Prompt 模板
   */
  public async update(id: number, updates: Partial<PromptTemplate>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
      }
      if (updates.category !== undefined) {
        fields.push('category = ?');
        values.push(updates.category);
      }

      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      this.db.prepare(
        `UPDATE prompt_templates SET ${fields.join(', ')} WHERE id = ?`
      ).run(...values);
    } catch (error) {
      console.error('Failed to update prompt template:', error);
      throw error;
    }
  }

  /**
   * 删除 Prompt 模板
   */
  public async delete(id: number): Promise<void> {
    try {
      this.db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id);
    } catch (error) {
      console.error('Failed to delete prompt template:', error);
      throw error;
    }
  }

  /**
   * 根据 category 获取 Prompt 模板
   */
  public async getByCategory(category: string): Promise<PromptTemplate[]> {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM prompt_templates WHERE category = ? ORDER BY created_at DESC'
      ).all(category) as any[];
      return rows.map(row => this.parseTemplate(row));
    } catch (error) {
      console.error('Failed to get prompt templates by category:', error);
      return [];
    }
  }

  /**
   * 解析数据库行数据为 PromptTemplate 对象
   */
  private parseTemplate(row: any): PromptTemplate {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
