import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

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
  private backupInterval: NodeJS.Timeout | null = null;
  private readonly BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
  private readonly RETENTION_DAYS = 7;
  
  constructor(sourceDbPath: string) {
    this.sourceDbPath = sourceDbPath;
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
  
  // 执行备份
  public async createBackup(): Promise<BackupInfo> {
    // 1. 生成备份文件名
    const timestamp = new Date();
    const filename = `todo_app_backup_${this.formatDate(timestamp)}.db`;
    const backupPath = path.join(this.backupDir, filename);
    
    // 2. 复制数据库文件
    await fs.promises.copyFile(this.sourceDbPath, backupPath);
    
    // 3. 获取文件信息
    const stats = await fs.promises.stat(backupPath);
    
    // 4. 清理旧备份
    await this.cleanOldBackups();
    
    return {
      filename,
      filepath: backupPath,
      timestamp: timestamp.getTime(),
      size: stats.size,
      createdAt: timestamp.toISOString()
    };
  }
  
  // 清理过期备份
  private async cleanOldBackups(): Promise<void> {
    const files = await fs.promises.readdir(this.backupDir);
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      if (!file.startsWith('todo_app_backup_') || !file.endsWith('.db')) {
        continue;
      }
      
      const filepath = path.join(this.backupDir, file);
      const stats = await fs.promises.stat(filepath);
      
      // 删除超过7天的备份
      if (now - stats.mtimeMs > retentionMs) {
        await fs.promises.unlink(filepath);
        console.log(`Deleted old backup: ${file}`);
      }
    }
  }
  
  // 获取所有备份列表
  public async listBackups(): Promise<BackupInfo[]> {
    const files = await fs.promises.readdir(this.backupDir);
    const backups: BackupInfo[] = [];
    
    for (const file of files) {
      if (!file.startsWith('todo_app_backup_') || !file.endsWith('.db')) {
        continue;
      }
      
      const filepath = path.join(this.backupDir, file);
      const stats = await fs.promises.stat(filepath);
      
      backups.push({
        filename: file,
        filepath,
        timestamp: stats.mtimeMs,
        size: stats.size,
        createdAt: new Date(stats.mtime).toISOString()
      });
    }
    
    // 按时间降序排序
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  // 启动自动备份
  public startAutoBackup(): void {
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
    }
  }
  
  // 检查并执行备份
  private async checkAndBackup(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const now = Date.now();
      
      // 如果没有备份，或最后一次备份超过24小时，则执行备份
      if (backups.length === 0 || now - backups[0].timestamp > this.BACKUP_INTERVAL) {
        const backup = await this.createBackup();
        console.log(`Backup created: ${backup.filename}`);
      }
    } catch (error) {
      console.error('Backup failed:', error);
    }
  }
  
  // 格式化日期为文件名
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }
  
  // 恢复备份（可选功能）
  public async restoreBackup(backupPath: string): Promise<void> {
    // 1. 备份当前数据库（以防恢复失败）
    const tempBackup = path.join(this.backupDir, `temp_before_restore_${Date.now()}.db`);
    await fs.promises.copyFile(this.sourceDbPath, tempBackup);
    
    try {
      // 2. 覆盖当前数据库
      await fs.promises.copyFile(backupPath, this.sourceDbPath);
      
      // 3. 删除临时备份
      await fs.promises.unlink(tempBackup);
    } catch (error) {
      // 恢复失败，回滚
      await fs.promises.copyFile(tempBackup, this.sourceDbPath);
      await fs.promises.unlink(tempBackup);
      throw error;
    }
  }
}

