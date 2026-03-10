import { invoke } from '@tauri-apps/api/core';

export interface PersistedOpenTab<TChatMessage = unknown> {
  id?: string;
  filePath: string;
  chatMessages?: TChatMessage[];
}

export interface ParsedCodingState<TSettings, TRuntime, TChatMessage = unknown> {
  favorites: string[];
  settings: TSettings;
  recentFiles: string[];
  pythonInfo: TRuntime | null;
  nodeInfo: TRuntime | null;
  activeTabId: string;
  openTabs: PersistedOpenTab<TChatMessage>[];
}

export async function getCodingScriptsDirCommand(): Promise<string> {
  return invoke<string>('get_coding_scripts_dir');
}

export async function loadCodingStateCommand(): Promise<string | null> {
  return invoke<string | null>('load_coding_state');
}

export async function saveCodingStateCommand(json: string): Promise<void> {
  await invoke('save_coding_state', { json });
}

export async function readCodingScriptCommand(filePath: string): Promise<string> {
  return invoke<string>('read_coding_script', { filePath });
}

export async function saveCodingScriptCommand(filePath: string, content: string): Promise<void> {
  await invoke('save_coding_script', { filePath, content });
}

export async function checkPythonCommand(customPath: string): Promise<unknown> {
  return invoke('check_python', { customPath: customPath || null });
}

export async function checkNodeCommand(customPath: string): Promise<unknown> {
  return invoke('check_nodejs', { customPath: customPath || null });
}

export function parsePersistedCodingState<
  TSettings extends Record<string, any>,
  TRuntime,
  TChatMessage = unknown,
>(
  json: string | null,
  defaultSettings: TSettings,
): ParsedCodingState<TSettings, TRuntime, TChatMessage> {
  const fallback: ParsedCodingState<TSettings, TRuntime, TChatMessage> = {
    favorites: [],
    settings: { ...defaultSettings },
    recentFiles: [],
    pythonInfo: null,
    nodeInfo: null,
    activeTabId: '',
    openTabs: [],
  };

  if (!json) {
    return fallback;
  }

  try {
    const state = JSON.parse(json) as Record<string, any>;
    return {
      favorites: Array.isArray(state.favorites) ? state.favorites : [],
      settings: { ...defaultSettings, ...(state.settings || {}) },
      recentFiles: Array.isArray(state.recentFiles) ? state.recentFiles.slice(0, 20) : [],
      pythonInfo: state.pythonInfo || null,
      nodeInfo: state.nodeInfo || null,
      activeTabId: state.activeTabId || '',
      openTabs: Array.isArray(state.openTabs) ? state.openTabs : [],
    };
  } catch {
    return fallback;
  }
}

export function buildCodingStateSnapshot<
  TTab extends { id: string; filePath: string; chatMessages?: TChatMessage[] },
  TSettings,
  TRuntime,
  TChatMessage = unknown,
>(params: {
  tabs: TTab[];
  activeTabId: string;
  favorites: string[];
  settings: TSettings;
  recentFiles: string[];
  pythonInfo: TRuntime | null;
  nodeInfo: TRuntime | null;
}): string {
  return JSON.stringify(
    {
      openTabs: params.tabs.map(tab => ({
        id: tab.id,
        filePath: tab.filePath,
        chatMessages: tab.chatMessages || [],
      })),
      activeTabId: params.activeTabId,
      favorites: params.favorites,
      settings: params.settings,
      recentFiles: params.recentFiles,
      pythonInfo: params.pythonInfo,
      nodeInfo: params.nodeInfo,
    },
    null,
    2,
  );
}

export function ensureActiveItemId<TItem extends { id: string }>(items: TItem[], activeId: string): string {
  if (!activeId || !items.find(item => item.id === activeId)) {
    return items[0]?.id || '';
  }
  return activeId;
}

export function removeItemWithActiveFallback<TItem extends { id: string }>(
  items: TItem[],
  activeId: string,
  removeId: string,
): { items: TItem[]; activeId: string } {
  const nextItems = items.filter(item => item.id !== removeId);
  let nextActiveId = activeId;
  if (nextActiveId === removeId) {
    const removedIndex = items.findIndex(item => item.id === removeId);
    nextActiveId = nextItems[Math.min(removedIndex, nextItems.length - 1)]?.id || '';
  }
  return {
    items: nextItems,
    activeId: nextActiveId,
  };
}

export function updateItemById<TItem extends { id: string }>(
  items: TItem[],
  itemId: string,
  patch: Partial<TItem>,
): TItem[] {
  return items.map(item => (item.id === itemId ? { ...item, ...patch } : item));
}

export function reorderItemsById<TItem extends { id: string }>(
  items: TItem[],
  fromId: string,
  toId: string,
): TItem[] {
  const nextItems = [...items];
  const fromIndex = nextItems.findIndex(item => item.id === fromId);
  const toIndex = nextItems.findIndex(item => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return items;
  }
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

export function toggleStringInList(items: string[], value: string): string[] {
  return items.includes(value) ? items.filter(item => item !== value) : [...items, value];
}

export function prependRecentFile(items: string[], filePath: string, limit = 20): string[] {
  const filtered = items.filter(item => item !== filePath);
  return [filePath, ...filtered].slice(0, limit);
}

export function prependLimitedEntry<TEntry>(items: TEntry[], entry: TEntry, limit: number): TEntry[] {
  return [entry, ...items].slice(0, limit);
}

export function createRuntimeCheckFailure(error: unknown) {
  return {
    available: false,
    version: null,
    path: null,
    error: String(error),
  };
}
