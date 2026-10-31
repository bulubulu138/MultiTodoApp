const assert = require('assert');
const fs = require('fs');
const path = require('path');

const formSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'renderer', 'components', 'TodoForm.tsx'),
  'utf8'
);

assert.match(formSource, /generateHash\(title, submitContent\)/);
assert.match(formSource, /contentHash: contentHash/);
assert.doesNotMatch(formSource, /findDuplicate/);
assert.doesNotMatch(formSource, /检测到重复待办/);
assert.match(formSource, /await onSubmit\(todoData\)/);

console.log('todo creation allows duplicate content without a lookup');
