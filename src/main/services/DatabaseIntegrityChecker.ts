/**
 * 数据库完整性检查工具
 * 用于诊断数据库模式下的存储健康状态
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseManager } from '../database/DatabaseManager';
import { Todo } from '../../shared/types';

export interface DatabaseIntegrityResult {
  healthy: boolean;
  checks: {
    connection: ConnectionCheckResult;
    structure: StructureCheckResult;
    performance: PerformanceCheckResult;
    data: DataCheckResult;
  };
  summary: string;
  recommendations: string[];
}

export interface ConnectionCheckResult {
  healthy: boolean;
  status: string;
  dbPath: string;
  fileSize: number;
  error?: string;
}

export interface StructureCheckResult {
  healthy: boolean;
  tables: number;
  indexes: number;
  tableDetails: Array<{ name: string; rowCount: number }>;
  indexDetails: Array<{ name: string; tableName: string }>;
  error?: string;
}

export interface PerformanceCheckResult {
  healthy: boolean;
  queryTime: number; // 查询耗时（毫秒）
  dbSize: string; // 格式化的文件大小
  dbSizeBytes: number;
  error?: string;
}

export interface DataCheckResult {
  healthy: boolean;
  todoCount: number;
  relationCount: number;
  issues: number;
  sampleTitles: string[];
  error?: string;
}

export class DatabaseIntegrityChecker {
  private dbManager: DatabaseManager;
  private dbPath: string;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.dbPath = dbManager.getDbPath();
  }

  /**
   * 执行完整的数据库完整性检查
   */
  async performFullCheck(): Promise<DatabaseIntegrityResult> {
    console.log('[DatabaseIntegrityChecker] 🚀 Starting full database integrity check...');

    const result: DatabaseIntegrityResult = {
      healthy: true,
      checks: {
        connection: await this.withTimeout(
          this.checkConnection(),
          5000,
          'Connection check'
        ),
        structure: await this.withTimeout(
          this.checkStructure(),
          10000,
          'Structure check'
        ),
        performance: await this.withTimeout(
          this.checkPerformance(),
          5000,
          'Performance check'
        ),
        data: await this.withTimeout(
          this.checkData(),
          10000,
          'Data check'
        )
      },
      summary: '',
      recommendations: []
    };

    // 分析检查结果并生成建议
    this.analyzeResults(result);

    console.log('[DatabaseIntegrityChecker] ✅ Database integrity check completed');
    console.log('[DatabaseIntegrityChecker] Summary:', result.summary);

    return result;
  }

  /**
   * 检查数据库连接状态
   */
  private async checkConnection(): Promise<ConnectionCheckResult> {
    console.log('[DatabaseIntegrityChecker] 🔍 Checking database connection...');

    try {
      // 检查数据库文件是否存在
      if (!this.dbManager.databaseExists()) {
        return {
          healthy: false,
          status: 'Database file not found',
          dbPath: this.dbPath,
          fileSize: 0,
          error: `Database file does not exist: ${this.dbPath}`
        };
      }

      // 验证数据库完整性
      const isValid = this.dbManager.verifyDatabase();
      if (!isValid) {
        return {
          healthy: false,
          status: 'Database integrity check failed',
          dbPath: this.dbPath,
          fileSize: this.dbManager.getDatabaseSize(),
          error: 'Database integrity verification failed'
        };
      }

      // 获取文件大小
      const fileSize = this.dbManager.getDatabaseSize();

      console.log(`[DatabaseIntegrityChecker] ✅ Database connection OK: ${this.dbPath} (${this.formatBytes(fileSize)})`);

      return {
        healthy: true,
        status: 'Connected',
        dbPath: this.dbPath,
        fileSize
      };
    } catch (error) {
      console.error('[DatabaseIntegrityChecker] ❌ Connection check failed:', error);
      return {
        healthy: false,
        status: 'Connection failed',
        dbPath: this.dbPath,
        fileSize: 0,
        error: String(error)
      };
    }
  }

  /**
   * 检查数据库结构完整性
   */
  private async checkStructure(): Promise<StructureCheckResult> {
    console.log('[DatabaseIntegrityChecker] 🔍 Checking database structure...');

    try {
      const db = this.dbManager.getDb();
      if (!db) {
        return {
          healthy: false,
          tables: 0,
          indexes: 0,
          tableDetails: [],
          indexDetails: [],
          error: 'Database not initialized'
        };
      }

      // 获取所有表
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
      const tableNames = tables.map(t => t.name);

      // 获取每个表的行数
      const tableDetails: Array<{ name: string; rowCount: number }> = [];
      for (const tableName of tableNames) {
        try {
          const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as any;
          tableDetails.push({
            name: tableName,
            rowCount: result.count
          });
        } catch (error) {
          console.warn(`[DatabaseIntegrityChecker] ⚠️ Error counting rows in table ${tableName}:`, error);
        }
      }

      // 获取所有索引
      const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as any[];
      const indexDetails: Array<{ name: string; tableName: string }> = indexes.map(idx => ({
        name: idx.name,
        tableName: idx.tbl_name
      }));

      console.log(`[DatabaseIntegrityChecker] ✅ Structure OK: ${tableNames.length} tables, ${indexes.length} indexes`);

      return {
        healthy: true,
        tables: tableNames.length,
        indexes: indexes.length,
        tableDetails,
        indexDetails
      };
    } catch (error) {
      console.error('[DatabaseIntegrityChecker] ❌ Structure check failed:', error);
      return {
        healthy: false,
        tables: 0,
        indexes: 0,
        tableDetails: [],
        indexDetails: [],
        error: String(error)
      };
    }
  }

  /**
   * 检查数据库性能
   */
  private async checkPerformance(): Promise<PerformanceCheckResult> {
    console.log('[DatabaseIntegrityChecker] 🔍 Checking database performance...');

    try {
      const startTime = Date.now();

      // 执行一个简单的查询来测试性能
      await this.dbManager.getAllTodos();

      const queryTime = Date.now() - startTime;
      const dbSizeBytes = this.dbManager.getDatabaseSize();
      const dbSize = this.formatBytes(dbSizeBytes);

      // 性能评估：查询时间超过2秒认为性能不佳
      const healthy = queryTime < 2000;

      console.log(`[DatabaseIntegrityChecker] ✅ Performance check: ${queryTime}ms, ${dbSize}`);

      return {
        healthy,
        queryTime,
        dbSize,
        dbSizeBytes
      };
    } catch (error) {
      console.error('[DatabaseIntegrityChecker] ❌ Performance check failed:', error);
      return {
        healthy: false,
        queryTime: 0,
        dbSize: 'Unknown',
        dbSizeBytes: 0,
        error: String(error)
      };
    }
  }

  /**
   * 检查数据完整性
   */
  private async checkData(): Promise<DataCheckResult> {
    console.log('[DatabaseIntegrityChecker] 🔍 Checking data integrity...');

    try {
      // 获取所有待办数据
      const todos = await this.dbManager.getAllTodos();
      const todoCount = todos.length;

      // 获取所有关系数据
      const relations = await this.dbManager.getAllRelations();
      const relationCount = relations.length;

      // 检查数据问题
      const issues: string[] = [];
      const sampleTitles = todos.slice(0, 5).map(t => t.title || 'Untitled');

      // 检查1：空标题的待办
      const emptyTitles = todos.filter(t => !t.title || t.title.trim() === '').length;
      if (emptyTitles > 0) {
        issues.push(`${emptyTitles} todos with empty titles`);
      }

      // 检查2：孤立的关系（source_id 或 target_id 不存在）
      const todoIds = new Set(todos.map(t => String(t.id)));
      const orphanRelations = relations.filter(
        r => !todoIds.has(String(r.source_id)) || !todoIds.has(String(r.target_id))
      ).length;
      if (orphanRelations > 0) {
        issues.push(`${orphanRelations} orphaned relations`);
      }

      // 检查3：无效的状态值
      const invalidStatus = todos.filter(
        t => !['pending', 'in_progress', 'completed', 'paused'].includes(t.status)
      ).length;
      if (invalidStatus > 0) {
        issues.push(`${invalidStatus} todos with invalid status`);
      }

      const healthy = issues.length === 0;

      console.log(`[DatabaseIntegrityChecker] ✅ Data check: ${todoCount} todos, ${relationCount} relations, ${issues.length} issues`);

      return {
        healthy,
        todoCount,
        relationCount,
        issues: issues.length,
        sampleTitles
      };
    } catch (error) {
      console.error('[DatabaseIntegrityChecker] ❌ Data check failed:', error);
      return {
        healthy: false,
        todoCount: 0,
        relationCount: 0,
        issues: 0,
        sampleTitles: [],
        error: String(error)
      };
    }
  }

  /**
   * 分析检查结果并生成建议
   */
  private analyzeResults(result: DatabaseIntegrityResult): void {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 分析连接状态
    if (!result.checks.connection.healthy) {
      issues.push(`Database connection error: ${result.checks.connection.error}`);
      recommendations.push('Check database file existence and permissions');
      recommendations.push('Verify database file is not corrupted');
    }

    // 分析结构状态
    if (!result.checks.structure.healthy) {
      issues.push(`Database structure error: ${result.checks.structure.error}`);
      recommendations.push('Run database migration to fix structure issues');
    } else if (result.checks.structure.tables === 0) {
      issues.push('No tables found in database');
      recommendations.push('Initialize database schema');
    }

    // 分析性能状态
    if (!result.checks.performance.healthy) {
      issues.push(`Performance issue: query took ${result.checks.performance.queryTime}ms`);
      recommendations.push('Consider running VACUUM to optimize database');
      recommendations.push('Check if database file size is too large');
    }

    // 分析数据状态
    if (!result.checks.data.healthy) {
      issues.push(`Data integrity issues found: ${result.checks.data.issues} problems`);
      recommendations.push('Review and fix data inconsistencies');
      recommendations.push('Clean up orphaned relations');
    } else if (result.checks.data.todoCount === 0) {
      issues.push('No todo data found');
      recommendations.push('Import todos from file storage or create new todos');
    }

    // 检查数据库文件大小
    const dbSizeMB = result.checks.performance.dbSizeBytes / (1024 * 1024);
    if (dbSizeMB > 100) {
      issues.push(`Database file is large (${result.checks.performance.dbSize})`);
      recommendations.push('Consider archiving old todos to reduce database size');
    }

    result.healthy = issues.length === 0;
    result.summary = issues.length > 0
      ? `Found ${issues.length} issue(s): ` + issues.join('; ')
      : 'All checks passed - database is healthy';
    result.recommendations = recommendations;
  }

  /**
   * 打印详细的诊断报告
   */
  printDiagnosticReport(result: DatabaseIntegrityResult): void {
    console.log('\n========================================');
    console.log('📊 Database Integrity Diagnostic Report');
    console.log('========================================\n');

    console.log(`Overall Health: ${result.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    console.log(`Summary: ${result.summary}\n`);

    console.log('--- Connection Status ---');
    console.log(`Healthy: ${result.checks.connection.healthy ? '✅' : '❌'}`);
    console.log(`Status: ${result.checks.connection.status}`);
    console.log(`Database Path: ${result.checks.connection.dbPath}`);
    console.log(`File Size: ${this.formatBytes(result.checks.connection.fileSize)}`);
    if (result.checks.connection.error) {
      console.log(`Error: ${result.checks.connection.error}`);
    }

    console.log('\n--- Structure Status ---');
    console.log(`Healthy: ${result.checks.structure.healthy ? '✅' : '❌'}`);
    console.log(`Tables: ${result.checks.structure.tables}`);
    console.log(`Indexes: ${result.checks.structure.indexes}`);
    if (result.checks.structure.tableDetails.length > 0) {
      console.log('Table Details:');
      result.checks.structure.tableDetails.forEach(table => {
        console.log(`  - ${table.name}: ${table.rowCount} rows`);
      });
    }
    if (result.checks.structure.error) {
      console.log(`Error: ${result.checks.structure.error}`);
    }

    console.log('\n--- Performance Status ---');
    console.log(`Healthy: ${result.checks.performance.healthy ? '✅' : '❌'}`);
    console.log(`Query Time: ${result.checks.performance.queryTime}ms`);
    console.log(`Database Size: ${result.checks.performance.dbSize}`);
    if (result.checks.performance.error) {
      console.log(`Error: ${result.checks.performance.error}`);
    }

    console.log('\n--- Data Status ---');
    console.log(`Healthy: ${result.checks.data.healthy ? '✅' : '❌'}`);
    console.log(`Todo Count: ${result.checks.data.todoCount}`);
    console.log(`Relation Count: ${result.checks.data.relationCount}`);
    console.log(`Issues Found: ${result.checks.data.issues}`);
    console.log(`Sample Titles: ${result.checks.data.sampleTitles.join(', ')}`);
    if (result.checks.data.error) {
      console.log(`Error: ${result.checks.data.error}`);
    }

    if (result.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      result.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('\n========================================\n');
  }

  /**
   * 超时保护包装器
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string = 'operation'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          const error = new Error(`${operation} timeout after ${timeoutMs}ms`);
          console.error(`[DatabaseIntegrityChecker] ❌ ${error.message}`);
          reject(error);
        }, timeoutMs)
      )
    ]);
  }

  /**
   * 格式化字节数为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
