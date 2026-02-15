import type { Document } from '@aidocplus/shared-types';
import { getPluginsForDocument } from './registry';

/** 单个内容片段 */
export interface ContentFragment {
  id: string;           // pluginId + index
  pluginId: string;
  pluginName: string;
  pluginIcon?: React.ComponentType<{ className?: string }>;
  title: string;
  markdown: string;
}

/**
 * 获取文档中所有插件产出的内容片段
 * 遍历文档启用的插件，调用各插件的 toFragments 函数
 */
export function getAllFragments(doc: Document): ContentFragment[] {
  const plugins = getPluginsForDocument(doc);
  const fragments: ContentFragment[] = [];

  for (const plugin of plugins) {
    const pluginData = doc.pluginData?.[plugin.id];
    if (pluginData == null) continue;
    if (!plugin.toFragments) continue;

    const pluginFragments = plugin.toFragments(pluginData);
    for (let i = 0; i < pluginFragments.length; i++) {
      fragments.push({
        id: `${plugin.id}-${i}`,
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginIcon: plugin.icon,
        title: pluginFragments[i].title,
        markdown: pluginFragments[i].markdown,
      });
    }
  }

  return fragments;
}

/**
 * 按插件分组获取片段
 */
export function getFragmentsGroupedByPlugin(doc: Document): Map<string, { pluginName: string; pluginIcon?: React.ComponentType<{ className?: string }>; fragments: ContentFragment[] }> {
  const allFragments = getAllFragments(doc);
  const grouped = new Map<string, { pluginName: string; pluginIcon?: React.ComponentType<{ className?: string }>; fragments: ContentFragment[] }>();

  for (const f of allFragments) {
    if (!grouped.has(f.pluginId)) {
      grouped.set(f.pluginId, { pluginName: f.pluginName, pluginIcon: f.pluginIcon, fragments: [] });
    }
    grouped.get(f.pluginId)!.fragments.push(f);
  }

  return grouped;
}
