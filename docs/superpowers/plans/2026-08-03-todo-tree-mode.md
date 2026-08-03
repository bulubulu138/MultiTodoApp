# Todo Tree Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tree view mode that displays all todos as a single-parent hierarchy, supports selection/details, and allows add/edit/delete/reparent operations.

**Architecture:** Keep hierarchy logic in pure renderer utilities, render tree UI in a focused `TodoTreeView` component, and keep all mutations owned by `App.tsx` through existing Electron IPC APIs. Use existing `extends` relations as the canonical parent-child model: parent is `source_id`, child is `target_id`.

**Tech Stack:** Electron, React 18, TypeScript, Ant Design, `@dnd-kit/core`, existing `window.electronAPI` IPC bridge, Jest-style unit tests already present in the repo.

---

## File Structure

- Create `src/renderer/utils/todoTree.ts`: pure tree-building, parent lookup, descendant lookup, and reparent validation.
- Create `src/renderer/utils/__tests__/todoTree.test.ts`: unit tests for the pure tree behavior.
- Create `src/renderer/components/TodoTreeView.tsx`: two-pane tree UI with node selection, add/edit/delete actions, and drag/drop events.
- Create `src/renderer/components/TodoTreeView.module.css`: stable two-pane layout and compact node styling.
- Modify `src/renderer/components/Toolbar.tsx`: extend `ViewMode` with `tree` and add segmented control option.
- Modify `src/renderer/App.tsx`: add tree-mode state, all-status filtering for tree mode, create-child relation flow, reparent flow, and render branch.
- Optionally modify `package.json`: only if execution discovers there is no runnable test script and the local Jest setup exists in dependencies or lockfile.

---

### Task 1: Pure Tree Utilities

**Files:**
- Create: `src/renderer/utils/todoTree.ts`
- Test: `src/renderer/utils/__tests__/todoTree.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/utils/__tests__/todoTree.test.ts` with this content:

```typescript
import { Todo, TodoRelation } from '../../../shared/types';
import {
  buildTodoTree,
  canReparentTodo,
  getCurrentParentRelation,
  getParentRelations,
  getDescendantIds,
} from '../todoTree';

const makeTodo = (id: string, title = `Todo ${id}`, status: Todo['status'] = 'pending'): Todo => ({
  id,
  title,
  content: '',
  status,
  priority: 'mental',
  tags: '',
  createdAt: `2026-08-03T00:00:0${id.length}.000Z`,
  updatedAt: `2026-08-03T00:00:0${id.length}.000Z`,
});

const relation = (
  id: string,
  source_id: string,
  target_id: string,
  relation_type: TodoRelation['relation_type'] = 'extends',
  created_at = '2026-08-03T00:00:00.000Z'
): TodoRelation => ({ id, source_id, target_id, relation_type, created_at });

describe('todoTree utilities', () => {
  it('builds roots and children from extends relations', () => {
    const todos = [makeTodo('parent'), makeTodo('child'), makeTodo('other', 'Other', 'completed')];
    const relations = [relation('r1', 'parent', 'child')];

    const result = buildTodoTree(todos, relations);

    expect(result.roots.map(node => node.todo.id)).toEqual(['parent', 'other']);
    expect(result.roots[0].children.map(node => node.todo.id)).toEqual(['child']);
    expect(result.parentByChildId.get('child')?.source_id).toBe('parent');
  });

  it('ignores background and parallel relations for the editable hierarchy', () => {
    const todos = [makeTodo('a'), makeTodo('b'), makeTodo('c')];
    const relations = [
      relation('r1', 'a', 'b', 'background'),
      relation('r2', 'b', 'c', 'parallel'),
    ];

    const result = buildTodoTree(todos, relations);

    expect(result.roots.map(node => node.todo.id)).toEqual(['a', 'b', 'c']);
    expect(result.parentByChildId.size).toBe(0);
  });

  it('chooses the newest parent when inconsistent data gives one child multiple parents', () => {
    const todos = [makeTodo('old-parent'), makeTodo('new-parent'), makeTodo('child')];
    const relations = [
      relation('old', 'old-parent', 'child', 'extends', '2026-08-03T00:00:00.000Z'),
      relation('new', 'new-parent', 'child', 'extends', '2026-08-03T00:01:00.000Z'),
    ];

    const result = buildTodoTree(todos, relations);

    expect(result.parentByChildId.get('child')?.id).toBe('new');
    const newParent = result.roots.find(node => node.todo.id === 'new-parent');
    expect(newParent?.children.map(node => node.todo.id)).toEqual(['child']);
  });

  it('finds descendants without including the starting node', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')]
    );

    expect(Array.from(getDescendantIds('a', result.nodeById)).sort()).toEqual(['b', 'c']);
  });

  it('blocks moving a node under itself or under its descendant', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')]
    );

    expect(canReparentTodo('a', 'a', result.nodeById).allowed).toBe(false);
    expect(canReparentTodo('a', 'c', result.nodeById).allowed).toBe(false);
  });

  it('allows moving a node under a different valid parent', () => {
    const result = buildTodoTree(
      [makeTodo('a'), makeTodo('b'), makeTodo('c')],
      [relation('ab', 'a', 'b')]
    );

    expect(canReparentTodo('b', 'c', result.nodeById)).toEqual({ allowed: true });
  });

  it('returns the current parent relation for a child', () => {
    const relations = [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')];

    expect(getCurrentParentRelation('b', relations)?.id).toBe('ab');
    expect(getCurrentParentRelation('a', relations)).toBeNull();
  });

  it('returns all parent relations for single-parent cleanup', () => {
    const relations = [
      relation('old', 'old-parent', 'child', 'extends', '2026-08-03T00:00:00.000Z'),
      relation('new', 'new-parent', 'child', 'extends', '2026-08-03T00:01:00.000Z'),
      relation('ignored', 'other', 'child', 'background'),
    ];

    expect(getParentRelations('child', relations).map(parentRelation => parentRelation.id)).toEqual(['old', 'new']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the narrowest available test command first:

```bash
npm run test -- src/renderer/utils/__tests__/todoTree.test.ts
```

Expected: the command either fails because `../todoTree` does not exist, or reports that `npm run test` is not defined. If `npm run test` is not defined, record that in the task notes and continue with build verification after implementation; do not change production behavior to satisfy a missing script.

- [ ] **Step 3: Implement the minimal utility module**

Create `src/renderer/utils/todoTree.ts` with this content:

```typescript
import { Todo, TodoRelation, TodoTreeNode } from '../../shared/types';

export interface BuiltTodoTree {
  roots: TodoTreeNode[];
  nodeById: Map<string, TodoTreeNode>;
  parentByChildId: Map<string, TodoRelation>;
}

export interface ReparentValidationResult {
  allowed: boolean;
  reason?: 'same-node' | 'descendant' | 'missing-node';
}

const compareRelationRecency = (left: TodoRelation, right: TodoRelation): number => {
  const leftTime = Date.parse(left.created_at || '');
  const rightTime = Date.parse(right.created_at || '');

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return 0;
};

export const getCurrentParentRelation = (
  childTodoId: string,
  relations: TodoRelation[]
): TodoRelation | null => {
  const parentRelations = getParentRelations(childTodoId, relations);

  if (parentRelations.length === 0) return null;

  return parentRelations.reduce((current, next) => (
    compareRelationRecency(current, next) <= 0 ? next : current
  ));
};

export const getParentRelations = (
  childTodoId: string,
  relations: TodoRelation[]
): TodoRelation[] => relations.filter(relation =>
  relation.relation_type === 'extends' && String(relation.target_id) === String(childTodoId)
);

export const buildTodoTree = (todos: Todo[], relations: TodoRelation[]): BuiltTodoTree => {
  const nodeById = new Map<string, TodoTreeNode>();
  const parentByChildId = new Map<string, TodoRelation>();

  todos.filter(todo => todo && todo.id).forEach(todo => {
    nodeById.set(String(todo.id), {
      key: String(todo.id),
      title: todo.title,
      todo,
      children: [],
    });
  });

  relations.forEach(relation => {
    if (relation.relation_type !== 'extends') return;

    const parentId = String(relation.source_id);
    const childId = String(relation.target_id);
    if (!nodeById.has(parentId) || !nodeById.has(childId) || parentId === childId) return;

    const existing = parentByChildId.get(childId);
    if (!existing || compareRelationRecency(existing, relation) <= 0) {
      parentByChildId.set(childId, relation);
    }
  });

  parentByChildId.forEach((relation, childId) => {
    const parentNode = nodeById.get(String(relation.source_id));
    const childNode = nodeById.get(childId);
    if (!parentNode || !childNode) return;

    if (getDescendantIds(childId, nodeById).has(String(relation.source_id))) {
      parentByChildId.delete(childId);
      return;
    }

    parentNode.children = [...(parentNode.children || []), childNode];
  });

  const childIds = new Set(parentByChildId.keys());
  const roots = Array.from(nodeById.values()).filter(node => !childIds.has(String(node.todo.id)));

  const sortNodes = (nodes: TodoTreeNode[]) => {
    nodes.sort((left, right) => new Date(right.todo.createdAt).getTime() - new Date(left.todo.createdAt).getTime());
    nodes.forEach(node => sortNodes(node.children || []));
  };
  sortNodes(roots);

  return { roots, nodeById, parentByChildId };
};

export const getDescendantIds = (
  todoId: string,
  nodeById: Map<string, TodoTreeNode>
): Set<string> => {
  const descendants = new Set<string>();
  const root = nodeById.get(String(todoId));
  const stack = [...(root?.children || [])];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    const id = String(node.todo.id);
    if (descendants.has(id)) continue;

    descendants.add(id);
    stack.push(...(node.children || []));
  }

  return descendants;
};

export const canReparentTodo = (
  childTodoId: string,
  newParentTodoId: string,
  nodeById: Map<string, TodoTreeNode>
): ReparentValidationResult => {
  const childId = String(childTodoId);
  const parentId = String(newParentTodoId);

  if (!nodeById.has(childId) || !nodeById.has(parentId)) {
    return { allowed: false, reason: 'missing-node' };
  }

  if (childId === parentId) {
    return { allowed: false, reason: 'same-node' };
  }

  if (getDescendantIds(childId, nodeById).has(parentId)) {
    return { allowed: false, reason: 'descendant' };
  }

  return { allowed: true };
};
```

- [ ] **Step 4: Run tests or build verification**

Run:

```bash
npm run test -- src/renderer/utils/__tests__/todoTree.test.ts
```

Expected if a test script exists: PASS for `todoTree utilities`.

If there is no test script, run:

```bash
npm run build:renderer
```

Expected: renderer build succeeds without TypeScript errors from `todoTree.ts`.

- [ ] **Step 5: Commit utility work**

```bash
git -c safe.directory=D:/todolist/MultiTodoApp add src/renderer/utils/todoTree.ts src/renderer/utils/__tests__/todoTree.test.ts
git -c safe.directory=D:/todolist/MultiTodoApp commit -m "feat: add todo tree utilities"
```

---

### Task 2: Toolbar View Mode

**Files:**
- Modify: `src/renderer/components/Toolbar.tsx`

- [ ] **Step 1: Write the failing type/UI expectation**

Because no focused toolbar test exists, make the smallest compile-time change first in `Toolbar.tsx` by changing only the exported type:

```typescript
export type ViewMode = 'card' | 'content-focus' | 'compact' | 'tree';
```

Then run:

```bash
npm run build:renderer
```

Expected: build still passes, but the UI does not yet expose the mode. This is a compile check step, not the final implementation.

- [ ] **Step 2: Add the tree option to the segmented control**

Modify imports in `Toolbar.tsx` to include a tree-like icon available from Ant Design icons:

```typescript
import { PlusOutlined, SettingOutlined, CalendarOutlined, SortAscendingOutlined, UnorderedListOutlined, AlignLeftOutlined, AppstoreOutlined, SearchOutlined, FileTextOutlined, SyncOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
```

Add this option after `compact` and before `content-focus`:

```typescript
{
  label: '树形',
  value: 'tree',
  icon: <ApartmentOutlined />,
},
```

- [ ] **Step 3: Run renderer build**

```bash
npm run build:renderer
```

Expected: PASS with no `ViewMode` or icon import errors.

- [ ] **Step 4: Commit toolbar work**

```bash
git -c safe.directory=D:/todolist/MultiTodoApp add src/renderer/components/Toolbar.tsx
git -c safe.directory=D:/todolist/MultiTodoApp commit -m "feat: add tree view mode option"
```

---

### Task 3: TodoTreeView Component

**Files:**
- Create: `src/renderer/components/TodoTreeView.tsx`
- Create: `src/renderer/components/TodoTreeView.module.css`

- [ ] **Step 1: Create the component shell**

Create `src/renderer/components/TodoTreeView.module.css`:

```css
.treeView {
  display: grid;
  grid-template-columns: minmax(320px, 42%) minmax(360px, 1fr);
  gap: 16px;
  height: calc(100vh - 132px);
  min-height: 520px;
}

.treePane,
.detailPane {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.treePane {
  display: flex;
  flex-direction: column;
}

.treeHeader,
.detailHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.treeBody {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.nodeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.nodeRow:hover,
.nodeRowSelected {
  background: var(--color-surface-hover);
}

.nodeTitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.nodeMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.children {
  margin-left: 22px;
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
}

.detailBody {
  height: calc(100% - 57px);
  overflow: auto;
  padding: 16px;
}

@media (max-width: 900px) {
  .treeView {
    grid-template-columns: 1fr;
    height: auto;
  }

  .treePane,
  .detailPane {
    min-height: 360px;
  }
}
```

Create `src/renderer/components/TodoTreeView.tsx`:

```typescript
import React, { useMemo } from 'react';
import { Button, Empty, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Todo, TodoRelation, TodoTreeNode } from '../../shared/types';
import { buildTodoTree } from '../utils/todoTree';
import ReadOnlyMarkdown from './ReadOnlyMarkdown';
import TodoOwnerAvatar from './TodoOwnerAvatar';
import styles from './TodoTreeView.module.css';

const { Text, Title } = Typography;

interface TodoTreeViewProps {
  todos: Todo[];
  relations: TodoRelation[];
  loading: boolean;
  selectedTodo: Todo | null;
  onSelectTodo: (todo: Todo) => void;
  onAddChild: (parentTodo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onReparent: (childTodoId: string, parentTodoId: string) => void;
}

const statusText: Record<Todo['status'], string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  paused: '暂停',
};

const priorityText: Record<Todo['priority'], string> = {
  mental: '脑力',
  communication: '沟通',
  trivial: '琐碎',
};

const TreeNodeRow: React.FC<{
  node: TodoTreeNode;
  selectedTodoId: string | null;
  onSelectTodo: (todo: Todo) => void;
  onAddChild: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}> = ({ node, selectedTodoId, onSelectTodo, onAddChild, onEdit, onDelete }) => {
  const id = String(node.todo.id);
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });
  const isSelected = selectedTodoId === id;

  return (
    <div ref={droppable.setNodeRef}>
      <div
        ref={draggable.setNodeRef}
        {...draggable.listeners}
        {...draggable.attributes}
        className={`${styles.nodeRow} ${isSelected ? styles.nodeRowSelected : ''}`}
        onClick={() => onSelectTodo(node.todo)}
      >
        <div>
          <div className={styles.nodeTitle}>{node.todo.title || '未命名待办'}</div>
          <div className={styles.nodeMeta}>
            <Tag>{statusText[node.todo.status]}</Tag>
            <Tag>{priorityText[node.todo.priority]}</Tag>
            {node.todo.owner && <TodoOwnerAvatar owner={node.todo.owner} size={18} />}
          </div>
        </div>
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Tooltip title="新增子待办">
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => onAddChild(node.todo)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(node.todo)} />
          </Tooltip>
          <Tooltip title="删除待办">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(node.todo)} />
          </Tooltip>
        </Space>
      </div>
      {node.children && node.children.length > 0 && (
        <div className={styles.children}>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.key}
              node={child}
              selectedTodoId={selectedTodoId}
              onSelectTodo={onSelectTodo}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TodoTreeView: React.FC<TodoTreeViewProps> = ({
  todos,
  relations,
  loading,
  selectedTodo,
  onSelectTodo,
  onAddChild,
  onEdit,
  onDelete,
  onReparent,
}) => {
  const tree = useMemo(() => buildTodoTree(todos, relations), [todos, relations]);
  const selectedTodoId = selectedTodo ? String(selectedTodo.id) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const childTodoId = event.active.id ? String(event.active.id) : '';
    const parentTodoId = event.over?.id ? String(event.over.id) : '';
    if (!childTodoId || !parentTodoId) return;
    onReparent(childTodoId, parentTodoId);
  };

  return (
    <div className={styles.treeView}>
      <section className={styles.treePane}>
        <div className={styles.treeHeader}>
          <Text strong>待办树</Text>
          <Text type="secondary">{todos.length} 项</Text>
        </div>
        <div className={styles.treeBody}>
          {loading ? (
            <Spin />
          ) : tree.roots.length === 0 ? (
            <Empty description="暂无待办" />
          ) : (
            <DndContext onDragEnd={handleDragEnd}>
              {tree.roots.map(node => (
                <TreeNodeRow
                  key={node.key}
                  node={node}
                  selectedTodoId={selectedTodoId}
                  onSelectTodo={onSelectTodo}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </DndContext>
          )}
        </div>
      </section>

      <section className={styles.detailPane}>
        <div className={styles.detailHeader}>
          <Text strong>详情</Text>
          {selectedTodo && (
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => onAddChild(selectedTodo)}>子待办</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(selectedTodo)}>编辑</Button>
            </Space>
          )}
        </div>
        <div className={styles.detailBody}>
          {!selectedTodo ? (
            <Empty description="选择一个待办查看详情" />
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Title level={4} style={{ margin: 0 }}>{selectedTodo.title || '未命名待办'}</Title>
              <Space wrap>
                <Tag>{statusText[selectedTodo.status]}</Tag>
                <Tag>{priorityText[selectedTodo.priority]}</Tag>
                {selectedTodo.owner && <TodoOwnerAvatar owner={selectedTodo.owner} size={22} />}
              </Space>
              {selectedTodo.tags && (
                <Space wrap>
                  {selectedTodo.tags.split(',').filter(Boolean).map(tag => <Tag key={tag}>{tag}</Tag>)}
                </Space>
              )}
              {selectedTodo.content ? <ReadOnlyMarkdown content={selectedTodo.content} /> : <Text type="secondary">暂无内容</Text>}
            </Space>
          )}
        </div>
      </section>
    </div>
  );
};

export default TodoTreeView;
```

- [ ] **Step 2: Run renderer build and fix type issues**

```bash
npm run build:renderer
```

Expected: likely first failure if `ReadOnlyMarkdown` props differ. If so, inspect `src/renderer/components/ReadOnlyMarkdown.tsx` and adjust only the prop name in `TodoTreeView.tsx`.

- [ ] **Step 3: Commit component work**

```bash
git -c safe.directory=D:/todolist/MultiTodoApp add src/renderer/components/TodoTreeView.tsx src/renderer/components/TodoTreeView.module.css
git -c safe.directory=D:/todolist/MultiTodoApp commit -m "feat: add todo tree view component"
```

---

### Task 4: App Integration And Mutations

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Import tree dependencies**

Add imports near existing renderer imports:

```typescript
import TodoTreeView from './components/TodoTreeView';
import { buildTodoTree, canReparentTodo, getParentRelations } from './utils/todoTree';
```

- [ ] **Step 2: Add tree state**

Near existing `pendingPosition` and modal state, add:

```typescript
const [selectedTreeTodoId, setSelectedTreeTodoId] = useState<string | null>(null);
const [treeParentForNewTodo, setTreeParentForNewTodo] = useState<Todo | null>(null);
```

- [ ] **Step 3: Make create return the created todo**

Change `handleCreateTodo` signature to return `Promise<Todo | null>`:

```typescript
const handleCreateTodo = async (
  todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Todo | null> => {
```

Before `setShowForm(false);`, add tree-child relation creation after the existing `pendingPosition` block:

```typescript
if (treeParentForNewTodo && treeParentForNewTodo.id) {
  try {
    await window.electronAPI.relations.create({
      source_id: treeParentForNewTodo.id,
      target_id: newTodo.id,
      relation_type: 'extends',
    });
    await loadRelations();
    setSelectedTreeTodoId(String(newTodo.id));
    message.success('子待办创建成功');
  } catch (error) {
    console.error('Failed to create tree child relation:', error);
    message.error('待办事项创建成功，但父子关系创建失败');
  } finally {
    setTreeParentForNewTodo(null);
  }
}
```

At the end of the successful `try`, after `setShowForm(false);`, add:

```typescript
return newTodo;
```

In the `catch` block, after existing error handling, add:

```typescript
return null;
```

- [ ] **Step 4: Clear tree create state when closing the form**

In `handleCloseForm`, add:

```typescript
setTreeParentForNewTodo(null);
```

- [ ] **Step 5: Add tree datasets and handlers**

After `searchedTodos`, add a tree-specific filtered dataset that ignores status tab filtering while preserving owner and search:

```typescript
const treeTodos = useMemo(() => {
  const ownerFiltered = todos.filter(todo => todo && todo.id && matchesTodoOwner(todo, ownerFilter));
  const query = debouncedSearchText.trim().toLowerCase();
  if (!query || query.length < 2) return ownerFiltered;

  return ownerFiltered.filter(todo => {
    const titleMatch = todo.title?.toLowerCase().includes(query);
    if (titleMatch) return true;
    return todo.content?.toLowerCase().includes(query);
  });
}, [todos, ownerFilter, debouncedSearchText]);

const selectedTreeTodo = useMemo(() => {
  if (!selectedTreeTodoId) return null;
  return todos.find(todo => String(todo.id) === selectedTreeTodoId) || null;
}, [todos, selectedTreeTodoId]);

const treeData = useMemo(() => buildTodoTree(todos, relations), [todos, relations]);
```

Add handlers near other `handle*` callbacks:

```typescript
const handleSelectTreeTodo = useCallback((todo: Todo) => {
  setSelectedTreeTodoId(String(todo.id));
}, []);

const handleAddTreeChild = useCallback((parentTodo: Todo) => {
  setTreeParentForNewTodo(parentTodo);
  setEditingTodo(null);
  setQuickCreateContent(null);
  setShowForm(true);
}, []);

const handleDeleteTreeTodo = useCallback((todo: Todo) => {
  Modal.confirm({
    title: '删除待办',
    content: `确定删除「${todo.title || '未命名待办'}」吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      await handleDeleteTodo(String(todo.id));
      if (selectedTreeTodoId === String(todo.id)) {
        setSelectedTreeTodoId(null);
      }
      await loadRelations();
    },
  });
}, [handleDeleteTodo, loadRelations, selectedTreeTodoId]);

const handleReparentTreeTodo = useCallback(async (childTodoId: string, parentTodoId: string) => {
  const validation = canReparentTodo(childTodoId, parentTodoId, treeData.nodeById);
  if (!validation.allowed) {
    message.warning(validation.reason === 'descendant' ? '不能移动到自己的子分支下' : '无法移动到该位置');
    return;
  }

  const parentRelations = getParentRelations(childTodoId, relations);
  const matchingParentRelation = parentRelations.find(relation => String(relation.source_id) === String(parentTodoId));
  if (matchingParentRelation && parentRelations.length === 1) {
    return;
  }

  try {
    const relationsToDelete = parentRelations.filter(relation =>
      relation.id && String(relation.id) !== String(matchingParentRelation?.id || '')
    );

    for (const relation of relationsToDelete) {
      await window.electronAPI.relations.delete(String(relation.id));
    }

    if (!matchingParentRelation) {
      await window.electronAPI.relations.create({
        source_id: parentTodoId,
        target_id: childTodoId,
        relation_type: 'extends',
      });
    }

    await loadRelations();
    message.success('父子关系已更新');
  } catch (error) {
    console.error('Error reparenting todo:', error);
    message.error('更新父子关系失败');
    await loadRelations();
  }
}, [treeData.nodeById, relations, loadRelations, message]);
```

- [ ] **Step 6: Render tree mode branch**

Inside the `AnimatePresence` where `content-focus`, `compact`, and `card` branches are rendered, add a branch before `card`:

```tsx
{currentTabSettings.viewMode === 'tree' && (
  <motion.div
    key="tree"
    variants={shouldReduceMotion() ? {} : optimizedMotionVariants.pageTransition}
    initial="hidden"
    animate="visible"
    exit="exit"
  >
    <TodoTreeView
      todos={treeTodos}
      relations={relations}
      loading={loading}
      selectedTodo={selectedTreeTodo}
      onSelectTodo={handleSelectTreeTodo}
      onAddChild={handleAddTreeChild}
      onEdit={handleEditTodo}
      onDelete={handleDeleteTreeTodo}
      onReparent={handleReparentTreeTodo}
    />
  </motion.div>
)}
```

- [ ] **Step 7: Run renderer build**

```bash
npm run build:renderer
```

Expected: PASS. If TypeScript complains that `handleDeleteTodo` or `loadRelations` are not stable dependencies, convert them to `useCallback` only if required by lint/build; otherwise preserve current code shape.

- [ ] **Step 8: Commit app integration**

```bash
git -c safe.directory=D:/todolist/MultiTodoApp add src/renderer/App.tsx
git -c safe.directory=D:/todolist/MultiTodoApp commit -m "feat: integrate todo tree mode"
```

---

### Task 5: Verification And Polish

**Files:**
- Modify only files from earlier tasks if verification finds issues.

- [ ] **Step 1: Run main and renderer builds**

```bash
npm run build:main
npm run build:renderer
```

Expected: both commands pass.

- [ ] **Step 2: Run available tests**

```bash
npm run test -- src/renderer/utils/__tests__/todoTree.test.ts
```

Expected: PASS if a test script is available. If `npm run test` is not defined, record this as a verification gap in the final implementation summary.

- [ ] **Step 3: Start the dev app for manual verification**

```bash
npm run dev
```

Expected: Electron app starts. Manually verify:

- Toolbar has `树形` view option.
- Tree mode shows pending, in-progress, completed, and paused todos together.
- Clicking a node updates the right detail pane.
- Add child creates a todo under the selected parent.
- Edit opens the existing todo form.
- Delete asks for confirmation and removes the todo.
- Dragging a node onto another reparents it.
- Dragging a node onto itself or its descendant is blocked.

- [ ] **Step 4: Commit final polish if any files changed**

```bash
git -c safe.directory=D:/todolist/MultiTodoApp status --short
git -c safe.directory=D:/todolist/MultiTodoApp add src/renderer/App.tsx src/renderer/components/TodoTreeView.tsx src/renderer/components/TodoTreeView.module.css src/renderer/components/Toolbar.tsx src/renderer/utils/todoTree.ts src/renderer/utils/__tests__/todoTree.test.ts
git -c safe.directory=D:/todolist/MultiTodoApp commit -m "fix: polish todo tree mode"
```

Skip the commit if `git status --short` shows no changes.

---

## Self-Review Notes

- Spec coverage: this plan covers the `tree` toolbar mode, all-status tree dataset, `extends` parent-child model, single-parent reparenting, cycle blocking, add/edit/delete operations, right-side details, focused utilities, and verification.
- Testing: pure tree behavior is covered first. Component behavior is mostly verified by build and manual app checks because the repo has Jest-style tests but no visible `test` script in `package.json`.
- Scope control: no schema migration, no multiple-parent support, no flowchart canvas, and no full inline rich text editor are included.
