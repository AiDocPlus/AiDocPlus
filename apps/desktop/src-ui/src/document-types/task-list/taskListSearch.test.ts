import { describe, expect, it } from 'vitest';
import type { TaskItem } from './types';
import {
  filterCompletedForDisplay,
  filterPendingForDisplay,
  filterTasksByContentSearch,
  normalizePriorityFilterFromStorage,
  normalizeTaskSearchQuery,
} from './taskListSearch';

function task(partial: Partial<TaskItem> & Pick<TaskItem, 'id' | 'content'>): TaskItem {
  return {
    priority: 'medium',
    status: 'pending',
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('normalizePriorityFilterFromStorage', () => {
  it('accepts all and high', () => {
    expect(normalizePriorityFilterFromStorage('all')).toBe('all');
    expect(normalizePriorityFilterFromStorage('high')).toBe('high');
  });
  it('falls back for garbage', () => {
    expect(normalizePriorityFilterFromStorage(null)).toBe('all');
    expect(normalizePriorityFilterFromStorage('')).toBe('all');
    expect(normalizePriorityFilterFromStorage({})).toBe('all');
    expect(normalizePriorityFilterFromStorage('medium')).toBe('all');
  });
});

describe('normalizeTaskSearchQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeTaskSearchQuery('  Foo ')).toBe('foo');
  });
});

describe('filterTasksByContentSearch', () => {
  it('returns all when query empty', () => {
    const tasks = [task({ id: '1', content: 'A' })];
    expect(filterTasksByContentSearch(tasks, '')).toEqual(tasks);
  });
  it('matches case-insensitively', () => {
    const tasks = [task({ id: '1', content: 'Hello World' })];
    expect(filterTasksByContentSearch(tasks, 'hello')).toEqual(tasks);
    expect(filterTasksByContentSearch(tasks, 'xyz')).toEqual([]);
  });
});

describe('filterPendingForDisplay', () => {
  const pending = [
    task({ id: '1', content: 'buy milk', priority: 'high', status: 'pending' }),
    task({ id: '2', content: 'read book', priority: 'low', status: 'pending' }),
  ];
  it('filters by priority then search', () => {
    expect(filterPendingForDisplay(pending, 'high', '').map((t) => t.id)).toEqual(['1']);
    expect(filterPendingForDisplay(pending, 'all', 'book').map((t) => t.id)).toEqual(['2']);
    expect(filterPendingForDisplay(pending, 'high', 'milk').map((t) => t.id)).toEqual(['1']);
    expect(filterPendingForDisplay(pending, 'high', 'book')).toEqual([]);
  });
});

describe('filterCompletedForDisplay', () => {
  it('filters completed by search only', () => {
    const list = [
      task({ id: '1', content: 'done A', status: 'completed' }),
      task({ id: '2', content: 'done B', status: 'completed' }),
    ];
    expect(filterCompletedForDisplay(list, 'a').map((t) => t.id)).toEqual(['1']);
  });
});
