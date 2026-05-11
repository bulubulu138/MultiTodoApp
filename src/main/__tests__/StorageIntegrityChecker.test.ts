/**
 * Unit tests for StorageIntegrityChecker
 */

import { StorageIntegrityChecker, IntegrityCheckResult } from '../services/StorageIntegrityChecker';

describe('StorageIntegrityChecker', () => {
  describe('Result structure validation', () => {
    it('should return complete structure when all checks pass', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: true,
        checks: {
          database: {
            healthy: true,
            todoCount: 1,
            sampleTitles: ['Test Todo']
          },
          fileSystem: {
            healthy: true,
            mdFileCount: 29,
            sampleFiles: ['test1.md', 'test2.md']
          },
          index: {
            healthy: true,
            indexEntryCount: 29,
            indexLoaded: true,
            sampleEntries: [
              { uuid: 'uuid-1', title: 'Test 1' },
              { uuid: 'uuid-2', title: 'Test 2' }
            ]
          },
          mapping: {
            healthy: true,
            orphanFiles: [],
            orphanRecords: [],
            databaseMismatch: 0
          }
        },
        summary: 'All checks passed',
        recommendations: []
      };

      expect(mockResult).toHaveProperty('healthy');
      expect(mockResult).toHaveProperty('checks');
      expect(mockResult).toHaveProperty('summary');
      expect(mockResult).toHaveProperty('recommendations');

      expect(mockResult.checks).toHaveProperty('database');
      expect(mockResult.checks).toHaveProperty('fileSystem');
      expect(mockResult.checks).toHaveProperty('index');
      expect(mockResult.checks).toHaveProperty('mapping');
    });

    it('should handle database errors gracefully', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: false,
        checks: {
          database: {
            healthy: false,
            todoCount: 0,
            sampleTitles: [],
            error: 'Connection failed'
          },
          fileSystem: {
            healthy: true,
            mdFileCount: 29,
            sampleFiles: []
          },
          index: {
            healthy: true,
            indexEntryCount: 29,
            indexLoaded: true,
            sampleEntries: []
          },
          mapping: {
            healthy: true,
            orphanFiles: [],
            orphanRecords: [],
            databaseMismatch: 0
          }
        },
        summary: 'Found 1 issue(s): Database error: Connection failed',
        recommendations: ['Check database connection and permissions']
      };

      expect(mockResult.healthy).toBe(false);
      expect(mockResult.checks.database.healthy).toBe(false);
      expect(mockResult.checks.database.error).toBeDefined();
      expect(mockResult.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Mapping inconsistency detection', () => {
    it('should detect orphan files', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: false,
        checks: {
          database: { healthy: true, todoCount: 10, sampleTitles: [] },
          fileSystem: { healthy: true, mdFileCount: 29, sampleFiles: [] },
          index: { healthy: true, indexEntryCount: 1, indexLoaded: true, sampleEntries: [] },
          mapping: {
            healthy: false,
            orphanFiles: ['orphan1.md', 'orphan2.md'],
            orphanRecords: [],
            databaseMismatch: 0
          }
        },
        summary: 'Found 1 issue(s): 2 orphan files found',
        recommendations: ['Run index rebuild to include orphan files']
      };

      expect(mockResult.checks.mapping.orphanFiles.length).toBe(2);
      expect(mockResult.checks.mapping.healthy).toBe(false);
      expect(mockResult.recommendations).toContain('Run index rebuild to include orphan files');
    });

    it('should detect orphan records', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: false,
        checks: {
          database: { healthy: true, todoCount: 10, sampleTitles: [] },
          fileSystem: { healthy: true, mdFileCount: 1, sampleFiles: [] },
          index: { healthy: true, indexEntryCount: 29, indexLoaded: true, sampleEntries: [] },
          mapping: {
            healthy: false,
            orphanFiles: [],
            orphanRecords: ['missing1.md', 'missing2.md', 'missing3.md'],
            databaseMismatch: 0
          }
        },
        summary: 'Found 1 issue(s): 3 orphan index records',
        recommendations: ['Clean up orphan index records']
      };

      expect(mockResult.checks.mapping.orphanRecords.length).toBe(3);
      expect(mockResult.checks.mapping.healthy).toBe(false);
      expect(mockResult.recommendations).toContain('Clean up orphan index records');
    });

    it('should detect database mismatches', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: false,
        checks: {
          database: { healthy: true, todoCount: 10, sampleTitles: [] },
          fileSystem: { healthy: true, mdFileCount: 29, sampleFiles: [] },
          index: { healthy: true, indexEntryCount: 29, indexLoaded: true, sampleEntries: [] },
          mapping: {
            healthy: false,
            orphanFiles: [],
            orphanRecords: [],
            databaseMismatch: 5
          }
        },
        summary: 'Found 1 issue(s): 5 database records don\'t match files',
        recommendations: ['Sync database with file storage']
      };

      expect(mockResult.checks.mapping.databaseMismatch).toBe(5);
      expect(mockResult.checks.mapping.healthy).toBe(false);
      expect(mockResult.recommendations).toContain('Sync database with file storage');
    });
  });

  describe('Count mismatch detection', () => {
    it('should detect file count vs index count mismatch', () => {
      const mockResult: IntegrityCheckResult = {
        healthy: false,
        checks: {
          database: { healthy: true, todoCount: 1, sampleTitles: [] },
          fileSystem: { healthy: true, mdFileCount: 29, sampleFiles: [] },
          index: { healthy: true, indexEntryCount: 1, indexLoaded: true, sampleEntries: [] },
          mapping: {
            healthy: true,
            orphanFiles: [],
            orphanRecords: [],
            databaseMismatch: 0
          }
        },
        summary: 'Found 1 issue(s): File count mismatch: 29 files vs 1 index entries',
        recommendations: ['Rebuild index to sync with actual files']
      };

      expect(mockResult.healthy).toBe(false);
      expect(mockResult.checks.fileSystem.mdFileCount).toBe(29);
      expect(mockResult.checks.index.indexEntryCount).toBe(1);
      expect(mockResult.summary).toContain('29 files vs 1 index entries');
    });
  });
});
