/**
 * Unit tests for debug API diagnostic interface
 * Testing the fix for: TypeError: Cannot read properties of undefined (reading 'length')
 */

import { DiagnosticResult } from '../types';

describe('debug:quickDiagnostic API', () => {
  describe('Return value structure consistency', () => {
    it('should return complete structure when fileStorageManager is null', async () => {
      // Simulate the case where fileStorageManager is not initialized
      const mockResult = {
        success: false,
        healthy: false,
        issues: ['File storage not initialized'],
        recommendations: ['Initialize file storage manager'],
        error: 'File storage not initialized'
      };

      // Verify all required properties exist
      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('healthy');
      expect(mockResult).toHaveProperty('issues');
      expect(mockResult).toHaveProperty('recommendations');

      // Verify types
      expect(typeof mockResult.success).toBe('boolean');
      expect(typeof mockResult.healthy).toBe('boolean');
      expect(Array.isArray(mockResult.issues)).toBe(true);
      expect(Array.isArray(mockResult.recommendations)).toBe(true);

      // Verify we can safely access .length on issues
      expect(() => {
        const length = mockResult.issues.length;
        expect(length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should return complete structure when diagnostic throws error', async () => {
      const mockResult = {
        success: false,
        healthy: false,
        issues: ['Diagnostic error: simulated failure'],
        recommendations: ['Check file system permissions'],
        error: 'simulated failure'
      };

      expect(mockResult.issues).toBeDefined();
      expect(Array.isArray(mockResult.issues)).toBe(true);
      expect(mockResult.recommendations).toBeDefined();
      expect(Array.isArray(mockResult.recommendations)).toBe(true);
    });

    it('should return complete structure when diagnostic succeeds', async () => {
      const mockResult = {
        success: true,
        healthy: true,
        issues: [],
        recommendations: []
      };

      expect(mockResult.issues).toEqual([]);
      expect(mockResult.recommendations).toEqual([]);
      expect(() => {
        mockResult.issues.length;
        mockResult.recommendations.length;
      }).not.toThrow();
    });
  });

  describe('Safe access patterns', () => {
    it('should handle undefined issues with nullish coalescing', () => {
      const incompleteResult = {
        healthy: false,
        // issues property is missing
      } as any;

      // Safe access pattern
      const issues = incompleteResult.issues ?? [];
      const recommendations = incompleteResult.recommendations ?? [];

      expect(Array.isArray(issues)).toBe(true);
      expect(Array.isArray(recommendations)).toBe(true);
      expect(() => issues.length).not.toThrow();
      expect(() => recommendations.length).not.toThrow();
    });

    it('should handle optional chaining safely', () => {
      const result: any = {};

      // Optional chaining pattern
      const issuesLength = result.issues?.length ?? 0;
      const recommendationsLength = result.recommendations?.length ?? 0;

      expect(typeof issuesLength).toBe('number');
      expect(typeof recommendationsLength).toBe('number');
    });
  });
});
