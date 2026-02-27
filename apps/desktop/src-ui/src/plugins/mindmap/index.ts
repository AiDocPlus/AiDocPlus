import React from 'react';
import { Brain } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const MindMapPluginPanel = React.lazy(() => import('./MindMapPluginPanel').then(m => ({ default: m.MindMapPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-mindmap', { zh, en });

export const mindmapPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '思维导图',
  icon: Brain,
  description: 'AI 分析文档内容生成思维导图',
  i18nNamespace: 'plugin-mindmap',
  PanelComponent: MindMapPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'markdown' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { markdown?: string } | null;
    if (!d?.markdown?.trim()) return [];
    return [{ title: '思维导图', markdown: d.markdown }];
  },
};

registerPlugin(mindmapPlugin);
