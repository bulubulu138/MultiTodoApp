# Compact Child Nesting Design

## Goal

In compact todo mode, child todos should appear directly under their parent todo with one indentation level per generation. Apart from this visual nesting and adjacency, compact mode should keep its existing behavior: sorting, display order numbers, title editing, status controls, and dragging remain available.

## Relationship Rule

Use existing `extends` relations as the parent-child source. A relation with `source_id` as parent and `target_id` as child means the target todo should render under the source todo in compact mode.

## Rendering Design

Compact mode first applies the existing sort order. Then a compact-only flattening pass inserts each todo's children directly after that todo. Children are sorted by the same existing sorted order as their siblings. Nested children repeat the same rule and increase indentation by one level each generation.

The flattening pass is display-only. It does not change database order, relation data, or todo records.

## Safety

The flattening pass tracks visited todo IDs to avoid duplicate rendering and infinite loops if relation data contains cycles. Relations pointing to todos outside the current tab's filtered list are ignored for this view.

## UI

`CompactTodoItem` receives an `indentLevel` prop and applies left padding based on that level. No other special styling is added for child todos.

## Testing

Add a focused pure-function test for the flattening pass. It should verify that a child is moved directly below its parent, grandchildren receive deeper levels, and unrelated todos keep the existing sorted order.
