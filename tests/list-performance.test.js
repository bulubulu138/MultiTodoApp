const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('virtualized card list loads URL titles for visible rows only', () => {
  const list = read('src/renderer/components/VirtualizedTodoList.tsx');
  const parent = read('src/renderer/components/TodoList.tsx');
  assert.match(list, /onRowsRendered=\{handleRowsRendered\}/);
  assert.match(list, /useBatchURLTitles\(visibleTodos\)/);
  assert.match(parent, /useBatchURLTitles\(\s*shouldVirtualize \|\| viewMode !== 'card' \? emptyTodos : todos/);
});

test('compact view uses the shared linear parallel relation index', () => {
  const view = read('src/renderer/components/CompactTodoView.tsx');
  assert.match(view, /buildParallelRelationIndex\(relations\)/);
  assert.doesNotMatch(view, /relations\.filter\(r\s*=>\s*r\.relation_type === 'parallel'/);
});

test('large drag lists disable per-item motion and FLIP', () => {
  const parent = read('src/renderer/components/TodoList.tsx');
  const dragList = read('src/renderer/components/DragDropTodoList.tsx');
  assert.match(parent, /largeDragList \? <div/);
  assert.match(dragList, /todos\.length <= MAX_ANIMATED_ITEMS/);
});

test('compact drag reordering uses one batch or the parent optimistic handler', () => {
  const parent = read('src/renderer/components/TodoList.tsx');
  assert.match(parent, /onDragEnd=\{onDragEnd \|\|/);
  assert.doesNotMatch(parent, /await onUpdateDisplayOrder\(todo\.id, activeTab, i\)/);
  assert.match(parent, /batchUpdateDisplayOrders\(updates\)/);
});

test('URL title requests ignore responses from obsolete visible ranges', () => {
  const hook = read('src/renderer/hooks/useBatchURLTitles.ts');
  assert.match(hook, /requestIdRef\.current \+= 1/);
  assert.match(hook, /if \(requestId === requestIdRef\.current\) \{\s*setTitlesByTodo\(newTitlesByTodo\)/);
  assert.match(hook, /if \(requestId === requestIdRef\.current\) \{\s*setLoading\(false\)/);
});
