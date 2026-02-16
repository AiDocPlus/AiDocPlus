/**
 * 插件自动发现与加载器
 *
 * 使用 Vite 的 import.meta.glob 自动发现所有插件目录下的 index.ts，
 * eager 模式会立即执行各插件的 registerPlugin() 自注册。
 *
 * 同时发现所有 manifest.json，提供 syncManifestsToBackend() 将 manifest
 * 同步到后端磁盘（幂等），供后端 list_plugins 扫描使用。
 */
import { invoke } from '@tauri-apps/api/core';

// ── 自动发现并加载所有插件（排除 _framework 目录） ──
// eager: true → 模块在 import 时立即执行，触发各插件的 registerPlugin()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pluginModules = import.meta.glob(
  ['./**/index.ts', '!./_framework/**'],
  { eager: true }
);
void _pluginModules;

// ── 自动发现所有插件的 manifest.json ──
const _manifestModules = import.meta.glob(
  ['./**/manifest.json', '!./_framework/**'],
  { eager: true }
);

/**
 * 将所有插件的 manifest 同步到后端磁盘（幂等）
 * 应在 loadPlugins 之前调用
 */
export async function syncManifestsToBackend(): Promise<void> {
  const manifests = Object.values(_manifestModules).map(
    (m) => (m as { default: unknown }).default
  );
  if (manifests.length === 0) return;
  try {
    await invoke('sync_plugin_manifests', { manifests });
  } catch (e) {
    console.error('[PluginLoader] Failed to sync manifests to backend:', e);
  }
}

/**
 * 获取所有已发现的 manifest（前端侧）
 */
export function getDiscoveredManifests(): unknown[] {
  return Object.values(_manifestModules).map(
    (m) => (m as { default: unknown }).default
  );
}
