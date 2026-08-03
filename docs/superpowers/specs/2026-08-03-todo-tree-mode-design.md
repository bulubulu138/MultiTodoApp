# Todo Tree Mode Design

## Goal

Add a tree mode that shows all todos as a clear parent-child hierarchy. The feature should let the user switch into tree mode from the main toolbar, select a todo in the tree, inspect its details on the right, and manage the tree by creating, editing, deleting, and dragging todos between branches.

## Confirmed Decisions

- The tree uses the existing `extends` relation as the parent-child relation.
- `extends.source_id` is the parent todo id, and `extends.target_id` is the child todo id.
- A todo can have at most one parent in tree mode.
- Dragging a todo onto another todo reparents it by replacing its previous `extends` parent relation with a new one.
- Deleting from the tree deletes the todo itself after confirmation, using the existing delete flow.
- The right side reuses existing detail and edit behavior rather than introducing a new full inline editor.
- Tree mode is a fourth `ViewMode`, alongside `card`, `compact`, and `content-focus`.

## User Experience

The toolbar view segmented control adds a `tree` option labeled `树形` with a tree-style icon. Selecting it switches the main content area into tree mode.

Tree mode ignores the active status tab for its primary dataset and displays todos across all statuses. This is intentional because the user asked for all status groups to be visible together. Existing global search and owner filters may still narrow the tree if wired through the same top-level filtered dataset, but the implementation should avoid status-tab filtering in tree mode.

The tree view uses a two-pane layout:

- Left pane: hierarchical todo tree.
- Right pane: selected todo details.

Each tree node displays compact scanning information: title, status, priority, and optional owner. Node actions include add child, edit, and delete. Add child opens the existing todo form; after the new todo is created, an `extends` relation is created from the selected parent to the new todo. Edit opens the existing edit flow. Delete shows a confirmation and then deletes the todo.

Clicking a node selects it and renders its details on the right. The right pane should use the same detail conventions as `TodoViewDrawer` where practical, but embedded in the tree view instead of opening a drawer. If extracting a reusable detail component is too large for the first pass, the implementation can use a compact read-only detail panel and keep full editing through the existing form.

## Data Model

No new database table or todo field is required.

Tree relationships are derived from `TodoRelation[]` where `relation_type === 'extends'`.

Single-parent enforcement happens when creating or moving a tree parent relation:

1. Find any existing `extends` relation whose `target_id` equals the child todo id.
2. Delete those relations, except the relation being replaced if it already matches the requested parent.
3. Create the requested `extends` relation if it does not already exist.

The existing `background` relation is not used to build the editable tree. It can continue to exist for existing relation UI semantics, but tree mode should treat `extends` as the canonical hierarchy to avoid ambiguous parentage.

## Tree Building

Build the tree in renderer-side pure logic from the already loaded `todos` and `relations`, rather than relying on the current `relations:buildTree` IPC implementation. This keeps the tree immediately responsive to local relation state and avoids inheriting the existing mixed `background`/`extends` root detection ambiguity.

Algorithm:

1. Create a map of todo id to tree node.
2. Read all `extends` relations whose source and target todos both exist.
3. For each child id, keep one parent relation. If corrupted data contains multiple parents, choose the newest relation if `created_at` is available, otherwise the last relation in input order.
4. Attach each child to its chosen parent.
5. Roots are todos without a chosen parent.
6. Sort siblings using the current tree display sort, initially by todo creation time descending or by the existing app default comparator.

Cycle handling:

- Tree building must not recurse through cycles.
- If corrupted data would form a cycle, break the cycle for display by treating the moved or repeated node as a root and marking the situation in development logs.
- Drag/drop validation prevents new cycles from being created.

## Drag And Drop

Dragging a tree node onto another tree node makes the dragged node a child of the drop target.

Validation rules:

- Cannot drag a node onto itself.
- Cannot drag a node onto one of its descendants.
- Cannot drag if either todo no longer exists.
- Dropping onto the same current parent is a no-op.

After a valid drop:

1. Optimistically update local relation state if the existing app state pattern allows it.
2. Delete the dragged todo's old `extends` parent relation if present.
3. Create the new `extends` relation.
4. Refresh global relations via `loadRelations()`.
5. Show a concise success or error message.

The implementation should use the existing `@dnd-kit` dependency, since the project already uses it for drag/drop lists.

## Component Boundaries

Add focused tree utilities under renderer utilities, for example:

- `src/renderer/utils/todoTree.ts`
  - `buildTodoTree(todos, relations)`
  - `getDescendantIds(treeOrNode)`
  - `canReparentTodo(childId, newParentId, tree)`
  - `getCurrentParentRelation(childId, relations)`

Add a focused component:

- `src/renderer/components/TodoTreeView.tsx`

Expected props:

- `todos: Todo[]`
- `relations: TodoRelation[]`
- `loading: boolean`
- `selectedTodo?: Todo | null`
- `onSelectTodo(todo)`
- `onAddChild(parentTodo)`
- `onEdit(todo)`
- `onDelete(todo)`
- `onReparent(childTodoId, parentTodoId)`

`App.tsx` owns data mutation and passes handlers down, matching existing IPC-first state ownership.

## App Integration

`Toolbar.tsx` extends `ViewMode` to include `tree` and adds the segmented option.

`App.tsx` adds a render branch for tree mode. In this branch, pass all loaded todos after non-status global filters, plus the global `relations` state, to `TodoTreeView`.

`App.tsx` adds a tree-specific create path so that adding a child can remember the selected parent while the existing `TodoForm` is open. After `handleCreateTodo` returns the created todo, create the parent-child relation and refresh relations.

If the current `handleCreateTodo` does not return the created todo, adjust it to return the created `Todo` while preserving existing call sites.

## Error Handling

- Show an empty state if there are no todos.
- Show a clear empty state in the right pane when no todo is selected.
- Failed relation changes should restore or refresh state from storage.
- Reparent cycle attempts should be blocked before IPC calls and show a warning.
- Delete confirmation should identify the todo title.

## Testing

Use TDD for the implementation.

Primary tests should cover pure tree utility behavior:

- Builds roots and children from `extends` relations.
- Ignores `parallel` and `background` for the editable hierarchy.
- Enforces single parent by selecting one parent for display when data is inconsistent.
- Detects descendants for drag validation.
- Blocks moving a node under itself or its descendant.
- Allows moving a node under a different valid parent.

Add component tests only where practical, focused on important behavior rather than visual implementation details:

- Tree mode renders all statuses together.
- Selecting a node shows details in the right pane.

Run at minimum:

- `npm run build:renderer`
- `npm run build:main`

If the existing test runner is available and relevant tests can be targeted, run those as well.

## Out Of Scope

- No new graph database schema.
- No support for multiple parents in tree mode.
- No visual flowchart-style canvas.
- No full custom inline rich-text editor inside the tree right pane for the first implementation.
- No migration of existing `background` relations into `extends` relations.
