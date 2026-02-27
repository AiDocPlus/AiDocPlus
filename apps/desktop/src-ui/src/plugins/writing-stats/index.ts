import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const WritingStatsPluginPanel = React.lazy(() => import('./WritingStatsPluginPanel').then(m => ({ default: m.WritingStatsPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-writing-stats', { zh, en });

export const writingStatsPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '写作统计仪表盘',
  icon: BarChart3,
  description: '追踪写作进度、目标达成率、每日产出等关键指标',
  majorCategory: 'functional',
  subCategory: 'analysis',
  i18nNamespace: 'plugin-writing-stats',
  PanelComponent: WritingStatsPluginPanel,
  hasData: () => false,
};

registerPlugin(writingStatsPlugin);
