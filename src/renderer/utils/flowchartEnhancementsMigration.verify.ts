/**
 * Manual verification script for flowchartEnhancementsMigration
 * 
 * This script manually tests the migration functions to ensure they work correctly.
 * Run this with: npx ts-node src/renderer/utils/flowchartEnhancementsMigration.verify.ts
 */

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

console.log('=== Flowchart Enhancements Migration Verification ===\n');

// Test 1: Migrate edge without style
console.log('Test 1: Migrate edge without style');
const edge1: PersistedEdge = {
  id: 'e1',
  source: 'n1',
  target: 'n2'
};
const migrated1 = migrateEdgeData(edge1);
console.log('✓ Edge migrated:', {
  hasStyle: !!migrated1.style,
  strokeWidth: migrated1.style?.strokeWidth,
  stroke: migrated1.style?.stroke
});
console.assert(migrated1.style?.strokeWidth === LINE_WIDTH_OPTIONS.thin, 'strokeWidth should be thin');
console.assert(migrated1.style?.stroke === '#b1b1b7', 'stroke should be #b1b1b7');
console.log('');

// Test 2: Migrate edge with label but no labelStyle
console.log('Test 2: Migrate edge with label but no labelStyle');
const edge2: PersistedEdge = {
  id: 'e2',
  source: 'n1',
  target: 'n2',
  label: 'Yes'
};
const migrated2 = migrateEdgeData(edge2);
console.log('✓ Edge migrated:', {
  hasLabel: !!migrated2.label,
  hasLabelStyle: !!migrated2.labelStyle,
  fontSize: migrated2.labelStyle?.fontSize
});
console.assert(migrated2.labelStyle?.fontSize === 12, 'fontSize should be 12');
console.assert(migrated2.labelStyle?.color === '#000', 'color should be #000');
console.log('');

// Test 3: Edge with complete style should not be modified
console.log('Test 3: Edge with complete style should not be modified');
const edge3: PersistedEdge = {
  id: 'e3',
  source: 'n1',
  target: 'n2',
  style: {
    strokeWidth: 2,
    stroke: '#ff0000'
  }
};
const migrated3 = migrateEdgeData(edge3);
console.log('✓ Edge unchanged:', {
  strokeWidth: migrated3.style?.strokeWidth,
  stroke: migrated3.style?.stroke
});
console.assert(migrated3.style?.strokeWidth === 2, 'strokeWidth should remain 2');
console.assert(migrated3.style?.stroke === '#ff0000', 'stroke should remain #ff0000');
console.log('');

// Test 4: needsEdgeMigration checks
console.log('Test 4: needsEdgeMigration checks');
console.log('✓ Edge without style needs migration:', needsEdgeMigration(edge1));
console.log('✓ Edge with label but no labelStyle needs migration:', needsEdgeMigration(edge2));
console.log('✓ Edge with complete style does not need migration:', needsEdgeMigration(edge3));
console.assert(needsEdgeMigration(edge1) === true, 'edge1 should need migration');
console.assert(needsEdgeMigration(edge2) === true, 'edge2 should need migration');
console.assert(needsEdgeMigration(edge3) === false, 'edge3 should not need migration');
console.log('');

// Test 5: Batch migration
console.log('Test 5: Batch migration');
const edges: PersistedEdge[] = [edge1, edge2, edge3];
const migratedEdges = migrateEdges(edges);
console.log('✓ Migrated', migratedEdges.length, 'edges');
console.assert(migratedEdges.length === 3, 'should have 3 edges');
console.assert(migratedEdges[0].style?.strokeWidth === LINE_WIDTH_OPTIONS.thin, 'first edge should have default strokeWidth');
console.assert(migratedEdges[1].labelStyle?.fontSize === 12, 'second edge should have default labelStyle');
console.log('');

// Test 6: Node migration (should be no-op)
console.log('Test 6: Node migration (should be no-op)');
const node1: PersistedNode = {
  id: 'n1',
  type: 'rectangle',
  position: { x: 0, y: 0 },
  data: { label: 'Start' }
};
const migratedNode = migrateNodeData(node1);
console.log('✓ Node unchanged:', migratedNode.id === node1.id);
console.assert(migratedNode === node1, 'node should be unchanged');
console.assert(needsNodeMigration(node1) === false, 'node should not need migration');
console.log('');

// Test 7: Text node handling
console.log('Test 7: Text node handling');
const textNode: PersistedNode = {
  id: 'n2',
  type: 'text',
  position: { x: 100, y: 100 },
  data: { label: 'Note' }
};
const migratedTextNode = migrateNodeData(textNode);
console.log('✓ Text node unchanged:', migratedTextNode.type === 'text');
console.assert(migratedTextNode.type === 'text', 'text node type should be preserved');
console.log('');

// Test 8: Edge with partial style
console.log('Test 8: Edge with partial style');
const edge4: PersistedEdge = {
  id: 'e4',
  source: 'n1',
  target: 'n2',
  style: {
    stroke: '#00ff00'
  }
};
const migrated4 = migrateEdgeData(edge4);
console.log('✓ Edge with partial style migrated:', {
  strokeWidth: migrated4.style?.strokeWidth,
  stroke: migrated4.style?.stroke
});
console.assert(migrated4.style?.strokeWidth === LINE_WIDTH_OPTIONS.thin, 'should add default strokeWidth');
console.assert(migrated4.style?.stroke === '#00ff00', 'should preserve existing stroke');
console.log('');

// Test 9: Edge with empty label
console.log('Test 9: Edge with empty label');
const edge5: PersistedEdge = {
  id: 'e5',
  source: 'n1',
  target: 'n2',
  label: ''
};
const migrated5 = migrateEdgeData(edge5);
console.log('✓ Edge with empty label:', {
  hasLabel: !!migrated5.label,
  hasLabelStyle: !!migrated5.labelStyle
});
console.assert(!migrated5.labelStyle, 'should not add labelStyle for empty label');
console.log('');

// Test 10: needsEdgesMigration
console.log('Test 10: needsEdgesMigration');
const mixedEdges: PersistedEdge[] = [edge1, edge3];
console.log('✓ Mixed edges need migration:', needsEdgesMigration(mixedEdges));
console.assert(needsEdgesMigration(mixedEdges) === true, 'should return true if any edge needs migration');

const completeEdges: PersistedEdge[] = [edge3];
console.log('✓ Complete edges do not need migration:', !needsEdgesMigration(completeEdges));
console.assert(needsEdgesMigration(completeEdges) === false, 'should return false if no edge needs migration');
console.log('');

console.log('=== All verification tests passed! ===');
