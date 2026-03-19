/**
 * business-plan 文档类型 — 商业计划书
 */
import { lazy } from 'react';
import { BarChart3 } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const businessPlanDocType: DocTypeDefinition = {
  id: 'business-plan',
  version: '1.0.0',
  labelKey: 'docType.businessPlan',
  descriptionKey: 'docType.businessPlanDesc',
  icon: BarChart3,
  category: 'business',
  layoutMode: 'standard',
  EditorComponent: lazy(() => import('./BusinessPlanEditor')),
  AISidebarComponent: lazy(() => import('./BusinessPlanAISidebar')),
  createEmptyContent: () => '# 商业计划书\n\n## 一、项目概述\n\n## 二、市场分析\n\n## 三、产品与服务\n\n## 四、商业模式\n\n## 五、营销策略\n\n## 六、团队介绍\n\n## 七、财务预测\n\n## 八、融资需求\n',
  extractPlainText: (content) => content,
  defaultSystemPrompt: '你是专业的商业计划书写作顾问。擅长市场分析、商业模式设计、财务预测。回答时注重数据支撑和逻辑严密。',
  aiQuickActions: [
    { id: 'bplan:market-analysis', labelKey: 'businessPlan.marketAnalysis', icon: BarChart3, defaultPromptTemplate: '请根据以下项目描述，生成详细的市场分析（市场规模、增长趋势、竞争格局、目标用户）：\n\n{{content}}' },
    { id: 'bplan:swot', labelKey: 'businessPlan.swot', icon: BarChart3, defaultPromptTemplate: '请根据以下商业计划内容，生成 SWOT 分析（优势、劣势、机会、威胁）：\n\n{{content}}' },
    { id: 'bplan:financial', labelKey: 'businessPlan.financial', icon: BarChart3, defaultPromptTemplate: '请根据以下商业计划，生成3年财务预测框架（收入、成本、利润）：\n\n{{content}}' },
  ],
};
