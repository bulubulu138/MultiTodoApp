/**
 * Unit tests for DatabaseManager close() method
 * Tests focus on: idempotency, error handling, resource cleanup
 */

import Database from 'better-sqlite3';
import { DatabaseManager } from './DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app')
  }
}));

describe('DatabaseManager - close() method', () => {
  let dbManager: DatabaseManager;
  let testDbPath: string;

  beforeEach(() => {
    // Create a unique test database path
    testDbPath = path.join('/tmp', `test-db-${Date.now()}.db`);

    // Mock the database path
    jest.spyOn(app, 'getPath').mockReturnValue('/tmp');

    dbManager = new DatabaseManager();

    // Override the dbPath for testing
    (dbManager as any).dbPath = testDbPath;
  });

  afterEach(async () => {
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Ensure database is closed
    try {
      (dbManager as any).db?.close();
    } catch (error) {
      // Ignore close errors
    }
  });

  describe('Idempotency tests', () => {
    it('should be idempotent - multiple calls should not throw', async () => {
      await dbManager.initialize();

      // First close
      expect(() => dbManager.close()).not.toThrow();

      // Second close should not throw
      expect(() => dbManager.close()).not.toThrow();

      // Third close should still not throw
      expect(() => dbManager.close()).not.toThrow();
    });

    it('should handle close when database is not initialized', () => {
      // Database not initialized
      expect(() => dbManager.close()).not.toThrow();
    });
  });

  describe('Resource cleanup tests', () => {
    it('should release database connection and allow file deletion', async () => {
      await dbManager.initialize();

      // Verify database file exists
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Close database
      dbManager.close();

      // Verify db is null
      expect((dbManager as any).db).toBeNull();

      // Should be able to delete the file (no EBUSY error)
      expect(() => fs.unlinkSync(testDbPath)).not.toThrow();

      // Verify file is deleted
      expect(fs.existsSync(testDbPath)).toBe(false);
    });

    it('should set db to null after successful close', async () => {
      await dbManager.initialize();

      const dbBeforeClose = (dbManager as any).db;
      expect(dbBeforeClose).not.toBeNull();

      dbManager.close();

      const dbAfterClose = (dbManager as any).db;
      expect(dbAfterClose).toBeNull();
    });
  });

  describe('Error handling tests', () => {
    it('should handle errors during close gracefully', async () => {
      await dbManager.initialize();

      // Mock the close method to throw an error
      const originalDb = (dbManager as any).db;
      jest.spyOn(originalDb, 'close').mockImplementation(() => {
        throw new Error('Simulated close error');
      });

      // Should not throw, but should log error
      expect(() => dbManager.close()).not.toThrow();
    });

    it('should handle case where db.close() throws but still set db to null', async () => {
      await dbManager.initialize();

      const originalDb = (dbManager as any).db;
      let closeCalled = false;
      jest.spyOn(originalDb, 'close').mockImplementation(() => {
        closeCalled = true;
        throw new Error('Close failed');
      });

      dbManager.close();

      expect(closeCalled).toBe(true);
      expect((dbManager as any).db).toBeNull();
    });
  });

  describe('Integration with file operations', () => {
    it('should allow file operations after close', async () => {
      await dbManager.initialize();

      // Perform some database operations
      await dbManager.createTodo({
        title: 'Test Todo',
        content: 'Test content',
        status: 'pending',
        priority: 'medium',
        tags: [],
        keywords: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Close database
      dbManager.close();

      // Should be able to access file metadata
      const stats = fs.statSync(testDbPath);
      expect(stats.isFile()).toBe(true);

      // Should be able to rename file
      const renamedPath = testDbPath + '.renamed';
      fs.renameSync(testDbPath, renamedPath);
      expect(fs.existsSync(renamedPath)).toBe(true);
      expect(fs.existsSync(testDbPath)).toBe(false);

      // Cleanup
      fs.unlinkSync(renamedPath);
    });
  });
});
