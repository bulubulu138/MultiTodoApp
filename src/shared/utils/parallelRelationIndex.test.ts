import { TodoRelation } from '../types';
import { buildParallelRelationIndex } from './parallelRelationIndex';

const relation = (source_id: string | number, target_id: string | number): TodoRelation => ({
  source_id,
  target_id,
  relation_type: 'parallel'
});

describe('buildParallelRelationIndex', () => {
  it('returns empty indexes when there are no parallel relations', () => {
    const index = buildParallelRelationIndex([
      { ...relation('a', 'b'), relation_type: 'extends' }
    ]);

    expect(index.parallelAdjacency.size).toBe(0);
    expect(index.parallelGroupByTodo.size).toBe(0);
    expect(index.hasParallelByTodo.size).toBe(0);
  });

  it('builds one connected group for a chained relation graph', () => {
    const index = buildParallelRelationIndex([
      relation('a', 'b'),
      relation('b', 'c'),
      relation('c', 'd')
    ]);

    expect(index.parallelGroupByTodo.get('a')).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(index.parallelGroupByTodo.get('d')).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(index.hasParallelByTodo).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('keeps separate connected components separate and handles cycles', () => {
    const index = buildParallelRelationIndex([
      relation('a', 'b'),
      relation('b', 'a'),
      relation('x', 'y')
    ]);

    expect(index.parallelGroupByTodo.get('a')).toEqual(new Set(['a', 'b']));
    expect(index.parallelGroupByTodo.get('b')).toEqual(new Set(['a', 'b']));
    expect(index.parallelGroupByTodo.get('x')).toEqual(new Set(['x', 'y']));
    expect(index.parallelGroupByTodo.get('y')).toEqual(new Set(['x', 'y']));
  });

  it('normalizes mixed numeric and string ids', () => {
    const index = buildParallelRelationIndex([
      relation(1, '2'),
      relation('2', 3)
    ]);

    expect(index.parallelAdjacency.get('1')).toEqual(new Set(['2']));
    expect(index.parallelAdjacency.get('2')).toEqual(new Set(['1', '3']));
    expect(index.parallelGroupByTodo.get('3')).toEqual(new Set(['1', '2', '3']));
  });
});
