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

function isCjkCharacter(char: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

export function getTodoOwnerAvatarText(owner?: string | null): string {
  const normalized = normalizeTodoOwner(owner);
  if (!normalized) {
    return '';
  }

  const compact = normalized.replace(/\s+/g, '');
  const cjkCharacters = Array.from(compact).filter(isCjkCharacter);
  if (cjkCharacters.length > 0) {
    return cjkCharacters.slice(-2).join('');
  }

  const parts = normalized
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  return parts[0]?.charAt(0).toUpperCase() ?? compact.charAt(0).toUpperCase();
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
