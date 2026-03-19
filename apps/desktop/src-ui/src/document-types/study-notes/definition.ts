/**
 * study-notes 文档类型定义 — 学习体会文章
 * layoutMode='standard'，使用平台标准 Markdown 编辑器 + 自定义 AI 侧栏
 */
import { lazy } from 'react';
import { BookOpenCheck, ListChecks, Lightbulb, Brain, GitBranch, FileText } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

const STUDY_NOTES_TEMPLATE = `---
source: ""
author: ""
studyDate: "${new Date().toISOString().slice(0, 10)}"
---

## 一、原文要点



## 二、个人体会



## 三、延伸思考

`;

export const studyNotesDocType: DocTypeDefinition = {
  id: 'study-notes',
  version: '1.0.0',
  labelKey: 'docType.studyNotes',
  descriptionKey: 'docType.studyNotesDesc',
  icon: BookOpenCheck,
  category: 'writing',

  EditorComponent: lazy(() => import('./StudyNotesEditor')),
  layoutMode: 'standard',
  AISidebarComponent: lazy(() => import('./StudyNotesAISidebar')),

  createEmptyContent: () => STUDY_NOTES_TEMPLATE,
  extractPlainText: (content) => content,

  defaultSystemPrompt: '你是一位学习辅导助手。帮助用户深入理解学习材料，撰写有深度的学习体会文章。回答时注重理论联系实际，鼓励批判性思考，引导用户形成自己的观点。',

  aiQuickActions: [
    {
      id: 'study:extract-points',
      labelKey: 'studyNotes.extractPoints',
      icon: ListChecks,
      defaultPromptTemplate: '请从以下学习材料中提炼核心要点（5-8条），每条用简洁的语言概括：\n\n{{content}}',
    },
    {
      id: 'study:expand-insight',
      labelKey: 'studyNotes.expandInsight',
      icon: Lightbulb,
      defaultPromptTemplate: '请对以下体会进行深入扩展解读，结合理论背景和实际意义：\n\n{{content}}',
    },
    {
      id: 'study:reflect',
      labelKey: 'studyNotes.reflect',
      icon: Brain,
      defaultPromptTemplate: '请基于以下学习内容，从批判性思维角度提出3-5个反思问题，帮助深入理解：\n\n{{content}}',
    },
    {
      id: 'study:relate',
      labelKey: 'studyNotes.relate',
      icon: GitBranch,
      defaultPromptTemplate: '请分析以下内容与其他相关理论/观点的关联，找出知识点之间的联系：\n\n{{content}}',
    },
    {
      id: 'study:summarize',
      labelKey: 'studyNotes.summarize',
      icon: FileText,
      defaultPromptTemplate: '请为以下学习体会生成一段精炼的总结（200-300字），提炼核心观点和个人收获：\n\n{{content}}',
    },
  ],
};
