import React from 'react';
import { Image } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const ImagePluginPanel = React.lazy(() => import('./ImagePluginPanel').then(m => ({ default: m.ImagePluginPanel })));
const ImageAssistantPanel = React.lazy(() => import('./ImageAssistantPanel').then(m => ({ default: m.ImageAssistantPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-image', { zh, en });

export const imagePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '图片编辑',
  icon: Image,
  description: 'AI 图片生成、编辑与管理',
  i18nNamespace: 'plugin-image',
  PanelComponent: ImagePluginPanel,
  AssistantPanelComponent: ImageAssistantPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    if (data == null || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.canvases) && d.canvases.length > 0) {
      return d.canvases.some((c: Record<string, unknown>) => {
        const json = c.fabricJson as Record<string, unknown> | undefined;
        return json && Array.isArray(json.objects) && json.objects.length > 0;
      });
    }
    return false;
  },
  toFragments: (pluginData) => {
    const d = pluginData as { canvases?: Array<{ title?: string; fabricJson?: Record<string, unknown> }> } | null;
    if (!d?.canvases?.length) return [];
    const fragments: Array<{ title: string; markdown: string }> = [];
    for (const c of d.canvases) {
      const json = c.fabricJson;
      if (!json || !Array.isArray(json.objects) || json.objects.length === 0) continue;
      const objSummary = (json.objects as Array<Record<string, unknown>>)
        .map(o => `${o.type || 'object'}`)
        .join(', ');
      fragments.push({
        title: c.title || '图片',
        markdown: `[图片画布: ${c.title || '未命名'}，包含 ${json.objects.length} 个对象 (${objSummary})]`,
      });
    }
    return fragments;
  },
};

registerPlugin(imagePlugin);
