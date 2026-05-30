import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { FileStorageManager } from '../FileStorageManager';
import { Todo, BackupInfo } from '../../shared/types';

export class BackupManager {
  private backupDir: string;
  private fileStorageManager: FileStorageManager;
  private backupInterval: NodeJS.Timeout | null = null;
  private readonly BACKUP_INTERVAL = 60 * 60 * 1000; // 1小时
  private readonly MAX_BACKUPS = 3; // 保留最近3个备份
  private lastBackupTime: Date | null = null;

  constructor(fileStorageManager: FileStorageManager) {
    this.fileStorageManager = fileStorageManager;
    const userDataPath = app.getPath('userData');
    this.backupDir = path.join(userDataPath, 'backups');
    this.ensureBackupDirectory();
  }

  // 确保备份目录存在
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // 生成单个 Todo 的 Markdown 内容
  private generateTodoMarkdown(todo: Todo): string {
    let content = `---
id: ${todo.id}
title: ${todo.title || '(Untitled)'}
status: ${todo.status}
priority: ${todo.priority}
tags: ${todo.tags || ''}
createdAt: ${todo.createdAt}
updatedAt: ${todo.updatedAt}
`;

    if (todo.startTime) {
      content += `startTime: ${todo.startTime}\n`;
    }
    if (todo.deadline) {
      content += `deadline: ${todo.deadline}\n`;
    }
    if (todo.completedAt) {
      content += `completedAt: ${todo.completedAt}\n`;
    }
    if (todo.todayCompletedAt) {
      content += `todayCompletedAt: ${todo.todayCompletedAt}\n`;
    }
    if (todo.imageUrl) {
      content += `imageUrl: ${todo.imageUrl}\n`;
    }
    if (todo.images) {
      content += `images: ${todo.images}\n`;
    }

    content += `---\n\n`;
    content += `# ${todo.title || '(Untitled)'}\n\n`;

    if (todo.content) {
      content += `${todo.content}\n`;
    }

    return content;
  }

  // 提取 Todo 中的图片路径
  private extractImagePaths(todo: Todo): string[] {
    const imagePaths: string[] = [];

    // 处理 imageUrl
    if (todo.imageUrl && !todo.imageUrl.startsWith('data:')) {
      imagePaths.push(todo.imageUrl);
    }

    // 处理 images 数组
    if (todo.images) {
      try {
        const imagesArray = JSON.parse(todo.images);
        if (Array.isArray(imagesArray)) {
          imagesArray.forEach(img => {
            if (typeof img === 'string' && !img.startsWith('data:')) {
              imagePaths.push(img);
            }
          });
        }
      } catch (error) {
        console.error('[BackupManager] Failed to parse images JSON:', error);
      }
    }

    // 从 content 中提取图片路径（Markdown 格式）
    if (todo.content) {
      const imgRegex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = imgRegex.exec(todo.content)) !== null) {
        const imgPath = match[1];
        if (imgPath && !imgPath.startsWith('data:') && !imgPath.startsWith('http')) {
          imagePaths.push(imgPath);
        }
      }
    }

    return imagePaths;
  }

  // 创建备份
  public async createBackup(): Promise<BackupInfo> {
    return await this.executeWithRetry(async () => {
      const timestamp = new Date();
      const filename = `backup_${timestamp.getTime()}`;
      const backupPath = path.join(this.backupDir, filename);

      // 创建备份目录
      const todosDir = path.join(backupPath, 'todos');
      const imagesDir = path.join(backupPath, 'images');

      try {
        // 创建目录结构
        fs.mkdirSync(backupPath, { recursive: true });
        fs.mkdirSync(todosDir, { recursive: true });
        fs.mkdirSync(imagesDir, { recursive: true });

        // 获取所有待办事项
        const todos = await this.fileStorageManager.getAllTodos();

        // 生成每个 todo 的 md 文件
        const imageSet = new Set<string>();
        for (const todo of todos) {
          const markdown = this.generateTodoMarkdown(todo);
          const todoFilename = `todo_${todo.id}.md`;
          const todoPath = path.join(todosDir, todoFilename);
          await fs.promises.writeFile(todoPath, markdown, 'utf-8');

          // 收集图片路径
          const imagePaths = this.extractImagePaths(todo);
          imagePaths.forEach(imgPath => imageSet.add(imgPath));
        }

        // 复制图片文件
        const userDataPath = app.getPath('userData');
        for (const imgPath of imageSet) {
          try {
            const absolutePath = path.isAbsolute(imgPath)
              ? imgPath
              : path.join(userDataPath, imgPath);

            if (fs.existsSync(absolutePath)) {
              const imgFilename = path.basename(absolutePath);
              const destPath = path.join(imagesDir, imgFilename);
              await fs.promises.copyFile(absolutePath, destPath);
            }
          } catch (error) {
            console.error(`[BackupManager] Failed to copy image ${imgPath}:`, error);
          }
        }

        // 创建元数据文件
        const metadata = {
          timestamp: timestamp.toISOString(),
          totalTodos: todos.length,
          totalImages: imageSet.size,
          version: '1.0.0'
        };
        const metadataPath = path.join(backupPath, 'metadata.json');
        await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        // 计算备份文件夹大小
        const size = await this.getDirectorySize(backupPath);

        // 更新最后备份时间
        this.lastBackupTime = timestamp;

        // 清理旧备份（保留最近3个）
        await this.cleanOldBackups();

        console.log(`[BackupManager] ✅ Backup created: ${filename} (${todos.length} todos, ${imageSet.size} images)`);

        return {
          filename,
          filepath: backupPath,
          timestamp: timestamp.getTime(),
          size: size,
          createdAt: timestamp.toISOString()
        };
      } catch (error) {
        // 清理备份目录
        if (fs.existsSync(backupPath)) {
          await this.removeDirectory(backupPath);
        }
        throw error;
      }
    });
  }


  // 递归删除目录
  private async removeDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        await this.removeDirectory(filePath);
      } else {
        await fs.promises.unlink(filePath);
      }
    }

    await fs.promises.rmdir(dirPath);
  }

  // 递归计算目录大小
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const files = await fs.promises.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        totalSize += await this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  // 静默重试机制
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`[BackupManager] ❌ Retry ${i + 1}/${maxRetries} failed:`, error);
        if (i === maxRetries - 1) {
          console.error('[BackupManager] ❌ All retries failed, giving up silently');
          throw error;
        }
        // 指数退避：1秒, 4秒, 9秒
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(i + 1, 2)));
      }
    }
    throw new Error('All retries failed');
  }

  // 清理旧备份（保留最近3个）
  private async cleanOldBackups(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.backupDir);

      // 筛选出备份目录
      const backupDirs: string[] = [];
      for (const file of files) {
        if (!file.startsWith('backup_')) continue;

        const filepath = path.join(this.backupDir, file);
        const stats = await fs.promises.stat(filepath);

        if (stats.isDirectory()) {
          backupDirs.push(file);
        }
      }

      if (backupDirs.length <= this.MAX_BACKUPS) {
        return; // 备份数量未超过限制
      }

      // 按文件名排序（文件名包含时间戳）
      backupDirs.sort().reverse();

      // 删除超出限制的旧备份
      for (let i = this.MAX_BACKUPS; i < backupDirs.length; i++) {
        const filepath = path.join(this.backupDir, backupDirs[i]);
        await this.removeDirectory(filepath);
        console.log(`[BackupManager] 🗑️ Deleted old backup: ${backupDirs[i]}`);
      }
    } catch (error) {
      console.error('[BackupManager] ❌ Error cleaning old backups:', error);
      // 不抛出异常，避免影响备份功能
    }
  }

  // 获取所有备份列表
  public async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.promises.readdir(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (!file.startsWith('backup_')) {
          continue;
        }

        const filepath = path.join(this.backupDir, file);
        const stats = await fs.promises.stat(filepath);

        // 只处理目录
        if (!stats.isDirectory()) {
          continue;
        }

        // 从文件名解析时间戳：backup_[timestamp]
        const match = file.match(/backup_(\d+)/);
        let timestamp: number;
        let createdAt: string;

        if (match) {
          timestamp = parseInt(match[1]);
          createdAt = new Date(timestamp).toISOString();
        } else {
          // 解析失败，使用文件的修改时间
          timestamp = stats.mtimeMs;
          createdAt = stats.mtime.toISOString();
          console.warn(`[BackupManager] ⚠️ Cannot parse timestamp from filename: ${file}`);
        }

        backups.push({
          filename: file,
          filepath,
          timestamp,
          size: await this.getDirectorySize(filepath),
          createdAt
        });
      }

      // 按时间降序排序
      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[BackupManager] ❌ Error listing backups:', error);
      return [];
    }
  }

  // 启动自动备份
  public startAutoBackup(): void {
    console.log('[BackupManager] 🚀 Starting auto backup (interval: 1 hour)');

    // 检查是否需要立即备份
    this.checkAndBackup();

    // 设置定时器
    this.backupInterval = setInterval(() => {
      this.checkAndBackup();
    }, this.BACKUP_INTERVAL);
  }

  // 停止自动备份
  public stopAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('[BackupManager] 🛑 Auto backup stopped');
    }
  }

  // 检查并执行备份
  private async checkAndBackup(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const now = Date.now();

      // 如果没有备份，或最后一次备份超过1小时，则执行备份
      if (backups.length === 0 || !this.lastBackupTime || (now - this.lastBackupTime.getTime()) > this.BACKUP_INTERVAL) {
        const backup = await this.createBackup();
        console.log(`[BackupManager] ✅ Scheduled backup created: ${backup.filename}`);
      } else {
        console.log(`[BackupManager] ⏰ Backup check skipped, last backup was ${Math.round((now - this.lastBackupTime!.getTime()) / 1000 / 60)} minutes ago`);
      }
    } catch (error) {
      console.error('[BackupManager] ❌ Auto backup check failed:', error);
      // 静默失败，不影响主功能
    }
  }

  // 获取备份状态
  public async getBackupStatus(): Promise<{
    lastBackupTime: string;
    nextBackupTime: string;
    backupEnabled: boolean;
  }> {
    const lastBackupTime = this.lastBackupTime ? this.lastBackupTime.toISOString() : '';
    const nextBackupTime = this.lastBackupTime
      ? new Date(this.lastBackupTime.getTime() + this.BACKUP_INTERVAL).toISOString()
      : '';

    return {
      lastBackupTime,
      nextBackupTime,
      backupEnabled: this.backupInterval !== null
    };
  }

  // 恢复备份
  public async restoreBackup(backupPath: string): Promise<void> {
    try {
      console.log(`[BackupManager] 🔄 Restoring backup from: ${backupPath}`);

      // 验证备份目录
      if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isDirectory()) {
        throw new Error('Invalid backup: directory not found');
      }

      // 读取元数据
      const metadataPath = path.join(backupPath, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('Invalid backup: metadata.json not found');
      }

      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
      console.log(`[BackupManager] 📋 Backup metadata:`, metadata);

      // 读取所有 todo md 文件
      const todosDir = path.join(backupPath, 'todos');
      if (!fs.existsSync(todosDir)) {
        throw new Error('Invalid backup: todos directory not found');
      }

      const todoFiles = await fs.promises.readdir(todosDir);
      const todos: Todo[] = [];

      for (const file of todoFiles) {
        if (!file.endsWith('.md')) {
          continue;
        }

        const filePath = path.join(todosDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const todo = this.parseMarkdownTodo(content);
        if (todo) {
          todos.push(todo);
        }
      }

      console.log(`[BackupManager] 📝 Parsed ${todos.length} todos from backup`);

      // 恢复图片
      const imagesDir = path.join(backupPath, 'images');
      if (fs.existsSync(imagesDir)) {
        const userDataPath = app.getPath('userData');
        const targetImagesDir = path.join(userDataPath, 'images');

        if (!fs.existsSync(targetImagesDir)) {
          fs.mkdirSync(targetImagesDir, { recursive: true });
        }

        const imageFiles = await fs.promises.readdir(imagesDir);
        for (const imgFile of imageFiles) {
          const srcPath = path.join(imagesDir, imgFile);
          const destPath = path.join(targetImagesDir, imgFile);
          await fs.promises.copyFile(srcPath, destPath);
        }
        console.log(`[BackupManager] 🖼️ Restored ${imageFiles.length} images`);
      }

      // 清空所有 todos 并导入备份数据
      const allTodos = await this.fileStorageManager.getAllTodos();
      for (const todo of allTodos) {
        await this.fileStorageManager.deleteTodo(todo.id);
      }

      for (const todo of todos) {
        await this.fileStorageManager.createTodo(todo);
      }

      console.log(`[BackupManager] ✅ Backup restored successfully: ${todos.length} todos`);
    } catch (error) {
      console.error('[BackupManager] ❌ Failed to restore backup:', error);
      throw error;
    }
  }

  // 解析 Markdown 格式的 Todo
  private parseMarkdownTodo(content: string): Todo | null {
    try {
      // 解析 frontmatter
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        console.error('[BackupManager] Invalid markdown: no frontmatter found');
        return null;
      }

      const frontmatter = match[1];
      const lines = frontmatter.split('\n');
      const metadata: any = {};

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          metadata[key.trim()] = value;
        }
      }

      // 提取正文内容
      const bodyContent = content.substring(match[0].length).trim();
      // 移除第一行标题（# Title）
      const contentWithoutTitle = bodyContent.replace(/^#\s+.*?\n\n/, '');

      const todo: Todo = {
        id: metadata.id || '',
        title: metadata.title || '',
        content: contentWithoutTitle || '',
        status: metadata.status || 'pending',
        priority: metadata.priority || 'trivial',
        tags: metadata.tags || '',
        createdAt: metadata.createdAt || new Date().toISOString(),
        updatedAt: metadata.updatedAt || new Date().toISOString(),
      };

      // 可选字段
      if (metadata.startTime) todo.startTime = metadata.startTime;
      if (metadata.deadline) todo.deadline = metadata.deadline;
      if (metadata.completedAt) todo.completedAt = metadata.completedAt;
      if (metadata.todayCompletedAt) todo.todayCompletedAt = metadata.todayCompletedAt;
      if (metadata.imageUrl) todo.imageUrl = metadata.imageUrl;
      if (metadata.images) todo.images = metadata.images;

      return todo;
    } catch (error) {
      console.error('[BackupManager] Failed to parse markdown todo:', error);
      return null;
    }
  }
}
