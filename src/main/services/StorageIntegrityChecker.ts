/**
 * 存储完整性检查工具
 * 用于诊断文件-数据库映射不一致问题
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { FileStorageManager } from '../FileStorageManager';
import { FileIndexer, TodoIndexEntry } from '../FileIndexer';
import { Todo } from '../../shared/types';

export interface IntegrityCheckResult {
  healthy: boolean;
  checks: {
    database: DatabaseCheckResult;
    fileSystem: FileSystemCheckResult;
    index: IndexCheckResult;
    mapping: MappingCheckResult;
  };
  summary: string;
  recommendations: string[];
}

export interface DatabaseCheckResult {
  healthy: boolean;
  todoCount: number;
  sampleTitles: string[];
  error?: string;
}

export interface FileSystemCheckResult {
  healthy: boolean;
  mdFileCount: number;
  sampleFiles: string[];
  error?: string;
}

export interface IndexCheckResult {
  healthy: boolean;
  indexEntryCount: number;
  indexLoaded: boolean;
  sampleEntries: Array<{ uuid: string; title: string }>;
  error?: string;
}

export interface MappingCheckResult {
  healthy: boolean;
  orphanFiles: string[]; // 文件存在但索引中不存在
  orphanRecords: string[]; // 索引记录存在但文件不存在
  databaseMismatch: number; // 数据库记录与文件不匹配的数量
  error?: string;
}

export class StorageIntegrityChecker {
  private dbManager: DatabaseManager;
  private fileManager: FileStorageManager | null;
  private fileIndexer: FileIndexer;
  private storagePath: string;

  constructor(
    dbManager: DatabaseManager,
    fileManager: FileStorageManager | null,
    storagePath: string
  ) {
    this.dbManager = dbManager;
    this.fileManager = fileManager;
    this.storagePath = storagePath;
    this.fileIndexer = new FileIndexer(storagePath);
  }

  /**
   * 执行完整的完整性检查
   */
  async performFullCheck(): Promise<IntegrityCheckResult> {
    console.log('[StorageIntegrityChecker] 🚀 Starting full integrity check...');

    const result: IntegrityCheckResult = {
      healthy: true,
      checks: {
        database: await this.checkDatabase(),
        fileSystem: await this.checkFileSystem(),
        index: await this.checkIndex(),
        mapping: await this.checkMapping()
      },
      summary: '',
      recommendations: []
    };

    // 分析检查结果并生成建议
    this.analyzeResults(result);

    console.log('[StorageIntegrityChecker] ✅ Integrity check completed');
    console.log('[StorageIntegrityChecker] Summary:', result.summary);

    return result;
  }

  /**
   * 检查数据库状态
   */
  private async checkDatabase(): Promise<DatabaseCheckResult> {
    console.log('[StorageIntegrityChecker] 🔍 Checking database...');
    try {
      const todos = await this.dbManager.getAllTodos();
      const sampleTitles = todos.slice(0, 5).map(t => t.title || 'Untitled');

      console.log(`[StorageIntegrityChecker] Database: ${todos.length} todos found`);

      return {
        healthy: true,
        todoCount: todos.length,
        sampleTitles
      };
    } catch (error) {
      console.error('[StorageIntegrityChecker] ❌ Database check failed:', error);
      return {
        healthy: false,
        todoCount: 0,
        sampleTitles: [],
        error: String(error)
      };
    }
  }

  /**
   * 检查文件系统状态
   */
  private async checkFileSystem(): Promise<FileSystemCheckResult> {
    console.log('[StorageIntegrityChecker] 🔍 Checking file system...');
    try {
      if (!fs.existsSync(this.storagePath)) {
        return {
          healthy: false,
          mdFileCount: 0,
          sampleFiles: [],
          error: 'Storage path does not exist'
        };
      }

      const files = await fs.promises.readdir(this.storagePath);
      const mdFiles = files.filter(f =>
        f.endsWith('.md') &&
        !f.startsWith('.multitodo-metadata')
      );

      const sampleFiles = mdFiles.slice(0, 5);

      console.log(`[StorageIntegrityChecker] File system: ${mdFiles.length} .md files found`);

      return {
        healthy: true,
        mdFileCount: mdFiles.length,
        sampleFiles
      };
    } catch (error) {
      console.error('[StorageIntegrityChecker] ❌ File system check failed:', error);
      return {
        healthy: false,
        mdFileCount: 0,
        sampleFiles: [],
        error: String(error)
      };
    }
  }

  /**
   * 检查索引状态
   */
  private async checkIndex(): Promise<IndexCheckResult> {
    console.log('[StorageIntegrityChecker] 🔍 Checking index...');
    try {
      if (!this.fileManager) {
        return {
          healthy: false,
          indexEntryCount: 0,
          indexLoaded: false,
          sampleEntries: [],
          error: 'File storage manager not initialized'
        };
      }

      // 重新加载索引以获取最新状态
      await this.fileIndexer.loadIndex();

      const entries = await this.fileIndexer.getAllTodos();
      const sampleEntries = entries.slice(0, 5).map(e => ({
        uuid: e.uuid,
        title: e.title || 'Untitled'
      }));

      console.log(`[StorageIntegrityChecker] Index: ${entries.length} entries found`);

      return {
        healthy: true,
        indexEntryCount: entries.length,
        indexLoaded: true,
        sampleEntries
      };
    } catch (error) {
      console.error('[StorageIntegrityChecker] ❌ Index check failed:', error);
      return {
        healthy: false,
        indexEntryCount: 0,
        indexLoaded: false,
        sampleEntries: [],
        error: String(error)
      };
    }
  }

  /**
   * 检查映射关系
   */
  private async checkMapping(): Promise<MappingCheckResult> {
    console.log('[StorageIntegrityChecker] 🔍 Checking mappings...');
    try {
      const orphanFiles: string[] = [];
      const orphanRecords: string[] = [];
      let databaseMismatch = 0;

      // 1. 获取文件系统中的所有.md文件
      const files = await fs.promises.readdir(this.storagePath);
      const mdFiles = new Set(
        files.filter(f =>
          f.endsWith('.md') &&
          !f.startsWith('.multitodo-metadata')
        )
      );

      // 2. 获取索引中的所有条目
      const indexEntries = await this.fileIndexer.getAllTodos();
      const indexedUuids = new Set(indexEntries.map(e => {
        // 文件名格式: uuid-title.md
        const fileName = path.basename(e.filePath);
        const match = fileName.match(/^([a-f0-9-]+)\.md$/);
        return match ? match[1] : null;
      }).filter(Boolean));

      // 3. 获取数据库中的所有contentHash
      const dbTodos = await this.dbManager.getAllTodos();
      const dbHashes = new Set(dbTodos.map(t => t.contentHash).filter(Boolean));

      // 4. 检查孤立文件（文件存在但索引中没有）
      for (const file of mdFiles) {
        const uuid = file.replace(/^([a-f0-9-]+)-.*\.md$/, '$1');
        if (!indexedUuids.has(uuid)) {
          orphanFiles.push(file);
        }
      }

      // 5. 检查孤立记录（索引中有但文件不存在）
      for (const entry of indexEntries) {
        const fileName = path.basename(entry.filePath);
        if (!mdFiles.has(fileName)) {
          orphanRecords.push(fileName);
        }
      }

      // 6. 检查数据库与文件的匹配度
      for (const todo of dbTodos) {
        if (todo.contentHash && !indexedUuids.has(todo.contentHash)) {
          databaseMismatch++;
        }
      }

      const healthy = orphanFiles.length === 0 &&
                      orphanRecords.length === 0 &&
                      databaseMismatch === 0;

      console.log(`[StorageIntegrityChecker] Mapping: ` +
                  `${orphanFiles.length} orphan files, ` +
                  `${orphanRecords.length} orphan records, ` +
                  `${databaseMismatch} DB mismatches`);

      return {
        healthy,
        orphanFiles,
        orphanRecords,
        databaseMismatch
      };
    } catch (error) {
      console.error('[StorageIntegrityChecker] ❌ Mapping check failed:', error);
      return {
        healthy: false,
        orphanFiles: [],
        orphanRecords: [],
        databaseMismatch: 0,
        error: String(error)
      };
    }
  }

  /**
   * 分析检查结果并生成建议
   */
  private analyzeResults(result: IntegrityCheckResult): void {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 分析数据库
    if (!result.checks.database.healthy) {
      issues.push(`Database error: ${result.checks.database.error}`);
      recommendations.push('Check database connection and permissions');
    } else if (result.checks.database.todoCount === 0) {
      issues.push('Database is empty');
      recommendations.push('Import todos from file storage or create new todos');
    }

    // 分析文件系统
    if (!result.checks.fileSystem.healthy) {
      issues.push(`File system error: ${result.checks.fileSystem.error}`);
      recommendations.push('Check storage path configuration');
    } else if (result.checks.fileSystem.mdFileCount === 0) {
      issues.push('No markdown files found');
      recommendations.push('Check if files were moved or deleted');
    }

    // 分析索引
    if (!result.checks.index.healthy) {
      issues.push(`Index error: ${result.checks.index.error}`);
      recommendations.push('Check file storage manager initialization');
    } else if (result.checks.index.indexEntryCount === 0) {
      issues.push('Index is empty');
      recommendations.push('Rebuild index from markdown files');
    }

    // 分析映射关系
    if (!result.checks.mapping.healthy) {
      if (result.checks.mapping.orphanFiles.length > 0) {
        issues.push(`${result.checks.mapping.orphanFiles.length} orphan files found`);
        recommendations.push('Run index rebuild to include orphan files');
      }
      if (result.checks.mapping.orphanRecords.length > 0) {
        issues.push(`${result.checks.mapping.orphanRecords.length} orphan index records`);
        recommendations.push('Clean up orphan index records');
      }
      if (result.checks.mapping.databaseMismatch > 0) {
        issues.push(`${result.checks.mapping.databaseMismatch} database records don't match files`);
        recommendations.push('Sync database with file storage');
      }
    }

    // 检查数量一致性
    const { fileSystem, index, database } = result.checks;
    if (fileSystem.healthy && index.healthy && database.healthy) {
      const countsMatch = fileSystem.mdFileCount === index.indexEntryCount;
      if (!countsMatch) {
        issues.push(`File count mismatch: ${fileSystem.mdFileCount} files vs ${index.indexEntryCount} index entries`);
        recommendations.push('Rebuild index to sync with actual files');
      }
    }

    result.healthy = issues.length === 0;
    result.summary = issues.length > 0
      ? `Found ${issues.length} issue(s): ` + issues.join('; ')
      : 'All checks passed';
    result.recommendations = recommendations;
  }

  /**
   * 打印详细的诊断报告
   */
  printDiagnosticReport(result: IntegrityCheckResult): void {
    console.log('\n========================================');
    console.log('📊 Storage Integrity Diagnostic Report');
    console.log('========================================\n');

    console.log(`Overall Health: ${result.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    console.log(`Summary: ${result.summary}\n`);

    console.log('--- Database Status ---');
    console.log(`Healthy: ${result.checks.database.healthy ? '✅' : '❌'}`);
    console.log(`Todo Count: ${result.checks.database.todoCount}`);
    console.log(`Sample Titles: ${result.checks.database.sampleTitles.join(', ')}`);
    if (result.checks.database.error) {
      console.log(`Error: ${result.checks.database.error}`);
    }

    console.log('\n--- File System Status ---');
    console.log(`Healthy: ${result.checks.fileSystem.healthy ? '✅' : '❌'}`);
    console.log(`MD File Count: ${result.checks.fileSystem.mdFileCount}`);
    console.log(`Sample Files: ${result.checks.fileSystem.sampleFiles.join(', ')}`);
    if (result.checks.fileSystem.error) {
      console.log(`Error: ${result.checks.fileSystem.error}`);
    }

    console.log('\n--- Index Status ---');
    console.log(`Healthy: ${result.checks.index.healthy ? '✅' : '❌'}`);
    console.log(`Index Entry Count: ${result.checks.index.indexEntryCount}`);
    console.log(`Index Loaded: ${result.checks.index.indexLoaded}`);
    console.log(`Sample Entries: ${result.checks.index.sampleEntries.map(e => `${e.uuid}: ${e.title}`).join(', ')}`);
    if (result.checks.index.error) {
      console.log(`Error: ${result.checks.index.error}`);
    }

    console.log('\n--- Mapping Status ---');
    console.log(`Healthy: ${result.checks.mapping.healthy ? '✅' : '❌'}`);
    console.log(`Orphan Files: ${result.checks.mapping.orphanFiles.length}`);
    if (result.checks.mapping.orphanFiles.length > 0) {
      console.log(`  ${result.checks.mapping.orphanFiles.slice(0, 10).join(', ')}${result.checks.mapping.orphanFiles.length > 10 ? '...' : ''}`);
    }
    console.log(`Orphan Records: ${result.checks.mapping.orphanRecords.length}`);
    if (result.checks.mapping.orphanRecords.length > 0) {
      console.log(`  ${result.checks.mapping.orphanRecords.slice(0, 10).join(', ')}${result.checks.mapping.orphanRecords.length > 10 ? '...' : ''}`);
    }
    console.log(`Database Mismatches: ${result.checks.mapping.databaseMismatch}`);
    if (result.checks.mapping.error) {
      console.log(`Error: ${result.checks.mapping.error}`);
    }

    if (result.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      result.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('\n========================================\n');
  }
}
