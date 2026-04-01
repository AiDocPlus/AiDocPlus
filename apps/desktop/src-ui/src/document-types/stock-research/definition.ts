/**
 * stock-research 文档类型定义 — 股票研究
 * layoutMode='full'，自定义四栏布局
 */
import { lazy } from 'react';
import { TrendingUp, Sparkles, MessageSquare, DollarSign, Activity, FileText } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyStockResearchContent, extractStockResearchPlainText } from './types';
import { STOCK_RESEARCH_SYSTEM_PROMPT } from './ai/prompts';

export const stockResearchDocType: DocTypeDefinition = {
  id: 'stock-research',
  version: '1.0.0',
  labelKey: 'docType.stockResearch',
  descriptionKey: 'docType.stockResearchDesc',
  icon: TrendingUp,
  fileSuffix: '.stock',
  category: 'other',

  EditorComponent: lazy(() => import('./StockResearchWorkspace')),
  layoutMode: 'full',

  createEmptyContent: () => JSON.stringify(createEmptyStockResearchContent()),
  extractPlainText: (content) => extractStockResearchPlainText(content),

  defaultSystemPrompt: STOCK_RESEARCH_SYSTEM_PROMPT,

  aiQuickActions: [
    {
      id: 'stock-research:analyze',
      labelKey: 'stockResearch.actionQuickAnalyze',
      icon: Sparkles,
      defaultPromptTemplate: `请快速分析 {{stockName}}（{{stockCode}}）的投资价值：

1. 公司概况（1-2句话）
2. 核心优势（2-3点）
3. 主要风险（2-3点）
4. 当前技术位置
5. 投资建议（1句话）

参考数据：
{{fullContext}}`,
    },
    {
      id: 'stock-research:qa',
      labelKey: 'stockResearch.actionQA',
      icon: MessageSquare,
      defaultPromptTemplate: `关于 {{stockName}}（{{stockCode}}），我有以下问题：

{{selection}}

请结合以下数据进行解答：
{{fullContext}}`,
    },
    {
      id: 'stock-research:fetch-daily',
      labelKey: 'stockResearch.actionFetchDaily',
      icon: TrendingUp,
      defaultPromptTemplate: `请获取 {{stockName}}（{{stockCode}}）最近20个交易日的日线数据，并分析走势：

1. 近期涨跌幅统计
2. 均线位置分析（5/10/20/60日均线）
3. 成交量变化
4. 近期支撑位和压力位
5. 技术面综合判断

如数据不足，请先调用 stock_daily 工具获取数据。`,
    },
    {
      id: 'stock-research:fetch-financial',
      labelKey: 'stockResearch.actionFetchFinancial',
      icon: DollarSign,
      defaultPromptTemplate: `请获取 {{stockName}}（{{stockCode}}）最近2年财务数据，进行财务分析：

1. 盈利能力（ROE、毛利率、净利率）及趋势
2. 成长能力（营收增速、净利润增速）
3. 偿债能力（资产负债率、流动比率）
4. 估值分析（PE、PB 当前水平）
5. 财务综合评价

如数据不足，请先调用 stock_income、stock_balance_sheet、stock_indicator 等工具获取数据。`,
    },
    {
      id: 'stock-research:fetch-moneyflow',
      labelKey: 'stockResearch.actionFetchMoneyflow',
      icon: Activity,
      defaultPromptTemplate: `请获取 {{stockName}}（{{stockCode}}）最近1个月资金流向数据，分析主力动向：

1. 主力资金净流入/净流出
2. 超大单、大单、中单、小单资金分布
3. 北向资金持股变化（如有）
4. 融资融券余额变化（如有）
5. 资金面对股价影响判断

如数据不足，请先调用 stock_moneyflow、stock_hsgt_top、stock_margin_detail 等工具获取数据。`,
    },
    {
      id: 'stock-research:comprehensive',
      labelKey: 'stockResearch.actionComprehensive',
      icon: FileText,
      defaultPromptTemplate: `请对 {{stockName}}（{{stockCode}}）进行全面研究：

1. 基本信息（请调用 stock_basic_info）
2. 近期行情分析最近20日（请调用 stock_daily）
3. 财务数据分析2年（请调用 stock_income、stock_indicator）
4. 资金流向分析（请调用 stock_moneyflow）
5. 综合投资建议

请逐步调用工具获取数据，然后给出完整分析报告。`,
    },
  ],
};
