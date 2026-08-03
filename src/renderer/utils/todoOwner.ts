import { Todo } from '../../shared/types';

export const UNASSIGNED_OWNER_FILTER = '__unassigned__';

export type OwnerFilter = 'all' | typeof UNASSIGNED_OWNER_FILTER | string;

const OWNER_AVATAR_COLORS = [
  '#1677ff',
  '#13a8a8',
  '#52c41a',
  '#722ed1',
  '#eb2f96',
  '#fa8c16',
  '#2f54eb',
  '#389e0d',
];

export function normalizeTodoOwner(owner?: string | null): string | undefined {
  const normalized = owner?.trim();
  return normalized ? normalized : undefined;
}

export function collectTodoOwners(todos: Todo[]): string[] {
  const owners = new Set<string>();

  todos.forEach((todo) => {
    const owner = normalizeTodoOwner(todo.owner);
    if (owner) {
      owners.add(owner);
    }
  });

  return Array.from(owners);
}

export function getTodoOwnerAvatarText(owner?: string | null): string {
  const normalized = normalizeTodoOwner(owner);
  if (!normalized) {
    return '';
  }

  const compact = normalized.replace(/\s+/g, '');
  return Array.from(compact)[0]?.toUpperCase() ?? '';
}

export function getTodoOwnerColor(owner?: string | null): string {
  const normalized = normalizeTodoOwner(owner);
  if (!normalized) {
    return OWNER_AVATAR_COLORS[0];
  }

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return OWNER_AVATAR_COLORS[hash % OWNER_AVATAR_COLORS.length];
}

export function matchesTodoOwner(todo: Todo, ownerFilter: OwnerFilter): boolean {
  if (ownerFilter === 'all') {
    return true;
  }

  const normalizedOwner = normalizeTodoOwner(todo.owner);

  if (ownerFilter === UNASSIGNED_OWNER_FILTER) {
    return !normalizedOwner;
  }

  return normalizedOwner === normalizeTodoOwner(ownerFilter);
}
