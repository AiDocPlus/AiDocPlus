import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

interface PluginsSettings {
  /** 插件启用状态，key 为插件 id */
  enabled: Record<string, boolean>;
  /** 插件使用频率统计，key 为插件 id，value 为累计使用次数 */
  usageCount: Record<string, number>;
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
      storage: createJSONStorage(() => localStorage),
      // Partial persist - don't persist loading/error states
      partialize: (state) => ({
        editor: state.editor,
        ui: state.ui,
        file: state.file,
        ai: state.ai,
        email: state.email,
        shortcuts: state.shortcuts,
        plugins: state.plugins,
      }),
      version: 8,
      migrate: (persistedState: any, version: number) => {
        if (version < 8) {
          // 迁移: 更新 markdownModePrompt（旧版含“加粗”指令导致 AI 输出不当加粗）
          if (persistedState.ai) {
            persistedState.ai.markdownModePrompt = DEFAULT_AI_SETTINGS.markdownModePrompt;
          }
        }
        if (version < 6) {
          // 迁移: 工具栏按钮全部强制开启
          if (persistedState.editor) {
            persistedState.editor.toolbarButtons = { ...DEFAULT_EDITOR_SETTINGS.toolbarButtons };
          }
        }
        if (version < 5) {
          // 迁移: 确保 ai.markdownMode 字段存在
          if (persistedState.ai && persistedState.ai.markdownMode === undefined) {
            persistedState.ai.markdownMode = true;
          }
        }
        if (version < 4) {
          // 迁移: 确保 email 字段存在
          if (!persistedState.email) {
            persistedState.email = { accounts: [], activeAccountId: '' };
          }
        }
        if (version < 3) {
          // 迁移 v1/v2 -> v3: 将旧的单服务配置转为 services 数组
          const oldAi = persistedState?.ai;
          if (oldAi && !oldAi.services) {
            const provider = oldAi.provider || 'glm';
            // 兼容 v1 (apiKey) 和 v2 (apiKeys)
            const apiKey = oldAi.apiKey || (oldAi.apiKeys && oldAi.apiKeys[provider]) || '';
            const model = oldAi.model || '';
            const baseUrl = oldAi.baseUrl || '';
            const services: any[] = [];
            if (apiKey) {
              services.push({
                id: `svc_${Date.now()}`,
                name: provider,
                provider,
                apiKey,
                model,
                baseUrl,
                enabled: true,
              });
            }
            persistedState.ai = {
              ...DEFAULT_AI_SETTINGS,
              services,
              activeServiceId: services[0]?.id || '',
              temperature: oldAi.temperature ?? 0.7,
              maxTokens: oldAi.maxTokens ?? 2000,
              streamEnabled: oldAi.streamEnabled ?? true,
              systemPrompt: oldAi.systemPrompt || '',
              maxContentLength: oldAi.maxContentLength ?? 0,
            };
          }
        }
        // 确保 plugins 字段存在（旧版本持久化数据可能缺失）
        if (!persistedState.plugins) {
          persistedState.plugins = { enabled: {}, usageCount: {} };
        } else {
          if (!persistedState.plugins.usageCount) {
            persistedState.plugins.usageCount = {};
          }
          if (!persistedState.plugins.enabled) {
            persistedState.plugins.enabled = {};
          }
        }
        return persistedState;
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
