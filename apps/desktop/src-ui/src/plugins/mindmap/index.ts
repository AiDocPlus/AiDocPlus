import React from 'react';
import { Brain } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const MindMapPluginPanel = React.lazy(() => import('./MindMapPluginPanel').then(m => ({ default: m.MindMapPluginPanel })));
const MindMapAssistantPanel = React.lazy(() => import('./MindMapAssistantPanel').then(m => ({ default: m.MindMapAssistantPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-mindmap', { zh, en });

export const mindmapPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '思维导图',
  icon: Brain,
  description: 'AI 分析文档内容生成思维导图',
  i18nNamespace: 'plugin-mindmap',
  PanelComponent: MindMapPluginPanel,
  AssistantPanelComponent: MindMapAssistantPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    if (data == null || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    // 多标签：检查 diagrams 数组
    if (Array.isArray(d.diagrams) && d.diagrams.length > 0) {
      return d.diagrams.some((diag: Record<string, unknown>) => diag.markdownContent || diag.jsonData);
    }
    return 'markdownContent' in d || 'markdown' in d || 'jsonData' in d;
  },
  toFragments: (pluginData) => {
    const d = pluginData as { markdownContent?: string; markdown?: string; jsonData?: unknown; diagrams?: Array<{ title?: string; markdownContent?: string; jsonData?: unknown }> } | null;
    // 多标签：遍历所有 diagrams
    if (d?.diagrams && d.diagrams.length > 0) {
      const fragments: Array<{ title: string; markdown: string }> = [];
      for (const diag of d.diagrams) {
        let md = diag.markdownContent;
        if (!md?.trim() && diag.jsonData) {
          try {
            const { mindMapDataToMarkdown } = require('./mindmapConverter');
            md = mindMapDataToMarkdown(diag.jsonData);
          } catch { /* ignore */ }
        }
        if (md?.trim()) {
          fragments.push({ title: diag.title || '思维导图', markdown: md });
        }
      }
      return fragments;
    }
    // 兼容旧数据
    let md = d?.markdownContent || d?.markdown;
    if (!md?.trim() && d?.jsonData) {
      try {
        const { mindMapDataToMarkdown } = require('./mindmapConverter');
        md = mindMapDataToMarkdown(d.jsonData);
      } catch { /* ignore */ }
    }
    if (!md?.trim()) return [];
    return [{ title: '思维导图', markdown: md }];
  },
};

registerPlugin(mindmapPlugin);
