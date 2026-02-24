import React from 'react';
import { TableProperties } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const ExtractPluginPanel = React.lazy(() => import('./ExtractPluginPanel').then(m => ({ default: m.ExtractPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-extract', { zh, en });

export const extractPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '结构化数据提取',
  icon: TableProperties,
  description: '从文档中智能提取结构化信息，支持表格编辑和 JSON/CSV 导出',
  majorCategory: 'content-generation',
  subCategory: 'data',
  i18nNamespace: 'plugin-extract',
  PanelComponent: ExtractPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'extractions' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { extractions?: Record<string, { templateLabel: string; fields: { key: string; label: string }[]; rows: Record<string, string>[] }> } | null;
    if (!d?.extractions) return [];
    return Object.values(d.extractions)
      .filter(ext => ext.rows?.length > 0)
      .map(ext => {
        const header = '| ' + ext.fields.map(f => f.label).join(' | ') + ' |';
        const sep = '| ' + ext.fields.map(() => '---').join(' | ') + ' |';
        const body = ext.rows.map(row =>
          '| ' + ext.fields.map(f => row[f.key] || '').join(' | ') + ' |'
        ).join('\n');
        return { title: ext.templateLabel || '提取数据', markdown: `# ${ext.templateLabel}\n\n${header}\n${sep}\n${body}` };
      });
  },
};

registerPlugin(extractPlugin);
