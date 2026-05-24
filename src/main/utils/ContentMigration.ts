/**
 * Content Migration Tool
 *
 * Migrates existing HTML content to Markdown format for Milkdown editor migration.
 * Handles todos, notes, and other content fields safely with backup support.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Simple HTML to Markdown converter (server-side version)
 */
function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') {
    return html || '';
  }

  let markdown = html;

  // Replace heading tags
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

  // Replace images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');

  // Replace links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Replace strong/bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

  // Replace italic
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Replace code inline
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Replace code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```');
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```');

  // Replace unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match: string, content: string) => {
    const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n').split('\n').filter((line: string) => line.trim());
    return items.join('\n') + '\n\n';
  });

  // Replace ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match: string, content: string) => {
    const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, (_match2: string, item: string, index: number) => {
      return `${index + 1}. ${item}\n`;
    });
    return items + '\n\n';
  });

  // Replace blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (_match: string, content: string) => {
    const lines = content.split('\n').map((line: string) => `> ${line.trim()}`).filter((line: string) => line);
    return lines.join('\n') + '\n\n';
  });

  // Replace line breaks and paragraphs
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/p>/gi, '\n\n');
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n\n');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Decode HTML entities
  markdown = decodeHTMLEntities(markdown);

  return markdown.trim();
}

/**
 * Decode HTML entities to plain text
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#39;': "'",
    '&#34;': '"',
    '&#38;': '&',
    '&#60;': '<',
    '&#62;': '>'
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Check if content contains HTML tags
 */
function isHTML(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  migrated: number;
  skipped: number;
  errors: number;
  backupPath?: string;
  details?: string[];
}

/**
 * Content Migrator class
 */
export class ContentMigrator {
  private userDataPath: string;

  constructor() {
    this.userDataPath = app.getPath('userData');
  }

  /**
   * Create backup before migration
   */
  private createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.userDataPath, `backup-${timestamp}`);

    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Backup todos directory
    const todosPath = path.join(this.userDataPath, 'todos');
    if (fs.existsSync(todosPath)) {
      const backupTodosPath = path.join(backupPath, 'todos');
      fs.cpSync(todosPath, backupTodosPath, { recursive: true });
    }

    console.log(`[ContentMigrator] Backup created at: ${backupPath}`);
    return backupPath;
  }

  /**
   * Migrate a single markdown file
   */
  private migrateFile(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!isHTML(content)) {
        return false; // Skip if not HTML
      }

      const markdown = htmlToMarkdown(content);
      fs.writeFileSync(filePath, markdown, 'utf-8');

      console.log(`[ContentMigrator] Migrated: ${path.basename(filePath)}`);
      return true;
    } catch (error) {
      console.error(`[ContentMigrator] Failed to migrate ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Migrate all content in the storage directory
   */
  public migrateAllContent(): MigrationResult {
    console.log('[ContentMigrator] Starting content migration...');

    const result: MigrationResult = {
      success: true,
      totalProcessed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    try {
      // Create backup
      result.backupPath = this.createBackup();

      // Process todos directory
      const todosPath = path.join(this.userDataPath, 'todos');
      if (fs.existsSync(todosPath)) {
        const processDirectory = (dir: string) => {
          const files = fs.readdirSync(dir);

          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
              processDirectory(filePath); // Recursive
            } else if (file.endsWith('.md')) {
              result.totalProcessed++;
              const migrated = this.migrateFile(filePath);
              if (migrated) {
                result.migrated++;
                if (result.details) result.details.push(`Migrated: ${filePath}`);
              } else {
                result.skipped++;
              }
            }
          }
        };

        processDirectory(todosPath);
      }

      console.log('[ContentMigrator] Migration completed:', {
        totalProcessed: result.totalProcessed,
        migrated: result.migrated,
        skipped: result.skipped,
        backupPath: result.backupPath
      });

    } catch (error) {
      result.success = false;
      result.errors = 1;
      console.error('[ContentMigrator] Migration failed:', error);
    }

    return result;
  }

  /**
   * Get migration status (check if migration is needed)
   */
  public needsMigration(): boolean {
    const todosPath = path.join(this.userDataPath, 'todos');
    if (!fs.existsSync(todosPath)) {
      return false;
    }

    // Check if any markdown file contains HTML
    const checkForHTML = (dir: string): boolean => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          if (checkForHTML(filePath)) return true;
        } else if (file.endsWith('.md')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (isHTML(content)) {
              console.log(`[ContentMigrator] Found HTML content in: ${filePath}`);
              return true;
            }
          } catch {
            continue;
          }
        }
      }
      return false;
    };

    return checkForHTML(todosPath);
  }
}