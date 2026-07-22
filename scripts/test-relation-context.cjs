const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const utilityPath = path.join(repoRoot, 'src', 'renderer', 'utils', 'relationContext.ts');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const module = { exports: {} };
  const localRequire = (request) => {
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), request);
      if (fs.existsSync(`${resolved}.ts`)) return loadTsModule(`${resolved}.ts`);
      if (fs.existsSync(`${resolved}.js`)) return require(`${resolved}.js`);
    }
    return require(request);
  };

  Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const { getRelationContextGroups } = loadTsModule(utilityPath);

const makeTodo = (id, title, createdAt) => ({
  id,
  title,
  content: '',
  status: 'pending',
  priority: 'mental',
  tags: [],
  createdAt,
  updatedAt: createdAt,
  displayOrder: 0
});

const todos = [
  makeTodo('parent', '父级待办', '2026-07-20T00:00:00.000Z'),
  makeTodo('child', '当前子待办', '2026-07-21T00:00:00.000Z'),
  makeTodo('sibling', '兄弟待办', '2026-07-22T00:00:00.000Z')
];

const relations = [
  {
    id: 'rel-parent-child',
    source_id: 'parent',
    target_id: 'child',
    relation_type: 'extends',
    created_at: '2026-07-22T00:00:00.000Z'
  },
  {
    id: 'rel-parent-sibling',
    source_id: 'parent',
    target_id: 'sibling',
    relation_type: 'extends',
    created_at: '2026-07-22T00:00:00.000Z'
  }
];

const groups = getRelationContextGroups(todos[1], todos, relations);

assert.deepStrictEqual(
  groups.backgrounds.map((todo) => todo.id),
  ['parent'],
  'extends source should appear as the parent todo when viewing the child todo'
);

assert.deepStrictEqual(
  groups.backgroundExtensions.map((todo) => todo.id),
  ['sibling'],
  'other extends children of the same parent should appear as sibling todos'
);

assert.deepStrictEqual(groups.extensions, [], 'the current child todo should not list itself as a child');

console.log('relation context regression tests passed');
