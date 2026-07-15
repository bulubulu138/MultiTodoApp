/**
 * 复现：getAllTodos 在 300+ 待办时被腐蚀到 ~100 的根因
 *
 * 镜像 src/main/FileStorageManager.ts 中的两套缓存交互：
 *   - this.cache      : 热缓存（LRU），MAX_CACHE_SIZE = 100
 *   - this.todosCache : 全量缓存，getAllTodos() 直接返回它
 *
 * 运行：node scripts/repro-cache-eviction-bug.js
 */

const MAX_CACHE_SIZE = 100;
const TOTAL_TODOS = 300;

// ---------- 修复前的 updateCache（当前仓库代码） ----------
function makeStoreBuggy() {
  const cache = new Map();        // 热缓存
  const todosCache = new Map();   // 全量缓存

  function updateCache(uuid, todo) {
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
        todosCache.delete(oldestKey); // 🔧 同步删除全量缓存中的对应项  ← BUG
      }
    }
    cache.set(uuid, todo);
    todosCache.set(uuid, todo);
  }

  return {
    // preloadCache：绕过 updateCache 直接塞满两套缓存（与真实代码一致）
    preload(entries) {
      for (const t of entries) {
        cache.set(t.id, t);
        todosCache.set(t.id, t);
      }
    },
    updateCache,
    getAllTodos() {
      return Array.from(todosCache.values());
    },
    cacheSize: () => cache.size,
  };
}

// ---------- 修复后的 updateCache ----------
function makeStoreFixed() {
  const cache = new Map();
  const todosCache = new Map();

  function updateCache(uuid, todo) {
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
        // ✅ 修复：不删除 todosCache —— 全量缓存必须保持完整
      }
    }
    cache.set(uuid, todo);
    todosCache.set(uuid, todo);
  }

  return {
    preload(entries) {
      for (const t of entries) {
        cache.set(t.id, t);
        todosCache.set(t.id, t);
      }
    },
    updateCache,
    getAllTodos() {
      return Array.from(todosCache.values());
    },
    cacheSize: () => cache.size,
  };
}

// ---------- 场景：模拟 300 待办 + 部分文件被 watcher/change 触发 updateCache ----------
const entries = Array.from({ length: TOTAL_TODOS }, (_, i) => ({
  id: `todo-${i}`,
  title: `任务 ${i}`,
}));

// 文件监听/同步/重建等会在 preload 之后触发若干次 updateCache（这里用 200 次模拟）
const CHANGE_EVENTS = 200;

function run(label, factory) {
  const store = factory();
  store.preload(entries); // 启动时 preload，两套缓存都是 300
  const afterPreload = store.getAllTodos().length;

  // preload 之后，chokidar 'change' / getTodoById 缓存未命中等触发 updateCache
  for (let i = 0; i < CHANGE_EVENTS; i++) {
    // 真实场景里被触发的通常是少数"热点"待办，这里循环更新前若干个
    const hot = entries[i % 30];
    store.updateCache(hot.id, { ...hot, updatedAt: `t${i}` });
  }
  const afterChanges = store.getAllTodos().length;

  console.log(`\n[${label}]`);
  console.log(`  preload 后显示数量 : ${afterPreload}`);
  console.log(`  ${CHANGE_EVENTS} 次 change 后 : ${afterChanges}`);
  console.log(`  热缓存 cache.size   : ${store.cacheSize()}`);
  return { afterPreload, afterChanges };
}

console.log('==== 复现 300 待办只剩 ~100 的 bug ====');
console.log(`TOTAL_TODOS=${TOTAL_TODOS}, MAX_CACHE_SIZE=${MAX_CACHE_SIZE}, CHANGE_EVENTS=${CHANGE_EVENTS}`);

const buggy = run('修复前 (BUG)', makeStoreBuggy);
const fixed = run('修复后', makeStoreFixed);

console.log('\n==== 结论 ====');
console.log(`修复前：${buggy.afterChanges} 个待办（丢失 ${TOTAL_TODOS - buggy.afterChanges} 个）— 复现"只剩约 100"`);
console.log(`修复后：${fixed.afterChanges} 个待办（完整无丢失）`);

const ok = fixed.afterChanges === TOTAL_TODOS && buggy.afterChanges < TOTAL_TODOS;
console.log(`\n${ok ? '✅ 验证通过：修复消除了数据丢失' : '❌ 验证未通过'}`);
process.exit(ok ? 0 : 1);
