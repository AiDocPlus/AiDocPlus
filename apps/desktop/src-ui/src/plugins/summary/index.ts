import React from 'react';
import { FileText } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const SummaryPluginPanel = React.lazy(() => import('./SummaryPluginPanel').then(m => ({ default: m.SummaryPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-summary', { zh, en });

export const summaryPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文档摘要',
  icon: FileText,
  description: 'AI 提炼文档要点、生成多种风格摘要',
  i18nNamespace: 'plugin-summary',
  PanelComponent: SummaryPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'summaries' in (data as Record<string, unknown>);
  },
  assistantConfig: {
    defaultSystemPrompt: '你是文档摘要 AI 助手。你的职责是帮助用户分析文档内容，提炼核心要点，生成不同风格的摘要。回复使用中文。',
    quickActions: [
      { id: 'summarize', icon: 'Sparkles', label: '生成摘要', buildPrompt: ({ aiContent }) => `请为以下文档内容生成一份简明的摘要：\n\n${(aiContent || '').slice(0, 3000)}` },
      { id: 'bullets', icon: 'Sparkles', label: '提炼要点', buildPrompt: ({ aiContent }) => `请将以下文档内容提炼为 5-8 个核心要点：\n\n${(aiContent || '').slice(0, 3000)}` },
      { id: 'improve', icon: 'Sparkles', label: '优化摘要', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const s = d?.summaries ? Object.values(d.summaries).filter(Boolean).join('\n') : ''; return s ? `请优化以下摘要内容，使其更加精练准确：\n\n${s}` : '当前没有已生成的摘要，请先生成摘要后再优化。'; } },
    ],
    buildContext: (_doc, pluginData, aiContent) => {
      const parts: string[] = [];
      if (aiContent) parts.push(`文档正文（截取前2000字）：\n${aiContent.slice(0, 2000)}`);
      const d = pluginData as any;
      if (d?.summaries) {
        const existing = Object.entries(d.summaries).filter(([, v]) => v).map(([k, v]) => `[${k}] ${v}`).join('\n');
        if (existing) parts.push(`已有摘要：\n${existing}`);
      }
      return parts.join('\n\n');
    },
  },
  toFragments: (pluginData) => {
    const d = pluginData as { summaries?: Record<string, string> } | null;
    if (!d?.summaries) return [];
    const styleLabels: Record<string, string> = { oneliner: '一句话摘要', bullets: '要点提炼', abstract: '学术摘要', executive: '执行摘要' };
    return Object.entries(d.summaries)
      .filter(([, v]) => v && v.trim())
      .map(([style, text]) => ({ title: styleLabels[style] || style, markdown: text }));
  },
};

registerPlugin(summaryPlugin);
