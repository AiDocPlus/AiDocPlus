import { Table2 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { TablePluginPanel } from './TablePluginPanel';
import { sheetsToMarkdown } from './tableUtils';
import type { TableSheet } from './tableUtils';
import { PLUGIN_ID_TABLE } from '../constants';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-table', { zh, en, ja });

export const tablePlugin: DocumentPlugin = {
  id: PLUGIN_ID_TABLE,
  name: '表格',
  icon: Table2,
  description: 'AI 生成结构化表格数据',
  i18nNamespace: 'plugin-table',
  PanelComponent: TablePluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[PLUGIN_ID_TABLE] as Record<string, unknown> | null | undefined;
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
