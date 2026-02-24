import React from 'react';
import { Clock } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const TimelinePluginPanel = React.lazy(() => import('./TimelinePluginPanel').then(m => ({ default: m.TimelinePluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-timeline', { zh, en });

export const timelinePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '版本时间线',
  icon: Clock,
  description: '可视化展示文档版本历史，支持版本预览和对比',
  majorCategory: 'functional',
  subCategory: 'analysis',
  i18nNamespace: 'plugin-timeline',
  PanelComponent: TimelinePluginPanel,
  hasData: () => false,
};

registerPlugin(timelinePlugin);
