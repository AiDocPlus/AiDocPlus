import React from 'react';
import { Languages } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const TranslationPluginPanel = React.lazy(() => import('./TranslationPluginPanel').then(m => ({ default: m.TranslationPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-translation', { zh, en });

export const translationPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '翻译',
  icon: Languages,
  description: 'AI 将文档内容翻译为多种语言',
  i18nNamespace: 'plugin-translation',
  PanelComponent: TranslationPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'translations' in (data as Record<string, unknown>);
  },
  assistantConfig: {
    defaultSystemPrompt: '你是翻译 AI 助手。你的职责是帮助用户翻译文档内容、校对译文质量、统一术语用法。你精通多种语言，能根据上下文选择最佳翻译方案。回复使用中文。',
    quickActions: [
      { id: 'proofread', icon: 'Sparkles', label: '校对译文', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const t = d?.translations ? Object.entries(d.translations).filter(([, v]: any) => v).map(([k, v]: any) => `[${k}]\n${v}`).join('\n\n') : ''; return t ? `请校对以下译文，指出翻译不准确或不通顺的地方：\n\n${t}` : '当前没有已翻译的内容。'; } },
      { id: 'terminology', icon: 'Sparkles', label: '统一术语', buildPrompt: ({ pluginData, aiContent }) => { const d = pluginData as any; const t = d?.translations ? Object.values(d.translations).filter(Boolean).join('\n') : ''; return `请检查以下翻译内容中的专业术语使用是否一致，并给出统一建议：\n\n原文（截取）：\n${(aiContent || '').slice(0, 1500)}\n\n译文：\n${t.slice(0, 1500)}`; } },
      { id: 'style', icon: 'Sparkles', label: '调整风格', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const t = d?.translations ? Object.values(d.translations).filter(Boolean).join('\n') : ''; return t ? `请将以下译文调整为更自然流畅的表达风格：\n\n${t.slice(0, 2000)}` : '当前没有已翻译的内容。'; } },
    ],
    buildContext: (_doc, pluginData, aiContent) => {
      const parts: string[] = [];
      if (aiContent) parts.push(`原文（截取前2000字）：\n${aiContent.slice(0, 2000)}`);
      const d = pluginData as any;
      if (d?.translations) {
        const existing = Object.entries(d.translations).filter(([, v]) => v).map(([k, v]) => `[${k}] ${(v as string).slice(0, 500)}`).join('\n');
        if (existing) parts.push(`已有译文：\n${existing}`);
      }
      return parts.join('\n\n');
    },
  },
  toFragments: (pluginData) => {
    const d = pluginData as { translations?: Record<string, string> } | null;
    if (!d?.translations) return [];
    return Object.entries(d.translations)
      .filter(([, v]) => v && v.trim())
      .map(([lang, text]) => ({ title: `翻译：${lang}`, markdown: text }));
  },
};

registerPlugin(translationPlugin);
