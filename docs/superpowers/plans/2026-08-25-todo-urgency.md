# Todo Urgency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent high/low urgency field to Markdown-backed todos and allow filtering the pending todo pool by urgency.

**Architecture:** Keep the existing `priority` field unchanged and add `urgency` to the shared todo model. Normalize the field at Markdown parse/index boundaries with `low` as the backward-compatible default, write it in generated frontmatter, and apply pending-only filtering in the existing App/Toolbar filtering pipeline.

**Tech Stack:** TypeScript, React, Electron IPC, Markdown frontmatter via `gray-matter`, Ant Design, existing Jest/Vitest-compatible test setup and npm build scripts.

---

## File Map

- Modify `src/shared/types.ts`: Add the `Urgency` union and `Todo.urgency` field.
- Modify `src/main/MarkdownParser.ts`: Parse, normalize, serialize, and validate Markdown urgency.
- Modify `src/main/FileIndexer.ts`: Carry urgency through index entries, MiniSearch stored fields, index creation, updates, serialization, and filtering; bump the index version so old index data is rebuilt.
- Modify `src/main/FileStorageManager.ts`: Include urgency when converting index entries back to complete `Todo` objects and expose it in advanced-search options if that path is used by the app.
- Modify `src/renderer/components/TodoForm.tsx`: Show and submit the high/low selector with low as the default.
- Modify `src/renderer/components/Toolbar.tsx`: Add an optional pending-only urgency selector to the existing toolbar props.
- Modify `src/renderer/App.tsx`: Own urgency-filter state, pass toolbar props, filter pending todos before search, and include the filter in cache keys/dependencies.
- Modify the todo display components that render the existing priority tag (`TodoCard.tsx`, `TodoList.tsx`, `VirtualizedTodoList.tsx`, `CompactTodoItem.tsx`, and any shared compact view path identified during implementation): Render a separate urgency tag without changing the priority label.
- Add focused tests beside the existing test conventions for Markdown parsing/serialization, urgency filtering, and form submission; add backflow coverage only if a current backflow test harness exists.

## Task 1: Add the shared urgency contract

**Files:**
- Modify: `src/shared/types.ts`
- Test: `src/shared/utils/typeUtils.test.ts` only if the existing shared type utility tests are the established place for runtime model helpers; otherwise add a focused test beside the parser.

- [ ] **Step 1: Add the type without changing priority**

Define:

```ts
export type TodoUrgency = 'high' | 'low';
```

Add `urgency: TodoUrgency` immediately after `priority` in `Todo`. Add the same required field to `TodoFormData` only if that interface is used by the active form path; otherwise keep the form payload inferred from `Todo` and avoid an unused API change.

- [ ] **Step 2: Run the main TypeScript build to identify all object literals requiring the field**

Run:

```bash
npm run build:main
```

Expected: TypeScript reports every main-process `Todo` construction that must receive a normalized urgency value. Record those locations for Tasks 2 and 3; do not add `as any` casts to suppress errors.

- [ ] **Step 3: Keep the change scoped and verify the diff**

Run:

```bash
git -c safe.directory=D:/todolist/MultiTodoApp diff --check -- src/shared/types.ts
```

Expected: no whitespace errors.

## Task 2: Make Markdown the authoritative persistence path

**Files:**
- Modify: `src/main/MarkdownParser.ts`
- Test: Add `src/main/MarkdownParser.urgency.test.ts` using the repository's configured test runner and mocking image extraction only if parser construction requires it.

- [ ] **Step 1: Write failing parser tests**

Cover these exact cases:

```ts
it('reads high urgency from frontmatter', () => {
  const todo = parser.parseTodo(`---\nid: a\ntitle: A\nstatus: pending\npriority: trivial\nurgency: high\ncreated_at: 2026-01-01T00:00:00.000Z\nupdated_at: 2026-01-01T00:00:00.000Z\n---\n`);
  expect(todo.urgency).toBe('high');
});

it.each([undefined, 'urgent', 3])('defaults invalid urgency %p to low', (urgency) => {
  const value = urgency === undefined ? '' : `urgency: ${urgency}\n`;
  const todo = parser.parseTodo(`---\nid: a\ntitle: A\nstatus: pending\npriority: trivial\n${value}---\n`);
  expect(todo.urgency).toBe('low');
});

it('writes urgency to generated frontmatter', async () => {
  const markdown = await parser.generateTodo({ ...todoFixture, urgency: 'high' });
  expect(matter(markdown).data.urgency).toBe('high');
});
```

Use complete fixture values required by `Todo`; do not omit required fields with unsafe casts.

- [ ] **Step 2: Run the focused test and verify it fails**

Run the repository's configured focused test command, for example:

```bash
npx jest src/main/MarkdownParser.urgency.test.ts --runInBand
```

Expected: FAIL because the parser does not yet populate or serialize `urgency`.

- [ ] **Step 3: Implement one normalization helper and use it at parse/serialize boundaries**

Add a private helper with this behavior:

```ts
private normalizeTodoUrgency(urgency: unknown): TodoUrgency {
  return urgency === 'high' ? 'high' : 'low';
}
```

Use it in `parseTodo`, add `urgency: this.normalizeTodoUrgency(todo.urgency)` to generated frontmatter, and validate only `high`/`low` when the field is present. Missing urgency must remain valid for old files and must not produce a required-field error.

- [ ] **Step 4: Run the focused parser test**

Run:

```bash
npx jest src/main/MarkdownParser.urgency.test.ts --runInBand
```

Expected: PASS.

## Task 3: Carry urgency through indexing, file storage, and search

**Files:**
- Modify: `src/main/FileIndexer.ts`
- Modify: `src/main/FileStorageManager.ts`
- Test: Extend the parser/file-index test location established in Task 2, or add `src/main/FileIndexer.urgency.test.ts` if the indexer can be constructed with a temporary directory in the existing test environment.

- [ ] **Step 1: Write failing index round-trip tests**

Verify that an indexed entry built from Markdown has `urgency: 'high'`, an entry missing urgency has `urgency: 'low'`, and converting an index entry to a full Todo preserves the value. Also verify that an old serialized index is rebuilt or normalized rather than exposing `undefined`.

- [ ] **Step 2: Bump the index version and add the field everywhere an entry is created**

Increase `FileIndexer.INDEX_VERSION` so existing `.multitodo-metadata/index.json` files rebuild. Add `urgency: string` to `TodoIndexEntry`; populate it from parsed frontmatter with `high`/`low` normalization, and include it in `addTodo`, `batchUpdateTodos`, `buildIndexEntryFromTodo`, and `FileStorageManager`'s `todoFromIndexEntry` conversion.

- [ ] **Step 3: Preserve the field in serialized and deserialized index data**

Include urgency in MiniSearch `storeFields` and the serialized todo entries. On deserialization, normalize legacy entries with `entry.urgency ?? 'low'` before rebuilding the map and auxiliary indexes. Do not create a new SQLite index or migration.

- [ ] **Step 4: Add optional advanced-search support without changing the renderer filter contract**

Add `urgency?: string` to `FileStorageManager.advancedSearch` options and filter results only when the value is `high` or `low`. The App's current local filtering remains the source for the visible pending-pool selector.

- [ ] **Step 5: Run focused main-process tests and build**

Run:

```bash
npx jest src/main/MarkdownParser.urgency.test.ts src/main/FileIndexer.urgency.test.ts --runInBand
npm run build:main
```

Expected: focused tests PASS and main TypeScript compilation PASS.

## Task 4: Add urgency to create/edit forms

**Files:**
- Modify: `src/renderer/components/TodoForm.tsx`
- Test: Add or extend a focused `TodoForm` test using the repository's existing React test setup.

- [ ] **Step 1: Write failing form behavior tests**

Cover:

1. A new form has `urgency === 'low'` in its submitted data when the user leaves the selector unchanged.
2. Selecting “高” submits `urgency: 'high'`.
3. Editing a high-urgency Todo initializes the selector to `high`.
4. A legacy Todo missing urgency initializes to `low`.

- [ ] **Step 2: Add the selector and defaults**

In the metadata fields, add an Ant Design `Form.Item name="urgency" label="紧急程度"` with options `high/高` and `low/低`. Set `urgency: 'low'` in the new-todo initialization and use `todo.urgency ?? 'low'` in edit initialization. Include the normalized value in `todoData` submitted to `onSubmit`.

- [ ] **Step 3: Run the form test and renderer type/build checks**

Run the focused form test command used by the repository, then:

```bash
npm run build:renderer
```

Expected: form tests PASS and the renderer build compiles without missing urgency fields.

## Task 5: Show urgency without replacing priority

**Files:**
- Modify: `src/renderer/components/TodoCard.tsx`
- Modify: `src/renderer/components/TodoList.tsx`
- Modify: `src/renderer/components/VirtualizedTodoList.tsx`
- Modify: `src/renderer/components/CompactTodoItem.tsx` and the active compact-view parent if it renders metadata separately.
- Modify: `src/renderer/components/TodoViewDrawer.tsx` only if the detail view is part of the existing metadata presentation and can show the same field without broad layout changes.
- Test: Extend existing component tests or add a focused display test for high/low labels.

- [ ] **Step 1: Identify every active priority-tag render path**

Use:

```bash
rg -n -C 3 "getPriorityText|priorityTag|<Tag.*priority|优先级" src/renderer/components
```

For each active list/card path, add urgency beside the current priority tag. Do not alter the existing priority label or its color mapping.

- [ ] **Step 2: Add a small shared display mapping only if duplication is already problematic**

Prefer the local helper pattern already used by each component. If a shared helper is needed, define explicit labels/colors:

```ts
const urgencyLabel = urgency === 'high' ? '高紧急' : '低紧急';
const urgencyColor = urgency === 'high' ? 'red' : 'default';
```

Always use `todo.urgency ?? 'low'` at render boundaries for old in-memory data.

- [ ] **Step 3: Verify display tests and responsive layout**

Run the focused component test and `npm run build:renderer`. Check that both tags remain within their metadata row at the existing desktop and narrow-window layouts; adjust wrapping styles only in the owning component if required.

## Task 6: Add pending-only urgency filtering

**Files:**
- Modify: `src/renderer/components/Toolbar.tsx`
- Modify: `src/renderer/App.tsx`
- Test: Add `src/renderer/utils/urgencyFilter.test.ts` if extracting a pure filter helper is useful; otherwise extend an App/Toolbar test with the existing test conventions.

- [ ] **Step 1: Write a pure filtering test before wiring UI**

Use a helper or equivalent logic with this contract:

```ts
filterTodos(todos, 'pending', 'all') // all pending todos
filterTodos(todos, 'pending', 'high') // only pending high urgency
filterTodos(todos, 'completed', 'high') // all completed todos; urgency filter ignored
```

Missing urgency must behave as `low`.

- [ ] **Step 2: Add controlled Toolbar props and selector**

Add `urgencyFilter?: 'all' | 'high' | 'low'` and `onUrgencyFilterChange?: (...) => void` to `ToolbarProps`. Render a `Select` labeled by its placeholder/suffix icon only when `activeTab` is pending; pass `activeTab` from App. Options are `全部`, `高紧急`, and `低紧急`.

- [ ] **Step 3: Apply the filter in App's base filtering layer**

Add `const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'high' | 'low'>('all')`. After status/custom-tab selection and owner matching, apply urgency only when `activeTab === 'pending'`; use `todo.urgency ?? 'low'` for compatibility. Add `urgencyFilter` to the `useMemo` dependency list.

- [ ] **Step 4: Include urgency filter state in cache keys and stale-filter guards**

Include `urgencyFilter` in search and sorting cache keys where `activeTab` is currently used, and clear/reset the filter only if the existing Tab switching behavior requires it. Ensure changing the selector immediately recalculates `baseFilteredTodos` and cannot return a cached result from another urgency selection.

- [ ] **Step 5: Run filtering tests and renderer build**

Run the focused filtering test and:

```bash
npm run build:renderer
```

Expected: pending high/low filtering works, other tabs remain unchanged, and the renderer compiles.

## Task 7: Verify backflow preservation and the complete build

**Files:**
- Review: `src/main/services/TodoBackflowManager.ts` (expected behavior is no code change because it updates only `status` and `updatedAt`).
- Test: Add/extend a backflow test only if an existing test harness can mock `getAllTodos` and `bulkUpdateTodos`.

- [ ] **Step 1: Add the backflow regression test**

Given an `in_progress` Todo with `urgency: 'high'`, mock the storage manager and run `checkAndBackflowTodos()`. Assert the bulk update payload contains `status: 'pending'` and does not overwrite urgency; separately verify a low-urgency todo remains low.

- [ ] **Step 2: Run all relevant verification commands**

Run:

```bash
npm run build:main
npm run build:renderer
npm run build
```

Run the focused tests from Tasks 2, 3, 4, 5, 6, and 7 using the repository's configured test runner. Expected: all focused tests pass and both process builds complete successfully.

- [ ] **Step 3: Inspect the final diff for storage-scope regressions**

Run:

```bash
rg -n "urgency|priority" src/shared/types.ts src/main/MarkdownParser.ts src/main/FileIndexer.ts src/main/FileStorageManager.ts src/main/services/TodoBackflowManager.ts src/renderer/App.tsx src/renderer/components/Toolbar.tsx src/renderer/components/TodoForm.tsx
git -c safe.directory=D:/todolist/MultiTodoApp diff --check
```

Confirm there is no SQLite migration, no replacement of the existing priority semantics, no `as any` workaround for missing fields, and no unrelated changes to the user’s existing worktree modifications.

