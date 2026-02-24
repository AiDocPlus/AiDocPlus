import React from 'react';
import { Languages } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const ParallelTranslationPluginPanel = React.lazy(() => import('./ParallelTranslationPluginPanel').then(m => ({ default: m.ParallelTranslationPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-parallel-translation', { zh, en });

export const parallelTranslationPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '多版本对照翻译',
  icon: Languages,
  description: 'AI 将文档翻译为多种语言，支持原文与译文左右对照显示',
  majorCategory: 'content-generation',
  subCategory: 'ai-text',
  i18nNamespace: 'plugin-parallel-translation',
  PanelComponent: ParallelTranslationPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object'
      && 'translations' in (data as Record<string, unknown>);
  },
};

registerPlugin(parallelTranslationPlugin);
