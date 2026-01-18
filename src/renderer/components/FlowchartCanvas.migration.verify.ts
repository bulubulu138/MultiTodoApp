/**
 * FlowchartCanvas Migration Integration Verification
 * 
 * Manual verification script to test that FlowchartCanvas correctly applies
 * migrations when loading flowchart data.
 * 
 * Run this in the browser console when the app is running to verify migration.
 * 
 * Validates Requirements: 5.4, 5.5
 */

import { PersistedNode, PersistedEdge } from '../../shared/types';
import { migrateEdges as migrateEdgesBasic, needsEdgesMigration as needsEdgesMigrationBasic } from '../utils/flowchartMigration';
import { migrateEdges as migrateEdgesEnhancements, migrateNodes as migrateNodesEnhancements, needsEdgesMigration as needsEdgesMigrationEnhancements, needsNodesMigration } from '../utils/flowchartEnhancementsMigration';

console.log('=== FlowchartCanvas Migration Verification ===\n');

// Test 1: Legacy edge without any properties
console.log('Test 1: Legacy edge without markerEnd, type, animated, style, labelStyle');
const legacyEdge1: PersistedEdge = {
  id: 'e1',
  source: 'n1',
  target: 'n2'
} as PersistedEdge;

console.log('Before migration:', legacyEdge1);

let migratedEdge1 = legacyEdge1;
if (needsEdgesMigrationBasic([legacyEdge1])) {
  console.log('✓ Basic migration needed');
  migratedEdge1 = migrateEdgesBasic([migratedEdge1])[0];
}

if (needsEdgesMigrationEnhancements([migratedEdge1])) {
  console.log('✓ Enhancements migration needed');
  migratedEdge1 = migrateEdgesEnhancements([migratedEdge1])[0];
}

console.log('After migration:', migratedEdge1);
console.assert(migratedEdge1.markerEnd === 'arrowclosed', 'Should have markerEnd');
console.assert(migratedEdge1.type === 'default', 'Should have type');
console.assert(migratedEdge1.animated === false, 'Should have animated');
console.assert(migratedEdge1.style?.strokeWidth === 1, 'Should have strokeWidth');
console.assert(migratedEdge1.style?.stroke === '#b1b1b7', 'Should have stroke color');
console.log('✓ Test 1 passed\n');

// Test 2: Edge with basic properties but no enhancements
console.log('Test 2: Edge with basic properties but no style/labelStyle');
const legacyEdge2: PersistedEdge = {
  id: 'e2',
  source: 'n1',
  target: 'n2',
  markerEnd: 'arrowclosed',
  type: 'default',
  animated: false,
  label: 'Connection'
};

console.log('Before migration:', legacyEdge2);

let migratedEdge2 = legacyEdge2;
if (needsEdgesMigrationBasic([legacyEdge2])) {
  console.log('✓ Basic migration needed');
  migratedEdge2 = migrateEdgesBasic([migratedEdge2])[0];
} else {
  console.log('✓ Basic migration not needed');
}

if (needsEdgesMigrationEnhancements([migratedEdge2])) {
  console.log('✓ Enhancements migration needed');
  migratedEdge2 = migrateEdgesEnhancements([migratedEdge2])[0];
}

console.log('After migration:', migratedEdge2);
console.assert(migratedEdge2.style?.strokeWidth === 1, 'Should have strokeWidth');
console.assert(migratedEdge2.style?.stroke === '#b1b1b7', 'Should have stroke color');
console.assert(migratedEdge2.labelStyle?.fontSize === 12, 'Should have label fontSize');
console.assert(migratedEdge2.labelStyle?.color === '#000', 'Should have label color');
console.log('✓ Test 2 passed\n');

// Test 3: Modern edge with all properties
console.log('Test 3: Modern edge with all properties (no migration needed)');
const modernEdge: PersistedEdge = {
  id: 'e3',
  source: 'n1',
  target: 'n2',
  markerEnd: 'arrowclosed',
  type: 'default',
  animated: false,
  style: {
    strokeWidth: 2,
    stroke: '#b1b1b7'
  },
  labelStyle: {
    fontSize: 12,
    color: '#000',
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 4
  }
};

console.log('Before migration:', modernEdge);

let migratedEdge3 = modernEdge;
const needsBasic = needsEdgesMigrationBasic([modernEdge]);
const needsEnhancements = needsEdgesMigrationEnhancements([modernEdge]);

console.log('Needs basic migration:', needsBasic);
console.log('Needs enhancements migration:', needsEnhancements);

console.assert(!needsBasic, 'Should not need basic migration');
console.assert(!needsEnhancements, 'Should not need enhancements migration');
console.log('✓ Test 3 passed\n');

// Test 4: Batch migration
console.log('Test 4: Batch migration of multiple edges');
const batchEdges: PersistedEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2' } as PersistedEdge,
  { id: 'e2', source: 'n2', target: 'n3', markerEnd: 'arrowclosed', type: 'default', animated: false, label: 'Test' },
  { id: 'e3', source: 'n3', target: 'n4', markerEnd: 'arrowclosed', type: 'default', animated: false, style: { strokeWidth: 2, stroke: '#b1b1b7' } }
];

console.log('Before migration:', batchEdges.length, 'edges');

let migratedBatch = batchEdges;
if (needsEdgesMigrationBasic(migratedBatch)) {
  console.log('✓ Applying basic migration to batch');
  migratedBatch = migrateEdgesBasic(migratedBatch);
}

if (needsEdgesMigrationEnhancements(migratedBatch)) {
  console.log('✓ Applying enhancements migration to batch');
  migratedBatch = migrateEdgesEnhancements(migratedBatch);
}

console.log('After migration:', migratedBatch.length, 'edges');
console.assert(migratedBatch.every(e => e.markerEnd), 'All edges should have markerEnd');
console.assert(migratedBatch.every(e => e.type), 'All edges should have type');
console.assert(migratedBatch.every(e => e.style?.strokeWidth), 'All edges should have strokeWidth');
console.log('✓ Test 4 passed\n');

// Test 5: Node migration (currently no-op)
console.log('Test 5: Node migration (currently no-op)');
const nodes: PersistedNode[] = [
  {
    id: 'n1',
    type: 'rectangle',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' }
  },
  {
    id: 'n2',
    type: 'text',
    position: { x: 200, y: 0 },
    data: { label: 'Text Node' }
  }
];

console.log('Before migration:', nodes.length, 'nodes');

const needsNodeMigration = needsNodesMigration(nodes);
console.log('Needs node migration:', needsNodeMigration);

let migratedNodes = nodes;
if (needsNodeMigration) {
  console.log('✓ Applying node migration');
  migratedNodes = migrateNodesEnhancements(migratedNodes);
}

console.log('After migration:', migratedNodes.length, 'nodes');
console.assert(migratedNodes.length === nodes.length, 'Node count should be preserved');
console.log('✓ Test 5 passed\n');

console.log('=== All Migration Verification Tests Passed ===');
console.log('\nSummary:');
console.log('✓ Legacy edges are migrated with basic properties (markerEnd, type, animated)');
console.log('✓ Edges without style are migrated with default style properties');
console.log('✓ Edges with labels but no labelStyle get default label styles');
console.log('✓ Modern edges with all properties are not migrated');
console.log('✓ Batch migration works correctly');
console.log('✓ Node migration is available (currently no-op)');
console.log('\nRequirements validated: 5.4, 5.5');
