# 专注模式序号全量重排设计

**日期:** 2026-07-15
**状态:** 已通过设计评审，待实现

## 背景

应用有两种查看模式：

- **紧凑模式 (Compact mode)**：列表视图，支持拖拽重排。拖拽时调用 `computeAllFinalOrders`，对整个可见列表重新编号为连续值（0,1,2,…），无空号。
- **专注模式 (Focus mode / ContentFocusView)**：纵向聚焦视图，仅支持通过 `InputNumber` 手动输入序号。

专注模式手动改序号时，当前走的是 `resolveOrderConflicts`（递归冲突后移）规则：只有占用目标序号的待办及其后续链各 +1，其余不动，**会留下空号**。

## 问题

用户在专注模式下改一个序号后，期望列表像紧凑模式那样**整体重排、填满空号**（连续无空号），而非仅冲突后移留空号。

## 目标

专注模式下编辑某待办序号时，把输入值当作**目标位置**，将当前待办移到该位置，其余待办保持相对顺序，然后对整个可见列表重新编号为连续 `displayOrder`，行为等价于紧凑模式的拖拽重排。

具体示例：列表为 A(0)、B(1)、C(2)、D(3)，把 B 的序号改为 3（目标位置=末位）后，结果为 A(0)、C(1)、D(2)、B(3)，中间无空号。

## 非目标 (Out of Scope)

- 不给专注模式增加拖拽重排（YAGNI）。
- 不改动紧凑模式（它有自己的内联 `handleOrderSave`，不受影响）。
- 不改变序号显示口径（沿用现有 0-based `displayOrder`）。

## 当前实现分析

- `useOrderEdit` hook（`src/renderer/hooks/useOrderEdit.ts`）**仅被 `ContentFocusView` 使用**。紧凑模式不使用此 hook，它有自己的内联 `handleOrderSave`。
- hook 的 `handleOrderSave` 当前流程：`resolveOrderConflicts` → `batchUpdateDisplayOrders`(级联) → `syncParallelGroupOrders` → `onUpdateDisplayOrder`(当前)。
- 可复用：`computeAllFinalOrders(newOrder, activeTab, parallelGroupsMap, allTodos)`（`src/renderer/utils/orderConflictResolver.ts:225`）——输入"期望顺序"的 `Todo[]`，输出全量连续序号 + 并列分组同步 + 冲突兜底。这正是紧凑拖拽重排所用的函数。
- `ContentFocusView` 已计算好 `parallelGroups`（`Map<string, Set<string>>`，主组件 line 854-895），可透传。
- `App.tsx:1940` 已将完整 `allTodos={todos}` 传入。

## 设计

### 1. 新增纯函数 `buildRenumberedOrder`

**文件：** `src/renderer/utils/orderConflictResolver.ts`

签名：

```ts
export function buildRenumberedOrder(
  sortedTodos: Todo[],
  currentTodoId: string,
  targetPosition: number
): Todo[]
```

入参 `sortedTodos` 为**当前可见、已按显示顺序排好的列表**（专注模式下即 `todos` 数组，其顺序即显示顺序）。注意：不按 `displayOrder` 值重新排序、也不过滤掉"无序号"的待办——这样能覆盖全部可见待办，与紧凑模式拖拽的"按数组索引给所有人分配连续序号"语义完全一致。

行为：

1. 在 `sortedTodos` 中找到 `currentTodoId` 的索引；若不存在，原样返回（防御）。
2. 从数组中移除该待办。
3. 钳制 `targetPosition` 到 `[0, len-1]`（`len` 为移除后的长度）。
4. 将该待办插入到钳制后的位置。
5. 返回重排后的 `Todo[]`（数组顺序即新位置；交由 `computeAllFinalOrders` 按 index 分配连续 `displayOrder`）。

纯函数，无副作用，便于单测。

### 2. 修改 `useOrderEdit` hook

**文件：** `src/renderer/hooks/useOrderEdit.ts`

- 新增可选入参 `parallelGroupsMap?: Map<string, Set<string>>`（加入 `UseOrderEditProps`）。
- 重写 `handleOrderSave`，用 `buildRenumberedOrder` + `computeAllFinalOrders` 替换原 `resolveOrderConflicts` 流程。专注模式下传入的 `allTodos` 即可见已排序列表（`App.tsx:1940` 传入 `todos`），直接作为 `sortedTodos` 使用。
- 新流程：
  1. `reordered = buildRenumberedOrder(allTodos, todo.id, editingOrder)`。
  2. `updates = computeAllFinalOrders({ newOrder: reordered, activeTab, parallelGroupsMap: parallelGroupsMap ?? new Map(), allTodos })`。
  3. `await window.electronAPI.todo.batchUpdateDisplayOrders(updates)`（一次性更新所有可见待办，含当前）。
  4. 成功提示 `序号已保存`。
- 保留：`editingOrder === currentValue` 早退（no-op）；try/catch 错误处理；`savingOrder` 状态。
- `onUpdateDisplayOrder` 入参在 `UseOrderEditProps` 中保留（避免破坏调用方契约），但全量重排流程不再调用它（当前待办已包含在 `updates` 中）。

> 说明：经核实，`useOrderEdit` 仅被专注模式使用，故直接替换其内部规则，**不引入 `renumberMode` 开关**，避免死代码。紧凑模式有独立的内联 handler，完全不受影响。

### 3. 修改 `ContentFocusView`

**文件：** `src/renderer/components/ContentFocusView.tsx`

- `parallelGroups`（完整 `Map`）定义在主组件 `ContentFocusView`（line 854），而 `useOrderEdit` 在子组件 `ContentFocusItem`（line 86）中调用。
- 需将完整 `parallelGroups` Map 从主组件透传到 `ContentFocusItem`（新增 prop），再传入 `useOrderEdit` 的 `parallelGroupsMap`。
- 现有 `parallelGroup={parallelGroups.get(todo.id)}`（单个 Set，用于 UI 分组禁用逻辑）保持不变。

### 数据流

```
InputNumber 回车/失焦
  → useOrderEdit.handleOrderSave
  → buildRenumberedOrder(可见todos, 当前id, 输入值) → 重排 Todo[]
  → computeAllFinalOrders(重排, tab, parallelGroupsMap, todos) → 连续序号 updates
  → batchUpdateDisplayOrders(全量)   // 落库 + 刷新（与紧凑拖拽同通路）
  → 界面连续 0..n-1
```

## 边界处理

- 输入超出范围（过大/负数）→ `buildRenumberedOrder` 内钳制到首/尾。
- 输入空/非数字 → `editingOrder === undefined`，hook 早退不保存。
- 输入与当前值相同 → hook 早退 no-op。
- 并列分组 → `computeAllFinalOrders` 内部自动同步整组。
- 分组内非首项（`isInGroup && !isGroupStart`）→ 现有 UI 已禁用编辑（line 696/712），保持不变。
- 单元素列表 → 重排平凡（该待办 → 0）。
- 目标待办不在列表 → 原样返回（防御）。

## 错误处理

`batchUpdateDisplayOrders` 抛错 → 沿用 hook 现有 try/catch（line 74-80）：`message.error('更新排序失败')`，保留已有序号、不清空，重置编辑态。单次 batch 调用，无半成品状态风险。

## 刷新一致性

用户已确认专注模式下序号变更能即时反映到界面（当前 conflict-shift 可见），说明 `batchUpdateDisplayOrders` 本身会刷新 UI。全量重排走同一调用通路，刷新行为一致。实现后需验证一次；若发现界面不刷新，再补一个刷新回调（兜底）。

## 测试

- **单元测试** `buildRenumberedOrder`（纯函数），覆盖：
  - 移到首位 / 中间 / 末位
  - 超大值钳到末尾、负值钳到首位
  - 其余待办保持相对顺序
  - 单元素列表
  - 目标待办不存在（原样返回）
- **回归**：确保现有 `src/renderer/components/__tests__/ContentFocusView.undo.test.tsx` 仍通过（测撤销逻辑，不涉及排序，预期不受影响）。

## 改动文件清单

1. `src/renderer/utils/orderConflictResolver.ts` — 新增 `buildRenumberedOrder` 纯函数。
2. `src/renderer/hooks/useOrderEdit.ts` — 替换 `handleOrderSave` 内部规则为全量重排；`UseOrderEditProps` 新增 `parallelGroupsMap?` 入参。
3. `src/renderer/components/ContentFocusView.tsx` — 将完整 `parallelGroups` Map 透传到 `ContentFocusItem` 并接入 hook。
4. （测试）新增 `buildRenumberedOrder` 单元测试文件。
