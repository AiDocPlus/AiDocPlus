import React from 'react';
import { BookA } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const GlossaryPluginPanel = React.lazy(() => import('./GlossaryPluginPanel').then(m => ({ default: m.GlossaryPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-glossary', { zh, en });

export const glossaryPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '术语表',
  icon: BookA,
  description: 'AI 自动识别文档中的专业术语，生成带定义的术语表，支持编辑和导出',
  majorCategory: 'content-generation',
  subCategory: 'data',
  i18nNamespace: 'plugin-glossary',
  PanelComponent: GlossaryPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'terms' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { terms?: Array<{ term: string; definition: string; translation?: string; aliases: string[] }> } | null;
    if (!d?.terms?.length) return [];
    const lines = d.terms.map(t => {
      let md = `**${t.term}**`;
      if (t.translation) md += ` (${t.translation})`;
      md += `：${t.definition}`;
      if (t.aliases.length > 0) md += ` _别名：${t.aliases.join('、')}_`;
      return md;
    });
    return [{ title: '术语表', markdown: `# 术语表\n\n${lines.join('\n\n')}` }];
  },
};

registerPlugin(glossaryPlugin);
