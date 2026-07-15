# 专注模式序号全量重排 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让专注模式（ContentFocusView）编辑某个待办序号时，对整个可见列表全量重排为连续序号、填满空号，行为等价于紧凑模式的拖拽重排。

**Architecture:** 新增纯函数 `buildRenumberedOrder`（把当前待办移到目标位置、其余保持相对顺序），在 `useOrderEdit` hook 里用它 + 已有的 `computeAllFinalOrders`（紧凑拖拽同款全量重排通路）替换原来的 `resolveOrderConflicts` 冲突后移逻辑，再经 `batchUpdateDisplayOrders` 一次性落库刷新。`ContentFocusView` 把已算好的 `parallelGroups` Map 透传给 hook。

**Tech Stack:** TypeScript (strict)、React 18 + Ant Design v5、Electron IPC、Node v22.14.0（`--experimental-strip-types` 跑验证脚本）。

## Global Constraints

- **TypeScript strict 模式**，所有改动必须通过 `npx tsc --noEmit -p tsconfig.json`。
- **0-based `displayOrder`**：序号从 0 开始，沿用现有口径，不改显示。
- **紧凑模式零改动**：紧凑模式有自己的内联 `handleOrderSave`，不经过 `useOrderEdit`，本计划不碰它。
- **无自动化测试框架**：项目未安装 Jest/testing-library（现有 `__tests__/*.test.tsx` 是无法运行的死代码）。纯函数用 Node 验证脚本测；hook/组件用类型检查 + 构建 + 手动验证。
- **验证脚本依赖**：Node v22.14.0 的 `--experimental-strip-types`。被导入的源文件必须是"运行时可导入"的——`orderConflictResolver.ts` 当前 `import { Todo }` 需改为 `import type { Todo }`（`Todo` 仅作类型用，此改动正确且必要）。
- **IPC 通道命名**沿用现有 `todo:batchUpdateDisplayOrders`。

## File Structure

| 文件 | 责任 | 本计划改动 |
|------|------|-----------|
| `src/renderer/utils/orderConflictResolver.ts` | 序号冲突解决 / 重排的纯函数集合 | 新增 `buildRenumberedOrder`；`import { Todo }` → `import type { Todo }` |
| `src/renderer/hooks/useOrderEdit.ts` | 专注模式序号编辑 hook（仅 ContentFocusView 使用） | `handleOrderSave` 改为全量重排；props 新增 `parallelGroupsMap` |
| `src/renderer/components/ContentFocusView.tsx` | 专注模式视图 | 把 `parallelGroups` Map 透传到 `ContentFocusItem` 并接入 hook |
| `scripts/verify-build-renumber.ts` | `buildRenumberedOrder` 纯函数验证（新建） | 新建 |

---

## Task 1: 新增 `buildRenumberedOrder` 纯函数 + 验证脚本

**Files:**
- Modify: `src/renderer/utils/orderConflictResolver.ts`（第 1 行 import；文件末尾追加新函数）
- Create: `scripts/verify-build-renumber.ts`

**Interfaces:**
- Produces: `buildRenumberedOrder(sortedTodos: Todo[], currentTodoId: string, targetPosition: number): Todo[]`（Task 2 消费）

- [ ] **Step 1: 写验证脚本（此时应失败）**

创建 `scripts/verify-build-renumber.ts`：

```typescript
/**
 * 验证 buildRenumberedOrder 纯函数
 * 运行：node --experimental-strip-types scripts/verify-build-renumber.ts
 */
import { buildRenumberedOrder } from '../src/renderer/utils/orderConflictResolver.ts';
import type { Todo } from '../src/shared/types.ts';

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
```

- [ ] **Step 2: 运行验证脚本，确认失败**

Run: `node --experimental-strip-types scripts/verify-build-renumber.ts`
Expected: FAIL — 报错 `buildRenumberedOrder is not a function`（或导入失败，因为尚未导出）。

- [ ] **Step 3: 修改 import 为 type-only**

`src/renderer/utils/orderConflictResolver.ts` 第 1 行：

```typescript
import type { Todo } from '../../shared/types';
```

（原为 `import { Todo } from '../../shared/types';`。`Todo` 在本文件仅作类型注解使用，改为 `import type` 是正确做法，且使文件可被验证脚本运行时导入。）

- [ ] **Step 4: 在文件末尾追加 `buildRenumberedOrder`**

在 `src/renderer/utils/orderConflictResolver.ts` 末尾追加：

```typescript
interface BuildRenumberedOrderConfig {
  sortedTodos: Todo[];
  currentTodoId: string;
  targetPosition: number;
}

/**
 * 构建全量重排后的顺序数组（专注模式序号编辑用）
 *
 * 把 currentTodoId 对应待办移到 targetPosition（钳制到合法范围），
 * 其余待办保持原有相对顺序。返回的数组交给 computeAllFinalOrders
 * 按 index 分配连续 displayOrder，行为等价于紧凑模式拖拽：
 * 覆盖全部可见待办（含原本无序号的），结果无空号。
 *
 * @param sortedTodos  当前可见、已按显示顺序排好的列表（专注模式下即 todos 数组）
 * @param currentTodoId 要移动的待办 id
 * @param targetPosition 目标位置（用户输入的序号）
 * @returns 重排后的 Todo[]，数组顺序即新位置
 */
export function buildRenumberedOrder(
  sortedTodos: Todo[],
  currentTodoId: string,
  targetPosition: number
): Todo[] {
  const currentIndex = sortedTodos.findIndex(t => t.id === currentTodoId);
  if (currentIndex === -1) {
    return sortedTodos; // 防御：目标待办不在列表
  }

  // 1. 移除当前待办
  const remaining = sortedTodos.filter(t => t.id !== currentTodoId);
  const currentTodo = sortedTodos[currentIndex];

  // 2. 钳制 targetPosition 到 [0, remaining.length]（合法插入位置）
  const clamped = Math.max(0, Math.min(targetPosition, remaining.length));

  // 3. 插入目标位置
  const result = [...remaining];
  result.splice(clamped, 0, currentTodo);
  return result;
}
```

> 注：`BuildRenumberedOrderConfig` 接口暂保留以备后续重构为 config 风格（与本文件其它函数一致）；当前导出函数使用位置参数，与设计 spec 一致。若 lint 报未使用接口，可删除该接口块（函数体不依赖它）。

- [ ] **Step 5: 运行验证脚本，确认通过**

Run: `node --experimental-strip-types scripts/verify-build-renumber.ts`
Expected: 输出 8 个 `✓`，结尾 `8 passed, 0 failed`，退出码 0。（会有一行 `ExperimentalWarning: Type Stripping...`，正常。）

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无错误（退出码 0）。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/utils/orderConflictResolver.ts scripts/verify-build-renumber.ts
git commit -m "feat: 新增 buildRenumberedOrder 全量重排纯函数及验证脚本

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 改写 `useOrderEdit` 为全量重排

**Files:**
- Modify: `src/renderer/hooks/useOrderEdit.ts`（imports、`UseOrderEditProps`、`handleOrderSave`）

**Interfaces:**
- Consumes: `buildRenumberedOrder`（Task 1）、`computeAllFinalOrders`（已存在于 `orderConflictResolver.ts:225`）
- Produces: `useOrderEdit` 的 props 新增 `parallelGroupsMap?: Map<string, Set<string>>`（Task 3 消费）

- [ ] **Step 1: 替换 imports**

`src/renderer/hooks/useOrderEdit.ts` 第 4-7 行替换为：

```typescript
import {
  buildRenumberedOrder,
  computeAllFinalOrders
} from '../utils/orderConflictResolver';
```

（原为 `import { resolveOrderConflicts, syncParallelGroupOrders } from '../utils/orderConflictResolver';`。新流程不再用这两个函数。）

- [ ] **Step 2: 给 `UseOrderEditProps` 新增 `parallelGroupsMap`**

将 `UseOrderEditProps` 接口（第 9-15 行）改为：

```typescript
interface UseOrderEditProps {
  todo: Todo;
  activeTab: string;
  allTodos: Todo[];
  parallelGroupsMap?: Map<string, Set<string>>;
  onUpdateDisplayOrder: (id: string, tabKey: string, order: number) => Promise<void>;
}
```

（移除原 `parallelGroup?: Set<string>;`，新增 `parallelGroupsMap?: Map<string, Set<string>>;`。`onUpdateDisplayOrder` 按 spec 保留在接口中，全量重排流程不再调用它。）

- [ ] **Step 3: 更新 hook 内的 props 解构**

将第 22 行：

```typescript
  const { todo, activeTab, allTodos, parallelGroup, onUpdateDisplayOrder } = props;
```

改为：

```typescript
  const { todo, activeTab, allTodos, parallelGroupsMap } = props;
```

（不再解构 `parallelGroup`、`onUpdateDisplayOrder`，避免未使用变量 lint 报错；二者仍在接口中保留。）

- [ ] **Step 4: 重写 `handleOrderSave`**

将第 27-81 行的整个 `handleOrderSave` 替换为：

```typescript
  const handleOrderSave = useCallback(async () => {
    if (!todo.id || editingOrder === undefined) return;

    const currentValue = todo.displayOrders && todo.displayOrders[activeTab];
    if (editingOrder === currentValue) {
      setEditingOrder(undefined);
      return;
    }

    setSavingOrder(true);

    try {
      // 1. 构建重排顺序：把当前待办移到目标位置，其余保持相对顺序
      const reordered = buildRenumberedOrder(allTodos, todo.id, editingOrder);

      // 2. 全量重排：按 index 分配连续 displayOrder，并同步并列分组
      const updates = computeAllFinalOrders({
        newOrder: reordered,
        activeTab,
        parallelGroupsMap: parallelGroupsMap ?? new Map(),
        allTodos,
      });

      // 3. 一次性落库（含当前待办）+ 刷新（与紧凑拖拽同一通路）
      await window.electronAPI.todo.batchUpdateDisplayOrders(updates);

      setEditingOrder(undefined);
      if (updates.length > 1) {
        message.success(`序号已保存，已重排 ${updates.length} 个待办`);
      } else {
        message.success('序号已保存');
      }
    } catch (error) {
      message.error('更新排序失败');
      console.error('Order save error:', error);
      setEditingOrder(undefined);
    } finally {
      setSavingOrder(false);
    }
  }, [todo.id, editingOrder, activeTab, allTodos, parallelGroupsMap, message]);
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 报错——`ContentFocusView.tsx` 调用 `useOrderEdit` 时传了 `parallelGroup`（新接口已移除该字段，且未传 `parallelGroupsMap`）。这是预期的，**Task 3 会修复**。记录报错行（应在 `ContentFocusView.tsx:86-91`）。

> 说明：本任务单独提交会让 `ContentFocusView.tsx` 类型检查失败。为保证每个提交可独立构建，**本任务先不单独提交**，与 Task 3 合并提交（见 Task 3 Step 5）。如果你希望每任务独立提交，可临时在 `ContentFocusView.tsx` 调用处把 `parallelGroup,` 删掉、加上 `parallelGroupsMap: new Map()` 作为占位，提交后再在 Task 3 改为真实 Map——但这会多一次提交，不推荐。

- [ ] **Step 6: 暂不提交，进入 Task 3**

（与 Task 3 一起提交。）

---

## Task 3: `ContentFocusView` 透传 `parallelGroupsMap`

**Files:**
- Modify: `src/renderer/components/ContentFocusView.tsx`（`ContentFocusItemProps`、`ContentFocusItem` 内 `useOrderEdit` 调用、主组件渲染处）

**Interfaces:**
- Consumes: `useOrderEdit` 的新 `parallelGroupsMap` 入参（Task 2）
- Produces: 专注模式序号全量重排的端到端可用功能

- [ ] **Step 1: `ContentFocusItemProps` 新增 `parallelGroupsMap`**

将 `ContentFocusItemProps`（第 33-45 行）中的字段调整为：

```typescript
interface ContentFocusItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void | Promise<void>;
  isLast: boolean;
  activeTab: string;
  allTodos: Todo[];
  relations: TodoRelation[];
  parallelGroup?: Set<string>;
  parallelGroupsMap?: Map<string, Set<string>>;
  prevTodo: Todo | null;
  nextTodo: Todo | null;
  onUpdateDisplayOrder: (todoId: string, tabKey: string, displayOrder: number) => Promise<void>;
}
```

（在 `parallelGroup?: Set<string>;` 下一行新增 `parallelGroupsMap?: Map<string, Set<string>>;`。`parallelGroup` 保留——UI 的 `isInGroup`/`isGroupStart` 禁用逻辑仍需要它。）

- [ ] **Step 2: `ContentFocusItem` 解构出 `parallelGroupsMap` 并传给 hook**

在第 55-66 行的 `ContentFocusItem` props 解构中，于 `parallelGroup,` 之后加入 `parallelGroupsMap,`：

```typescript
  }, {
    todo,
    onUpdate,
    onView,
    isLast,
    activeTab,
    allTodos,
    relations,
    parallelGroup,
    parallelGroupsMap,
    prevTodo,
    nextTodo,
    onUpdateDisplayOrder,
  }, ref) => {
```

然后将第 86-92 行 `useOrderEdit` 调用改为：

```typescript
    } = useOrderEdit({
      todo,
      activeTab,
      allTodos: allTodos || [],
      parallelGroupsMap,
      onUpdateDisplayOrder,
    });
```

（移除原 `parallelGroup,`，新增 `parallelGroupsMap,`。）

- [ ] **Step 3: 主组件渲染时把 `parallelGroups` Map 传下去**

在主组件 `ContentFocusView` 渲染 `ContentFocusItem` 处（第 932-951 行），在 `parallelGroup={parallelGroups.get(todo.id)}` 下一行加 `parallelGroupsMap={parallelGroups}`：

```typescript
          {todos.map((todo, index) => (
            <ContentFocusItem
              key={todo.id}
              ref={(itemRef) => {
                if (itemRef && todo.id) {
                  itemRefsMap.current.set(todo.id, itemRef);
                }
              }}
              todo={todo}
              onUpdate={onUpdate}
              onView={onView}
              isLast={index === todos.length - 1}
              activeTab={activeTab}
              allTodos={allTodos || todos}
              relations={relations}
              parallelGroup={parallelGroups.get(todo.id)}
              parallelGroupsMap={parallelGroups}
              prevTodo={index > 0 ? todos[index - 1] : null}
              nextTodo={index < todos.length - 1 ? todos[index + 1] : null}
              onUpdateDisplayOrder={onUpdateDisplayOrder}
            />
          ))}
```

（`parallelGroups` 是主组件第 854 行 `useMemo` 已算好的 `Map<string, Set<string>>`，直接透传。）

- [ ] **Step 4: 类型检查 + 构建**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无错误（Task 2 的报错应已消失）。

Run: `npm run build:renderer`
Expected: webpack 构建成功（无 TS / 打包错误）。

- [ ] **Step 5: 提交（含 Task 2 的改动）**

```bash
git add src/renderer/hooks/useOrderEdit.ts src/renderer/components/ContentFocusView.tsx
git commit -m "feat: 专注模式序号编辑改为全量重排，等价紧凑模式拖拽语义

- useOrderEdit: 用 buildRenumberedOrder + computeAllFinalOrders 替换冲突后移逻辑
- ContentFocusView: 透传 parallelGroups Map 到 hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 手动端到端验证

**Files:** 无（仅运行验证）

**Goal:** 在真实运行环境中确认专注模式序号编辑为全量重排、无空号，并列分组同步正常，紧凑模式未受影响。

- [ ] **Step 1: 启动开发环境**

Run: `npm run dev`
Expected: Electron 窗口启动，webpack 热更新就绪。

- [ ] **Step 2: 专注模式——中间位置重排**

操作：切到专注模式（ContentFocusView），在某个 tab 下准备至少 4 个有序号的待办（如 A(0)、B(1)、C(2)、D(3)）。点击 B 的序号 → 输入 `2` → 回车。
Expected: 列表重排为 A(0)、C(1)、B(2)、D(3)，**无空号**；提示"序号已保存，已重排 N 个待办"。

- [ ] **Step 3: 专注模式——移到末位**

操作：把 A 的序号改为 `3`。
Expected: 重排为 B(0)、C(1)、D(2)、A(3)，连续无空号。

- [ ] **Step 4: 专注模式——超大值钳制**

操作：把某个待办序号改为 `999`。
Expected: 该待办移到列表末位，其余连续重排，无异常。

- [ ] **Step 5: 并列分组同步（如有并列关系的待办）**

操作：对处于并列分组内的待办改序号。
Expected: 分组内成员序号同步更新（由 `computeAllFinalOrders` 处理）；分组内非首项的序号编辑仍被禁用（UI 不变）。

- [ ] **Step 6: 紧凑模式回归**

操作：切回紧凑模式，拖拽重排 + 手动改序号。
Expected: 行为与改动前一致（紧凑模式未受影响）。

- [ ] **Step 7: 若界面未刷新（兜底）**

若 Step 2-4 中序号已写入数据库（切换 tab 或重启后正确）但**界面未即时刷新**，说明 `batchUpdateDisplayOrders` 在专注模式下未触发 React state 刷新。此时在 `useOrderEdit.handleOrderSave` 的 `batchUpdateDisplayOrders` 之后补一个刷新回调：给 `UseOrderEditProps` 加 `onOrderChanged?: () => void`，在 `batchUpdateDisplayOrders` 成功后调用，由 `ContentFocusView` 传入触发重载（如父级 `loadTodos`）。记录此情况后再决定是否加。

- [ ] **Step 8: 验证通过后收尾**

无需提交（本任务无代码改动）。若 Step 7 触发了兜底改动，则按其说明单独提交。

---

## Self-Review 已完成

- **Spec 覆盖**：`buildRenumberedOrder`（Task 1）、hook 全量重排 + `parallelGroupsMap` 入参（Task 2）、`ContentFocusView` 透传（Task 3）、边界/错误处理（Task 1 钳制与防御 + Task 2 try/catch）、测试（Task 1 验证脚本 + Task 4 手动）、刷新兜底（Task 4 Step 7）均覆盖。
- **占位符扫描**：无 TBD/TODO；所有代码步骤均含完整代码。
- **类型一致性**：`buildRenumberedOrder(sortedTodos, currentTodoId, targetPosition)` 在 Task 1 定义、Task 2 消费，签名一致；`parallelGroupsMap: Map<string, Set<string>>` 在 Task 2 定义、Task 3 透传，类型一致；`computeAllFinalOrders` 入参 `newOrder/activeTab/parallelGroupsMap/allTodos` 与源文件 `orderConflictResolver.ts:225` 一致。
