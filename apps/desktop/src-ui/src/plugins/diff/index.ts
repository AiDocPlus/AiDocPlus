import React from 'react';
import { GitCompareArrows } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const DiffPluginPanel = React.lazy(() => import('./DiffPluginPanel').then(m => ({ default: m.DiffPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-diff', { zh, en });

export const diffPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文档对比',
  icon: GitCompareArrows,
  description: '对比文档不同版本或不同来源的内容差异，直观展示增删改',
  majorCategory: 'functional',
  subCategory: 'analysis',
  i18nNamespace: 'plugin-diff',
  PanelComponent: DiffPluginPanel,
  hasData: () => false,
};

registerPlugin(diffPlugin);
