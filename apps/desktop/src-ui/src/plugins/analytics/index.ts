import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const AnalyticsPluginPanel = React.lazy(() => import('./AnalyticsPluginPanel').then(m => ({ default: m.AnalyticsPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-analytics', { zh, en });

export const analyticsPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文档统计',
  icon: BarChart3,
  description: '字数、阅读时间、关键词频率等统计分析',
  i18nNamespace: 'plugin-analytics',
  PanelComponent: AnalyticsPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'analyzed' in (data as Record<string, unknown>);
  },
};

registerPlugin(analyticsPlugin);
