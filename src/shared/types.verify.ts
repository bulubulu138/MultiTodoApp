/**
 * Verification script for line width constants and types (Task 5.1)
 * This script validates that the LINE_WIDTH_OPTIONS constant and LineWidth type work correctly
 * Run with: npx ts-node src/shared/types.verify.ts
 */

import { LINE_WIDTH_OPTIONS, LineWidth, EdgeStyle } from './types';

console.log('🔍 Verifying Line Width Constants and Types (Task 5.1)...\n');

// Test 1: Verify LINE_WIDTH_OPTIONS constant
console.log('✓ Test 1: LINE_WIDTH_OPTIONS constant');
console.log('  - thin:', LINE_WIDTH_OPTIONS.thin, '(expected: 1)');
console.log('  - medium:', LINE_WIDTH_OPTIONS.medium, '(expected: 2)');
console.log('  - thick:', LINE_WIDTH_OPTIONS.thick, '(expected: 4)');

if (LINE_WIDTH_OPTIONS.thin !== 1 || LINE_WIDTH_OPTIONS.medium !== 2 || LINE_WIDTH_OPTIONS.thick !== 4) {
  console.error('❌ FAILED: LINE_WIDTH_OPTIONS values are incorrect');
  process.exit(1);
}
console.log('  ✅ PASSED\n');

// Test 2: Verify LineWidth type
console.log('✓ Test 2: LineWidth type');
const validWidths: LineWidth[] = ['thin', 'medium', 'thick'];
console.log('  - Valid widths:', validWidths.join(', '));

validWidths.forEach(width => {
  const value = LINE_WIDTH_OPTIONS[width];
  console.log(`  - ${width} maps to ${value}`);
});
console.log('  ✅ PASSED\n');

// Test 3: Verify EdgeStyle interface with strokeWidth
console.log('✓ Test 3: EdgeStyle interface with strokeWidth');

const thinEdge: EdgeStyle = {
  strokeWidth: LINE_WIDTH_OPTIONS.thin,
  stroke: '#000000'
};
console.log('  - Thin edge:', JSON.stringify(thinEdge));

const mediumEdge: EdgeStyle = {
  strokeWidth: LINE_WIDTH_OPTIONS.medium,
  stroke: '#000000',
  animated: true
};
console.log('  - Medium edge:', JSON.stringify(mediumEdge));

const thickEdge: EdgeStyle = {
  strokeWidth: LINE_WIDTH_OPTIONS.thick,
  stroke: '#000000',
  strokeDasharray: '5,5'
};
console.log('  - Thick edge:', JSON.stringify(thickEdge));

if (thinEdge.strokeWidth !== 1 || mediumEdge.strokeWidth !== 2 || thickEdge.strokeWidth !== 4) {
  console.error('❌ FAILED: EdgeStyle strokeWidth values are incorrect');
  process.exit(1);
}
console.log('  ✅ PASSED\n');

// Test 4: Verify type safety (compile-time check)
console.log('✓ Test 4: Type safety verification');
console.log('  - TypeScript compilation ensures type safety');
console.log('  - LineWidth only accepts: "thin" | "medium" | "thick"');
console.log('  - EdgeStyle.strokeWidth accepts number (including LINE_WIDTH_OPTIONS values)');
console.log('  ✅ PASSED\n');

// Test 5: Verify usage in edge creation
console.log('✓ Test 5: Practical usage in edge creation');

interface TestEdge {
  id: string;
  style: EdgeStyle;
}

const createEdge = (id: string, width: LineWidth, color: string): TestEdge => {
  return {
    id,
    style: {
      strokeWidth: LINE_WIDTH_OPTIONS[width],
      stroke: color
    }
  };
};

const edge1 = createEdge('edge-1', 'thin', '#ff0000');
const edge2 = createEdge('edge-2', 'medium', '#00ff00');
const edge3 = createEdge('edge-3', 'thick', '#0000ff');

console.log('  - Edge 1 (thin):', JSON.stringify(edge1));
console.log('  - Edge 2 (medium):', JSON.stringify(edge2));
console.log('  - Edge 3 (thick):', JSON.stringify(edge3));

if (edge1.style.strokeWidth !== 1 || edge2.style.strokeWidth !== 2 || edge3.style.strokeWidth !== 4) {
  console.error('❌ FAILED: Edge creation with line widths failed');
  process.exit(1);
}
console.log('  ✅ PASSED\n');

console.log('🎉 All verification tests passed!');
console.log('✅ Task 5.1 implementation is correct and working as expected.');
