/**
 * 大纲文档类型定义
 * 
 * 专业级大纲写作工具，对标幕布核心体验
 */

import { lazy } from 'react';
import { ListTree } from 'lucide-react';
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
      id: 'expand',
      labelKey: 'outline.ai.expand',
      icon: 'Sparkles',
    },
    {
      id: 'generate',
      labelKey: 'outline.ai.generate',
      icon: 'FileText',
    },
    {
      id: 'polish',
      labelKey: 'outline.ai.polish',
      icon: 'Wand2',
    },
    {
      id: 'continue',
      labelKey: 'outline.ai.continue',
      icon: 'PlusCircle',
    },
    {
      id: 'summarize',
      labelKey: 'outline.ai.summarize',
      icon: 'WrapText',
    },
  ],
  exportFormats: [
    { format: 'opml', labelKey: 'outline.export.opml', extension: 'opml' },
    { format: 'markdown', labelKey: 'outline.export.markdown', extension: 'md' },
    { format: 'txt', labelKey: 'outline.export.txt', extension: 'txt' },
    { format: 'json', labelKey: 'outline.export.json', extension: 'json' },
  ],
};

export default outlineDocType;
