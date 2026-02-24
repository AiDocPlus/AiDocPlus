import React from 'react';
import { BookOpen } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const CitationPluginPanel = React.lazy(() => import('./CitationPluginPanel').then(m => ({ default: m.CitationPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-citation', { zh, en });

export const citationPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '引用管理',
  icon: BookOpen,
  description: 'AI 识别文档中的引用和参考文献，支持格式转换、完整性检查和 BibTeX 导出',
  majorCategory: 'content-generation',
  subCategory: 'data',
  i18nNamespace: 'plugin-citation',
  PanelComponent: CitationPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'citations' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { citations?: Array<{ index: number; authors: string[]; title: string; source: string; year: string; doi?: string }> } | null;
    if (!d?.citations?.length) return [];
    const lines = d.citations.map(c =>
      `[${c.index}] ${c.authors.join(', ')}. ${c.title}. ${c.source}${c.year ? `, ${c.year}` : ''}${c.doi ? `. DOI: ${c.doi}` : ''}`
    );
    return [{ title: '参考文献', markdown: `# 参考文献\n\n${lines.join('\n\n')}` }];
  },
};

registerPlugin(citationPlugin);
