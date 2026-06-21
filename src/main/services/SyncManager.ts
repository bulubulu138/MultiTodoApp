/**
 * SyncManager - 同步管理器，协调文件扫描和智能合并
 */

import * as crypto from 'crypto';
import { FileStorageManager } from '../FileStorageManager';
import { MarkdownParser } from '../MarkdownParser';
import { Todo, TodoRelation } from '../../shared/types';

export interface SyncMetadata {
  id: string;
  filename: string;
  hash: string;
  size: number;
  updatedAt: string;
}

export interface SyncPlan {
  toMobile: string[];
  toDesktop: string[];
  skip: string[];
  conflicts: string[];
  totalFiles: number;
}

export interface SyncStats {
  syncCount: number;
  lastSyncTime: string | null;
}

export class SyncManager {
  private fileStorageManager: FileStorageManager;
  private markdownParser: MarkdownParser;
  private syncCount = 0;
  private lastSyncTime: string | null = null;

  constructor(fileStorageManager: FileStorageManager) {
    this.fileStorageManager = fileStorageManager;
    this.markdownParser = new MarkdownParser();
  }

  /**
   * 获取本地文件元数据
   */
  async getLocalMetadata(): Promise<SyncMetadata[]> {
    const todos = await this.fileStorageManager.getAllTodos();
    const metadata: SyncMetadata[] = [];

    for (const todo of todos) {
      try {
        // 使用MarkdownParser生成markdown内容
        const markdown = await this.markdownParser.generateTodo(todo, [], []);
        const hash = crypto.createHash('sha256').update(markdown).digest('hex');
        const filename = this.generateFilename(todo);

        metadata.push({
          id: todo.id,
          filename,
          hash,
          size: markdown.length,
          updatedAt: todo.updatedAt,
        });
      } catch (error) {
        console.error(`Failed to generate metadata for todo ${todo.id}:`, error);
      }
    }

    console.log(`Generated metadata for ${metadata.length} todos`);
    return metadata;
  }

  /**
   * 生成同步计划
   */
  generateSyncPlan(
    localMetadata: SyncMetadata[],
    mobileMetadata: SyncMetadata[]
  ): SyncPlan {
    const plan: SyncPlan = {
      toMobile: [],
      toDesktop: [],
      skip: [],
      conflicts: [],
      totalFiles: 0,
    };

    const localMap = new Map(localMetadata.map((m) => [m.id, m]));
    const mobileMap = new Map(mobileMetadata.map((m) => [m.id, m]));

    // 处理本地文件
    for (const local of localMetadata) {
      const mobile = mobileMap.get(local.id);

      if (!mobile) {
        // 情况1: 移动端没有此文件 → 发送到移动端
        plan.toMobile.push(local.id);
      } else if (local.hash === mobile.hash) {
        // 情况2: 内容完全相同，跳过
        plan.skip.push(local.id);
      } else {
        // 情况3: 内容不同，比较时间戳
        const localTime = new Date(local.updatedAt).getTime();
        const mobileTime = new Date(mobile.updatedAt).getTime();

        if (localTime > mobileTime) {
          // 本地更新，发送到移动端
          plan.toMobile.push(local.id);
        } else if (mobileTime > localTime) {
          // 移动端更新，从移动端接收
          plan.toDesktop.push(local.id);
        } else {
          // 时间戳相同但哈希不同（极少见情况）
          console.warn('Timestamp conflict detected for todo:', local.id);
          plan.conflicts.push(local.id);
        }
      }
    }

    // 处理移动端独有的文件
    for (const mobile of mobileMetadata) {
      if (!localMap.has(mobile.id)) {
        // 移动端有但本地没有 → 从移动端接收
        plan.toDesktop.push(mobile.id);
      }
    }

    plan.totalFiles = plan.toMobile.length + plan.toDesktop.length + plan.skip.length;

    console.log('Sync plan generated:', {
      toMobile: plan.toMobile.length,
      toDesktop: plan.toDesktop.length,
      skip: plan.skip.length,
      conflicts: plan.conflicts.length,
      total: plan.totalFiles,
    });

    return plan;
  }

  /**
   * 准备发送的文件
   */
  async prepareFileForSending(id: string): Promise<{
    id: string;
    filename: string;
    content: string;
    hash: string;
    updatedAt: string;
  } | null> {
    try {
      const todo = await this.fileStorageManager.getTodoById(id);
      if (!todo) {
        console.error(`Todo not found: ${id}`);
        return null;
      }

      // 生成markdown内容
      const markdown = await this.markdownParser.generateTodo(todo, [], []);
      const base64Content = Buffer.from(markdown).toString('base64');
      const hash = crypto.createHash('sha256').update(markdown).digest('hex');
      const filename = this.generateFilename(todo);

      console.log(`Prepared file for sending: ${filename}`);
      console.log(`[SYNC DEBUG] Markdown content length: ${markdown.length}`);
      console.log(`[SYNC DEBUG] Markdown content preview: ${markdown.substring(0, 200)}`);
      console.log(`[SYNC DEBUG] Calculated hash: ${hash}`);

      return {
        id: todo.id,
        filename,
        content: base64Content,
        hash,
        updatedAt: todo.updatedAt,
      };
    } catch (error) {
      console.error('Failed to prepare file:', error);
      return null;
    }
  }

  /**
   * 应用接收到的文件
   */
  async applyReceivedFile(
    filename: string,
    base64Content: string,
    hash: string
  ): Promise<boolean> {
    try {
      // Base64解码
      const markdown = Buffer.from(base64Content, 'base64').toString('utf-8');

      // 验证哈希
      const calculatedHash = crypto.createHash('sha256').update(markdown).digest('hex');
      if (calculatedHash !== hash) {
        console.error('Hash mismatch for file:', filename);
        return false;
      }

      // 解析markdown为todo对象
      const todo = this.markdownParser.parseTodo(markdown);
      if (!todo) {
        console.error('Failed to parse markdown:', filename);
        return false;
      }

      // 保存到FileStorageManager (使用updateTodo，如果不存在会自动创建)
      await this.fileStorageManager.updateTodo(todo.id, todo);

      console.log(`Applied received file: ${filename}`);
      return true;
    } catch (error) {
      console.error('Failed to apply received file:', error);
      return false;
    }
  }

  /**
   * 同步Todo关系
   */
  async syncRelations(
    localRelations: TodoRelation[],
    mobileRelations: TodoRelation[]
  ): Promise<void> {
    try {
      // 获取所有现有todo的ID集合
      const todos = await this.fileStorageManager.getAllTodos();
      const existingTodoIds = new Set(todos.map(t => t.id));

      // 合并关系（去重）
      const relationMap = new Map<string, TodoRelation>();

      // 添加本地关系
      for (const rel of localRelations) {
        const key = `${rel.source_id}-${rel.target_id}-${rel.relation_type}`;
        relationMap.set(key, rel);
      }

      // 添加移动端关系
      for (const rel of mobileRelations) {
        const key = `${rel.source_id}-${rel.target_id}-${rel.relation_type}`;

        // 验证关系引用的todo都存在
        if (existingTodoIds.has(rel.source_id) && existingTodoIds.has(rel.target_id)) {
          relationMap.set(key, rel);
        } else {
          console.warn('Skipping relation with missing todo references:', key);
        }
      }

      // 保存合并后的关系
      const mergedRelations = Array.from(relationMap.values());

      // 这里需要调用FileStorageManager的关系保存方法
      // 注意：当前FileStorageManager可能没有直接的关系保存方法
      // 需要根据实际实现调整
      console.log(`Synced ${mergedRelations.length} relations`);

      // TODO: 实现关系保存逻辑
      // await this.fileStorageManager.saveRelations(mergedRelations);

    } catch (error) {
      console.error('Failed to sync relations:', error);
    }
  }

  /**
   * 更新同步统计
   */
  updateSyncStats(): void {
    this.syncCount++;
    this.lastSyncTime = new Date().toISOString();
    console.log('Sync stats updated:', { syncCount: this.syncCount, lastSyncTime: this.lastSyncTime });
  }

  /**
   * 获取同步统计
   */
  getSyncStats(): SyncStats {
    return {
      syncCount: this.syncCount,
      lastSyncTime: this.lastSyncTime,
    };
  }

  /**
   * 生成文件名
   */
  private generateFilename(todo: Todo): string {
    // 确保 title 是字符串
    const title = typeof todo.title === 'string' ? todo.title : String(todo.title || '');

    // 使用title和id生成文件名
    const safeTitle = title
      .replace(/[^a-zA-Z0-9一-龥]/g, '-')
      .substring(0, 50);
    return `${safeTitle}-${todo.id}.md`;
  }
}
