// 关键词处理器 - 异步处理待办关键词生成
import { DatabaseManager } from '../database/DatabaseManager';
import { keywordExtractor } from './KeywordExtractor';
import { Todo } from '../../shared/types';

interface KeywordTask {
  todoId: number;
  title: string;
  content: string;
}

export class KeywordProcessor {
  private dbManager: DatabaseManager;
  private taskQueue: KeywordTask[] = [];
  private isProcessing: boolean = false;
  private processingDelay: number = 100; // 每个任务间隔100ms，避免阻塞

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 添加单个待办到关键词生成队列
   */
  public async queueTodoForKeywordExtraction(todo: Todo): Promise<void> {
    if (!todo.id) return;

    const task: KeywordTask = {
      todoId: todo.id,
      title: todo.title,
      content: todo.content || ''
    };

    this.taskQueue.push(task);
    
    // 如果当前没有在处理，立即开始处理
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 批量生成所有待办的关键词
   */
  public async generateKeywordsForAllTodos(): Promise<{ total: number; processed: number; failed: number }> {
    console.log('Starting batch keyword generation...');
    
    try {
      // 获取所有没有关键词的待办
      const todos = await this.dbManager.getTodosWithoutKeywords();
      console.log(`Found ${todos.length} todos without keywords`);

      let processed = 0;
      let failed = 0;

      for (const todo of todos) {
        try {
          await this.processSingleTodo(todo);
          processed++;
          
          // 每处理10个打印一次进度
          if (processed % 10 === 0) {
            console.log(`Keyword generation progress: ${processed}/${todos.length}`);
          }
          
          // 短暂延迟，避免阻塞
          await this.sleep(this.processingDelay);
        } catch (error) {
          console.error(`Failed to generate keywords for todo ${todo.id}:`, error);
          failed++;
        }
      }

      console.log(`Batch keyword generation completed: ${processed} processed, ${failed} failed`);
      
      return {
        total: todos.length,
        processed,
        failed
      };
    } catch (error) {
      console.error('Error in batch keyword generation:', error);
      throw error;
    }
  }

  /**
   * 处理单个待办的关键词提取
   */
  private async processSingleTodo(todo: Todo): Promise<void> {
    if (!todo.id) return;

    try {
      // 提取关键词
      const keywords = keywordExtractor.extractKeywords(todo.title, todo.content || '');
      
      // 更新数据库
      await this.dbManager.updateTodoKeywords(todo.id, keywords);
      
      console.log(`Generated ${keywords.length} keywords for todo ${todo.id}: ${keywords.join(', ')}`);
    } catch (error) {
      console.error(`Error processing todo ${todo.id}:`, error);
      throw error;
    }
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Starting to process ${this.taskQueue.length} keyword extraction tasks...`);

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      
      if (!task) continue;

      try {
        // 提取关键词
        const keywords = keywordExtractor.extractKeywords(task.title, task.content);
        
        // 更新数据库
        await this.dbManager.updateTodoKeywords(task.todoId, keywords);
        
        console.log(`Keywords generated for todo ${task.todoId}: ${keywords.join(', ')}`);
        
        // 短暂延迟
        await this.sleep(this.processingDelay);
      } catch (error) {
        console.error(`Failed to process keyword extraction for todo ${task.todoId}:`, error);
      }
    }

    this.isProcessing = false;
    console.log('Keyword extraction queue processing completed');
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取队列状态
   */
  public getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * 清空队列
   */
  public clearQueue(): void {
    this.taskQueue = [];
    console.log('Keyword extraction queue cleared');
  }
}

