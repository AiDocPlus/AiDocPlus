import React from 'react';
import { Presentation } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const PptPluginPanel = React.lazy(() => import('./PptPluginPanel').then(m => ({ default: m.PptPluginPanel })));
import manifest from './manifest.json';
import type { Slide, SlidesDeck } from '@aidocplus/shared-types';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-ppt', { zh, en });

export const pptPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '生成 PPT',
  icon: Presentation,
  description: '根据文档内容 AI 生成演示文稿',
  i18nNamespace: 'plugin-ppt',
  PanelComponent: PptPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'slidesDeck' in (data as Record<string, unknown>);
  },
  assistantConfig: {
    defaultSystemPrompt: '你是 PPT 演示文稿 AI 助手。你的职责是帮助用户优化 PPT 的结构、内容和演讲逻辑，包括幻灯片布局建议、内容精炼、演讲稿撰写等。回复使用中文。',
    quickActions: [
      { id: 'structure', icon: 'Sparkles', label: '优化结构', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const slides = d?.slidesDeck?.slides; if (!slides?.length) return '当前没有 PPT 内容。'; const outline = slides.map((s: any, i: number) => `${i + 1}. ${s.title}`).join('\n'); return `请优化以下 PPT 的整体结构和逻辑顺序：\n\n${outline}`; } },
      { id: 'enrich', icon: 'Sparkles', label: '丰富内容', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const slides = d?.slidesDeck?.slides; if (!slides?.length) return '当前没有 PPT 内容。'; const detail = slides.map((s: any) => `## ${s.title}\n${s.content?.join('\n') || '（无内容）'}`).join('\n\n'); return `请为以下 PPT 的每页幻灯片补充更丰富的内容要点：\n\n${detail.slice(0, 3000)}`; } },
      { id: 'notes', icon: 'Sparkles', label: '生成演讲稿', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const slides = d?.slidesDeck?.slides; if (!slides?.length) return '当前没有 PPT 内容。'; const detail = slides.map((s: any) => `## ${s.title}\n${s.content?.join('\n') || ''}`).join('\n\n'); return `请为以下 PPT 每页生成对应的演讲稿/讲稿备注：\n\n${detail.slice(0, 3000)}`; } },
    ],
    buildContext: (_doc, pluginData, aiContent) => {
      const parts: string[] = [];
      const d = pluginData as any;
      if (d?.slidesDeck?.slides?.length) {
        parts.push(`PPT 共 ${d.slidesDeck.slides.length} 页`);
        const outline = d.slidesDeck.slides.map((s: any, i: number) => `${i + 1}. ${s.title}`).join('\n');
        parts.push(`大纲：\n${outline}`);
      }
      if (aiContent) parts.push(`文档正文（截取前1500字）：\n${aiContent.slice(0, 1500)}`);
      return parts.join('\n\n');
    },
  },
  toFragments: (pluginData) => {
    const d = pluginData as { slidesDeck?: SlidesDeck } | null;
    const slides = d?.slidesDeck?.slides;
    if (!slides?.length) return [];
    const lines = slides.map((s: Slide) => {
      let md = `## ${s.title}`;
      if (s.subtitle) md += `\n*${s.subtitle}*`;
      if (s.content?.length) md += '\n' + s.content.map(c => `- ${c}`).join('\n');
      if (s.notes) md += `\n\n> ${s.notes}`;
      return md;
    });
    return [{ title: 'PPT 大纲', markdown: lines.join('\n\n') }];
  },
};

registerPlugin(pptPlugin);
