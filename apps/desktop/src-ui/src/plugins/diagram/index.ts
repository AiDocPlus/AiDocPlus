import { GitBranch } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
import { DiagramPluginPanel } from './DiagramPluginPanel';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-diagram', { zh, en, ja });

export const diagramPlugin: DocumentPlugin = {
  id: manifest.id,
  name: 'Mermaid 图表',
  icon: GitBranch,
  description: 'AI 生成流程图、时序图、类图等 Mermaid 图表',
  i18nNamespace: 'plugin-diagram',
  PanelComponent: DiagramPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'mermaidCode' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { mermaidCode?: string; diagramType?: string } | null;
    if (!d?.mermaidCode?.trim()) return [];
    return [{ title: d.diagramType || '图表', markdown: '```mermaid\n' + d.mermaidCode + '\n```' }];
  },
};

registerPlugin(diagramPlugin);
