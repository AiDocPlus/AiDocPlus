/**
 * 散文文档类型 — DocTypeDefinition 注册定义
 */
import { lazy } from 'react';
import { Feather, PenLine, Sparkles, Wand2 } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyEssayContent } from './types';

const EssayDocWorkspace = lazy(() => import('./EssayDocWorkspace'));

export const essayDocType: DocTypeDefinition = {
  id: 'essay',
  version: '1.0.0',
  labelKey: 'docType.essay',
  descriptionKey: 'docType.essayDesc',
  icon: Feather,
  fileSuffix: '.aidoc-essay',
  category: 'creative',
  EditorComponent: EssayDocWorkspace,
  layoutMode: 'full',
  createEmptyContent: () => JSON.stringify(createEmptyEssayContent()),
  extractPlainText: (content: string) => {
    try {
      const data = JSON.parse(content);
      return data.content || '';
    } catch {
      return content;
    }
  },
  defaultSystemPrompt: '你是一位专业的散文写作顾问，精通各类散文（抒情、叙事、议论、游记、哲理）的写作技法。你擅长修辞分析、意象营造、结构梳理和文学性提升。直接输出内容，不要添加额外说明。',
  aiQuickActions: [
    { id: 'essay:continue', labelKey: 'essay.aiContinue', icon: PenLine, defaultPromptTemplate: '请续写以下散文正文，保持文风和情感基调一致：\n\n{{content}}' },
    { id: 'essay:rhetoric', labelKey: 'essay.aiRhetoric', icon: Sparkles, defaultPromptTemplate: '请为以下段落建议合适的修辞手法并给出改写示例：\n\n{{content}}' },
    { id: 'essay:polish', labelKey: 'essay.aiPolish', icon: Wand2, defaultPromptTemplate: '请对以下散文段落进行语言润色，提升文学性和表达质量：\n\n{{content}}' },
  ],
};
