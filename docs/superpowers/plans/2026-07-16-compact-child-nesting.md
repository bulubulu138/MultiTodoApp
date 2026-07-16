# Compact Child Nesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render child todos directly under their parent with indentation in compact mode while preserving existing compact-mode behavior.

**Architecture:** Add a small pure utility that transforms an already-sorted todo list plus `extends` relations into display rows with `indentLevel`. Wire `CompactTodoView` to use those rows and pass indentation into `CompactTodoItem`.

**Tech Stack:** TypeScript, React, existing Electron renderer utilities, existing `Todo` and `TodoRelation` shared types.

---

### Task 1: Compact Nesting Utility Test

**Files:**
- Create: `src/renderer/utils/compactTodoNesting.ts`
- Create: `src/renderer/utils/__tests__/compactTodoNesting.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/utils/__tests__/compactTodoNesting.test.ts` with tests for parent-child adjacency, nested indentation, and sibling order based on the incoming sorted list.

- [ ] **Step 2: Run test to verify it fails**

Run a focused TypeScript check or available test command. Expected failure: `buildCompactTodoRows` is missing or returns un-nested rows.

### Task 2: Compact Nesting Utility Implementation

**Files:**
- Modify: `src/renderer/utils/compactTodoNesting.ts`

- [ ] **Step 1: Implement minimal utility**

Export `buildCompactTodoRows(todos, relations)` returning `{ todo, indentLevel }[]`. Use only `extends` relations, ignore relations outside the visible todo set, preserve incoming list order among roots and siblings, and track visited IDs.

- [ ] **Step 2: Run focused test to verify it passes**

Expected: the new compact nesting test passes.

### Task 3: Wire Compact View Indentation

**Files:**
- Modify: `src/renderer/components/CompactTodoView.tsx`
- Modify: `src/renderer/components/CompactTodoItem.tsx`

- [ ] **Step 1: Use compact rows in view rendering**

Compute `compactRows` from `sortedTodos` and `relations`, pass `compactRows.map(row => row.todo)` to `DragDropTodoList`, and look up the row's `indentLevel` when rendering each item.

- [ ] **Step 2: Apply indentation in item**

Add `indentLevel?: number` to `CompactTodoItemProps`, default it to `0`, and increase left padding by a fixed compact indent per level.

### Task 4: Verification

**Files:**
- Modify only if verification exposes a real issue.

- [ ] **Step 1: Run renderer/main build or typecheck available in this repo**

Run `npm run build:renderer` and, if needed, `npm run build:main`. Expected: no TypeScript or webpack errors from the change.

- [ ] **Step 2: Review changed files**

Check `git diff -- src/renderer/components/CompactTodoView.tsx src/renderer/components/CompactTodoItem.tsx src/renderer/utils/compactTodoNesting.ts src/renderer/utils/__tests__/compactTodoNesting.test.ts` and confirm scope stays limited.
