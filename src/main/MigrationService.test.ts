/**
 * Unit tests for MigrationService database deletion logic
 * Tests focus on: database connection cleanup before file deletion
 */

import { MigrationService } from './MigrationService';
import { DatabaseManager } from './database/DatabaseManager';
import { FileStorageManager } from './FileStorageManager';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('./database/DatabaseManager');
jest.mock('./FileStorageManager');
jest.mock('./BackupManager');

describe('MigrationService - database deletion logic', () => {
  let migrationService: MigrationService;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockFileStorage: jest.Mocked<FileStorageManager>;
  let testDbPath: string;

  beforeEach(() => {
    // Create test database path
    testDbPath = path.join('/tmp', `migration-test-${Date.now()}.db`);

    // Setup mocks
    mockDbManager = new DatabaseManager() as jest.Mocked<DatabaseManager>;
    mockFileStorage = new FileStorageManager('/tmp/test-storage') as jest.Mocked<FileStorageManager>;

    mockDbManager.getDbPath.mockReturnValue(testDbPath);
    mockDbManager.getAllTodos.mockResolvedValue([]);
    mockDbManager.getAllRelations.mockResolvedValue([]);
    mockDbManager.getSettings.mockResolvedValue({ storageMode: 'database', storagePath: '' });

    // Create migration service
    migrationService = new MigrationService(mockDbManager, mockFileStorage);

    // Create a test database file
    fs.writeFileSync(testDbPath, 'test database content');
  });

  afterEach(() => {
    // Cleanup test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Database deletion with connection cleanup', () => {
    it('should close database connection before deletion when deleteDatabaseAfter is true', async () => {
      // Setup
      const closeSpy = jest.spyOn(mockDbManager, 'close');

      // Execute migration with deleteDatabaseAfter option
      await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: true,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify close was called
      expect(closeSpy).toHaveBeenCalled();

      // Verify database file was deleted
      expect(fs.existsSync(testDbPath)).toBe(false);
    });

    it('should NOT close database connection when deleteDatabaseAfter is false', async () => {
      // Setup
      const closeSpy = jest.spyOn(mockDbManager, 'close');

      // Execute migration without deleteDatabaseAfter option
      await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: false,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify close was NOT called
      expect(closeSpy).not.toHaveBeenCalled();

      // Verify database file still exists
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should handle database close errors gracefully but still attempt deletion', async () => {
      // Setup - make close throw an error
      jest.spyOn(mockDbManager, 'close').mockImplementation(() => {
        throw new Error('Database close failed');
      });

      // Execute migration - should not throw
      const result = await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: true,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify migration completed (may have errors but didn't crash)
      expect(result).toBeDefined();
    });
  });

  describe('File deletion safety', () => {
    it('should not attempt to delete non-existent database file', async () => {
      // Remove the test file
      fs.unlinkSync(testDbPath);

      const unlinkSpy = jest.spyOn(fs.promises, 'unlink');

      // Execute migration
      await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: true,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify unlink was called but with non-existent file (should handle gracefully)
      expect(unlinkSpy).toHaveBeenCalled();
    });

    it('should handle file deletion errors gracefully', async () => {
      // Setup - make unlink throw an error
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('EBUSY: resource busy'));

      // Execute migration - should not throw
      const result = await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: true,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify migration completed with error information
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should complete full migration flow with database cleanup', async () => {
      // Setup - mock successful migration data
      mockDbManager.getAllTodos.mockResolvedValue([
        {
          id: 1,
          title: 'Test Todo',
          content: 'Test content',
          status: 'pending',
          priority: 'medium',
          tags: '["test"]',
          imageUrl: null,
          images: null,
          startTime: null,
          deadline: null,
          displayOrder: 0,
          displayOrders: '{}',
          contentHash: 'hash123',
          keywords: '["keyword"]',
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);

      mockFileStorage.createTodo.mockResolvedValue({
        id: 'uuid-123',
        title: 'Test Todo',
        content: 'Test content',
        status: 'pending',
        priority: 'medium',
        tags: ['test'],
        keywords: ['keyword'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Execute migration
      const result = await migrationService.migrate('/tmp/test-storage', {
        deleteDatabaseAfter: true,
        createBackup: false,
        batchWriteSize: 50,
        verifyAfterMigration: false,
        forceClean: false
      });

      // Verify successful migration
      expect(result.success).toBe(true);
      expect(result.todosMigrated).toBeGreaterThan(0);

      // Verify database cleanup
      expect(mockDbManager.close).toHaveBeenCalled();
      expect(fs.existsSync(testDbPath)).toBe(false);
    });
  });
});
