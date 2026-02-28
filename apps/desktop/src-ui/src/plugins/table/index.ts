import React from 'react';
import { Table2 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const TablePluginPanel = React.lazy(() => import('./TablePluginPanel').then(m => ({ default: m.TablePluginPanel })));
import { sheetsToMarkdown } from './tableUtils';
import type { TableSheet } from './tableUtils';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-table', { zh, en });

export const tablePlugin: DocumentPlugin = {
  id: manifest.id,
  name: '表格',
  icon: Table2,
  description: 'AI 生成结构化表格数据',
  i18nNamespace: 'plugin-table',
  PanelComponent: TablePluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id] as Record<string, unknown> | null | undefined;
    if (!data || typeof data !== 'object') return false;
    if ('sheets' in data && Array.isArray(data.sheets) && (data.sheets as unknown[]).length > 0) return true;
    if ('tableData' in data) return true;
    return false;
  },
  assistantConfig: {
    defaultSystemPrompt: '你是表格数据 AI 助手。你的职责是帮助用户创建、分析和优化表格数据，包括数据整理、公式计算、数据分析等。回复使用中文。',
    quickActions: [
      { id: 'analyze', icon: 'Sparkles', label: '分析数据', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const sheets = d?.sheets; if (!sheets?.length) return '当前没有表格数据。'; const preview = JSON.stringify(sheets[0]?.data?.slice(0, 10)); return `请分析以下表格数据，给出关键发现和趋势：\n\n${preview}`; } },
      { id: 'addcol', icon: 'Sparkles', label: '建议新列', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const headers = d?.sheets?.[0]?.data?.[0]; return headers ? `当前表格的列标题为：${JSON.stringify(headers)}。请建议可以添加哪些有意义的新列。` : '当前没有表格数据。'; } },
      { id: 'format', icon: 'Sparkles', label: '优化格式', buildPrompt: ({ pluginData }) => { const d = pluginData as any; const sheets = d?.sheets; if (!sheets?.length) return '当前没有表格数据。'; return `请检查以下表格数据，建议格式优化方案（如统一日期格式、数字精度等）：\n\n${JSON.stringify(sheets[0]?.data?.slice(0, 5))}`; } },
    ],
    buildContext: (_doc, pluginData, aiContent) => {
      const parts: string[] = [];
      const d = pluginData as any;
      if (d?.sheets?.length) {
        const sheet = d.sheets[0];
        parts.push(`当前表格「${sheet.name || '表格1'}」共 ${sheet.data?.length || 0} 行`);
        if (sheet.data?.[0]) parts.push(`列标题：${JSON.stringify(sheet.data[0])}`);
      }
      if (aiContent) parts.push(`文档正文（截取前1500字）：\n${aiContent.slice(0, 1500)}`);
      return parts.join('\n\n');
    },
  },
  toFragments: (pluginData) => {
    const d = pluginData as { sheets?: TableSheet[] } | null;
    if (!d?.sheets?.length) return [];
    return d.sheets.map((sheet, i) => ({
      title: sheet.name || `表格 ${i + 1}`,
      markdown: sheetsToMarkdown([sheet]),
    }));
  },
};

registerPlugin(tablePlugin);
