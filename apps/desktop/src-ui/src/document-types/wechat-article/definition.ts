/**
 * wechat-article 文档类型 — 公众号文章
 */
import { lazy } from 'react';
import { Newspaper } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const wechatArticleDocType: DocTypeDefinition = {
  id: 'wechat-article',
  version: '1.0.0',
  labelKey: 'docType.wechatArticle',
  descriptionKey: 'docType.wechatArticleDesc',
  icon: Newspaper,
  category: 'creative',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./WechatArticleEditor')),
  AISidebarComponent: lazy(() => import('./WechatArticleAISidebar')),
  createEmptyContent: () => '# 标题\n\n> 摘要：\n\n正文内容...\n',
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的公众号文章写作助手。擅长撰写吸引眼球的标题、生动的开头、有节奏感的正文。注重排版美观、阅读体验和传播性。',
  aiQuickActions: [
    { id: 'wechat:title-optimize', labelKey: 'wechat.titleOptimize', icon: Newspaper, defaultPromptTemplate: '请为以下文章提供5个吸引眼球的标题方案：\n\n{{content}}' },
    { id: 'wechat:summary', labelKey: 'wechat.summary', icon: Newspaper, defaultPromptTemplate: '请为以下公众号文章生成一段吸引读者的摘要（50-100字）：\n\n{{content}}' },
    { id: 'wechat:polish', labelKey: 'wechat.polish', icon: Newspaper, defaultPromptTemplate: '请润色以下公众号文章，使其更加生动有趣、有传播性：\n\n{{content}}' },
  ],
};
