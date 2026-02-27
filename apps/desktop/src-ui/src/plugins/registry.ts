import './_framework'; // 注册插件框架层翻译
import './loader'; // 自动发现并加载所有插件（触发 registerPlugin 自注册）

import type { DocumentPlugin } from './types';
import type { PluginManifest, Document } from '@aidocplus/shared-types';
import { DEFAULT_DOC_PLUGINS } from './constants';
import { PLUGIN_MAP, registerPlugin } from './pluginStore';

// 重新导出，供外部使用
export { registerPlugin };

/** 插件内容片段（toFragments 返回值） */
export interface PluginFragment {
  title: string;
  markdown: string;
}

/**
 * 从 manifest 列表构建运行时插件列表
 * manifest 控制插件的启用/禁用，插件定义来自各插件的 index.ts
 */
export function buildPluginList(manifests: PluginManifest[]): DocumentPlugin[] {
  const result: DocumentPlugin[] = [];
  for (const m of manifests) {
    if (!m.enabled) continue;
    const plugin = PLUGIN_MAP.get(m.id);
    if (!plugin) continue;
    result.push(plugin);
  }
  return result;
}

/**
 * 运行时插件列表（由 store 初始化后填充）
 */
let _plugins: DocumentPlugin[] = [];

export function setPlugins(plugins: DocumentPlugin[]) {
  _plugins = plugins;
}

export function getPlugins(): DocumentPlugin[] {
  return _plugins;
}

/**
 * 获取所有已启用插件（供管理面板使用）
 */
export function getAllPlugins(): DocumentPlugin[] {
  return _plugins;
}

/**
 * 根据 ID 查找插件
 */
export function getPluginById(id: string): DocumentPlugin | undefined {
  return _plugins.find(p => p.id === id);
}

/**
 * 根据文档的 enabledPlugins 过滤插件列表
 * - enabledPlugins 为 undefined → 使用 DEFAULT_DOC_PLUGINS
 * - enabledPlugins 为 [] → 返回空
 * - 保持 enabledPlugins 数组顺序
 */
export function getPluginsForDocument(doc: Document): DocumentPlugin[] {
  const ids = doc.enabledPlugins ?? DEFAULT_DOC_PLUGINS;
  const result: DocumentPlugin[] = [];
  for (const id of ids) {
    const plugin = _plugins.find(p => p.id === id);
    if (plugin) result.push(plugin);
  }
  return result;
}

/**
 * 按分类和搜索关键词过滤插件
 * - category 为 'all' 或 undefined 时不过滤分类
 * - search 对 name + tags + description 做模糊匹配
 */
export function filterPlugins(
  plugins: DocumentPlugin[],
  opts: { category?: string; search?: string },
  manifests: PluginManifest[],
): DocumentPlugin[] {
  let result = plugins;

  if (opts.category && opts.category !== 'all') {
    const manifestMap = new Map(manifests.map(m => [m.id, m]));
    result = result.filter(p => {
      const m = manifestMap.get(p.id);
      return m?.category === opts.category;
    });
  }

  if (opts.search && opts.search.trim()) {
    const q = opts.search.toLowerCase().trim();
    const manifestMap = new Map(manifests.map(m => [m.id, m]));
    result = result.filter(p => {
      const m = manifestMap.get(p.id);
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description?.toLowerCase().includes(q)) return true;
      if (m?.tags?.some(t => t.toLowerCase().includes(q))) return true;
      if (m?.description?.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  return result;
}
