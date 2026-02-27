import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@aidocplus/shared-types';
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

/**
 * 底层 storage adapter：通过 Tauri 后端读写 ~/AiDocPlus/settings.json
 * 首次启动时自动从 localStorage 迁移数据
 */
const tauriRawStorage: {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
} = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const json = await invoke<string | null>('load_settings');
      if (json) return json;
      // 首次启动：从 localStorage 迁移
      const legacy = localStorage.getItem(name);
      if (legacy) {
        await invoke('save_settings', { json: legacy }).catch(() => {});
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
      await invoke('save_settings', { json: value });
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await invoke('save_settings', { json: '{}' });
    } catch {
      localStorage.removeItem(name);
    }
  },
};

/**
 * 深度合并：将 saved 的值覆盖到 defaults 上，缺失字段自动用默认值填充。
 * 这替代了旧的 version + migrate() 机制。
 */
function deepMergeDefaults<T extends Record<string, any>>(defaults: T, saved: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(saved) as (keyof T)[]) {
    const savedVal = saved[key];
    const defaultVal = defaults[key];
    if (savedVal !== undefined && savedVal !== null) {
      if (typeof defaultVal === 'object' && !Array.isArray(defaultVal) && defaultVal !== null
          && typeof savedVal === 'object' && !Array.isArray(savedVal) && savedVal !== null) {
        result[key] = deepMergeDefaults(defaultVal, savedVal as any);
      } else {
        result[key] = savedVal as T[keyof T];
      }
    }
  }
  return result;
}

/** 分类节点 */
export interface CategoryItem {
  key: string;
  label: string;
  order: number;
}

/** 用户自定义分类树 */
interface CustomCategories {
  majors: CategoryItem[];
  subs: Record<string, CategoryItem[]>;
}

interface PluginsSettings {
  /** 插件启用状态，key 为插件 id */
  enabled: Record<string, boolean>;
  /** 插件使用频率统计，key 为插件 id，value 为累计使用次数 */
  usageCount: Record<string, number>;
  /** 用户自定义分类（与内置分类合并使用） */
  customCategories?: CustomCategories;
  /** 全局插件显示顺序（插件 ID 数组） */
  pluginOrder?: string[];
}

const DEFAULT_PLUGINS_SETTINGS: PluginsSettings = {
  enabled: {},
  usageCount: {},
};

interface SettingsState extends AppSettings {
  // Settings state
  isLoading: boolean;
  error: string | null;
  plugins: PluginsSettings;

  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  isPluginEnabled: (pluginId: string) => boolean;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  incrementPluginUsage: (pluginId: string) => void;
  getPluginUsageCount: (pluginId: string) => number;
  // 分类管理
  addCategory: (type: 'major' | 'sub', majorKey: string | null, key: string, label: string) => void;
  renameCategory: (type: 'major' | 'sub', majorKey: string | null, key: string, newLabel: string) => void;
  deleteCategory: (type: 'major' | 'sub', majorKey: string | null, key: string) => void;
  reorderCategories: (type: 'major' | 'sub', majorKey: string | null, orderedKeys: string[]) => void;
  // 插件排序
  setPluginOrder: (orderedIds: string[]) => void;
  updateEditorSettings: (settings: Partial<typeof DEFAULT_EDITOR_SETTINGS>) => void;
  updateUISettings: (settings: Partial<typeof DEFAULT_UI_SETTINGS>) => void;
  updateFileSettings: (settings: Partial<typeof DEFAULT_FILE_SETTINGS>) => void;
  updateAISettings: (settings: Partial<typeof DEFAULT_AI_SETTINGS>) => void;
  updateEmailSettings: (settings: Partial<typeof DEFAULT_EMAIL_SETTINGS>) => void;
  updateShortcut: (key: string, value: string) => void;
  resetSettings: () => void;
  resetCategory: (category: 'editor' | 'ui' | 'file' | 'ai') => void;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state from defaults
      editor: { ...DEFAULT_EDITOR_SETTINGS },
      ui: { ...DEFAULT_UI_SETTINGS },
      file: { ...DEFAULT_FILE_SETTINGS },
      ai: { ...DEFAULT_AI_SETTINGS },
      email: { ...DEFAULT_EMAIL_SETTINGS },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
      plugins: { ...DEFAULT_PLUGINS_SETTINGS },
      isLoading: false,
      error: null,

      // Update all settings
      updateSettings: (settings) => {
        set((state) => ({
          editor: settings.editor ?? state.editor,
          ui: settings.ui ?? state.ui,
          file: settings.file ?? state.file,
          ai: settings.ai ?? state.ai,
          email: settings.email ?? state.email,
          shortcuts: settings.shortcuts ?? state.shortcuts
        }));
      },

      // Update editor settings
      updateEditorSettings: (settings) => {
        set((state) => ({
          editor: { ...state.editor, ...settings }
        }));
      },

      // Update UI settings
      updateUISettings: (settings) => {
        set((state) => ({
          ui: { ...state.ui, ...settings }
        }));
      },

      // Update file settings
      updateFileSettings: (settings) => {
        set((state) => ({
          file: { ...state.file, ...settings }
        }));
      },

      // Update AI settings
      updateAISettings: (settings) => {
        set((state) => ({
          ai: { ...state.ai, ...settings }
        }));
      },

      // Update email settings
      updateEmailSettings: (settings) => {
        set((state) => ({
          email: { ...state.email, ...settings }
        }));
      },

      // 判断插件是否启用（默认启用）
      isPluginEnabled: (pluginId) => {
        const plugins = get().plugins || DEFAULT_PLUGINS_SETTINGS;
        return plugins.enabled?.[pluginId] !== false;
      },

      // 设置插件启用/禁用
      setPluginEnabled: (pluginId, enabled) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          return {
            plugins: {
              ...plugins,
              enabled: { ...(plugins.enabled || {}), [pluginId]: enabled }
            }
          };
        });
      },

      // 插件使用计数 +1
      incrementPluginUsage: (pluginId) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          const usageCount = plugins.usageCount || {};
          return {
            plugins: {
              ...plugins,
              usageCount: {
                ...usageCount,
                [pluginId]: (usageCount[pluginId] || 0) + 1,
              }
            }
          };
        });
      },

      // 获取插件使用次数
      getPluginUsageCount: (pluginId) => {
        return get().plugins?.usageCount?.[pluginId] || 0;
      },

      // 添加分类
      addCategory: (type, majorKey, key, label) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          const custom = plugins.customCategories || { majors: [], subs: {} };
          if (type === 'major') {
            const maxOrder = custom.majors.reduce((max, c) => Math.max(max, c.order), 0);
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  majors: [...custom.majors, { key, label, order: maxOrder + 1 }],
                },
              },
            };
          } else {
            if (!majorKey) return {};
            const subs = custom.subs[majorKey] || [];
            const maxOrder = subs.reduce((max, c) => Math.max(max, c.order), 0);
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  subs: {
                    ...custom.subs,
                    [majorKey]: [...subs, { key, label, order: maxOrder + 1 }],
                  },
                },
              },
            };
          }
        });
      },

      // 重命名分类
      renameCategory: (type, majorKey, key, newLabel) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          const custom = plugins.customCategories || { majors: [], subs: {} };
          if (type === 'major') {
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  majors: custom.majors.map(c => c.key === key ? { ...c, label: newLabel } : c),
                },
              },
            };
          } else {
            if (!majorKey) return {};
            const subs = custom.subs[majorKey] || [];
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  subs: {
                    ...custom.subs,
                    [majorKey]: subs.map(c => c.key === key ? { ...c, label: newLabel } : c),
                  },
                },
              },
            };
          }
        });
      },

      // 删除分类
      deleteCategory: (type, majorKey, key) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          const custom = plugins.customCategories || { majors: [], subs: {} };
          if (type === 'major') {
            const newSubs = { ...custom.subs };
            delete newSubs[key];
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  majors: custom.majors.filter(c => c.key !== key),
                  subs: newSubs,
                },
              },
            };
          } else {
            if (!majorKey) return {};
            const subs = custom.subs[majorKey] || [];
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  subs: {
                    ...custom.subs,
                    [majorKey]: subs.filter(c => c.key !== key),
                  },
                },
              },
            };
          }
        });
      },

      // 重新排序分类
      reorderCategories: (type, majorKey, orderedKeys) => {
        set((state) => {
          const plugins = state.plugins || DEFAULT_PLUGINS_SETTINGS;
          const custom = plugins.customCategories || { majors: [], subs: {} };
          if (type === 'major') {
            const majors = custom.majors.map(c => ({
              ...c,
              order: orderedKeys.indexOf(c.key),
            }));
            return {
              plugins: {
                ...plugins,
                customCategories: { ...custom, majors },
              },
            };
          } else {
            if (!majorKey) return {};
            const subs = (custom.subs[majorKey] || []).map(c => ({
              ...c,
              order: orderedKeys.indexOf(c.key),
            }));
            return {
              plugins: {
                ...plugins,
                customCategories: {
                  ...custom,
                  subs: { ...custom.subs, [majorKey]: subs },
                },
              },
            };
          }
        });
      },

      // 设置全局插件显示顺序
      setPluginOrder: (orderedIds) => {
        set((state) => ({
          plugins: {
            ...(state.plugins || DEFAULT_PLUGINS_SETTINGS),
            pluginOrder: orderedIds,
          },
        }));
      },

      // Update a single shortcut
      updateShortcut: (key, value) => {
        set((state) => ({
          shortcuts: { ...state.shortcuts, [key]: value }
        }));
      },

      // Reset all settings to defaults
      resetSettings: () => {
        set({
          editor: { ...DEFAULT_EDITOR_SETTINGS },
          ui: { ...DEFAULT_UI_SETTINGS },
          file: { ...DEFAULT_FILE_SETTINGS },
          ai: { ...DEFAULT_AI_SETTINGS },
          email: { ...DEFAULT_EMAIL_SETTINGS },
          shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
          plugins: { ...DEFAULT_PLUGINS_SETTINGS },
          error: null
        });
      },

      // Reset a specific category
      resetCategory: (category) => {
        const defaults = {
          editor: DEFAULT_EDITOR_SETTINGS,
          ui: DEFAULT_UI_SETTINGS,
          file: DEFAULT_FILE_SETTINGS,
          ai: DEFAULT_AI_SETTINGS
        };
        set({
          [category]: { ...defaults[category as keyof typeof defaults] }
        });
      },

      // Export settings as JSON string
      exportSettings: () => {
        const { editor, ui, file, ai, email, shortcuts } = get();
        return JSON.stringify({ editor, ui, file, ai, email, shortcuts }, null, 2);
      },

      // Import settings from JSON string
      importSettings: (settingsJson) => {
        try {
          const settings = JSON.parse(settingsJson);
          set((state) => ({
            editor: settings.editor ?? state.editor,
            ui: settings.ui ?? state.ui,
            file: settings.file ?? state.file,
            ai: settings.ai ?? state.ai,
            email: settings.email ?? state.email,
            shortcuts: settings.shortcuts ?? state.shortcuts,
            error: null
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to import settings'
          });
          throw error;
        }
      }
    }),
    {
      name: 'aidocplus-settings',
      storage: createJSONStorage(() => tauriRawStorage),
      partialize: (state) => ({
        editor: state.editor,
        ui: state.ui,
        file: state.file,
        ai: state.ai,
        email: state.email,
        shortcuts: state.shortcuts,
        plugins: state.plugins,
      }),
      // 用深度合并替代版本迁移：缺失字段自动用默认值填充，无需 version + migrate()
      merge: (persisted, current) => {
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
        };
      },
    }
  )
);

// Selectors for commonly used settings
export const useEditorSettings = () => useSettingsStore((state) => state.editor);
export const useUISettings = () => useSettingsStore((state) => state.ui);
export const useFileSettings = () => useSettingsStore((state) => state.file);
export const useAISettings = () => useSettingsStore((state) => state.ai);
export const useEmailSettings = () => useSettingsStore((state) => state.email);
export const useShortcuts = () => useSettingsStore((state) => state.shortcuts);
export const usePluginsSettings = () => useSettingsStore((state) => state.plugins);

/**
 * 获取当前激活的 AI 服务的 invoke 调用参数。
 */
export function getAIInvokeParams() {
  const ai = useSettingsStore.getState().ai;
  const service = getActiveService(ai);
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

/**
 * 当 AI 服务配置变化时，自动导出到共享文件供资源管理器等外部工具使用。
 * 文件路径: ~/.aidocplus/ai-services.json
 */
let _lastAiJson = '';
useSettingsStore.subscribe((state) => {
  const ai = state.ai;
  const json = JSON.stringify({ services: ai.services, activeServiceId: ai.activeServiceId, temperature: ai.temperature, maxTokens: ai.maxTokens });
  if (json === _lastAiJson) return;
  _lastAiJson = json;
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('export_ai_services', { json }).catch(() => {});
  });
});

/**
 * 按指定 serviceId 获取 AI 服务的 invoke 调用参数。
 * 为空时回退到全局 activeServiceId。
 */
export function getAIInvokeParamsForService(serviceId?: string) {
  const ai = useSettingsStore.getState().ai;
  let service;
  if (serviceId) {
    service = ai.services.find(s => s.id === serviceId && s.enabled);
  }
  // 回退到全局激活服务
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
