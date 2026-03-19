/**
 * translation 文档类型定义 — 中英文翻译
 * layoutMode='full'，自定义双栏对照布局
 */
import { lazy } from 'react';
import { Languages, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyTranslationContent, extractTranslationPlainText } from './types';

export const translationDocType: DocTypeDefinition = {
  id: 'translation',
  version: '1.0.0',
  labelKey: 'docType.translation',
  descriptionKey: 'docType.translationDesc',
  icon: Languages,
  category: 'writing',

  EditorComponent: lazy(() => import('./TranslationWorkspace')),
  layoutMode: 'standard',
  AISidebarComponent: lazy(() => import('./TranslationAISidebar')),

  createEmptyContent: () => JSON.stringify(createEmptyTranslationContent()),
  extractPlainText: (content) => extractTranslationPlainText(content),

  defaultSystemPrompt: '你是专业的中英文翻译助手。翻译时注重信、达、雅，保持术语一致性。对专业术语给出多种译法供选择。',

  aiQuickActions: [
    {
      id: 'translation:translate',
      labelKey: 'translation.translate',
      icon: Languages,
      defaultPromptTemplate: '请翻译以下段落：\n\n{{content}}',
    },
    {
      id: 'translation:polish',
      labelKey: 'translation.polish',
      icon: Sparkles,
      defaultPromptTemplate: '请润色以下译文，使其更加通顺自然：\n\n{{content}}',
    },
    {
      id: 'translation:alternative',
      labelKey: 'translation.alternative',
      icon: RefreshCw,
      defaultPromptTemplate: '请提供以下译文的另一种翻译方案：\n\n{{content}}',
    },
    {
      id: 'translation:consistency',
      labelKey: 'translation.checkConsistency',
      icon: ShieldCheck,
      defaultPromptTemplate: '请检查以下译文中的术语一致性问题：\n\n{{content}}',
    },
  ],
};
