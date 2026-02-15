/**
 * 功能执行类插件示例
 * 展示独立于文档的工具功能
 */
import type { DocumentPlugin } from '@/plugins/types';
import { PLUGIN_MAJOR_CATEGORY_FUNCTIONAL } from '@/plugins/types';
import { Wrench } from 'lucide-react';
import { ToolPluginPanel } from './ToolPluginPanel';
import { registerPluginI18n } from '@/plugins/i18n-loader';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

// 注册插件翻译
registerPluginI18n('plugin-example-tool', { zh, en, ja });

export const exampleToolPlugin: DocumentPlugin = {
  id: 'example-tool-uuid',  // 实际使用时替换为真实 UUID
  name: 'Tool Example',
  icon: Wrench,
  description: 'A minimal functional plugin example',
  majorCategory: PLUGIN_MAJOR_CATEGORY_FUNCTIONAL,
  subCategory: 'utility',
  i18nNamespace: 'plugin-example-tool',
  PanelComponent: ToolPluginPanel,
  // 功能执行类插件的 hasData 始终返回 false
  hasData: () => false,
};
