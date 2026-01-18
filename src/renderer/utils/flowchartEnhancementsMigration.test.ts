import {
  migrateEdgeData,
  migrateNodeData,
  needsEdgeMigration,
  needsNodeMigration,
  migrateEdges,
  migrateNodes,
  needsEdgesMigration,
  needsNodesMigration
} from './flowchartEnhancementsMigration';
import { PersistedEdge, PersistedNode, LINE_WIDTH_OPTIONS } from '../../shared/types';

describe('flowchartEnhancementsMigration', () => {
  describe('migrateEdgeData', () => {
    it('should add default style to edge without style', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2'
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.style).toBeDefined();
      expect(migrated.style?.strokeWidth).toBe(LINE_WIDTH_OPTIONS.thin);
      expect(migrated.style?.stroke).toBe('#b1b1b7');
    });

    it('should add default strokeWidth to edge with partial style', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: {
          stroke: '#ff0000'
        }
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.style?.strokeWidth).toBe(LINE_WIDTH_OPTIONS.thin);
      expect(migrated.style?.stroke).toBe('#ff0000'); // Preserves existing stroke
    });

    it('should add default labelStyle to edge with label but no labelStyle', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes'
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.labelStyle).toBeDefined();
      expect(migrated.labelStyle?.fontSize).toBe(12);
      expect(migrated.labelStyle?.color).toBe('#000');
      expect(migrated.labelStyle?.backgroundColor).toBe('#fff');
      expect(migrated.labelStyle?.padding).toBe(4);
      expect(migrated.labelStyle?.borderRadius).toBe(4);
    });

    it('should not add labelStyle to edge without label', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2'
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.labelStyle).toBeUndefined();
    });

    it('should preserve existing labelStyle', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes',
        labelStyle: {
          fontSize: 14,
          color: '#ff0000',
          backgroundColor: '#000',
          padding: 8,
          borderRadius: 8
        }
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.labelStyle).toEqual(edge.labelStyle);
    });

    it('should not modify edge that already has complete style and labelStyle', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes',
        style: {
          strokeWidth: 2,
          stroke: '#ff0000'
        },
        labelStyle: {
          fontSize: 14,
          color: '#ff0000',
          backgroundColor: '#000',
          padding: 8,
          borderRadius: 8
        }
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated).toEqual(edge);
    });

    it('should handle edge with empty label string', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: ''
      };

      const migrated = migrateEdgeData(edge);

      // Empty string is falsy, so no labelStyle should be added
      expect(migrated.labelStyle).toBeUndefined();
    });
  });

  describe('migrateNodeData', () => {
    it('should return node unchanged', () => {
      const node: PersistedNode = {
        id: 'n1',
        type: 'rectangle',
        position: { x: 0, y: 0 },
        data: { label: 'Start' }
      };

      const migrated = migrateNodeData(node);

      expect(migrated).toEqual(node);
    });

    it('should handle text node type', () => {
      const node: PersistedNode = {
        id: 'n1',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { label: 'Note' }
      };

      const migrated = migrateNodeData(node);

      expect(migrated).toEqual(node);
    });
  });

  describe('needsEdgeMigration', () => {
    it('should return true for edge without style', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2'
      };

      expect(needsEdgeMigration(edge)).toBe(true);
    });

    it('should return true for edge with partial style', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: {
          stroke: '#ff0000'
        }
      };

      expect(needsEdgeMigration(edge)).toBe(true);
    });

    it('should return true for edge with label but no labelStyle', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes',
        style: {
          strokeWidth: 2,
          stroke: '#ff0000'
        }
      };

      expect(needsEdgeMigration(edge)).toBe(true);
    });

    it('should return false for edge with complete style and labelStyle', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes',
        style: {
          strokeWidth: 2,
          stroke: '#ff0000'
        },
        labelStyle: {
          fontSize: 14,
          color: '#ff0000',
          backgroundColor: '#000',
          padding: 8,
          borderRadius: 8
        }
      };

      expect(needsEdgeMigration(edge)).toBe(false);
    });

    it('should return false for edge without label and with complete style', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: {
          strokeWidth: 2,
          stroke: '#ff0000'
        }
      };

      expect(needsEdgeMigration(edge)).toBe(false);
    });
  });

  describe('needsNodeMigration', () => {
    it('should return false for any node', () => {
      const node: PersistedNode = {
        id: 'n1',
        type: 'rectangle',
        position: { x: 0, y: 0 },
        data: { label: 'Start' }
      };

      expect(needsNodeMigration(node)).toBe(false);
    });
  });

  describe('migrateEdges', () => {
    it('should migrate multiple edges', () => {
      const edges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2'
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n3',
          label: 'Yes'
        },
        {
          id: 'e3',
          source: 'n3',
          target: 'n4',
          style: {
            strokeWidth: 2,
            stroke: '#ff0000'
          }
        }
      ];

      const migrated = migrateEdges(edges);

      expect(migrated).toHaveLength(3);
      expect(migrated[0].style).toBeDefined();
      expect(migrated[1].style).toBeDefined();
      expect(migrated[1].labelStyle).toBeDefined();
      expect(migrated[2].style?.strokeWidth).toBe(2);
    });

    it('should handle empty array', () => {
      const edges: PersistedEdge[] = [];
      const migrated = migrateEdges(edges);

      expect(migrated).toEqual([]);
    });
  });

  describe('migrateNodes', () => {
    it('should return nodes unchanged', () => {
      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Start' }
        },
        {
          id: 'n2',
          type: 'text',
          position: { x: 100, y: 100 },
          data: { label: 'Note' }
        }
      ];

      const migrated = migrateNodes(nodes);

      expect(migrated).toEqual(nodes);
    });

    it('should handle empty array', () => {
      const nodes: PersistedNode[] = [];
      const migrated = migrateNodes(nodes);

      expect(migrated).toEqual([]);
    });
  });

  describe('needsEdgesMigration', () => {
    it('should return true if any edge needs migration', () => {
      const edges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          style: {
            strokeWidth: 2,
            stroke: '#ff0000'
          }
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n3'
        }
      ];

      expect(needsEdgesMigration(edges)).toBe(true);
    });

    it('should return false if no edge needs migration', () => {
      const edges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          style: {
            strokeWidth: 2,
            stroke: '#ff0000'
          }
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n3',
          style: {
            strokeWidth: 1,
            stroke: '#b1b1b7'
          }
        }
      ];

      expect(needsEdgesMigration(edges)).toBe(false);
    });

    it('should return false for empty array', () => {
      const edges: PersistedEdge[] = [];

      expect(needsEdgesMigration(edges)).toBe(false);
    });
  });

  describe('needsNodesMigration', () => {
    it('should return false for any nodes', () => {
      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Start' }
        },
        {
          id: 'n2',
          type: 'text',
          position: { x: 100, y: 100 },
          data: { label: 'Note' }
        }
      ];

      expect(needsNodesMigration(nodes)).toBe(false);
    });

    it('should return false for empty array', () => {
      const nodes: PersistedNode[] = [];

      expect(needsNodesMigration(nodes)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle edge with undefined style properties', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: {
          strokeWidth: undefined,
          stroke: undefined
        }
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.style?.strokeWidth).toBe(LINE_WIDTH_OPTIONS.thin);
      expect(migrated.style?.stroke).toBe('#b1b1b7');
    });

    it('should preserve other edge properties during migration', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
        markerEnd: 'arrowclosed',
        animated: true
      };

      const migrated = migrateEdgeData(edge);

      expect(migrated.id).toBe('e1');
      expect(migrated.source).toBe('n1');
      expect(migrated.target).toBe('n2');
      expect(migrated.sourceHandle).toBe('right');
      expect(migrated.targetHandle).toBe('left');
      expect(migrated.type).toBe('smoothstep');
      expect(migrated.markerEnd).toBe('arrowclosed');
      expect(migrated.animated).toBe(true);
    });

    it('should handle edge with strokeWidth 0', () => {
      const edge: PersistedEdge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        style: {
          strokeWidth: 0,
          stroke: '#ff0000'
        }
      };

      const migrated = migrateEdgeData(edge);

      // strokeWidth 0 is a valid value, should be preserved
      expect(migrated.style?.strokeWidth).toBe(0);
      expect(migrated.style?.stroke).toBe('#ff0000');
    });
  });
});
