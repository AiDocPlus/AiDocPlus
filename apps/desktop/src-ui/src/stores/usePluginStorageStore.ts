import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 插件独立持久化存储
 * 所有插件的设置和状态通过此 store 独立存储，按 pluginId 命名空间隔离。
 * 数据结构：{ [pluginId]: { [key]: value } }
 */

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
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1 || !persistedState || typeof persistedState !== 'object') {
          return { data: {} };
        }
        return persistedState as PluginStorageState;
      },
    }
  )
);
