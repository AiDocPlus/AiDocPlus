import { Languages } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
import { TranslationPluginPanel } from './TranslationPluginPanel';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-translation', { zh, en, ja });

export const translationPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '翻译',
  icon: Languages,
  description: 'AI 将文档内容翻译为多种语言',
  i18nNamespace: 'plugin-translation',
  PanelComponent: TranslationPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'translations' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { translations?: Record<string, string> } | null;
    if (!d?.translations) return [];
    return Object.entries(d.translations)
      .filter(([, v]) => v && v.trim())
      .map(([lang, text]) => ({ title: `翻译：${lang}`, markdown: text }));
  },
};

registerPlugin(translationPlugin);
