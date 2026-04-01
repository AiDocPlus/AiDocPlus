/**
 * 大纲文档类型定义
 *
 * 专业级大纲写作工具，对标幕布核心体验
 */

import { lazy } from 'react';
import { ListTree, Sparkles, FileText, Wand2, PlusCircle, WrapText } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import {
  createEmptyOutlineDocument,
  extractOutlinePlainText,
} from './types';
import { OUTLINE_AI_SYSTEM_BASE } from './ai-prompts';

/**
 * 大纲文档类型定义
 */
export const outlineDocType: DocTypeDefinition = {
  id: 'outline',
  version: '1.0.0',
  labelKey: 'docType.outline',
  descriptionKey: 'docType.outlineDesc',
  icon: ListTree,
  fileSuffix: '.outline',
  category: 'other',
  EditorComponent: lazy(() => import('./OutlineWorkspace')),
  layoutMode: 'full',
  AISidebarComponent: lazy(() => import('./OutlineAISidebar')),
  createEmptyContent: () => JSON.stringify(createEmptyOutlineDocument(), null, 2),
  extractPlainText: extractOutlinePlainText,
  defaultSystemPrompt: OUTLINE_AI_SYSTEM_BASE,
  supportsPlugins: false,
  aiQuickActions: [
    {
      id: 'outline:expand',
      labelKey: 'outline.ai.expand',
      icon: Sparkles,
      defaultPromptTemplate: '请展开以下大纲节点的子要点（3-7条），保持层级结构清晰：\n\n{{content}}',
    },
    {
      id: 'outline:generate',
      labelKey: 'outline.ai.generate',
      icon: FileText,
      defaultPromptTemplate: '请基于以下大纲生成完整的文档正文：\n\n{{content}}',
    },
    {
      id: 'outline:polish',
      labelKey: 'outline.ai.polish',
      icon: Wand2,
      defaultPromptTemplate: '请对以下大纲内容进行润色优化，改善表达但不改变结构：\n\n{{content}}',
    },
    {
      id: 'outline:continue',
      labelKey: 'outline.ai.continue',
      icon: PlusCircle,
      defaultPromptTemplate: '请继续扩展以下大纲，添加下一层级的要点：\n\n{{content}}',
    },
    {
      id: 'outline:summarize',
      labelKey: 'outline.ai.summarize',
      icon: WrapText,
      defaultPromptTemplate: '请对以下大纲内容进行总结提炼，生成精简版本：\n\n{{content}}',
    },
  ],
};
