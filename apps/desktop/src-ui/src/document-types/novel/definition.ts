/**
 * novel 文档类型定义 — 长篇小说
 * layoutMode='full'，自定义三栏布局
 */
import { lazy } from 'react';
import { BookOpen, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyNovelContent, extractNovelPlainText } from './types';
export { createDemoNovelContent } from './novelDemoData';

export const novelDocType: DocTypeDefinition = {
  id: 'novel',
  version: '1.0.0',
  labelKey: 'docType.novel',
  descriptionKey: 'docType.novelDesc',
  icon: BookOpen,
  fileSuffix: '.novel',
  category: 'creative',

  EditorComponent: lazy(() => import('./NovelDocWorkspace')),
  layoutMode: 'full',

  createEmptyContent: () => JSON.stringify(createEmptyNovelContent()),
  extractPlainText: (content) => extractNovelPlainText(content),

  defaultSystemPrompt: '你是一位专业的小说写作助手。保持文风一致，情节连贯，人物性格稳定。直接输出续写内容，不要添加额外说明。',

  aiQuickActions: [
    {
      id: 'novel:continue',
      labelKey: 'novel.actionContinue',
      icon: Sparkles,
      defaultPromptTemplate: '请续写以下小说正文，保持风格和节奏一致：\n\n{{content}}',
    },
    {
      id: 'novel:expand',
      labelKey: 'novel.actionExpand',
      icon: Wand2,
      defaultPromptTemplate: '请对以下文本进行扩写，增加细节描写：\n\n{{content}}',
    },
    {
      id: 'novel:polish',
      labelKey: 'novel.actionPolish',
      icon: RefreshCw,
      defaultPromptTemplate: '请对以下文本进行语言润色：\n\n{{content}}',
    },
  ],
};
