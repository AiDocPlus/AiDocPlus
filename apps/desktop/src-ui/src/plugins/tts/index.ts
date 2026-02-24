import React from 'react';
import { Volume2 } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const TtsPluginPanel = React.lazy(() => import('./TtsPluginPanel').then(m => ({ default: m.TtsPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-tts', { zh, en });

export const ttsPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '文本转语音',
  icon: Volume2,
  description: '使用浏览器内置语音合成将文档内容朗读出来',
  majorCategory: 'functional',
  subCategory: 'export',
  i18nNamespace: 'plugin-tts',
  PanelComponent: TtsPluginPanel,
  hasData: () => false,
};

registerPlugin(ttsPlugin);
