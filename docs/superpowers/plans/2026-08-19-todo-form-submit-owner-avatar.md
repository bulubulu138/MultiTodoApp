# Todo Form Submit Owner Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the todo form save on the first click and improve owner entry with avatar-backed history suggestions while keeping manual input.

**Architecture:** Keep all behavior inside `TodoForm.tsx`. Use Ant Design `Form` native submit flow for save handling, and replace the owner `Input` with an `AutoComplete` whose options render `TodoOwnerAvatar` plus owner names.

**Tech Stack:** React, TypeScript, Ant Design, existing todo owner utilities.

---

### Task 1: TodoForm Regression Tests

**Files:**
- Create: `src/renderer/components/__tests__/TodoForm.test.tsx`
- Modify: `src/renderer/components/TodoForm.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests that render `TodoForm` with mocked `MilkdownEditor` and `window.electronAPI`, click `保存` once, and assert `onSubmit` is called once. Add a second test that opens the owner input and expects historical owners to render with avatar labels.

- [ ] **Step 2: Run targeted test to verify failure**

Run: `npx jest src/renderer/components/__tests__/TodoForm.test.tsx --runInBand`

Expected before implementation: the submit test should fail because the footer button is not wired as a real form submit, and the avatar suggestion test should fail because owner suggestions are plain datalist options.

- [ ] **Step 3: Implement TodoForm changes**

Change `TodoForm.tsx` so `Form` receives `onFinish={handleSubmit}`, `handleSubmit` accepts validated values, the save button uses `htmlType="submit"` plus `loading={isSubmitting}`, and owner input uses `AutoComplete` with avatar-rendered options.

- [ ] **Step 4: Run targeted test to verify pass**

Run: `npx jest src/renderer/components/__tests__/TodoForm.test.tsx --runInBand`

Expected after implementation: all tests in the file pass.

- [ ] **Step 5: Run build verification**

Run: `npm run build`

Expected: TypeScript and renderer webpack builds complete successfully.
