const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'renderer', 'utils', 'orderConflictResolver.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: sourcePath,
});

const moduleExports = {};
const compiled = new Function('exports', 'require', 'module', '__filename', '__dirname', outputText);
compiled(moduleExports, require, { exports: moduleExports }, sourcePath, path.dirname(sourcePath));

const { buildRenumberedOrder, computeSequentialFinalOrders } = moduleExports;

function makeTodo(id, order, status = 'in_progress') {
  return {
    id,
    title: `Todo ${id}`,
    content: '',
    status,
    priority: 'medium',
    tags: [],
    displayOrders: { in_progress: order },
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

function orderMap(updates) {
  return Object.fromEntries(updates.map(update => [update.uuid, update.displayOrder]));
}

const todayTodos = [makeTodo('a', 0), makeTodo('b', 1), makeTodo('c', 2)];
const reordered = buildRenumberedOrder(todayTodos, 'b', 0);
assert.deepStrictEqual(reordered.map(todo => todo.id), ['b', 'a', 'c']);

const updates = computeSequentialFinalOrders({
  newOrder: reordered,
  activeTab: 'in_progress',
  parallelGroupsMap: new Map(),
});

assert.deepStrictEqual(orderMap(updates), {
  b: 0,
  a: 1,
  c: 2,
});

console.log('order conflict resolver tests passed');
