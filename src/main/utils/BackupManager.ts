import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { FileStorageManager } from '../FileStorageManager';
import { Todo } from '../../shared/types';

export interface BackupInfo {
  filename: string;
  filepath: string;
  timestamp: number;
  size: number;
  createdAt: string;
}

export class BackupManager {
  private backupDir: string;
  private sourceDbPath: string;
  private fileStorageManager: FileStorageManager;
  private backupInterval: NodeJS.Timeout | null = null;
  private readonly BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6小时
  private lastBackupTime: Date | null = null;

  constructor(sourceDbPath: string, fileStorageManager: FileStorageManager) {
    this.sourceDbPath = sourceDbPath;
    this.fileStorageManager = fileStorageManager;
    // 修改备份目录为数据库文件夹内的 .backup
    this.backupDir = path.join(sourceDbPath, '.backup');
    this.ensureBackupDirectory();
  }
  
  // 确保备份目录存在
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // 生成 Markdown 备份内容
  private async generateMarkdownBackup(todos: Todo[]): Promise<string> {
    const timestamp = new Date().toISOString();
    const header = `# MultiTodo Backup

**Generated**: ${timestamp}
**Total Todos**: ${todos.length}
**Database Path**: ${this.sourceDbPath}

---

`;

    if (todos.length === 0) {
      return header + `*No todos in this database yet.*`;
    }

    const content = todos.map(todo => {
      let todoSection = `## ${todo.title || '(Untitled)'}

- **ID**: \`${todo.id}\`
- **Status**: ${todo.status}
- **Priority**: ${todo.priority}
- **Created**: ${todo.createdAt}
- **Updated**: ${todo.updatedAt}
`;

      if (todo.content) {
        todoSection += `
### Content

${todo.content}
`;
      }

      if (todo.tags && todo.tags.length > 0) {
        const tagsArray = Array.isArray(todo.tags) ? todo.tags : [];
        todoSection += `
### Tags

${tagsArray.map((tag: string) => `\`${tag}\``).join(', ')}
`;
      }

      if (todo.startTime || todo.deadline) {
        todoSection += `
### Time

`;
        if (todo.startTime) {
          todoSection += `- **Start Time**: ${todo.startTime}\n`;
        }
        if (todo.deadline) {
          todoSection += `- **Deadline**: ${todo.deadline}\n`;
        }
      }

      if (todo.imageUrl) {
        todoSection += `
### Image

![Todo Image](${todo.imageUrl})
`;
      }

      return todoSection + '\n---\n\n';
    }).join('\n');

    return header + content;
  }
  
  // 执行备份（带重试机制）
  public async createBackup(): Promise<BackupInfo> {
    return await this.executeWithRetry(async () => {
      // 1. 获取所有待办事项
      const todos = await this.fileStorageManager.getAllTodos();

      // 2. 生成备份文件名
      const timestamp = new Date();
      const filename = `backup_${timestamp.getTime()}.md`;
      const backupPath = path.join(this.backupDir, filename);

      // 3. 生成 Markdown 备份内容
      const backupContent = await this.generateMarkdownBackup(todos);

      // 4. 写入备份文件
      await fs.promises.writeFile(backupPath, backupContent, 'utf-8');

      // 5. 获取文件信息
      const stats = await fs.promises.stat(backupPath);

      // 6. 更新最后备份时间
      this.lastBackupTime = timestamp;

      // 7. 清理旧备份（只保留最新的一个）
      await this.cleanOldBackups();

      console.log(`[BackupManager] ✅ Backup created: ${filename} (${todos.length} todos)`);

      return {
        filename,
        filepath: backupPath,
        timestamp: timestamp.getTime(),
        size: stats.size,
        createdAt: timestamp.toISOString()
      };
    });
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
        // 指数退避：1秒, 5秒, 15秒
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(i + 1, 2)));
      }
    }
    throw new Error('All retries failed');
  }
  
  // 清理旧备份（只保留最新的一个）
  private async cleanOldBackups(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.backupDir);

      // 筛选出备份文件
      const backupFiles = files.filter(file => file.startsWith('backup_') && file.endsWith('.md'));

      if (backupFiles.length <= 1) {
        return; // 只有一个或没有备份文件，不需要清理
      }

      // 按文件名排序（文件名包含时间戳）
      backupFiles.sort().reverse();

      // 删除除最新文件外的所有文件
      for (let i = 1; i < backupFiles.length; i++) {
        const filepath = path.join(this.backupDir, backupFiles[i]);
        await fs.promises.unlink(filepath);
        console.log(`[BackupManager] 🗑️ Deleted old backup: ${backupFiles[i]}`);
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
        if (!file.startsWith('backup_') || !file.endsWith('.md')) {
          continue;
        }

        const filepath = path.join(this.backupDir, file);
        const stats = await fs.promises.stat(filepath);

        // 从文件名解析时间戳：backup_[timestamp].md
        const match = file.match(/backup_(\d+)\.md/);
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
          size: stats.size,
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
    console.log('[BackupManager] 🚀 Starting auto backup (interval: 6 hours)');

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

      // 如果没有备份，或最后一次备份超过6小时，则执行备份
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
  
}

