import React from 'react';
import { Share2, Send } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
const PublishPluginPanel = React.lazy(() => import('./PublishPluginPanel').then(m => ({ default: m.PublishPluginPanel })));
import { WechatPublishPanel } from './WechatPublishPanel';
import manifest from './manifest.json';
import wechatManifest from './wechat-manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';

registerPluginI18n('plugin-publish', { zh, en });

export const publishPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '内容发布',
  icon: Share2,
  description: '将文档内容格式化并发布到微信公众号、知乎、掘金等主流内容平台',
  majorCategory: 'functional',
  subCategory: 'export',
  i18nNamespace: 'plugin-publish',
  PanelComponent: PublishPluginPanel,
  hasData: () => false,
};

export const wechatPublishPlugin: DocumentPlugin = {
  id: wechatManifest.id,
  name: '微信公众号发布',
  icon: Send,
  description: '将文档内容直接发布到微信公众号草稿箱，支持 AI 优化排版',
  majorCategory: 'functional',
  subCategory: 'export',
  i18nNamespace: 'plugin-publish',
  PanelComponent: WechatPublishPanel,
  hasData: (doc) => !!(doc.pluginData?.[wechatManifest.id]),
};

registerPlugin(publishPlugin);
registerPlugin(wechatPublishPlugin);
