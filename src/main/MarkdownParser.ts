import matter from 'gray-matter';
import { Todo, TodoRelation } from '../shared/types';

/**
 * Markdown 文件解析和生成器
 * 负责在 Todo 对象和 Markdown 文件之间进行转换
 */
export class MarkdownParser {
  /**
   * 从 Markdown 文件内容解析 Todo 对象
   */
  parseTodo(markdown: string, metaPath?: string): Todo {
    const { data, content } = matter(markdown);

    // 解析 YAML frontmatter
    const todo: Todo = {
      id: data.id as string || this.generateUUID(),
      title: data.title as string || '',
      content: this.extractContent(content),
      status: data.status as Todo['status'] || 'pending',
      priority: data.priority as Todo['priority'] || 'medium',
      tags: this.parseTags(data.tags),
      imageUrl: data.imageUrl as string | undefined,
      images: data.images as string | undefined,
      startTime: data.start_time as string | undefined || data.startTime as string | undefined,
      deadline: data.deadline as string | undefined,
      displayOrder: data.display_order as number | undefined,
      displayOrders: data.display_orders as { [key: string]: number } | undefined,
      contentHash: data.content_hash as string | undefined || data.contentHash as string | undefined,
      keywords: data.keywords as string[] | undefined,
      completedAt: data.completed_at as string | undefined || data.completedAt as string | undefined,
      todayCompletedAt: data.today_completed_at as string | undefined || data.todayCompletedAt as string | undefined,
      createdAt: data.created_at as string || new Date().toISOString(),
      updatedAt: data.updated_at as string || new Date().toISOString()
    };

    return todo;
  }

  /**
   * 从 Todo 对象生成 Markdown 文件内容（Obsidian 风格）
   */
  generateTodo(todo: Todo, relations: TodoRelation[] = [], attachments: string[] = []): string {
    // 生成 YAML frontmatter
    const frontmatter: Record<string, any> = {
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      tags: this.parseTags(todo.tags),
      created_at: todo.createdAt,
      updated_at: todo.updatedAt,
      id: todo.id
    };

    // 添加可选字段
    if (todo.deadline) frontmatter.deadline = todo.deadline;
    if (todo.completedAt) frontmatter.completed_at = todo.completedAt;
    if (todo.todayCompletedAt) frontmatter.today_completed_at = todo.todayCompletedAt;
    if (todo.displayOrder !== undefined) frontmatter.display_order = todo.displayOrder;
    if (todo.displayOrders) frontmatter.display_orders = todo.displayOrders;
    if (todo.contentHash) frontmatter.content_hash = todo.contentHash;
    if (todo.keywords) frontmatter.keywords = todo.keywords;
    if (todo.startTime) frontmatter.start_time = todo.startTime;

    // 添加附件列表（Obsidian 风格）
    if (attachments.length > 0) {
      frontmatter.attachments = attachments;
    }

    // 生成 Markdown 内容
    let markdown = matter.stringify('', frontmatter);

    // 添加内容部分
    if (todo.content) {
      markdown += '\n## Content\n\n';
      markdown += todo.content;
      markdown += '\n';
    }

    // 添加附件部分（使用标准 Markdown 图片语法）
    if (attachments.length > 0) {
      markdown += '\n## Attachments\n\n';
      attachments.forEach((att, index) => {
        const fileName = att.replace('./', '');
        markdown += `


![附件${index + 1}](${att})
\n`;
      });
    }

    // 添加关系部分
    if (relations.length > 0) {
      markdown += '\n## Relations\n\n';
      relations.forEach(rel => {
        const linkText = this.getRelationLinkText(rel);
        markdown += `- ${linkText}\n`;
      });
    }

    return markdown;
  }

  /**
   * 从 Markdown 内容中提取关系
   */
  extractRelations(markdown: string, currentTodoId: string): TodoRelation[] {
    const relations: TodoRelation[] = [];
    const lines = markdown.split('\n');
    let inRelationsSection = false;

    for (const line of lines) {
      // 检测是否进入 Relations 部分
      if (line.trim().startsWith('## Relations')) {
        inRelationsSection = true;
        continue;
      }

      // 检测是否离开 Relations 部分
      if (inRelationsSection && line.trim().startsWith('## ')) {
        break;
      }

      // 解析关系链接
      if (inRelationsSection && line.trim().startsWith('-')) {
        const relation = this.parseRelationLine(line, currentTodoId);
        if (relation) {
          relations.push(relation);
        }
      }
    }

    return relations;
  }

  /**
   * 验证 Markdown 文件格式
   */
  validateMarkdown(markdown: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const { data } = matter(markdown);

      // 验证必需字段
      if (!data.title) {
        errors.push('Missing required field: title');
      }

      if (!data.status) {
        errors.push('Missing required field: status');
      } else if (!['pending', 'in_progress', 'completed', 'paused'].includes(data.status)) {
        errors.push(`Invalid status value: ${data.status}`);
      }

      if (!data.priority) {
        errors.push('Missing required field: priority');
      } else if (!['low', 'medium', 'high'].includes(data.priority)) {
        errors.push(`Invalid priority value: ${data.priority}`);
      }

      if (!data.id) {
        errors.push('Missing required field: id');
      }

      // 验证日期格式
      const dateFields = ['created_at', 'updated_at', 'deadline', 'completed_at'];
      for (const field of dateFields) {
        if (data[field]) {
          const date = new Date(data[field]);
          if (isNaN(date.getTime())) {
            errors.push(`Invalid date format for ${field}: ${data[field]}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Failed to parse markdown: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 从内容中提取纯文本部分
   */
  private extractContent(content: string): string {
    // 移除可能的 Markdown 标题
    const lines = content.split('\n');
    const contentLines: string[] = [];
    let inContentSection = false;

    for (const line of lines) {
      if (line.trim().startsWith('## Content')) {
        inContentSection = true;
        continue;
      }

      if (inContentSection && line.trim().startsWith('## ')) {
        break;
      }

      if (inContentSection || !line.trim().startsWith('##')) {
        contentLines.push(line);
      }
    }

    return contentLines.join('\n').trim();
  }

  /**
   * 解析标签
   */
  private parseTags(tags: any): string {
    if (Array.isArray(tags)) {
      return tags.join(',');
    }
    if (typeof tags === 'string') {
      return tags;
    }
    return '';
  }

  /**
   * 从 Todo 中提取附件信息
   */
  private extractAttachments(todo: Todo): Array<{ description: string; filename: string }> {
    const attachments: Array<{ description: string; filename: string }> = [];

    // 处理单张图片
    if (todo.imageUrl) {
      const filename = this.extractFilename(todo.imageUrl);
      attachments.push({ description: 'Image', filename });
    }

    // 处理多张图片
    if (todo.images) {
      try {
        const images = JSON.parse(todo.images);
        if (Array.isArray(images)) {
          images.forEach((img, index) => {
            const filename = this.extractFilename(img);
            attachments.push({ description: `Image ${index + 1}`, filename });
          });
        }
      } catch {
        // 忽略解析错误
      }
    }

    return attachments;
  }

  /**
   * 从路径中提取文件名
   */
  private extractFilename(path: string): string {
    // 处理 base64 数据
    if (path.startsWith('data:')) {
      return `image-${Date.now()}.png`;
    }
    // 处理文件路径
    const parts = path.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * 解析关系行
   */
  private parseRelationLine(line: string, currentTodoId: string): TodoRelation | null {
    // 匹配 Markdown 链接格式：- [前置任务](../todo-{uuid}/todo.md)
    const linkMatch = line.match(/\[([^\]]+)\]\(\.\/todo-([^\/]+)\/todo\.md\)/);
    if (!linkMatch) return null;

    const [, text, targetUuid] = linkMatch;

    // 根据文本判断关系类型
    let relationType: TodoRelation['relation_type'] = 'parallel';
    if (text.includes('前置') || text.includes('子任务')) {
      relationType = 'extends';
    } else if (text.includes('背景') || text.includes('父任务')) {
      relationType = 'background';
    }

    return {
      source_id: currentTodoId, // 使用字符串 UUID
      target_id: targetUuid, // 使用字符串 UUID
      relation_type: relationType,
      created_at: new Date().toISOString()
    };
  }

  /**
   * 生成关系链接文本
   */
  private getRelationLinkText(relation: TodoRelation): string {
    const iconMap = {
      'extends': '🔗',
      'background': '📚',
      'parallel': '🔀'
    };

    const textMap = {
      'extends': '前置任务',
      'background': '背景任务',
      'parallel': '并行任务'
    };

    const icon = iconMap[relation.relation_type] || '🔗';
    const text = textMap[relation.relation_type] || '关联任务';

    // 这里需要获取目标待办的标题，暂时使用占位符
    return `[${icon} ${text}](../todo-${relation.target_id}/todo.md)`;
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    // 使用crypto API生成更安全的UUID（如果可用）
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      const uuid = crypto.randomUUID();
      console.log(`[MarkdownParser] Generated UUID using crypto API: ${uuid}`);
      return uuid;
    }

    // 降级到Math.random()方法
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    console.log(`[MarkdownParser] Generated UUID using Math.random(): ${uuid}`);
    return uuid;
  }
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}