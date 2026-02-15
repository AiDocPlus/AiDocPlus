/**
 * 内容生成类插件示例
 * 基于 summary 插件简化，展示基本结构
 */
import type { DocumentPlugin } from '@/plugins/types';
import { PLUGIN_MAJOR_CATEGORY_CONTENT } from '@/plugins/types';
import { Sparkles } from 'lucide-react';
import { SummaryPluginPanel } from './SummaryPluginPanel';
import { registerPluginI18n } from '@/plugins/i18n-loader';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

// 注册插件翻译
registerPluginI18n('plugin-example-summary', { zh, en, ja });

export const exampleSummaryPlugin: DocumentPlugin = {
  id: 'example-summary-uuid',  // 实际使用时替换为真实 UUID
  name: 'Summary Example',
  icon: Sparkles,
  description: 'A minimal content generation plugin example',
  majorCategory: PLUGIN_MAJOR_CATEGORY_CONTENT,
  subCategory: 'ai-text',
  i18nNamespace: 'plugin-example-summary',
  PanelComponent: SummaryPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.['example-summary-uuid'];
    return data != null && typeof data === 'object' && 'summary' in data;
  },
};
