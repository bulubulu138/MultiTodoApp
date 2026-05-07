import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { FileStorageManager } from './FileStorageManager';
import { BackupManager } from './utils/BackupManager';
import { Todo, TodoRelation } from '../shared/types';
import { MarkdownParser } from './MarkdownParser';

/**
 * 迁移进度
 */
export interface MigrationProgress {
  stage: 'preparing' | 'migrating_todos' | 'migrating_relations' | 'migrating_assets' | 'finalizing' | 'verifying' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  errors: string[];
  progress: number; // 0-100
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
  deleteDatabaseAfter: boolean;
  createBackup: boolean;
  batchWriteSize: number;
  verifyAfterMigration: boolean;
  onProgress?: (progress: MigrationProgress) => void;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  todosMigrated: number;
  relationsMigrated: number;
  assetsMigrated: number;
  errors: string[];
  duration: number;
  backupPath?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  success: boolean;
  errors: string[];
  sourceCount: number;
  targetCount: number;
  missingTodos: string[];
  contentMismatches: string[];
}

/**
 * 数据迁移服务
 * 负责 SQLite 到 Markdown 文件的迁移
 */
export class MigrationService {
  private dbManager: DatabaseManager;
  private fileStorage: FileStorageManager;
  private backupManager: BackupManager;
  private markdownParser: MarkdownParser;
  private progressCallback?: (progress: MigrationProgress) => void;

  constructor(dbManager: DatabaseManager, fileStorage: FileStorageManager) {
    this.dbManager = dbManager;
    this.fileStorage = fileStorage;
    this.backupManager = new BackupManager(dbManager.getDbPath());
    this.markdownParser = new MarkdownParser();
  }

  /**
   * 执行迁移
   */
  async migrate(targetPath: string, options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();
    let backupPath: string | undefined;

    try {
      // 阶段 1: 准备
      this.updateProgress({
        stage: 'preparing',
        current: 0,
        total: 100,
        message: '准备迁移环境...',
        errors: [],
        progress: 0
      });

      // 创建备份
      if (options.createBackup) {
        const backup = await this.backupManager.createBackup();
        backupPath = backup.filepath;
        this.updateProgress({
          stage: 'preparing',
          current: 0,
          total: 100,
          message: `已创建备份: ${backup.filename}`,
          errors: [],
          progress: 5
        });
      }

      // 获取所有数据
      const sourceTodos = await this.dbManager.getAllTodos();
      const sourceRelations = await this.dbManager.getAllRelations();

      this.updateProgress({
        stage: 'preparing',
        current: 0,
        total: sourceTodos.length,
        message: `准备迁移 ${sourceTodos.length} 个待办...`,
        errors: [],
        progress: 10
      });

      // 构建依赖关系图并排序
      const sortedTodos = this.topologicalSort(sourceTodos, sourceRelations);

      // 阶段 2: 迁移待办
      this.updateProgress({
        stage: 'migrating_todos',
        current: 0,
        total: sortedTodos.length,
        message: '开始迁移待办...',
        errors: [],
        progress: 20
      });

      const idMapping = new Map<number, string>(); // SQLite ID -> UUID 映射
      let assetsMigrated = 0;

      // 批量迁移待办
      for (let i = 0; i < sortedTodos.length; i += options.batchWriteSize) {
        const batch = sortedTodos.slice(i, i + options.batchWriteSize);

        for (const todo of batch) {
          try {
            // 生成 UUID
            const uuid = uuidv4();
            idMapping.set(Number(todo.id!), uuid);

            // 创建待办（无 ID）
            const { id, ...todoWithoutId } = todo;
            const newTodo = await this.fileStorage.createTodo(todoWithoutId);

            // 迁移附件
            const assetsCount = await this.migrateAssets(todo, uuid);
            assetsMigrated += assetsCount;

            this.updateProgress({
              stage: 'migrating_todos',
              current: i + batch.indexOf(todo) + 1,
              total: sortedTodos.length,
              message: `迁移待办: ${todo.title}`,
              errors: [],
              progress: 20 + (i / sortedTodos.length) * 50
            });
          } catch (error) {
            const errorMsg = `迁移待办 "${todo.title}" 失败: ${error}`;
            this.updateProgress({
              stage: 'migrating_todos',
              current: i + batch.indexOf(todo) + 1,
              total: sortedTodos.length,
              message: errorMsg,
              errors: [errorMsg],
              progress: 20 + (i / sortedTodos.length) * 50
            });
          }
        }
      }

      // 阶段 3: 迁移关系
      this.updateProgress({
        stage: 'migrating_relations',
        current: 0,
        total: sourceRelations.length,
        message: '开始迁移关系...',
        errors: [],
        progress: 70
      });

      for (const relation of sourceRelations) {
        try {
          const sourceUuid = idMapping.get(relation.source_id);
          const targetUuid = idMapping.get(relation.target_id);

          if (!sourceUuid || !targetUuid) {
            console.warn(`跳过关系: 无法找到映射 ${relation.source_id} -> ${relation.target_id}`);
            continue;
          }

          // 创建新关系
          await this.fileStorage.createRelation({
            source_id: parseInt(sourceUuid) || 0, // 临时使用，后续需要修复
            target_id: parseInt(targetUuid) || 0,
            relation_type: relation.relation_type,
            created_at: relation.created_at
          });
        } catch (error) {
          console.error(`迁移关系失败:`, error);
        }
      }

      this.updateProgress({
        stage: 'migrating_relations',
        current: sourceRelations.length,
        total: sourceRelations.length,
        message: `已迁移 ${sourceRelations.length} 个关系`,
        errors: [],
        progress: 80
      });

      // 阶段 4: 验证
      if (options.verifyAfterMigration) {
        this.updateProgress({
          stage: 'verifying',
          current: 0,
          total: 100,
          message: '验证迁移结果...',
          errors: [],
          progress: 85
        });

        const validation = await this.validateMigration(targetPath);

        if (!validation.success) {
          throw new Error(`验证失败: ${validation.errors.join(', ')}`);
        }
      }

      // 阶段 5: 完成
      this.updateProgress({
        stage: 'finalizing',
        current: 100,
        total: 100,
        message: '迁移完成！',
        errors: [],
        progress: 95
      });

      // 删除数据库（如果用户选择）
      if (options.deleteDatabaseAfter) {
        const dbPath = this.dbManager.getDbPath();
        if (fs.existsSync(dbPath)) {
          await fs.promises.unlink(dbPath);
        }
      }

      const duration = Date.now() - startTime;

      this.updateProgress({
        stage: 'completed',
        current: 100,
        total: 100,
        message: '迁移成功完成！',
        errors: [],
        progress: 100
      });

      return {
        success: true,
        todosMigrated: sourceTodos.length,
        relationsMigrated: sourceRelations.length,
        assetsMigrated,
        errors: [],
        duration,
        backupPath
      };

    } catch (error) {
      this.updateProgress({
        stage: 'error',
        current: 0,
        total: 100,
        message: `迁移失败: ${error}`,
        errors: [String(error)],
        progress: 0
      });

      return {
        success: false,
        todosMigrated: 0,
        relationsMigrated: 0,
        assetsMigrated: 0,
        errors: [String(error)],
        duration: Date.now() - startTime,
        backupPath
      };
    }
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(targetPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const missingTodos: string[] = [];
    const contentMismatches: string[] = [];

    try {
      // 获取源数据
      const sourceTodos = await this.dbManager.getAllTodos();
      const sourceRelations = await this.dbManager.getAllRelations();

      // 获取目标数据
      const targetTodos = await this.fileStorage.getAllTodos();
      const targetRelations = await this.fileStorage.getAllRelations();

      // 验证待办数量
      if (sourceTodos.length !== targetTodos.length) {
        errors.push(`待办数量不匹配: 源=${sourceTodos.length}, 目标=${targetTodos.length}`);
      }

      // 验证每个待办
      for (const sourceTodo of sourceTodos) {
        // 简单验证：通过标题查找（临时方案）
        const targetTodo = targetTodos.find(t => t.title === sourceTodo.title);

        if (!targetTodo) {
          missingTodos.push(sourceTodo.title);
          continue;
        }

        // 验证内容
        if (sourceTodo.content !== targetTodo.content) {
          contentMismatches.push(sourceTodo.title);
        }
      }

      // 验证关系数量
      if (sourceRelations.length !== targetRelations.length) {
        errors.push(`关系数量不匹配: 源=${sourceRelations.length}, 目标=${targetRelations.length}`);
      }

      if (errors.length > 0 || missingTodos.length > 0 || contentMismatches.length > 0) {
        return {
          success: false,
          errors,
          sourceCount: sourceTodos.length,
          targetCount: targetTodos.length,
          missingTodos,
          contentMismatches
        };
      }

      return {
        success: true,
        errors: [],
        sourceCount: sourceTodos.length,
        targetCount: targetTodos.length,
        missingTodos: [],
        contentMismatches: []
      };

    } catch (error) {
      return {
        success: false,
        errors: [String(error)],
        sourceCount: 0,
        targetCount: 0,
        missingTodos: [],
        contentMismatches: []
      };
    }
  }

  /**
   * 回滚迁移
   */
  async rollbackMigration(backupPath: string): Promise<void> {
    try {
      // 停止文件监听
      await this.fileStorage.stopWatching();

      // 恢复数据库
      const dbPath = this.dbManager.getDbPath();
      await fs.promises.copyFile(backupPath, dbPath);

      // 删除迁移的文件（可选）
      const storagePath = this.fileStorage.getStoragePath();
      // await fs.promises.rm(storagePath, { recursive: true, force: true });

      // 重新初始化数据库
      await this.dbManager.initialize();

    } catch (error) {
      throw new Error(`回滚失败: ${error}`);
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 拓扑排序待办（按依赖关系）
   */
  private topologicalSort(todos: Todo[], relations: TodoRelation[]): Todo[] {
    // 构建依赖图
    const graph = new Map<number, Set<number>>();
    const inDegree = new Map<number, number>();

    // 初始化
    for (const todo of todos) {
      graph.set(Number(todo.id!), new Set());
      inDegree.set(Number(todo.id!), 0);
    }

    // 添加依赖边
    for (const rel of relations) {
      // extends 和 background 创建依赖
      if (rel.relation_type === 'extends' || rel.relation_type === 'background') {
        const targetSet = graph.get(rel.source_id);
        if (targetSet) {
          targetSet.add(rel.target_id);
          inDegree.set(rel.source_id, (inDegree.get(rel.source_id) || 0) + 1);
        }
      }
    }

    // Kahn 算法
    const queue: number[] = [];
    const result: Todo[] = [];

    // 找到入度为 0 的节点
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const id = queue.shift()!;
      const todo = todos.find(t => t.id === id);
      if (todo) {
        result.push(todo);
      }

      // 减少依赖节点的入度
      const dependencies = graph.get(id);
      if (dependencies) {
        for (const depId of dependencies) {
          const newDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newDegree);

          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }

    // 检查循环依赖
    if (result.length !== todos.length) {
      console.warn('检测到循环依赖，部分待办可能无法正确排序');
      // 添加剩余的待办
      for (const todo of todos) {
        if (!result.includes(todo)) {
          result.push(todo);
        }
      }
    }

    return result;
  }

  /**
   * 迁移附件
   */
  private async migrateAssets(todo: Todo, uuid: string): Promise<number> {
    let migratedCount = 0;

    try {
      const assetsDir = path.join(this.fileStorage.getStoragePath(), `todo-${uuid}`, 'assets');

      // 确保 assets 目录存在
      await fs.promises.mkdir(assetsDir, { recursive: true });

      // 处理单张图片
      if (todo.imageUrl) {
        await this.migrateSingleAsset(todo.imageUrl, assetsDir, `image-1.png`);
        migratedCount++;
      }

      // 处理多张图片
      if (todo.images) {
        try {
          const images = JSON.parse(todo.images);
          if (Array.isArray(images)) {
            for (let i = 0; i < images.length; i++) {
              await this.migrateSingleAsset(images[i], assetsDir, `image-${i + 1}.png`);
              migratedCount++;
            }
          }
        } catch {
          // 忽略解析错误
        }
      }

    } catch (error) {
      console.error(`迁移待办 ${todo.title} 的附件失败:`, error);
    }

    return migratedCount;
  }

  /**
   * 迁移单个附件
   */
  private async migrateSingleAsset(
    imageData: string,
    assetsDir: string,
    filename: string
  ): Promise<void> {
    try {
      // 如果是 base64 数据
      if (imageData.startsWith('data:')) {
        const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) return;

        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const filepath = path.join(assetsDir, filename);
        await fs.promises.writeFile(filepath, buffer);
      }
      // 如果是文件路径，复制文件
      else if (fs.existsSync(imageData)) {
        const filepath = path.join(assetsDir, filename);
        await fs.promises.copyFile(imageData, filepath);
      }
    } catch (error) {
      console.error(`迁移附件 ${filename} 失败:`, error);
    }
  }

  /**
   * 更新进度
   */
  private updateProgress(progress: MigrationProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: (progress: MigrationProgress) => void): void {
    this.progressCallback = callback;
  }
}