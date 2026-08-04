# Review Page Input Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove typing lag in review mode when a todo detail drawer is open by preventing the left-side todo detail HTML from being re-sanitized and re-rendered on every editor keystroke.

**Architecture:** Keep `ReviewModePage` as the state owner, but move the selected-todo detail panel into a memoized leaf component so editor text changes do not force the heavy HTML rendering path to run again. Compute sanitized HTML only when the selected todo changes, not on every page render. Preserve existing behavior for selection, delete action, and drawer placement.

**Tech Stack:** React 18, TypeScript, DOMPurify, Ant Design

---

### Task 1: Isolate the todo detail drawer into a memoized leaf component

**Files:**
- Modify: `src/renderer/components/review/ReviewModePage.tsx`
- Test: `src/renderer/components/review/__tests__/ReviewModePage.todo-detail-performance.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import ReviewModePage from '../ReviewModePage';

const sanitizeMock = jest.fn((html: string) => `sanitized:${html}`);

jest.mock('dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => sanitizeMock(html),
  },
}));

jest.mock('../MarkdownEditorReview', () => {
  return React.forwardRef(() => <div data-testid="editor" />);
});

jest.mock('antd', () => {
  const React = require('react');
  return {
    __esModule: true,
    Button: (props: any) => <button {...props} />,
    Drawer: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    Dropdown: ({ children }: any) => <div>{children}</div>,
    Input: (props: any) => <input {...props} />,
    List: ({ dataSource = [], renderItem }: any) => <div>{dataSource.map(renderItem)}</div>,
    Menu: () => null,
    Modal: { confirm: jest.fn() },
    Space: ({ children }: any) => <div>{children}</div>,
    Tabs: ({ items }: any) => <div>{items?.map((item: any) => <div key={item.key}>{item.label}</div>)}</div>,
    Tooltip: ({ children }: any) => <>{children}</>,
    message: { error: jest.fn(), success: jest.fn(), warning: jest.fn() },
  };
});

describe('ReviewModePage todo detail rendering', () => {
  it('does not re-sanitize selected todo content when unrelated editor state changes', () => {
    const todos = [{ id: '1', title: 'Task', content: '<p>hello</p>' }] as any;

    const { rerender } = render(
      <ReviewModePage onClose={jest.fn()} todos={todos} onDeleteTodo={jest.fn()} />
    );

    expect(sanitizeMock).toHaveBeenCalledTimes(0);

    rerender(<ReviewModePage onClose={jest.fn()} todos={todos} onDeleteTodo={jest.fn()} />);

    expect(sanitizeMock).toHaveBeenCalledTimes(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm the current code still re-renders the heavy path or the test fails for the intended reason**

Run: `npm run test -- src/renderer/components/review/__tests__/ReviewModePage.todo-detail-performance.test.tsx`
Expected: FAIL before the component split, because the page still owns the expensive detail rendering path.

- [ ] **Step 3: Implement the minimal refactor**

Move the selected-todo drawer body into a new `TodoDetailDrawer` memoized component inside the same file or a focused sibling file if that keeps `ReviewModePage` smaller. Pass `selectedTodo` and `onDeleteTodo` down. Compute sanitized HTML with `useMemo` inside that leaf component so it only recalculates when `selectedTodo.content` changes.

- [ ] **Step 4: Run the test to verify the fix**

Run: `npm run test -- src/renderer/components/review/__tests__/ReviewModePage.todo-detail-performance.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the broader renderer build still succeeds**

Run: `npm run build:renderer`
Expected: PASS with no TypeScript or webpack regressions.

---

### Task 2: Sanity-check the review page behavior manually

**Files:**
- Modify: none

- [ ] **Step 1: Confirm the review page still opens, selects a todo, and edits text normally**

Run the app in dev mode and open review mode. Select a todo on the left, open its details, then type in the editor on the right.
Expected: typing remains responsive, the left detail panel stays visible, and deletion/selection still work.

- [ ] **Step 2: Inspect for any unnecessary remounts**

Confirm the memoized detail component does not remount on each keystroke by checking React DevTools or temporary console logging during local verification.
Expected: only the editor subtree updates while typing.

---

### Task 3: Commit the fix

**Files:**
- Modify: `src/renderer/components/review/ReviewModePage.tsx`
- Add: `src/renderer/components/review/__tests__/ReviewModePage.todo-detail-performance.test.tsx`

- [ ] **Step 1: Review the diff for scope creep**

Ensure the change only touches review-page rendering and the new targeted test.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/review/ReviewModePage.tsx src/renderer/components/review/__tests__/ReviewModePage.todo-detail-performance.test.tsx
git commit -m "fix: reduce review page typing lag"
```
