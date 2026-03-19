/**
 * official-doc 文档类型 — 公文写作
 * layoutMode='standard'，标准 Markdown 编辑器 + 专属 AI 侧栏
 */
import { lazy } from 'react';
import { FileCheck } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

const TEMPLATE = `---
title: ""
docNumber: ""
issueDate: ""
---

# 关于XXX的通知

各有关单位：

正文内容...

特此通知。

附件：无

XXXX单位
${new Date().toISOString().slice(0, 10)}
`;

export const officialDocType: DocTypeDefinition = {
  id: 'official-doc',
  version: '1.0.0',
  labelKey: 'docType.officialDoc',
  descriptionKey: 'docType.officialDocDesc',
  icon: FileCheck,
  category: 'writing',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./OfficialDocEditor')),
  AISidebarComponent: lazy(() => import('./OfficialDocAISidebar')),
  createEmptyContent: () => TEMPLATE,
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的公文写作助手。严格遵循公文格式规范，用语准确、简洁、庄重。熟悉常用公文种类：通知、报告、请示、批复、函、纪要等。',
  aiQuickActions: [
    { id: 'official:format-check', labelKey: 'officialDoc.formatCheck', icon: FileCheck, defaultPromptTemplate: '请检查以下公文的格式规范性，指出不符合公文写作规范的地方：\n\n{{content}}' },
    { id: 'official:polish', labelKey: 'officialDoc.polish', icon: FileCheck, defaultPromptTemplate: '请润色以下公文，使用语更加规范、准确、庄重：\n\n{{content}}' },
    { id: 'official:generate-reply', labelKey: 'officialDoc.generateReply', icon: FileCheck, defaultPromptTemplate: '请根据以下公文内容，生成对应的回复/批复文稿：\n\n{{content}}' },
  ],
};
