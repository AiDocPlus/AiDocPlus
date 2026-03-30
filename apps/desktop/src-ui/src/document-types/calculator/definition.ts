/**
 * 计算文档类型 - 定义与注册
 *
 * 注：AI 快捷操作定义在 calculatorQuickActions.ts 中，
 * 由 CalculatorAISidebar 直接使用（10 分类 60+ 操作）。
 */
import { lazy } from 'react';
import { Calculator } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import {
  createEmptyCalculatorContent,
  extractCalculatorPlainText,
} from './types';
import { CALCULATOR_DOCUMENT_AI_SYSTEM_BASE } from './calculatorAiPromptShared';

// ============================================================
// 文档类型定义
// ============================================================

export const calculatorDocType: DocTypeDefinition = {
  // 基础信息
  id: 'calculator',
  version: '1.0.0',
  labelKey: 'docType.calculator',
  descriptionKey: 'docType.calculatorDesc',
  icon: Calculator,
  fileSuffix: '.calc',
  category: 'other',

  // UI 组件
  EditorComponent: lazy(() => import('./CalculatorWorkspace')),
  layoutMode: 'full', // 自定义布局：双栏编辑器 + AI 侧栏

  // AI 组件（自定义，在 CalculatorWorkspace 内部集成）
  // AISidebarComponent: lazy(() => import('./CalculatorAISidebar')),

  // 数据方法
  createEmptyContent: () => JSON.stringify(createEmptyCalculatorContent(), null, 2),
  extractPlainText: extractCalculatorPlainText,

  // AI 配置
  defaultSystemPrompt: CALCULATOR_DOCUMENT_AI_SYSTEM_BASE,
  // 注：快捷操作由 CalculatorAISidebar 直接使用 calculatorQuickActions.ts

  // 不支持插件系统
  supportsPlugins: false,
};
