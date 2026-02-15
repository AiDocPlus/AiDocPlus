import { Presentation } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { PptPluginPanel } from './PptPluginPanel';
import { PLUGIN_ID_PPT } from '../constants';
import type { Slide, SlidesDeck } from '@aidocplus/shared-types';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-ppt', { zh, en, ja });

export const pptPlugin: DocumentPlugin = {
  id: PLUGIN_ID_PPT,
  name: '生成 PPT',
  icon: Presentation,
  description: '根据文档内容 AI 生成演示文稿',
  i18nNamespace: 'plugin-ppt',
  PanelComponent: PptPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[PLUGIN_ID_PPT];
    return data != null && typeof data === 'object' && 'slidesDeck' in (data as Record<string, unknown>);
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
