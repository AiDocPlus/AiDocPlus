/**
 * 任务清单文档类型 - 定义与注册
 */
import { lazy } from 'react';
import { CheckSquare } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import {
  createEmptyTaskListContent,
  extractTaskListPlainText,
} from './types';
import { TASKLIST_AI_SYSTEM_BASE } from './taskListAiPromptShared';

// ============================================================
// 文档类型定义
// ============================================================

export const taskListDocType: DocTypeDefinition = {
  // 基础信息
  id: 'task-list',
  version: '1.0.0',
  labelKey: 'docType.taskList',
  descriptionKey: 'docType.taskListDesc',
  icon: CheckSquare,
  fileSuffix: '.tasks',
  category: 'other',

  // UI 组件
  EditorComponent: lazy(() => import('./TaskListWorkspace')),
  layoutMode: 'full', // 自定义布局：工具栏 + 任务列表 + AI 侧栏

  // 数据方法
  createEmptyContent: () => JSON.stringify(createEmptyTaskListContent(), null, 2),
  extractPlainText: (content: string) => {
    try { return extractTaskListPlainText(JSON.parse(content)); } catch { return ''; }
  },

  // AI 配置
  defaultSystemPrompt: TASKLIST_AI_SYSTEM_BASE,

  // 不支持插件系统
  supportsPlugins: false,
};
