import { BookOpen } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { LessonPlanPluginPanel } from './LessonPlanPluginPanel';
import { PLUGIN_ID_LESSONPLAN } from '../constants';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-lessonplan', { zh, en, ja });

export const lessonplanPlugin: DocumentPlugin = {
  id: PLUGIN_ID_LESSONPLAN,
  name: '教案生成',
  icon: BookOpen,
  description: 'AI 根据文档内容生成结构化教案',
  i18nNamespace: 'plugin-lessonplan',
  PanelComponent: LessonPlanPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[PLUGIN_ID_LESSONPLAN];
    return data != null && typeof data === 'object' && 'lessonPlan' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { lessonPlan?: string } | null;
    if (!d?.lessonPlan?.trim()) return [];
    return [{ title: '教案', markdown: d.lessonPlan }];
  },
};
