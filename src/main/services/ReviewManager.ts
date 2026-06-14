/**
 * 复盘文件管理器
 * 管理复盘Markdown文件的创建、读取、更新、删除和重命名
 */

import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

export interface ReviewFile {
  filename: string;
  filepath: string;
  createdAt: string;
  updatedAt: string;
  size: number;
}

export class ReviewManager {
  private reviewsPath: string;

  constructor(databasePath: string) {
    this.reviewsPath = path.join(databasePath, 'reviews');
    this.ensureReviewsFolder();
  }

  /**
   * 确保reviews文件夹存在
   */
  private ensureReviewsFolder(): void {
    if (!fs.existsSync(this.reviewsPath)) {
      fs.mkdirSync(this.reviewsPath, { recursive: true });
      console.log(`[ReviewManager] Created reviews folder at: ${this.reviewsPath}`);
    }
  }

  /**
   * 获取reviews文件夹路径
   */
  getReviewsPath(): string {
    return this.reviewsPath;
  }

  /**
   * 列出所有复盘文件
   */
  async listReviews(): Promise<ReviewFile[]> {
    try {
      this.ensureReviewsFolder();

      const files = fs.readdirSync(this.reviewsPath);
      const reviewFiles: ReviewFile[] = [];

      for (const filename of files) {
        // 只处理.md文件
        if (!filename.endsWith('.md')) {
          continue;
        }

        const filepath = path.join(this.reviewsPath, filename);
        const fileInfo = this.getFileInfo(filepath);

        if (fileInfo) {
          reviewFiles.push(fileInfo);
        }
      }

      // 按更新时间降序排序（最新的在前面）
      reviewFiles.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return reviewFiles;
    } catch (error) {
      console.error('[ReviewManager] Error listing reviews:', error);
      throw error;
    }
  }

  /**
   * 创建新的复盘文件
   */
  async createReview(filename?: string, initialContent: string = ''): Promise<ReviewFile> {
    try {
      this.ensureReviewsFolder();

      // 如果未提供filename，自动生成
      const finalFilename = filename || this.generateFilename();
      const filepath = path.join(this.reviewsPath, finalFilename);

      // 检查文件是否已存在
      if (fs.existsSync(filepath)) {
        throw new Error(`File already exists: ${finalFilename}`);
      }

      // 创建文件
      fs.writeFileSync(filepath, initialContent, 'utf-8');
      console.log(`[ReviewManager] Created review file: ${filepath}`);

      return this.getFileInfo(filepath)!;
    } catch (error) {
      console.error('[ReviewManager] Error creating review:', error);
      throw error;
    }
  }

  /**
   * 读取复盘文件内容
   */
  async readReview(filepath: string): Promise<string> {
    try {
      if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
      }

      const content = fs.readFileSync(filepath, 'utf-8');
      return content;
    } catch (error) {
      console.error('[ReviewManager] Error reading review:', error);
      throw error;
    }
  }

  /**
   * 更新复盘文件内容
   */
  async updateReview(filepath: string, content: string): Promise<void> {
    try {
      if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
      }

      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`[ReviewManager] Updated review file: ${filepath}`);
    } catch (error) {
      console.error('[ReviewManager] Error updating review:', error);
      throw error;
    }
  }

  /**
   * 删除复盘文件
   */
  async deleteReview(filepath: string): Promise<void> {
    try {
      if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
      }

      fs.unlinkSync(filepath);
      console.log(`[ReviewManager] Deleted review file: ${filepath}`);
    } catch (error) {
      console.error('[ReviewManager] Error deleting review:', error);
      throw error;
    }
  }

  /**
   * 重命名复盘文件
   */
  async renameReview(oldPath: string, newPath: string): Promise<void> {
    try {
      if (!fs.existsSync(oldPath)) {
        throw new Error(`File not found: ${oldPath}`);
      }

      if (fs.existsSync(newPath)) {
        throw new Error(`Target file already exists: ${newPath}`);
      }

      fs.renameSync(oldPath, newPath);
      console.log(`[ReviewManager] Renamed review file: ${oldPath} -> ${newPath}`);
    } catch (error) {
      console.error('[ReviewManager] Error renaming review:', error);
      throw error;
    }
  }

  /**
   * 在文件管理器中打开文件
   */
  async openInExplorer(filepath: string): Promise<void> {
    try {
      const { shell } = require('electron');

      if (fs.existsSync(filepath)) {
        shell.showItemInFolder(filepath);
      } else {
        throw new Error(`File not found: ${filepath}`);
      }
    } catch (error) {
      console.error('[ReviewManager] Error opening in explorer:', error);
      throw error;
    }
  }

  /**
   * 生成自动文件名：review-YYYYMMDD-XXX.md
   */
  private generateFilename(): string {
    const today = dayjs().format('YYYYMMDD');
    let counter = 1;
    let filename = `review-${today}-${String(counter).padStart(3, '0')}.md`;

    while (fs.existsSync(path.join(this.reviewsPath, filename))) {
      counter++;
      filename = `review-${today}-${String(counter).padStart(3, '0')}.md`;
    }

    return filename;
  }

  /**
   * 获取文件信息
   */
  private getFileInfo(filepath: string): ReviewFile | null {
    try {
      const stats = fs.statSync(filepath);
      const filename = path.basename(filepath);

      return {
        filename,
        filepath,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
        size: stats.size,
      };
    } catch (error) {
      console.error('[ReviewManager] Error getting file info:', error);
      return null;
    }
  }
}
