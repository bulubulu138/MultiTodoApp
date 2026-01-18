import { toRuntimeEdge, toRuntimeEdges } from './flowchartTransforms';
import { DomainEdge } from '../../shared/types';

describe('flowchartTransforms Error Handling', () => {
  describe('Label Overflow Handling', () => {
    it('should truncate labels longer than 30 characters', () => {
      const longLabel = 'This is a very long label that exceeds the maximum display length';
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: longLabel,
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe('This is a very long label that...');
      expect(result.label?.length).toBeLessThanOrEqual(33); // 30 + '...'
      expect(result.data?.fullLabel).toBe(longLabel);
    });

    it('should not truncate labels shorter than 30 characters', () => {
      const shortLabel = 'Short label';
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: shortLabel,
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe(shortLabel);
      expect(result.data?.fullLabel).toBe(shortLabel);
    });

    it('should handle undefined labels', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBeUndefined();
      expect(result.data?.fullLabel).toBeUndefined();
    });

    it('should handle empty string labels', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: '',
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe('');
    });
  });

  describe('Invalid Label Style Handling', () => {
    it('should use default fontSize for invalid values', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: -5, // Invalid: negative
          color: '#000'
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelStyle?.fontSize).toBe(12); // Default
    });

    it('should use default fontSize for excessively large values', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: 200, // Invalid: too large
          color: '#000'
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelStyle?.fontSize).toBe(12); // Default
    });

    it('should use default fontSize for zero', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: 0, // Invalid: zero
          color: '#000'
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelStyle?.fontSize).toBe(12); // Default
    });

    it('should accept valid fontSize values', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: 16,
          color: '#000'
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelStyle?.fontSize).toBe(16);
    });

    it('should use default color for missing color', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: 12
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelStyle?.fill).toBe('#000'); // Default
    });

    it('should use default backgroundColor for missing value', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          fontSize: 12,
          color: '#000'
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgStyle?.fill).toBe('#fff'); // Default
    });
  });

  describe('Invalid Padding and BorderRadius Handling', () => {
    it('should reject negative padding', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          padding: -5 // Invalid
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgPadding).toBeUndefined();
    });

    it('should reject excessively large padding', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          padding: 100 // Invalid: too large
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgPadding).toBeUndefined();
    });

    it('should accept valid padding', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          padding: 8
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgPadding).toEqual([8, 8]);
    });

    it('should reject negative borderRadius', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          borderRadius: -5 // Invalid
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgBorderRadius).toBeUndefined();
    });

    it('should reject excessively large borderRadius', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          borderRadius: 100 // Invalid: too large
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgBorderRadius).toBeUndefined();
    });

    it('should accept valid borderRadius', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'Test',
        labelStyle: {
          borderRadius: 4
        },
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.labelBgBorderRadius).toBe(4);
    });
  });

  describe('Batch Conversion', () => {
    it('should handle multiple edges with mixed valid and invalid data', () => {
      const edges: DomainEdge[] = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          label: 'Valid label',
          labelStyle: {
            fontSize: 14,
            color: '#000'
          },
          type: 'default'
        },
        {
          id: 'edge-2',
          source: 'node-2',
          target: 'node-3',
          label: 'This is a very long label that will be truncated because it exceeds the limit',
          labelStyle: {
            fontSize: -10, // Invalid
            color: '#f00'
          },
          type: 'straight'
        },
        {
          id: 'edge-3',
          source: 'node-3',
          target: 'node-4',
          type: 'default'
          // No label or labelStyle
        }
      ];

      const results = toRuntimeEdges(edges);

      expect(results).toHaveLength(3);
      
      // First edge: valid
      expect(results[0].label).toBe('Valid label');
      expect(results[0].labelStyle?.fontSize).toBe(14);
      
      // Second edge: truncated label, default fontSize
      expect(results[1].label).toBe('This is a very long label that...');
      expect(results[1].labelStyle?.fontSize).toBe(12); // Default
      
      // Third edge: no label
      expect(results[2].label).toBeUndefined();
      expect(results[2].labelStyle).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge with only spaces as label', () => {
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: '     ',
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe('     ');
    });

    it('should handle edge with special characters in label', () => {
      const specialLabel = '→ ← ↑ ↓ ✓ ✗ 中文 日本語';
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: specialLabel,
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe(specialLabel);
    });

    it('should handle edge with emoji in label', () => {
      const emojiLabel = '🎉 Success! 🚀';
      const edge: DomainEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: emojiLabel,
        type: 'default'
      };

      const result = toRuntimeEdge(edge);

      expect(result.label).toBe(emojiLabel);
    });
  });
});
