import React from 'react';
import { GitBranch } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const DiagramPluginPanel = React.lazy(() => import('./DiagramPluginPanel').then(m => ({ default: m.DiagramPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-diagram', { zh, en });

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
  assistantConfig: {
    defaultSystemPrompt: '你是 Mermaid 图表 AI 助手。你的职责是帮助用户创建、修改和优化 Mermaid 图表代码，支持流程图、时序图、类图、甘特图等。回复使用中文，代码块使用 mermaid 语法。',
    quickActions: [
      { id: 'optimize', icon: 'Sparkles', label: '优化图表', buildPrompt: ({ pluginData }) => { const d = pluginData as any; return d?.mermaidCode ? `请优化以下 Mermaid 图表代码，使其更清晰易读：\n\n\`\`\`mermaid\n${d.mermaidCode}\n\`\`\`` : '当前没有图表代码，请先生成图表。'; } },
      { id: 'explain', icon: 'HelpCircle', label: '解释图表', buildPrompt: ({ pluginData }) => { const d = pluginData as any; return d?.mermaidCode ? `请解释以下 Mermaid 图表的含义和结构：\n\n\`\`\`mermaid\n${d.mermaidCode}\n\`\`\`` : '当前没有图表代码。'; } },
      { id: 'convert', icon: 'Sparkles', label: '换种图表', buildPrompt: ({ pluginData }) => { const d = pluginData as any; return d?.mermaidCode ? `请将以下图表转换为其他类型的 Mermaid 图表（如时序图转流程图），保留核心信息：\n\n\`\`\`mermaid\n${d.mermaidCode}\n\`\`\`` : '当前没有图表代码。'; } },
    ],
    buildContext: (_doc, pluginData, aiContent) => {
      const parts: string[] = [];
      const d = pluginData as any;
      if (d?.mermaidCode) parts.push(`当前图表代码：\n\`\`\`mermaid\n${d.mermaidCode}\n\`\`\``);
      if (d?.diagramType) parts.push(`图表类型：${d.diagramType}`);
      if (aiContent) parts.push(`文档正文（截取前1500字）：\n${aiContent.slice(0, 1500)}`);
      return parts.join('\n\n');
    },
  },
  toFragments: (pluginData) => {
    const d = pluginData as { mermaidCode?: string; diagramType?: string } | null;
    if (!d?.mermaidCode?.trim()) return [];
    return [{ title: d.diagramType || '图表', markdown: '```mermaid\n' + d.mermaidCode + '\n```' }];
  },
};

registerPlugin(diagramPlugin);
