import {
  createRelationForModalSelection,
  createRelationForNewTodoPlacement,
  getDisplayRelationForTodo
} from './relationDirection';
import { TodoRelation } from './types';

describe('relationDirection', () => {
  it('creates a new child todo as target of the selected parent for extends relations', () => {
    expect(createRelationForNewTodoPlacement('child', 'parent', 'extends')).toEqual({
      source_id: 'parent',
      target_id: 'child',
      relation_type: 'extends'
    });
  });

  it('keeps parallel placement directional storage unchanged', () => {
    expect(createRelationForNewTodoPlacement('new-todo', 'existing-todo', 'parallel')).toEqual({
      source_id: 'new-todo',
      target_id: 'existing-todo',
      relation_type: 'parallel'
    });
  });

  it('creates modal child relations with current todo as parent', () => {
    expect(createRelationForModalSelection('parent', 'child', 'extends')).toEqual({
      source_id: 'parent',
      target_id: 'child',
      relation_type: 'extends'
    });
  });

  it('displays extends targets as children and sources as parents', () => {
    const relation: TodoRelation = {
      id: 'rel-1',
      source_id: 'parent',
      target_id: 'child',
      relation_type: 'extends',
      created_at: '2026-07-21T00:00:00.000Z'
    };

    const findTodo = (id: string) => ({ id, title: id });

    expect(getDisplayRelationForTodo('parent', relation, findTodo)).toEqual({
      relatedTodo: { id: 'child', title: 'child' },
      displayType: 'extends'
    });

    expect(getDisplayRelationForTodo('child', relation, findTodo)).toEqual({
      relatedTodo: { id: 'parent', title: 'parent' },
      displayType: 'background'
    });
  });
});
