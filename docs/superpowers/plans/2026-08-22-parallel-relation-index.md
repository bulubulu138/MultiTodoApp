# Relation Index Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated relation scans in focus mode without changing full loading, rendering, editing, or auto-save behavior.

**Architecture:** Add a pure shared relation-index utility that normalizes relation IDs to strings, builds a parallel adjacency map, and computes connected parallel groups once. `ContentFocusView` consumes the precomputed maps while retaining its existing `todos.map()` rendering and child editor lifecycle. No save timers, editor refs, IPC calls, or persistence paths are changed.

**Tech Stack:** React, TypeScript, Jest-style unit tests, existing `TodoRelation` model.

---

### Task 1: Add relation-index regression tests

**Files:**
- Create: `src/shared/utils/parallelRelationIndex.test.ts`

- [ ] **Step 1: Write failing tests** for no relations, chained/branched groups, cycles, mixed numeric/string IDs, and per-todo membership.
- [ ] **Step 2: Run the focused test command** and confirm failure because the utility does not exist yet.

### Task 2: Implement the shared relation index

**Files:**
- Create: `src/shared/utils/parallelRelationIndex.ts`

- [ ] **Step 1: Define the index interface** with `parallelAdjacency`, `parallelGroupByTodo`, and `hasParallelByTodo`.
- [ ] **Step 2: Implement one adjacency pass** over only `parallel` relations, normalizing IDs with `String()`.
- [ ] **Step 3: Implement iterative connected-component traversal** so long relation chains do not recurse and cycles terminate safely.
- [ ] **Step 4: Run the focused tests** and confirm all cases pass.

### Task 3: Use the index in focus mode

**Files:**
- Modify: `src/renderer/components/ContentFocusView.tsx:865-907`
- Modify: `src/renderer/components/ContentFocusView.tsx:607-611`

- [ ] **Step 1: Replace the local repeated DFS/filter implementation** with `buildParallelRelationIndex(relations)` inside `useMemo`.
- [ ] **Step 2: Preserve the existing `Map<string, Set<string>>` group contract** used by `parallelGroup` props.
- [ ] **Step 3: Replace each item’s `relations.some()` call** with `hasParallelByTodo.has(String(todo.id))`.
- [ ] **Step 4: Leave `todos.map()`, editor refs, `saveNow`, debounce timers, and `saveAll` untouched.**

### Task 4: Verify behavior and build

**Files:**
- No additional production files.

- [ ] **Step 1: Run the focused relation-index tests.**
- [ ] **Step 2: Run the renderer/main TypeScript builds.**
- [ ] **Step 3: Inspect the diff** to confirm only relation calculation paths changed and save code remains unchanged.
- [ ] **Step 4: Report any existing test/build limitations separately.**
