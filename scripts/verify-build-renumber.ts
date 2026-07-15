/**
 * 验证 buildRenumberedOrder 纯函数
 * 运行：node --experimental-strip-types scripts/verify-build-renumber.ts
 */
import { buildRenumberedOrder } from '../src/renderer/utils/orderConflictResolver.ts';
import type { Todo } from '../src/shared/types.js';

function makeTodo(id: string): Todo {
  return { id, title: id } as Todo;
}

let passed = 0;
let failed = 0;

function assertIds(actual: Todo[], expected: string[], msg: string) {
  const a = actual.map(t => t.id);
  const ok = JSON.stringify(a) === JSON.stringify(expected);
  if (ok) { console.log(`  ✓ ${msg}`); passed++; }
  else {
    console.error(`  ✗ ${msg}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(a)}`);
    failed++;
  }
}

const A = makeTodo('A'), B = makeTodo('B'), C = makeTodo('C'), D = makeTodo('D');
const list = [A, B, C, D];

console.log('buildRenumberedOrder:');
assertIds(buildRenumberedOrder(list, 'B', 2), ['A', 'C', 'B', 'D'], 'move B to position 2 (middle)');
assertIds(buildRenumberedOrder(list, 'C', 0), ['C', 'A', 'B', 'D'], 'move C to position 0 (first)');
assertIds(buildRenumberedOrder(list, 'A', 3), ['B', 'C', 'D', 'A'], 'move A to position 3 (last)');
assertIds(buildRenumberedOrder(list, 'A', 99), ['B', 'C', 'D', 'A'], 'clamp huge target to end');
assertIds(buildRenumberedOrder(list, 'C', -5), ['C', 'A', 'B', 'D'], 'clamp negative target to start');
assertIds(buildRenumberedOrder(list, 'B', 0), ['B', 'A', 'C', 'D'], 'others keep relative order');
assertIds(buildRenumberedOrder([A], 'A', 5), ['A'], 'single element list');
assertIds(buildRenumberedOrder(list, 'Z', 2), ['A', 'B', 'C', 'D'], 'missing todo returns unchanged');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
