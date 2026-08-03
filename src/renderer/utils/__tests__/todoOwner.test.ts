import { Todo } from '../../../shared/types';
import {
  UNASSIGNED_OWNER_FILTER,
  collectTodoOwners,
  getTodoOwnerAvatarText,
  getTodoOwnerColor,
  matchesTodoOwner,
  normalizeTodoOwner,
} from '../todoOwner';

describe('todoOwner utilities', () => {
  it('normalizes owners and removes empty values', () => {
    expect(normalizeTodoOwner('  张三  ')).toBe('张三');
    expect(normalizeTodoOwner('   ')).toBeUndefined();
    expect(normalizeTodoOwner(undefined)).toBeUndefined();
  });

  it('collects distinct normalized owners', () => {
    expect(
      collectTodoOwners([
        { owner: '张三' },
        { owner: ' 张三 ' },
        { owner: '李四' },
        {},
      ] as Todo[])
    ).toEqual(['张三', '李四']);
  });

  it('builds avatar text from the first visible owner character', () => {
    expect(getTodoOwnerAvatarText('张三')).toBe('张');
    expect(getTodoOwnerAvatarText('欧阳娜娜')).toBe('欧');
    expect(getTodoOwnerAvatarText('Zhang San')).toBe('Z');
    expect(getTodoOwnerAvatarText('alice')).toBe('A');
  });

  it('returns deterministic colors', () => {
    expect(getTodoOwnerColor('张三')).toBe(getTodoOwnerColor('张三'));
    expect(getTodoOwnerColor('张三')).not.toBe('');
  });

  it('matches owner filters including unassigned', () => {
    expect(matchesTodoOwner({ owner: '张三' } as Todo, 'all')).toBe(true);
    expect(matchesTodoOwner({ owner: '张三' } as Todo, '张三')).toBe(true);
    expect(matchesTodoOwner({ owner: '李四' } as Todo, '张三')).toBe(false);
    expect(matchesTodoOwner({ owner: undefined } as Todo, UNASSIGNED_OWNER_FILTER)).toBe(true);
    expect(matchesTodoOwner({ owner: '   ' } as Todo, UNASSIGNED_OWNER_FILTER)).toBe(true);
    expect(matchesTodoOwner({ owner: '张三' } as Todo, UNASSIGNED_OWNER_FILTER)).toBe(false);
  });
});
