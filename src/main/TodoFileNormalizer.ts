import * as fs from 'fs';
import * as path from 'path';
import { MarkdownParser } from './MarkdownParser';
import { Todo } from '../shared/types';

/**
 * 规范化结果
 */
export interface NormalizationResult {
  success: boolean;
  todo?: Todo;
  wasNormalized: boolean;
  error?: string;
}

/**
 * MD文件规范化服务
 * 为缺失ID的MD文件生成UUID并写回
 */
export class TodoFileNormalizer {
  private storagePath: string;
  private markdownParser: MarkdownParser;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.markdownParser = new MarkdownParser();
  }

  /**
   * 规范化MD文件：为缺失ID的文件生成UUID并写回
   * @param filePath - 文件路径
   * @param originalContent - 原始文件内容（可选，避免重复读取）
   * @returns 规范化结果
   */
  async normalizeFile(filePath: string, originalContent?: string): Promise<NormalizationResult> {
    try {
      // 1. 读取文件内容（如果未提供）
      const content = originalContent || await fs.promises.readFile(filePath, 'utf-8');

      // 2. 使用MarkdownParser解析（会自动生成UUID）
      const todo = this.markdownParser.parseTodo(content);

      // 3. 检查是否生成了新ID（解析时没有ID）
      const { data } = require('gray-matter')(content);
      const hadId = !!data.id;
      const wasNormalized = !hadId;

      // 4. 如果生成了新ID，写回文件
      if (wasNormalized) {
        const newMarkdown = this.markdownParser.generateTodo(todo);
        await this.atomicWrite(filePath, newMarkdown);
        console.log(`[TodoFileNormalizer] Normalized ${path.basename(filePath)}: assigned UUID ${todo.id}`);
      }

      return {
        success: true,
        todo,
        wasNormalized,
      };
    } catch (error) {
      return {
        success: false,
        wasNormalized: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 原子化文件写入
   * 使用临时文件确保写入原子性
   * @param filePath - 目标文件路径
   * @param content - 要写入的内容
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
      throw error;
    }
  }
}