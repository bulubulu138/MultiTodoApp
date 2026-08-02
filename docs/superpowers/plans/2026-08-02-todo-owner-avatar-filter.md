# Todo Owner Avatar And Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one optional owner to desktop todos, show a deterministic name avatar in every desktop todo view, and provide a shared owner filter across view modes.

**Architecture:** Persist `owner?: string` on the existing `Todo` record and frontmatter. Keep owner-specific normalization, avatar text/color, owner collection, and filter matching in a pure renderer utility module. Feed one owner filter through `App.tsx` before search/sort, and render one memoized `TodoOwnerAvatar` component from the existing todo presentation components.

**Tech Stack:** Electron, React 18, TypeScript, Ant Design, gray-matter, existing Jest-style tests, webpack renderer build, TypeScript main build.

---

## File Map

Create:
- `src/renderer/utils/todoOwner.ts` - owner normalization, filter sentinel, collection, avatar text/color, and pure matching helpers.
- `src/renderer/utils/__tests__/todoOwner.test.ts` - focused owner utility tests.
- `src/renderer/components/TodoOwnerAvatar.tsx` - compact circular avatar with tooltip and empty-owner omission.

Modify:
- `src/shared/types.ts` - add `Todo.owner?: string`.
- `src/main/MarkdownParser.ts` - read/write `owner` in Markdown frontmatter.
- `src/renderer/components/TodoForm.tsx` - add a clearable single owner input with historical suggestions and submit `owner`.
- `src/renderer/components/Toolbar.tsx` - add owner filter props and a selectable owner filter control.
- `src/renderer/App.tsx` - own the filter state, derive owner options, apply owner filtering, include owner in cache signatures, and pass toolbar/form data.
- `src/renderer/components/TodoCard.tsx` - render the avatar beside the title metadata.
- `src/renderer/components/CompactTodoItem.tsx` - render the avatar in the compact title row.
- `src/renderer/components/ContentFocusView.tsx` - render the avatar in the focus header/meta area.
- `src/renderer/components/TodoList.tsx` - pass through shared data and cover its direct card/list rendering path.
- `src/renderer/components/VirtualizedTodoList.tsx` - render/pass the avatar in virtualized rows.
- `src/renderer/components/TodoViewDrawer.tsx` - show the avatar and owner name in todo details.
- `package.json` only if a focused test script is needed; do not add a dependency because the repo already has test sources and TypeScript tooling.

## Task 1: Add Owner Data Contract And Pure Utilities

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/renderer/utils/todoOwner.ts`
- Create: `src/renderer/utils/__tests__/todoOwner.test.ts`

- [ ] **Step 1: Write the failing utility tests**

Cover these exact behaviors:

```ts
expect(normalizeTodoOwner('  张三  ')).toBe('张三');
expect(normalizeTodoOwner('   ')).toBeUndefined();
expect(collectTodoOwners([
  { owner: '张三' },
  { owner: ' 张三 ' },
  { owner: '李四' },
  {},
] as Todo[])).toEqual(['张三', '李四']);
expect(getTodoOwnerAvatarText('张三')).toBe('张三');
expect(getTodoOwnerAvatarText('Zhang San')).toBe('ZS');
expect(getTodoOwnerColor('张三')).toBe(getTodoOwnerColor('张三'));
expect(matchesTodoOwner({ owner: '张三' } as Todo, '张三')).toBe(true);
expect(matchesTodoOwner({ owner: undefined } as Todo, UNASSIGNED_OWNER_FILTER)).toBe(true);
expect(matchesTodoOwner({ owner: '张三' } as Todo, UNASSIGNED_OWNER_FILTER)).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run the repository's configured Jest command if available. If no test script is exposed, run the same source through the existing TypeScript test style after adding the test file; expected result is a failure because the utility exports do not exist yet.

- [ ] **Step 3: Implement the minimum pure utility API**

Use these stable exports:

```ts
export const UNASSIGNED_OWNER_FILTER = '__unassigned__';
export type OwnerFilter = 'all' | typeof UNASSIGNED_OWNER_FILTER | string;
export function normalizeTodoOwner(owner?: string | null): string | undefined;
export function collectTodoOwners(todos: Todo[]): string[];
export function getTodoOwnerAvatarText(owner: string): string;
export function getTodoOwnerColor(owner: string): string;
export function matchesTodoOwner(todo: Todo, filter: OwnerFilter): boolean;
```

Normalize by trimming; use the last two CJK characters for Chinese names, initials for multi-word Latin names, and a one-character fallback for other names. Hash the normalized name into a fixed palette so equal names always use equal colors.

- [ ] **Step 4: Add `owner?: string` to `Todo`**

Place it with the other persisted metadata fields. Do not make it required so old records and all existing `Omit<Todo, ...>` call sites remain compatible.

- [ ] **Step 5: Run the focused tests and build type checks**

Expected: all owner utility assertions pass. Run `npm run build:main` to ensure the shared type change does not break the main process.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/utils/todoOwner.ts src/renderer/utils/__tests__/todoOwner.test.ts
git commit -m "feat: add todo owner utilities"
```

## Task 2: Persist Owner In Markdown

**Files:**
- Modify: `src/main/MarkdownParser.ts`
- Modify: `src/renderer/utils/__tests__/todoOwner.test.ts` or create a focused parser test alongside existing parser tests.

- [ ] **Step 1: Add parser round-trip assertions**

Use `MarkdownParser.parseTodo` on frontmatter containing `owner: 张三` and assert `todo.owner === '张三'`. Generate a todo with `owner: '张三'` and assert the generated frontmatter contains `owner: 张三` or its valid quoted YAML equivalent. Also assert a missing owner parses as `undefined`.

- [ ] **Step 2: Implement parser read/write**

In `parseTodo`, assign `owner: normalizeTodoOwner(data.owner as string | undefined)`. In `generateTodo`, add `frontmatter.owner = normalizedOwner` only when a non-empty owner exists. Keep all existing legacy aliases and optional-field behavior unchanged.

- [ ] **Step 3: Run parser tests and main build**

Expected: old frontmatter without `owner` still parses, owner round-trips, and `npm run build:main` passes.

- [ ] **Step 4: Commit**

```bash
git add src/main/MarkdownParser.ts src/renderer/utils/__tests__/todoOwner.test.ts
git commit -m "feat: persist todo owners"
```

## Task 3: Add Reusable Owner Avatar

**Files:**
- Create: `src/renderer/components/TodoOwnerAvatar.tsx`

- [ ] **Step 1: Implement the component**

Define:

```ts
interface TodoOwnerAvatarProps {
  owner?: string;
  size?: number;
  className?: string;
}
```

Normalize the owner first. Return `null` when there is no normalized owner. Otherwise render Ant Design `Tooltip` around a fixed-size circular `span`, using `getTodoOwnerAvatarText` and `getTodoOwnerColor`. Set `aria-label` to `负责人：${owner}` and keep the component memoized.

- [ ] **Step 2: Verify the component contract**

Run the renderer type/build check after the component exists. The empty-owner branch must compile without requiring callers to conditionally render it.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TodoOwnerAvatar.tsx
git commit -m "feat: add todo owner avatar"
```

## Task 4: Add Owner Field To Todo Form

**Files:**
- Modify: `src/renderer/components/TodoForm.tsx`

- [ ] **Step 1: Add owner suggestions and form state wiring**

Derive `historyOwners = collectTodoOwners(allTodos)` with the same memoized pattern used for `historyTags`. When opening an edit form, initialize the field from `todo.owner`; when creating a todo, leave it empty. Preserve owner values when the form is reset or a modal is reopened.

- [ ] **Step 2: Add the single-value control**

Add a vertical `Form.Item` named `owner`, labeled `负责人`, using an Ant Design `Select` with `showSearch`, `allowClear`, and `mode="tags"` plus a one-value guard. Render historical owners as options. If the control returns an array, take the last value and normalize it; the submitted data must contain at most one owner.

- [ ] **Step 3: Include normalized owner in submit data**

Extend the existing `todoData` object with:

```ts
owner: normalizeTodoOwner(
  Array.isArray(values.owner) ? values.owner[values.owner.length - 1] : values.owner
),
```

This must save `undefined` when the field is cleared and must not change the existing title/content/hash/duplicate flow.

- [ ] **Step 4: Run renderer build**

Expected: the form compiles, supports creating a new owner, reopens an existing owner, and clearing produces no owner.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/TodoForm.tsx
git commit -m "feat: assign owners from todo form"
```

## Task 5: Add Central Owner Filter

**Files:**
- Modify: `src/renderer/components/Toolbar.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add toolbar props and control**

Add props for `ownerOptions: string[]`, `ownerFilter: OwnerFilter`, and `onOwnerFilterChange`. Render a compact `Select` with `全部负责人`, `未分配`, and one option per owner. Each person option can use `TodoOwnerAvatar` as its label content; the value remains the exact normalized name.

- [ ] **Step 2: Add App state and options**

Import the owner utility API. Add `const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')`. Derive `ownerOptions` from all loaded `todos`, not only the active tab or current visible result. If the selected owner disappears from loaded data, reset the filter to `all`.

- [ ] **Step 3: Apply filtering before search and sorting**

Change the current base pipeline so the existing tab/status/tag result is filtered with `matchesTodoOwner(todo, ownerFilter)` before `searchedTodos` runs. Keep the existing search minimum length, search cache, relation grouping, and sort behavior unchanged.

- [ ] **Step 4: Update cache signatures**

Include `todo.owner ?? ''` in `buildTodoDataSignature`. Include `ownerFilter` in any cache key that depends on the base filtered list. This ensures assignment edits and owner filter changes cannot reuse stale search/sort results.

- [ ] **Step 5: Pass toolbar/form state**

Pass owner props to `Toolbar`. Pass the complete `todos` list through the existing `TodoForm` call as `allTodos` so owner suggestions include hidden statuses. Do not alter tab count semantics beyond the existing implementation.

- [ ] **Step 6: Add filter regression tests**

Extend the pure utility tests with a matrix of assigned, unassigned, and different-owner todos. Verify `all` returns every todo, a named owner returns only that owner, and the unassigned sentinel returns only empty/whitespace owners.

- [ ] **Step 7: Run renderer build**

Run `npm run build:renderer`; expected: TypeScript and webpack compilation pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/Toolbar.tsx src/renderer/App.tsx src/renderer/utils/todoOwner.ts src/renderer/utils/__tests__/todoOwner.test.ts
git commit -m "feat: filter todos by owner"
```

## Task 6: Display Owner Avatar In Every Desktop View

**Files:**
- Modify: `src/renderer/components/TodoCard.tsx`
- Modify: `src/renderer/components/CompactTodoItem.tsx`
- Modify: `src/renderer/components/ContentFocusView.tsx`
- Modify: `src/renderer/components/TodoList.tsx`
- Modify: `src/renderer/components/VirtualizedTodoList.tsx`
- Modify: `src/renderer/components/TodoViewDrawer.tsx`

- [ ] **Step 1: Add the avatar to card mode**

Import `TodoOwnerAvatar` and place it in the existing title/meta row next to the todo title or existing metadata. Pass `owner={todo.owner}`; do not add a fallback placeholder.

- [ ] **Step 2: Add the avatar to compact mode**

Place the same component in the compact title row with a fixed `size` matching the row height. Preserve checkbox, serial number, drag target, inline title editing, and status control layout.

- [ ] **Step 3: Add the avatar to focus mode**

Place it in the focus item header/meta section next to the title/time metadata. It must remain visible while content editing and must not intercept editor or order-edit clicks.

- [ ] **Step 4: Cover direct, virtualized, and delegated list paths**

Inspect the direct list row and the virtualized row renderer. Add the avatar where each path owns the title markup. When `TodoList` delegates to `CompactTodoView` or `ContentFocusView`, rely on those components rather than rendering a duplicate avatar. Ensure all `todo` props carry the existing owner field naturally.

- [ ] **Step 5: Add owner data to the detail drawer**

In `TodoViewDrawer`, show `TodoOwnerAvatar` beside the detail title and add a `负责人` description item containing the owner name when assigned. For an unassigned todo, omit the avatar and show the existing-style empty metadata text only if the detail layout requires a value.

- [ ] **Step 6: Run renderer build and inspect responsive layout**

Run `npm run build:renderer`. Verify the fixed avatar size does not alter title wrapping, compact row height, virtualized row height, or focus editor controls.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/TodoCard.tsx src/renderer/components/CompactTodoItem.tsx src/renderer/components/ContentFocusView.tsx src/renderer/components/TodoList.tsx src/renderer/components/VirtualizedTodoList.tsx src/renderer/components/TodoViewDrawer.tsx
git commit -m "feat: show todo owner avatars across views"
```

## Task 7: End-To-End Verification And Cleanup

**Files:**
- Modify only files revealed by verification; otherwise no additional source changes.

- [ ] **Step 1: Run focused owner tests**

Run the configured Jest test command if available, targeting `src/renderer/utils/__tests__/todoOwner.test.ts`. If the repository does not expose a test script, run the existing TypeScript-transpilation test convention used by `scripts/test-order-conflict-resolver.cjs` with the new utility module and report that exact command.

- [ ] **Step 2: Run both builds**

```bash
npm run build:main
npm run build:renderer
```

Expected: both commands exit successfully with no TypeScript errors for `owner` and no webpack errors for avatar imports.

- [ ] **Step 3: Manually verify the user flows**

Verify all of the following in the desktop app:

1. Create a todo, enter a new owner, save, and see the name avatar.
2. Edit the todo, confirm the owner is prefilled, then clear and save; the avatar disappears.
3. Select a named owner in the toolbar and confirm card, compact, focus, standard, and virtualized lists show only that person's todos.
4. Select `未分配` and confirm only unassigned todos appear.
5. Reload the app and confirm the owner persists from Markdown.

- [ ] **Step 4: Review final diff and status**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only the intended feature files are changed or committed.

- [ ] **Step 5: Commit any final corrections**

```bash
git add src docs
git commit -m "test: verify todo owner workflow"
```

