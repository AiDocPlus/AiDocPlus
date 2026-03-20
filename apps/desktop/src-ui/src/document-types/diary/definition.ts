/**
 * diary 文档类型定义 — 日记本
 * layoutMode='full'，自定义三栏布局
 */
import { lazy } from 'react';
import { BookHeart, Sparkles, RefreshCw, Lightbulb } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyDiaryContent, extractDiaryPlainText } from './types';

export const diaryDocType: DocTypeDefinition = {
  id: 'diary',
  version: '1.0.0',
  labelKey: 'docType.diary',
  descriptionKey: 'docType.diaryDesc',
  icon: BookHeart,
  fileSuffix: '.diary',
  category: 'writing',

  EditorComponent: lazy(() => import('./DiaryDocWorkspace')),
  layoutMode: 'full',

  createEmptyContent: () => JSON.stringify(createEmptyDiaryContent()),
  extractPlainText: (content) => extractDiaryPlainText(content),

  defaultSystemPrompt: '你是一位专业的日记写作助手。你的任务是帮助用户记录和反思日常生活。语气温和、共情、不评判。使用开放式问题引导反思，尊重用户的隐私和情感边界。直接输出内容，不要添加额外说明。',

  aiQuickActions: [
    {
      id: 'diary:continue',
      labelKey: 'diary.actionContinue',
      icon: Sparkles,
      defaultPromptTemplate: '请根据以下日记内容，帮我续写，保持风格一致：\n\n{{content}}',
    },
    {
      id: 'diary:reflect',
      labelKey: 'diary.actionReflect',
      icon: Lightbulb,
      defaultPromptTemplate: '请对以下日记内容进行深度反思分析，帮助我理解自己的情感和行为模式：\n\n{{content}}',
    },
    {
      id: 'diary:polish',
      labelKey: 'diary.actionPolish',
      icon: RefreshCw,
      defaultPromptTemplate: '请对以下日记文字进行润色美化，提升表达质量：\n\n{{content}}',
    },
  ],
};
