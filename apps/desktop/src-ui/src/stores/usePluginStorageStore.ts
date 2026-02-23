import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

/**
 * 插件独立持久化存储
 * 所有插件的设置和状态通过此 store 独立存储，按 pluginId 命名空间隔离。
 * 数据结构：{ [pluginId]: { [key]: value } }
 * 存储位置：~/AiDocPlus/plugin-storage.json
 */

/**
 * 底层 storage adapter：通过 Tauri 后端读写 ~/AiDocPlus/plugin-storage.json
 */
const tauriPluginRawStorage: {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
} = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const json = await invoke<string | null>('load_plugin_storage');
      if (json) return json;
      const legacy = localStorage.getItem(name);
      if (legacy) {
        await invoke('save_plugin_storage', { json: legacy }).catch(() => {});
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
      await invoke('save_plugin_storage', { json: value });
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await invoke('save_plugin_storage', { json: '{}' });
    } catch {
      localStorage.removeItem(name);
    }
  },
};

interface PluginStorageState {
  data: Record<string, Record<string, unknown>>;

  /** 读取插件数据 */
  getPluginData: <T = unknown>(pluginId: string, key: string) => T | null;
  /** 写入插件数据 */
  setPluginData: (pluginId: string, key: string, value: unknown) => void;
  /** 删除插件数据的指定 key */
  removePluginData: (pluginId: string, key: string) => void;
  /** 清空指定插件的所有数据 */
  clearPluginData: (pluginId: string) => void;
}

export const usePluginStorageStore = create<PluginStorageState>()(
  persist(
    (set, get) => ({
      data: {},

      getPluginData: <T = unknown>(pluginId: string, key: string): T | null => {
        const pluginData = get().data[pluginId];
        if (!pluginData || !(key in pluginData)) return null;
        return pluginData[key] as T;
      },

      setPluginData: (pluginId: string, key: string, value: unknown) => {
        set((state) => ({
          data: {
            ...state.data,
            [pluginId]: {
              ...(state.data[pluginId] || {}),
              [key]: value,
            },
          },
        }));
      },

      removePluginData: (pluginId: string, key: string) => {
        set((state) => {
          const pluginData = { ...(state.data[pluginId] || {}) };
          delete pluginData[key];
          return {
            data: {
              ...state.data,
              [pluginId]: pluginData,
            },
          };
        });
      },

      clearPluginData: (pluginId: string) => {
        set((state) => {
          const newData = { ...state.data };
          delete newData[pluginId];
          return { data: newData };
        });
      },
    }),
    {
      name: 'aidocplus-plugin-storage',
      storage: createJSONStorage(() => tauriPluginRawStorage),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Record<string, any>;
        return { ...current, data: saved.data || {} };
      },
    }
  )
);
