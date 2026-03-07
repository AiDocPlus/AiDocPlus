import React from 'react';
import { GitBranch } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const MermaidPluginPanel = React.lazy(() => import('./MermaidPluginPanel').then(m => ({ default: m.MermaidPluginPanel })));
const MermaidAssistantPanel = React.lazy(() => import('./MermaidAssistantPanel').then(m => ({ default: m.MermaidAssistantPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-mermaid', { zh, en });

export const mermaidPlugin: DocumentPlugin = {
  id: manifest.id,
  name: 'Mermaid 图表',
  icon: GitBranch,
  description: 'AI 生成流程图、时序图、类图等 Mermaid 图表',
  i18nNamespace: 'plugin-mermaid',
  PanelComponent: MermaidPluginPanel,
  AssistantPanelComponent: MermaidAssistantPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    if (data == null || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    // 支持多图表 diagrams[] 和旧的 mermaidCode 字段
    const diagrams = d.diagrams as Array<{ mermaidCode?: string }> | undefined;
    if (diagrams && diagrams.length > 0) return diagrams.some(dd => !!dd.mermaidCode?.trim());
    return 'mermaidCode' in d && !!(d.mermaidCode as string)?.trim();
  },
  toFragments: (pluginData) => {
    const d = pluginData as { mermaidCode?: string; diagrams?: Array<{ title?: string; mermaidCode?: string }> } | null;
    // 多图表：为每个有代码的图表生成独立片段
    if (d?.diagrams && d.diagrams.length > 0) {
      return d.diagrams
        .filter(dd => !!dd.mermaidCode?.trim())
        .map((dd, i) => ({
          title: dd.title || `图表 ${i + 1}`,
          markdown: '```mermaid\n' + dd.mermaidCode + '\n```',
        }));
    }
    // 向后兼容：旧的单图表
    const code = d?.mermaidCode;
    if (!code?.trim()) return [];
    return [{ title: 'Mermaid 图表', markdown: '```mermaid\n' + code + '\n```' }];
  },
};

registerPlugin(mermaidPlugin);
