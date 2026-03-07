import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const ReviewPluginPanel = React.lazy(() => import('./ReviewPluginPanel').then(m => ({ default: m.ReviewPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-review', { zh, en });

export const reviewPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文档评审',
  icon: ClipboardCheck,
  description: 'AI 对文档进行多维度评审，给出修改建议和评分',
  majorCategory: 'functional',
  subCategory: 'ai-text',
  i18nNamespace: 'plugin-review',
  PanelComponent: ReviewPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object'
      && 'reviews' in (data as Record<string, unknown>);
  },
};

registerPlugin(reviewPlugin);
