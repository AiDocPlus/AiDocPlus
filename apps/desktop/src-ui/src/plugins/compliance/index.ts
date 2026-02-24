import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const CompliancePluginPanel = React.lazy(() => import('./CompliancePluginPanel').then(m => ({ default: m.CompliancePluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-compliance', { zh, en });

export const compliancePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '合规检查',
  icon: ShieldCheck,
  description: 'AI 检查文档是否符合特定写作规范，输出结构化检查报告',
  majorCategory: 'content-generation',
  subCategory: 'analysis',
  i18nNamespace: 'plugin-compliance',
  PanelComponent: CompliancePluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'items' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { ruleSetLabel?: string; items?: Array<{ level: string; category: string; description: string; suggestion?: string }> } | null;
    if (!d?.items?.length) return [];
    const levelIcon: Record<string, string> = { pass: '✅', warning: '⚠️', error: '❌' };
    const lines = d.items.map(item =>
      `${levelIcon[item.level] || '•'} **${item.category}**：${item.description}${item.suggestion && item.level !== 'pass' ? `\n  > 建议：${item.suggestion}` : ''}`
    );
    return [{ title: `合规检查报告（${d.ruleSetLabel || ''}）`, markdown: `# 合规检查报告\n\n${lines.join('\n\n')}` }];
  },
};

registerPlugin(compliancePlugin);
