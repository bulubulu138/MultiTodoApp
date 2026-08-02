const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
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

  Function('require', 'module', 'exports', '__filename', '__dirname', output)(
    localRequire,
    module,
    module.exports,
    filePath,
    path.dirname(filePath)
  );
  return module.exports;
}

const utilityPath = path.join(__dirname, '..', 'src', 'renderer', 'utils', 'todoOwner.ts');
const {
  UNASSIGNED_OWNER_FILTER,
  collectTodoOwners,
  getTodoOwnerAvatarText,
  getTodoOwnerColor,
  matchesTodoOwner,
  normalizeTodoOwner,
} = loadTsModule(utilityPath);

assert.strictEqual(normalizeTodoOwner('  张三  '), '张三');
assert.strictEqual(normalizeTodoOwner('   '), undefined);
assert.deepStrictEqual(
  collectTodoOwners([
    { owner: '张三' },
    { owner: ' 张三 ' },
    { owner: '李四' },
    {},
  ]),
  ['张三', '李四']
);
assert.strictEqual(getTodoOwnerAvatarText('张三'), '张三');
assert.strictEqual(getTodoOwnerAvatarText('Zhang San'), 'ZS');
assert.strictEqual(getTodoOwnerColor('张三'), getTodoOwnerColor('张三'));
assert.strictEqual(matchesTodoOwner({ owner: '张三' }, '张三'), true);
assert.strictEqual(matchesTodoOwner({ owner: undefined }, UNASSIGNED_OWNER_FILTER), true);
assert.strictEqual(matchesTodoOwner({ owner: '张三' }, UNASSIGNED_OWNER_FILTER), false);

console.log('todo owner utility tests passed');
