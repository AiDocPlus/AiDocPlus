import React from 'react';
import { Image } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const PosterPluginPanel = React.lazy(() => import('./PosterPluginPanel').then(m => ({ default: m.PosterPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-poster', { zh, en });

export const posterPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '信息图海报',
  icon: Image,
  description: 'AI 将文档内容转化为可视化信息图海报，支持多种主题和 HTML 导出',
  majorCategory: 'content-generation',
  subCategory: 'visualization',
  i18nNamespace: 'plugin-poster',
  PanelComponent: PosterPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'html' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { html?: string } | null;
    if (!d?.html) return [];
    return [{ title: '信息图海报', markdown: '> 信息图海报已生成，请在插件面板中查看或导出 HTML。' }];
  },
};

registerPlugin(posterPlugin);
