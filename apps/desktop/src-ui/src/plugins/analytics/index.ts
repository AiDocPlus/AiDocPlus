import { BarChart3 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { AnalyticsPluginPanel } from './AnalyticsPluginPanel';
import { PLUGIN_ID_ANALYTICS } from '../constants';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-analytics', { zh, en, ja });

export const analyticsPlugin: DocumentPlugin = {
  id: PLUGIN_ID_ANALYTICS,
  name: '文档统计',
  icon: BarChart3,
  description: '字数、阅读时间、关键词频率等统计分析',
  i18nNamespace: 'plugin-analytics',
  PanelComponent: AnalyticsPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[PLUGIN_ID_ANALYTICS];
    return data != null && typeof data === 'object' && 'analyzed' in (data as Record<string, unknown>);
  },
};
