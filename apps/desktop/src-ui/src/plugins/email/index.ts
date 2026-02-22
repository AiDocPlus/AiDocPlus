import React from 'react';
import { Mail } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const EmailPluginPanel = React.lazy(() => import('./EmailPluginPanel').then(m => ({ default: m.EmailPluginPanel })));
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-email', { zh, en });

export const emailPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '邮件发送',
  icon: Mail,
  description: 'AI 辅助撰写邮件正文，通过 SMTP 直接发送文档内容',
  majorCategory: 'functional',
  subCategory: 'communication',
  i18nNamespace: 'plugin-email',
  PanelComponent: EmailPluginPanel,
  // 功能执行类插件不在 document.pluginData 中存储数据
  hasData: () => false,
};

registerPlugin(emailPlugin);
