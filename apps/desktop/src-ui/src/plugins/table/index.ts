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
