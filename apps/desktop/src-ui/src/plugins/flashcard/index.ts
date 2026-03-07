import React from 'react';
import { Layers } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const FlashcardPluginPanel = React.lazy(() => import('./FlashcardPluginPanel').then(m => ({ default: m.FlashcardPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-flashcard', { zh, en });

export const flashcardPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '知识卡片',
  icon: Layers,
  description: '从文档提取关键知识点，生成问答式记忆卡片，支持翻转学习和 Anki 导出',
  majorCategory: 'functional',
  subCategory: 'ai-text',
  i18nNamespace: 'plugin-flashcard',
  PanelComponent: FlashcardPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'cards' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { cards?: Array<{ front: string; back: string; type: string }> } | null;
    if (!d?.cards?.length) return [];
    const typeLabels: Record<string, string> = { concept: '概念', qa: '问答', fill: '填空', keyword: '关键词' };
    const lines = d.cards.map((c, i) =>
      `**${i + 1}. [${typeLabels[c.type] || c.type}]** ${c.front}\n> ${c.back}`
    );
    return [{ title: '知识卡片', markdown: `# 知识卡片\n\n${lines.join('\n\n')}` }];
  },
};

registerPlugin(flashcardPlugin);
