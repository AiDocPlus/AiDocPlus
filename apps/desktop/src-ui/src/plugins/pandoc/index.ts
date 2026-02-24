import React from 'react';
import { FileOutput } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const PandocPluginPanel = React.lazy(() => import('./PandocPluginPanel').then(m => ({ default: m.PandocPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-pandoc', { zh, en });

export const pandocPlugin: DocumentPlugin = {
  id: manifest.id,
  name: 'Pandoc 导出',
  icon: FileOutput,
  description: '通过 Pandoc 将文档导出为 PDF、DOCX、EPUB、LaTeX 等高质量格式',
  majorCategory: 'functional',
  subCategory: 'export',
  i18nNamespace: 'plugin-pandoc',
  PanelComponent: PandocPluginPanel,
  hasData: () => false,
};

registerPlugin(pandocPlugin);
