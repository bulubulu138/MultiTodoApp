const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'FileIndexer.ts'),
  'utf8'
);

assert.match(
  source,
  /findByContentHash\(contentHash: string, excludeUuid\?: string\): TodoIndexEntry \| null/
);
assert.match(source, /entry\.contentHash === contentHash/);
assert.doesNotMatch(source, /findByContentHash[\s\S]{0,500}getAllTodos\(\)/);

const mainSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'main.ts'),
  'utf8'
);

assert.match(mainSource, /findTodoByContentHash\(contentHash, excludeUuid\)/);
assert.doesNotMatch(mainSource, /todo:findDuplicate[\s\S]{0,500}getAllTodos\(\)/);

console.log('duplicate index lookup regression check passed');
