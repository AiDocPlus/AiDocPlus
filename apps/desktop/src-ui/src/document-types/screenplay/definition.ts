/**
 * screenplay 文档类型 — 电影剧本
 */
import { lazy } from 'react';
import { Film } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const screenplayDocType: DocTypeDefinition = {
  id: 'screenplay',
  version: '1.0.0',
  labelKey: 'docType.screenplay',
  descriptionKey: 'docType.screenplayDesc',
  icon: Film,
  category: 'creative',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./ScreenplayEditor')),
  AISidebarComponent: lazy(() => import('./ScreenplayAISidebar')),
  createEmptyContent: () => '# 剧本标题\n\n**类型**：\n**时长**：\n**编剧**：\n\n---\n\n## 场景一：内景 — 客厅 — 白天\n\n（场景描述）\n\n**角色名**\n对白内容...\n',
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的电影剧本写作助手。熟悉标准剧本格式（场景描述、角色对白、动作指示）。擅长构建戏剧冲突、塑造人物性格、推进情节发展。',
  aiQuickActions: [
    { id: 'screenplay:dialogue', labelKey: 'screenplay.dialogue', icon: Film, defaultPromptTemplate: '请根据以下场景描述，生成角色对白（注意性格特征和情绪变化）：\n\n{{content}}' },
    { id: 'screenplay:scene-desc', labelKey: 'screenplay.sceneDesc', icon: Film, defaultPromptTemplate: '请为以下场景补充详细的场景描述（环境、氛围、镜头语言）：\n\n{{content}}' },
    { id: 'screenplay:continue', labelKey: 'screenplay.continue', icon: Film, defaultPromptTemplate: '请续写以下剧本场景，推进情节发展：\n\n{{content}}' },
  ],
};
