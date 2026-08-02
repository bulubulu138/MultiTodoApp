# Todo Owner Avatar And Filter Design

## Goal

Desktop todos should support one optional owner. When a todo has an owner, every desktop todo view should show a small DingTalk-like name avatar bound to that todo. Users should also be able to filter todos by owner across the same view modes.

## Scope

This change applies only to the desktop app in `D:\todolist\MultiTodoApp`.

The owner model is single-select: each todo can have zero or one owner. Todos without an owner do not show a fallback avatar in list/card/focus views, but they can still be found through an `Unassigned` owner filter.

The mobile project is out of scope for this implementation. The persisted field remains backward-compatible so mobile can be updated later if needed.

## Data Model And Persistence

Add an optional `owner?: string` field to the shared `Todo` type.

Markdown frontmatter parsing and generation should read and write `owner`. Existing todos without `owner` remain valid. Empty or whitespace-only owner values are normalized to no owner and should not be treated as a real person.

The owner value is a plain display name string. There is no separate people registry, profile table, uploaded avatar image, department field, or multi-owner support in this iteration.

## Owner Utilities

Add a small renderer-side utility module for owner behavior:

- Normalize owner names by trimming whitespace.
- Collect distinct owners from todos for form suggestions and filter options.
- Match todos against an owner filter, including an explicit unassigned filter.
- Generate stable avatar display text and color from the owner name.

Chinese names should display the last one or two characters. Latin names should display initials when possible. The same owner name should always produce the same avatar color.

## UI Display

Add a reusable `TodoOwnerAvatar` component. It receives an owner name and renders a compact circular name avatar with a tooltip showing the full owner name. If no owner is present, it renders nothing.

Show the avatar in the title/meta area of the desktop todo render paths:

- Card mode (`TodoCard`)
- Compact mode (`CompactTodoItem` / compact list path)
- Content focus mode (`ContentFocusView`)
- Standard and virtualized list paths where todos are rendered outside those components
- Todo detail drawer

The avatar is informational only. It must not change status controls, ordering controls, relation controls, or drag behavior.

## Form Behavior

Add a `负责人` field to the todo form. It should allow choosing from existing owners and typing a new owner name. The field is single-value and clearable.

On submit, save only the normalized owner name. Clearing the field removes the owner from the todo. Suggestions come from distinct existing owners in the current desktop todo data.

## Filtering Behavior

Add an owner filter control to the main toolbar. Options include all owners, unassigned, and each distinct owner collected from all todos.

Filtering happens in the central `App.tsx` filtering pipeline so all desktop view modes receive the same filtered todo list. Owner filtering combines with existing tab/status/tag filtering, search, and sorting.

The default filter is all owners. Existing status and tab counts do not need to be redefined by owner unless the current code already derives them from the visible filtered list.

## Cache And Index Consistency

Any renderer cache signature that decides whether todo-derived filters or sorted lists should recompute must include `owner`. This prevents stale owner filter options or stale filtered lists after editing a todo owner.

File indexing may include owner metadata if the existing index schema has a natural todo metadata area, but owner search is not required for this iteration. The explicit owner filter is the required behavior.

## Error Handling And Compatibility

Invalid, missing, or empty owner values are treated as unassigned. Old Markdown files without owner frontmatter continue to load normally.

The owner filter should not fail if an owner value appears only on archived, completed, or otherwise currently hidden todos; it should still derive options from the app's loaded todo data.

## Testing

Add focused tests for pure utility behavior where the project test setup supports it:

- Owner normalization and distinct owner collection
- Avatar text generation for Chinese and Latin names
- Owner filter matching, including unassigned todos
- Markdown frontmatter parse/generate round trip for `owner`

Run the existing desktop verification commands after implementation, at minimum TypeScript/build checks available in the project.
