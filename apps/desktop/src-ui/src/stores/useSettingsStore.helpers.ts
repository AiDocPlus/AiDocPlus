import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_SETTINGS,
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_UI_SETTINGS,
  DEFAULT_FILE_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_EMAIL_SETTINGS,
  getProviderConfig,
  getActiveService,
} from '@aidocplus/shared-types';
import type { AppSettings, AIProvider } from '@aidocplus/shared-types';

export interface CategoryItem {
  key: string;
  label: string;
  order: number;
}

export interface CustomCategories {
  majors: CategoryItem[];
  subs: Record<string, CategoryItem[]>;
}

export interface PluginsSettings {
  enabled: Record<string, boolean>;
  usageCount: Record<string, number>;
  customCategories?: CustomCategories;
  pluginOrder?: string[];
}

export interface AIInvokeParams {
  provider: AIProvider | undefined;
  apiKey: string | undefined;
  model: string | undefined;
  baseUrl: string | undefined;
}

export type SettingsSnapshot = Pick<AppSettings, 'editor' | 'ui' | 'file' | 'ai' | 'email' | 'shortcuts'>;

export type SettingsStorageAdapter = {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
};

export function createTauriBackedStorageAdapter(args: {
  loadCommand: string;
  saveCommand: string;
  clearValue: string;
}): SettingsStorageAdapter {
  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const json = await invoke<string | null>(args.loadCommand);
        if (json) return json;
        const legacy = localStorage.getItem(name);
        if (legacy) {
          await invoke(args.saveCommand, { json: legacy }).catch(() => {});
          localStorage.removeItem(name);
          return legacy;
        }
        return null;
      } catch {
        return localStorage.getItem(name);
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        await invoke(args.saveCommand, { json: value });
      } catch {
        localStorage.setItem(name, value);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await invoke(args.saveCommand, { json: args.clearValue });
      } catch {
        localStorage.removeItem(name);
      }
    },
  };
}

export const DEFAULT_PLUGINS_SETTINGS: PluginsSettings = {
  enabled: {},
  usageCount: {},
};

export const tauriSettingsStorage: SettingsStorageAdapter = createTauriBackedStorageAdapter({
  loadCommand: 'load_settings',
  saveCommand: 'save_settings',
  clearValue: '{}',
});

type MergeableSettingsSections = Pick<AppSettings, 'editor' | 'ui' | 'file' | 'ai' | 'email'>;

export function pickSettingsSnapshot(settings: SettingsSnapshot): SettingsSnapshot {
  return {
    editor: settings.editor,
    ui: settings.ui,
    file: settings.file,
    ai: settings.ai,
    email: settings.email,
    shortcuts: settings.shortcuts,
  };
}

export function mergeSettingsSnapshot(
  current: SettingsSnapshot,
  patch: Partial<AppSettings>,
): SettingsSnapshot {
  return {
    editor: patch.editor ?? current.editor,
    ui: patch.ui ?? current.ui,
    file: patch.file ?? current.file,
    ai: patch.ai ?? current.ai,
    email: patch.email ?? current.email,
    shortcuts: patch.shortcuts ?? current.shortcuts,
  };
}

export function mergeSettingsSectionState<TKey extends keyof MergeableSettingsSections>(
  state: MergeableSettingsSections,
  key: TKey,
  patch: Partial<MergeableSettingsSections[TKey]>,
): Pick<MergeableSettingsSections, TKey> {
  return {
    [key]: {
      ...state[key],
      ...patch,
    },
  } as Pick<MergeableSettingsSections, TKey>;
}

export function deepMergeDefaults<T extends Record<string, any>>(defaults: T, saved: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(saved) as (keyof T)[]) {
    const savedVal = saved[key];
    const defaultVal = defaults[key];
    if (savedVal !== undefined && savedVal !== null) {
      if (
        typeof defaultVal === 'object'
        && !Array.isArray(defaultVal)
        && defaultVal !== null
        && typeof savedVal === 'object'
        && !Array.isArray(savedVal)
        && savedVal !== null
      ) {
        result[key] = deepMergeDefaults(defaultVal, savedVal as any);
      } else {
        result[key] = savedVal as T[keyof T];
      }
    }
  }
  return result;
}

export function createEmptyCustomCategories(): CustomCategories {
  return {
    majors: [],
    subs: {},
  };
}

export function resolvePluginsSettings(plugins?: PluginsSettings): PluginsSettings {
  return plugins || DEFAULT_PLUGINS_SETTINGS;
}

export function resolveCustomCategories(plugins?: PluginsSettings): CustomCategories {
  return plugins?.customCategories || createEmptyCustomCategories();
}

export function buildPluginsPatchState(
  plugins: PluginsSettings | undefined,
  updater: (plugins: PluginsSettings | undefined) => PluginsSettings | null,
): { plugins?: PluginsSettings } {
  const nextPlugins = updater(plugins);
  return nextPlugins ? { plugins: nextPlugins } : {};
}

export function setPluginEnabledState(
  plugins: PluginsSettings | undefined,
  pluginId: string,
  enabled: boolean,
): PluginsSettings {
  const resolved = resolvePluginsSettings(plugins);
  return {
    ...resolved,
    enabled: {
      ...(resolved.enabled || {}),
      [pluginId]: enabled,
    },
  };
}

export function incrementPluginUsageState(
  plugins: PluginsSettings | undefined,
  pluginId: string,
): PluginsSettings {
  const resolved = resolvePluginsSettings(plugins);
  const usageCount = resolved.usageCount || {};
  return {
    ...resolved,
    usageCount: {
      ...usageCount,
      [pluginId]: (usageCount[pluginId] || 0) + 1,
    },
  };
}

export function addPluginCategoryState(
  plugins: PluginsSettings | undefined,
  type: 'major' | 'sub',
  majorKey: string | null,
  key: string,
  label: string,
): PluginsSettings | null {
  const resolved = resolvePluginsSettings(plugins);
  const custom = resolveCustomCategories(resolved);

  if (type === 'major') {
    const maxOrder = custom.majors.reduce((max, category) => Math.max(max, category.order), 0);
    return {
      ...resolved,
      customCategories: {
        ...custom,
        majors: [...custom.majors, { key, label, order: maxOrder + 1 }],
      },
    };
  }

  if (!majorKey) return null;
  const subs = custom.subs[majorKey] || [];
  const maxOrder = subs.reduce((max, category) => Math.max(max, category.order), 0);
  return {
    ...resolved,
    customCategories: {
      ...custom,
      subs: {
        ...custom.subs,
        [majorKey]: [...subs, { key, label, order: maxOrder + 1 }],
      },
    },
  };
}

export function renamePluginCategoryState(
  plugins: PluginsSettings | undefined,
  type: 'major' | 'sub',
  majorKey: string | null,
  key: string,
  newLabel: string,
): PluginsSettings | null {
  const resolved = resolvePluginsSettings(plugins);
  const custom = resolveCustomCategories(resolved);

  if (type === 'major') {
    return {
      ...resolved,
      customCategories: {
        ...custom,
        majors: custom.majors.map(category =>
          category.key === key ? { ...category, label: newLabel } : category,
        ),
      },
    };
  }

  if (!majorKey) return null;
  const subs = custom.subs[majorKey] || [];
  return {
    ...resolved,
    customCategories: {
      ...custom,
      subs: {
        ...custom.subs,
        [majorKey]: subs.map(category =>
          category.key === key ? { ...category, label: newLabel } : category,
        ),
      },
    },
  };
}

export function deletePluginCategoryState(
  plugins: PluginsSettings | undefined,
  type: 'major' | 'sub',
  majorKey: string | null,
  key: string,
): PluginsSettings | null {
  const resolved = resolvePluginsSettings(plugins);
  const custom = resolveCustomCategories(resolved);

  if (type === 'major') {
    const newSubs = { ...custom.subs };
    delete newSubs[key];
    return {
      ...resolved,
      customCategories: {
        ...custom,
        majors: custom.majors.filter(category => category.key !== key),
        subs: newSubs,
      },
    };
  }

  if (!majorKey) return null;
  const subs = custom.subs[majorKey] || [];
  return {
    ...resolved,
    customCategories: {
      ...custom,
      subs: {
        ...custom.subs,
        [majorKey]: subs.filter(category => category.key !== key),
      },
    },
  };
}

export function reorderPluginCategoriesState(
  plugins: PluginsSettings | undefined,
  type: 'major' | 'sub',
  majorKey: string | null,
  orderedKeys: string[],
): PluginsSettings | null {
  const resolved = resolvePluginsSettings(plugins);
  const custom = resolveCustomCategories(resolved);

  if (type === 'major') {
    return {
      ...resolved,
      customCategories: {
        ...custom,
        majors: custom.majors.map(category => ({
          ...category,
          order: orderedKeys.indexOf(category.key),
        })),
      },
    };
  }

  if (!majorKey) return null;
  return {
    ...resolved,
    customCategories: {
      ...custom,
      subs: {
        ...custom.subs,
        [majorKey]: (custom.subs[majorKey] || []).map(category => ({
          ...category,
          order: orderedKeys.indexOf(category.key),
        })),
      },
    },
  };
}

export function setPluginOrderState(
  plugins: PluginsSettings | undefined,
  orderedIds: string[],
): PluginsSettings {
  return {
    ...resolvePluginsSettings(plugins),
    pluginOrder: orderedIds,
  };
}

export function createDefaultSettingsSnapshot() {
  return {
    editor: { ...DEFAULT_EDITOR_SETTINGS },
    ui: { ...DEFAULT_UI_SETTINGS },
    file: { ...DEFAULT_FILE_SETTINGS },
    ai: { ...DEFAULT_AI_SETTINGS },
    email: { ...DEFAULT_EMAIL_SETTINGS },
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
    plugins: { ...DEFAULT_PLUGINS_SETTINGS },
    error: null as string | null,
  };
}

export function resolveResetCategoryState(category: 'editor' | 'ui' | 'file' | 'ai') {
  const defaults = {
    editor: DEFAULT_EDITOR_SETTINGS,
    ui: DEFAULT_UI_SETTINGS,
    file: DEFAULT_FILE_SETTINGS,
    ai: DEFAULT_AI_SETTINGS,
  };

  return {
    [category]: { ...defaults[category] },
  };
}

export function exportSettingsSnapshot(settings: SettingsSnapshot): string {
  return JSON.stringify(settings, null, 2);
}

export function mergeImportedSettings(
  current: SettingsSnapshot,
  imported: Partial<AppSettings>,
) {
  return {
    ...mergeSettingsSnapshot(current, imported),
    error: null as string | null,
  };
}

export function mergePersistedSettings<T extends Record<string, any>>(
  persisted: unknown,
  current: T,
): T {
  const saved = (persisted || {}) as Record<string, any>;
  return {
    ...current,
    editor: deepMergeDefaults(DEFAULT_EDITOR_SETTINGS, saved.editor || {}),
    ui: deepMergeDefaults(DEFAULT_UI_SETTINGS, saved.ui || {}),
    file: deepMergeDefaults(DEFAULT_FILE_SETTINGS, saved.file || {}),
    ai: deepMergeDefaults(DEFAULT_AI_SETTINGS, saved.ai || {}),
    email: deepMergeDefaults(DEFAULT_EMAIL_SETTINGS, saved.email || {}),
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(saved.shortcuts || {}) },
    plugins: {
      enabled: saved.plugins?.enabled || {},
      usageCount: saved.plugins?.usageCount || {},
      customCategories: saved.plugins?.customCategories,
      pluginOrder: saved.plugins?.pluginOrder,
    },
  } as T;
}

export function resolveAIInvokeParams(ai: AppSettings['ai'], serviceId?: string): AIInvokeParams {
  let service;
  if (serviceId) {
    service = ai.services.find(item => item.id === serviceId && item.enabled);
  }
  if (!service) {
    service = getActiveService(ai);
  }
  if (!service) {
    return { provider: undefined, apiKey: undefined, model: undefined, baseUrl: undefined };
  }
  const providerConfig = getProviderConfig(service.provider);
  return {
    provider: service.provider || undefined,
    apiKey: service.apiKey || undefined,
    model: service.model || undefined,
    baseUrl: service.baseUrl || providerConfig?.baseUrl || undefined,
  };
}

export async function exportAiServicesCommand(json: string): Promise<void> {
  await invoke('export_ai_services', { json });
}
