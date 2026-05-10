import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { FileStorageManager } from './FileStorageManager';
import { BackupManager } from './utils/BackupManager';
import { Todo, TodoRelation } from '../shared/types';
import { MarkdownParser } from './MarkdownParser';
import { toNumberId } from '../shared/utils/typeUtils';

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
  forceClean?: boolean; // 强制清理目标路径的旧数据
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

      // 检查并清理目标路径的旧数据
      const hasOldData = await this.checkTargetPathHasData(targetPath);
      if (hasOldData) {
        if (options.forceClean) {
          console.log(`[Migration] 目标路径已有数据，执行清理: ${targetPath}`);
          await this.cleanTargetPath(targetPath);
          this.updateProgress({
            stage: 'preparing',
            current: 0,
            total: 100,
            message: '已清理目标路径的旧数据',
            errors: [],
            progress: 8
          });
        } else {
          // 不强制清理，报错让用户确认
          const error = '目标路径已存在数据，请先清理或设置 forceClean 选项';
          console.error(`[Migration] ${error}`);
          return {
            success: false,
            todosMigrated: 0,
            relationsMigrated: 0,
            assetsMigrated: 0,
            errors: [error],
            duration: 0
          };
        }
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

            // 添加迁移前的调试日志
            console.log(`[Migration] Creating todo: "${todo.title}"`);
            console.log(`[Migration] todo.imageUrl: ${todo.imageUrl ? 'present (' + todo.imageUrl.substring(0, 50) + '...)' : 'absent'}`);
            console.log(`[Migration] todo.images: ${todo.images ? 'present (' + todo.images.substring(0, 50) + '...)' : 'absent'}`);

            const newTodo = await this.fileStorage.createTodo(todoWithoutId);

            // 注意：附件现在由 FileStorageManager.createTodo 自动处理
            // 所以这里不再需要调用 migrateAssets

            console.log(`[Migration] Successfully created todo: "${todo.title}"`);

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
          const sourceUuid = idMapping.get(toNumberId(relation.source_id));
          const targetUuid = idMapping.get(toNumberId(relation.target_id));

          if (!sourceUuid || !targetUuid) {
            console.warn(`跳过关系: 无法找到映射 ${relation.source_id} -> ${relation.target_id}`);
            continue;
          }

          // 创建新关系 - 直接使用 UUID 字符串
          await this.fileStorage.createRelation({
            source_id: sourceUuid, // UUID 字符串
            target_id: targetUuid, // UUID 字符串
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
   * 验证迁移结果（直接扫描文件系统版本）
   */
  async validateMigration(targetPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const missingTodos: string[] = [];
    const contentMismatches: string[] = [];

    console.log('[validateMigration] ===== STARTING FILE SYSTEM VALIDATION =====');

    try {
      // 获取源数据
      const sourceTodos = await this.dbManager.getAllTodos();
      const sourceRelations = await this.dbManager.getAllRelations();

      console.log(`[validateMigration] Source data: ${sourceTodos.length} todos, ${sourceRelations.length} relations`);

      // 直接扫描文件系统获取实际文件数量（不依赖索引器）
      const actualMarkdownFiles = await this.scanMarkdownFiles(targetPath);
      console.log(`[validateMigration] Found ${actualMarkdownFiles.length} .md files in filesystem`);

      // 读取 UUID 映射
      const uuidMapPath = path.join(targetPath, '.multitodo-metadata', 'uuid-to-file.json');
      let uuidMap: Record<string, string> = {};

      if (fs.existsSync(uuidMapPath)) {
        const content = await fs.promises.readFile(uuidMapPath, 'utf-8');
        uuidMap = JSON.parse(content);
        console.log(`[validateMigration] UUID map loaded: ${Object.keys(uuidMap).length} mappings`);
      } else {
        console.warn('[validateMigration] UUID map file not found, assuming empty');
      }

      // 检查每个源待办是否成功迁移
      let successfulMigrations = 0;

      for (const sourceTodo of sourceTodos) {
        if (!sourceTodo.id) {
          console.error(`[validateMigration] ❌ Todo missing ID: ${sourceTodo.title}`);
          missingTodos.push(sourceTodo.title);
          continue;
        }

        const expectedFileName = uuidMap[String(sourceTodo.id)];

        if (expectedFileName) {
          // 检查对应的 .md 文件是否存在
          const expectedFilePath = path.join(targetPath, expectedFileName);

          if (fs.existsSync(expectedFilePath)) {
            console.log(`[validateMigration] ✅ Todo "${sourceTodo.title}" (${sourceTodo.id}) exists as ${expectedFileName}`);
            successfulMigrations++;
          } else {
            const errorMsg = `待办文件不存在: ${sourceTodo.title} (${expectedFileName})`;
            console.error(`[validateMigration] ❌ ${errorMsg}`);
            missingTodos.push(sourceTodo.title);
          }
        } else {
          const errorMsg = `待办未在映射中: ${sourceTodo.title} (${String(sourceTodo.id)})`;
          console.error(`[validateMigration] ❌ ${errorMsg}`);
          missingTodos.push(sourceTodo.title);
        }
      }

      console.log(`[validateMigration] Migration success: ${successfulMigrations}/${sourceTodos.length}`);

      // 生成验证结果
      const validationSuccess = successfulMigrations === sourceTodos.length;

      if (validationSuccess) {
        console.log('[validateMigration] ===== VALIDATION SUCCESSFUL =====');
        return {
          success: true,
          errors: [],
          sourceCount: sourceTodos.length,
          targetCount: actualMarkdownFiles.length,
          missingTodos: [],
          contentMismatches: []
        };
      } else {
        const errorMsg = `迁移验证失败: 期望${sourceTodos.length}个待办，实际成功${successfulMigrations}个`;
        console.error(`[validateMigration] ${errorMsg}`);
        console.error(`[validateMigration] Missing todos: ${missingTodos.join(', ')}`);

        return {
          success: false,
          errors: [errorMsg],
          sourceCount: sourceTodos.length,
          targetCount: actualMarkdownFiles.length,
          missingTodos,
          contentMismatches: []
        };
      }

    } catch (error) {
      console.error('[validateMigration] Validation exception:', error);
      return {
        success: false,
        errors: [`验证异常: ${String(error)}`],
        sourceCount: 0,
        targetCount: 0,
        missingTodos: [],
        contentMismatches: []
      };
    }
  }

  /**
   * 扫描文件系统中的 Markdown 文件（不依赖索引器）
   */
  private async scanMarkdownFiles(targetPath: string): Promise<string[]> {
    const markdownFiles: string[] = [];

    try {
      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });

      for (const entry of entries) {
        // 扫描所有 .md 文件（Obsidian 风格）
        if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          markdownFiles.push(entry.name);
        }
      }

      console.log(`[scanMarkdownFiles] Found ${markdownFiles.length} .md files`);
    } catch (error) {
      console.error('[scanMarkdownFiles] Error scanning files:', error);
    }

    return markdownFiles;
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
        const sourceId = toNumberId(rel.source_id);
        const targetId = toNumberId(rel.target_id);
        const targetSet = graph.get(sourceId);
        if (targetSet) {
          targetSet.add(targetId);
          inDegree.set(sourceId, (inDegree.get(sourceId) || 0) + 1);
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
   * 迁移附件（Obsidian 风格：与 md 文件同级）
   */
  private async migrateAssets(todo: Todo, todoFileName: string): Promise<number> {
    let migratedCount = 0;
    const storagePath = this.fileStorage.getStoragePath();
    const baseName = todoFileName.replace('.md', '');
    let attachmentIndex = 1;

    try {
      // 处理单张图片
      if (todo.imageUrl) {
        const fileName = `${baseName}_${attachmentIndex}.png`;
        await this.migrateSingleAsset(todo.imageUrl, storagePath, fileName);
        migratedCount++;
        attachmentIndex++;
      }

      // 处理多张图片
      if (todo.images) {
        try {
          const images = JSON.parse(todo.images);
          if (Array.isArray(images)) {
            for (const imageData of images) {
              const fileName = `${baseName}_${attachmentIndex}.png`;
              await this.migrateSingleAsset(imageData, storagePath, fileName);
              migratedCount++;
              attachmentIndex++;
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

  /**
   * 检查目标路径是否已有数据（Obsidian 风格）
   */
  private async checkTargetPathHasData(targetPath: string): Promise<boolean> {
    try {
      // 检查待办目录是否存在
      if (!fs.existsSync(targetPath)) {
        return false;
      }

      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });

      // 检查是否有 .md 文件（新的 Obsidian 风格）
      const hasMarkdownFiles = entries.some(
        entry => entry.isFile() && entry.name.endsWith('.md')
      );

      // 检查是否有 todo-* 目录（旧格式，向后兼容）
      const hasTodoDirs = entries.some(
        entry => entry.isDirectory() && entry.name.startsWith('todo-')
      );

      // 检查是否有元数据文件
      const metadataDir = path.join(targetPath, '.multitodo-metadata');
      const hasMetadata = fs.existsSync(metadataDir) &&
        fs.existsSync(path.join(metadataDir, 'index.json'));

      return hasMarkdownFiles || hasTodoDirs || hasMetadata;
    } catch (error) {
      console.error('[checkTargetPathHasData] Error checking target path:', error);
      return false;
    }
  }

  /**
   * 清理目标路径的旧数据（Obsidian 风格）
   */
  private async cleanTargetPath(targetPath: string): Promise<void> {
    try {
      console.log(`[cleanTargetPath] Cleaning target path: ${targetPath}`);

      if (!fs.existsSync(targetPath)) {
        return;
      }

      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });

      // 删除所有 .md 文件（新的 Obsidian 风格）
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(targetPath, entry.name);
          await fs.promises.unlink(filePath).catch(() => {
            console.warn(`[cleanTargetPath] Failed to delete ${entry.name}`);
          });
          console.log(`[cleanTargetPath] Removed: ${entry.name}`);
        }
      }

      // 删除所有附件文件（与 .md 文件同级的图片等）
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.docx', '.xlsx'];
      for (const entry of entries) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          const filePath = path.join(targetPath, entry.name);
          await fs.promises.unlink(filePath).catch(() => {
            console.warn(`[cleanTargetPath] Failed to delete attachment ${entry.name}`);
          });
          console.log(`[cleanTargetPath] Removed attachment: ${entry.name}`);
        }
      }

      // 删除旧格式的 todo-* 目录（向后兼容）
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('todo-')) {
          const todoPath = path.join(targetPath, entry.name);
          await fs.promises.rm(todoPath, { recursive: true, force: true });
          console.log(`[cleanTargetPath] Removed old format: ${entry.name}`);
        }
      }

      // 清理元数据文件
      const metadataDir = path.join(targetPath, '.multitodo-metadata');
      if (fs.existsSync(metadataDir)) {
        await fs.promises.rm(metadataDir, { recursive: true, force: true });
        console.log(`[cleanTargetPath] Removed metadata directory`);
      }

      // 重新创建元数据目录结构
      await fs.promises.mkdir(metadataDir, { recursive: true });
      console.log(`[cleanTargetPath] Recreated metadata directory`);

      console.log(`[cleanTargetPath] Cleanup completed`);
    } catch (error) {
      console.error('[cleanTargetPath] Error cleaning target path:', error);
      throw new Error(`清理目标路径失败: ${(error as Error).message}`);
    }
  }
}