import { FileText } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
import { SummaryPluginPanel } from './SummaryPluginPanel';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-summary', { zh, en, ja });

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
