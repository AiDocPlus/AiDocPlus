import React from 'react';
import { Droplets } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const WatermarkPluginPanel = React.lazy(() => import('./WatermarkPluginPanel').then(m => ({ default: m.WatermarkPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-watermark', { zh, en });

export const watermarkPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文档水印',
  icon: Droplets,
  description: '为文档添加文字或图片水印，支持自定义样式和导出',
  majorCategory: 'functional',
  subCategory: 'export',
  i18nNamespace: 'plugin-watermark',
  PanelComponent: WatermarkPluginPanel,
  hasData: () => false,
};

registerPlugin(watermarkPlugin);
