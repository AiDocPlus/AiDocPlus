/**
 * meeting-minutes 文档类型 — 会议纪要
 */
import { lazy } from 'react';
import { ClipboardList } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const meetingMinutesDocType: DocTypeDefinition = {
  id: 'meeting-minutes',
  version: '1.0.0',
  labelKey: 'docType.meetingMinutes',
  descriptionKey: 'docType.meetingMinutesDesc',
  icon: ClipboardList,
  category: 'business',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./MeetingMinutesEditor')),
  AISidebarComponent: lazy(() => import('./MeetingMinutesAISidebar')),
  createEmptyContent: () => `# 会议纪要\n\n**会议时间**：${new Date().toISOString().slice(0, 10)}\n**会议地点**：\n**参会人员**：\n**主持人**：\n\n## 会议议题\n\n## 讨论内容\n\n## 决议事项\n\n## 行动项\n\n| 序号 | 事项 | 负责人 | 截止日期 | 状态 |\n|------|------|--------|---------|------|\n| 1 | | | | 待完成 |\n`,
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的会议纪要助手。擅长提炼会议要点、整理行动项、梳理决议事项。语言简洁明确，条理清晰。',
  aiQuickActions: [
    { id: 'meeting:extract-actions', labelKey: 'meeting.extractActions', icon: ClipboardList, defaultPromptTemplate: '请从以下会议内容中提取行动项（任务、负责人、截止日期）：\n\n{{content}}' },
    { id: 'meeting:summarize', labelKey: 'meeting.summarize', icon: ClipboardList, defaultPromptTemplate: '请为以下会议纪要生成简洁的会议摘要（200字以内）：\n\n{{content}}' },
    { id: 'meeting:format', labelKey: 'meeting.format', icon: ClipboardList, defaultPromptTemplate: '请将以下会议记录整理为规范的会议纪要格式：\n\n{{content}}' },
  ],
};
