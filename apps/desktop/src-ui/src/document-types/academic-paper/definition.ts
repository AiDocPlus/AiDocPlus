/**
 * academic-paper 文档类型 — 学术论文
 */
import { lazy } from 'react';
import { GraduationCap } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const academicPaperDocType: DocTypeDefinition = {
  id: 'academic-paper',
  version: '1.0.0',
  labelKey: 'docType.academicPaper',
  descriptionKey: 'docType.academicPaperDesc',
  icon: GraduationCap,
  category: 'academic',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./AcademicPaperEditor')),
  AISidebarComponent: lazy(() => import('./AcademicPaperAISidebar')),
  createEmptyContent: () => '# 论文标题\n\n**摘要**：\n\n**关键词**：\n\n## 1. 引言\n\n## 2. 文献综述\n\n## 3. 研究方法\n\n## 4. 结果与分析\n\n## 5. 讨论\n\n## 6. 结论\n\n## 参考文献\n',
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的学术论文写作助手。熟悉学术写作规范，擅长文献综述、论证逻辑、学术用语。回答时注重学术严谨性和引用规范。',
  aiQuickActions: [
    { id: 'academic:literature-review', labelKey: 'academic.literatureReview', icon: GraduationCap, defaultPromptTemplate: '请根据以下研究主题，生成文献综述框架和关键论点：\n\n{{content}}' },
    { id: 'academic:abstract', labelKey: 'academic.abstract', icon: GraduationCap, defaultPromptTemplate: '请为以下论文生成学术摘要（200-300字，含研究目的、方法、结果、结论）：\n\n{{content}}' },
    { id: 'academic:polish', labelKey: 'academic.polish', icon: GraduationCap, defaultPromptTemplate: '请润色以下学术文本，使其更加严谨、规范、学术化：\n\n{{content}}' },
  ],
};
