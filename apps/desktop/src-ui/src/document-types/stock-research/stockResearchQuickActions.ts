/**
 * 股票研究 AI 快捷操作定义
 */

import {
  TrendingUp, BarChart3, PieChart, Activity,
  Target, AlertTriangle, FileText, FileSpreadsheet, MessageSquare,
  LineChart, DollarSign, Shield, Search, Lightbulb, Sparkles,
  RotateCcw, RefreshCw, Calculator,
} from 'lucide-react';
import { ALL_PROMPTS } from './ai/prompts';

// ═══════════════════════════════════════════════════════
// 快捷操作分类
// ═══════════════════════════════════════════════════════

export type QuickActionCategory = 'financial' | 'technical' | 'thesis' | 'comparison' | 'report' | 'refresh';

export interface QuickActionCategoryDef {
  key: QuickActionCategory;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const QUICK_ACTION_CATEGORIES: QuickActionCategoryDef[] = [
  { key: 'financial', labelKey: 'stockResearch.categoryFinancial', icon: DollarSign, color: 'text-green-500' },
  { key: 'technical', labelKey: 'stockResearch.categoryTechnical', icon: LineChart, color: 'text-blue-500' },
  { key: 'thesis', labelKey: 'stockResearch.categoryThesis', icon: Lightbulb, color: 'text-amber-500' },
  { key: 'comparison', labelKey: 'stockResearch.categoryComparison', icon: BarChart3, color: 'text-purple-500' },
  { key: 'report', labelKey: 'stockResearch.categoryReport', icon: FileText, color: 'text-slate-500' },
  { key: 'refresh', labelKey: 'stockResearch.categoryRefresh', icon: RefreshCw, color: 'text-orange-500' },
];

// ═══════════════════════════════════════════════════════
// 快捷操作接口
// ═══════════════════════════════════════════════════════

export interface QuickAction {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  category: QuickActionCategory;
  /** prompt 模板 ID（对应 prompts.ts） */
  promptId?: string;
  /** 直接内联 prompt（优先使用） */
  promptTemplate?: string;
  /** 是否需要额外上下文 */
  requiresContext?: 'financials' | 'technicals' | 'theses' | 'news' | 'all';
  /** 强制启用联网搜索（用于数据刷新操作） */
  forceWebSearch?: boolean;
  /** 排序权重 */
  order: number;
}

// ═══════════════════════════════════════════════════════
// 财务分析快捷操作
// ═══════════════════════════════════════════════════════

const FINANCIAL_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:dupont',
    labelKey: 'stockResearch.actionDupont',
    icon: PieChart,
    category: 'financial',
    promptId: 'dupont_analysis',
    requiresContext: 'financials',
    order: 1,
  },
  {
    id: 'stock-research:cashflow',
    labelKey: 'stockResearch.actionCashflow',
    icon: Activity,
    category: 'financial',
    promptId: 'cashflow_quality',
    requiresContext: 'financials',
    order: 2,
  },
  {
    id: 'stock-research:health',
    labelKey: 'stockResearch.actionHealthCheck',
    icon: Shield,
    category: 'financial',
    promptId: 'financial_health',
    requiresContext: 'financials',
    order: 3,
  },
  {
    id: 'stock-research:valuation',
    labelKey: 'stockResearch.actionValuation',
    icon: DollarSign,
    category: 'financial',
    promptId: 'valuation_model',
    requiresContext: 'financials',
    order: 4,
  },
  {
    id: 'stock-research:fraud',
    labelKey: 'stockResearch.actionFraudDetect',
    icon: AlertTriangle,
    category: 'financial',
    promptId: 'fraud_detection',
    requiresContext: 'financials',
    order: 5,
  },
  {
    id: 'stock-research:dividend',
    labelKey: 'stockResearch.actionDividend',
    icon: DollarSign,
    category: 'financial',
    promptId: 'dividend_analysis',
    requiresContext: 'financials',
    order: 6,
  },
  {
    id: 'stock-research:valuation-anchor',
    labelKey: 'stockResearch.actionValuationAnchor',
    icon: Target,
    category: 'financial',
    promptId: 'valuation_anchor',
    requiresContext: 'financials',
    order: 7,
  },
];

// ═══════════════════════════════════════════════════════
// 技术分析快捷操作
// ═══════════════════════════════════════════════════════

const TECHNICAL_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:candlestick',
    labelKey: 'stockResearch.actionCandlestick',
    icon: BarChart3,
    category: 'technical',
    promptId: 'candlestick_pattern',
    requiresContext: 'technicals',
    order: 1,
  },
  {
    id: 'stock-research:multi-period',
    labelKey: 'stockResearch.actionMultiPeriod',
    icon: LineChart,
    category: 'technical',
    promptId: 'multi_period_trend',
    requiresContext: 'technicals',
    order: 2,
  },
  {
    id: 'stock-research:volume-price',
    labelKey: 'stockResearch.actionVolumePrice',
    icon: Activity,
    category: 'technical',
    promptId: 'volume_price',
    requiresContext: 'technicals',
    order: 3,
  },
  {
    id: 'stock-research:tech-score',
    labelKey: 'stockResearch.actionTechScore',
    icon: Target,
    category: 'technical',
    promptId: 'tech_score',
    requiresContext: 'technicals',
    order: 4,
  },
];

// ═══════════════════════════════════════════════════════
// 投资论点快捷操作
// ═══════════════════════════════════════════════════════

const THESIS_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:invest-story',
    labelKey: 'stockResearch.actionInvestStory',
    icon: Lightbulb,
    category: 'thesis',
    promptId: 'investment_story',
    requiresContext: 'all',
    order: 1,
  },
  {
    id: 'stock-research:thesis-framework',
    labelKey: 'stockResearch.actionThesisFramework',
    icon: TrendingUp,
    category: 'thesis',
    promptId: 'thesis_framework',
    requiresContext: 'all',
    order: 2,
  },
  {
    id: 'stock-research:catalyst',
    labelKey: 'stockResearch.actionCatalyst',
    icon: Target,
    category: 'thesis',
    promptId: 'catalyst_tracker',
    requiresContext: 'all',
    order: 3,
  },
  {
    id: 'stock-research:scenario',
    labelKey: 'stockResearch.actionScenario',
    icon: BarChart3,
    category: 'thesis',
    promptId: 'scenario_analysis',
    requiresContext: 'all',
    order: 4,
  },
  {
    id: 'stock-research:management',
    labelKey: 'stockResearch.actionManagement',
    icon: Shield,
    category: 'thesis',
    promptId: 'management_analysis',
    requiresContext: 'all',
    order: 5,
  },
  {
    id: 'stock-research:scenario-sensitivity-calc',
    labelKey: 'stockResearch.actionScenarioSensitivity',
    icon: Calculator,
    category: 'thesis',
    promptTemplate: `【任务】为 {{stockName}}（{{stockCode}}）写「情景分析」用的计算文档行：例如基准/乐观/悲观下净利润或营收变动 → 推导 PE、估值差额或简易 DCF 中某一期的 npv 片段（可用 npv([], 折现率) 示意）。

【要求】
1. 变量命名清晰；情景用中文注释行区分。
2. 仅使用计算器支持的函数；折现、增长用幂与百分数即可。
3. 末尾 \`\`\`formula 输出。

【上下文】
{{fullContext}}`,
    requiresContext: 'all',
    order: 6,
  },
];

// ═══════════════════════════════════════════════════════
// 对标与新闻快捷操作
// ═══════════════════════════════════════════════════════

const COMPARISON_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:peer-analysis',
    labelKey: 'stockResearch.actionPeerAnalysis',
    icon: BarChart3,
    category: 'comparison',
    promptId: 'peer_analysis',
    requiresContext: 'all',
    order: 1,
  },
  {
    id: 'stock-research:news-impact',
    labelKey: 'stockResearch.actionNewsImpact',
    icon: Search,
    category: 'comparison',
    promptId: 'news_impact',
    requiresContext: 'news',
    order: 2,
  },
  {
    id: 'stock-research:industry-cycle',
    labelKey: 'stockResearch.actionIndustryCycle',
    icon: TrendingUp,
    category: 'comparison',
    promptId: 'industry_cycle',
    requiresContext: 'all',
    order: 3,
  },
  {
    id: 'stock-research:fund-flow',
    labelKey: 'stockResearch.actionFundFlow',
    icon: Activity,
    category: 'comparison',
    promptId: 'fund_flow',
    requiresContext: 'technicals',
    order: 4,
  },
  {
    id: 'stock-research:peer-ratio-lines',
    labelKey: 'stockResearch.actionPeerRatioLines',
    icon: BarChart3,
    category: 'comparison',
    promptTemplate: `【任务】基于 {{stockName}}（{{stockCode}}）与对标公司数据，生成「计算文档」用的多行算式，便于横向对比同一口径下的 PE、PB、ROE、毛利率、净利率等。

【要求】
1. 为每家公司预留变量前缀或用注释行区分（如 // 本公司、// 对标A）；仅使用计算器支持的函数与运算符。
2. 数据缺失处用占位变量并注明来源。
3. 末尾 \`\`\`formula 代码块输出全部行。

【上下文】
{{fullContext}}`,
    requiresContext: 'all',
    order: 5,
  },
];

// ═══════════════════════════════════════════════════════
// 报告生成快捷操作
// ═══════════════════════════════════════════════════════

const REPORT_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:summary',
    labelKey: 'stockResearch.actionSummary',
    icon: FileText,
    category: 'report',
    promptId: 'research_summary',
    requiresContext: 'all',
    order: 1,
  },
  {
    id: 'stock-research:full-report',
    labelKey: 'stockResearch.actionFullReport',
    icon: FileSpreadsheet,
    category: 'report',
    promptId: 'full_report',
    requiresContext: 'all',
    order: 2,
  },
  {
    id: 'stock-research:calc-formulas',
    labelKey: 'stockResearch.actionCalcFormulas',
    icon: Calculator,
    category: 'report',
    promptTemplate: `【任务】针对 {{stockName}}（{{stockCode}}），生成一批可在 AiDocPlus「计算文档」中直接粘贴、逐行执行的估值与财务比率算式。

【硬性规则】
1. 仅使用计算器已支持的语法：四则运算、百分数、幂、方括号数组，以及 npv、irr、pmt、fv、pv、nper、rate、sum、mean、median、std、variance、min、max 等与官方函数目录一致的函数；禁止编造 XIRR、VLOOKUP、GOOGLEFINANCE 等未列出名称。
2. 每行一条；中文变量名；需要展示单位时用双引号，如 14.2 "倍"、9.8%。
3. 结合下方上下文中的数据填数；缺失项写占位变量并注释「需从财报/行情填入」。
4. 至少覆盖其中若干：PE、PB（若有）、PS（若有）、ROE、净利率/毛利率、股息率（若有）、营收或盈利同比增速、简易 CAGR 或持有期收益、利息覆盖倍数（若有 EBIT 与利息）。
5. 回复末尾用单独一个 \`\`\`formula 代码块给出全部可执行行（可多行）。

【当前数据】
{{fullContext}}`,
    requiresContext: 'all',
    order: 3,
  },
];

// ═══════════════════════════════════════════════════════
// 数据刷新快捷操作
// ═══════════════════════════════════════════════════════

const REFRESH_ACTIONS: QuickAction[] = [
  {
    id: 'stock-research:refresh-financials',
    labelKey: 'stockResearch.actionRefreshFinancials',
    icon: RotateCcw,
    category: 'refresh',
    promptTemplate: `【任务】刷新股票「{{stockCode}} {{stockName}}」的财务数据。

【强制要求】
1. 必须通过联网搜索获取最新财务数据（PE、PB、ROE、营收、净利润等）
2. 如果数据无法获取，填写 null，禁止编造
3. 返回格式为 JSON：

\`\`\`json
{
  "financials": {
    "pe": 市盈率（数值或null）,
    "pb": 市净率（数值或null）,
    "roe": 净资产收益率（数值或null）,
    "grossMargin": 毛利率（数值或null）,
    "netMargin": 净利率（数值或null）,
    "revenue": 营收（亿元，数值或null）,
    "revenueGrowth": 营收增长率（数值或null）,
    "netIncome": 净利润（亿元，数值或null）,
    "netIncomeGrowth": 净利润增长率（数值或null）,
    "updatedAt": 数据获取时间戳
  }
}
\`\`\`

当前数据：{{fullContext}}`,
    forceWebSearch: true,
    requiresContext: 'financials',
    order: 1,
  },
  {
    id: 'stock-research:refresh-technicals',
    labelKey: 'stockResearch.actionRefreshTechnicals',
    icon: RefreshCw,
    category: 'refresh',
    promptTemplate: `【任务】刷新股票「{{stockCode}} {{stockName}}」的技术指标。

【强制要求】
1. 必须通过联网搜索获取最新技术指标
2. 如果数据无法获取，填写 null，禁止编造
3. 返回格式为 JSON：

\`\`\`json
{
  "technicals": {
    "price": 当前价格（数值或null）,
    "changePercent": 涨跌幅（数值或null）,
    "volume": 成交量（数值或null）,
    "ma5": 5日均线（数值或null）,
    "ma20": 20日均线（数值或null）,
    "support": 支撑位（数值或null）,
    "resistance": 阻力位（数值或null）,
    "trend": "趋势方向（up/down/sideways）",
    "updatedAt": 数据获取时间戳
  }
}
\`\`\`

当前数据：{{fullContext}}`,
    forceWebSearch: true,
    requiresContext: 'technicals',
    order: 2,
  },
  {
    id: 'stock-research:refresh-news',
    labelKey: 'stockResearch.actionRefreshNews',
    icon: Search,
    category: 'refresh',
    promptTemplate: `【任务】刷新股票「{{stockCode}} {{stockName}}」的最新新闻。

【强制要求】
1. 必须通过联网搜索获取最新新闻（最近 7 天内）
2. 每条新闻必须包含：标题、摘要、来源、情感、重要度
3. 返回格式为 JSON：

\`\`\`json
{
  "news": [
    {
      "title": "新闻标题",
      "summary": "摘要（50字内）",
      "source": "新闻来源",
      "sentiment": "positive/negative/neutral",
      "importance": "high/medium/low",
      "publishedAt": 发布时间戳
    }
  ]
}
\`\`\`

当前新闻：{{fullContext}}`,
    forceWebSearch: true,
    requiresContext: 'news',
    order: 3,
  },
  {
    id: 'stock-research:refresh-risk',
    labelKey: 'stockResearch.actionRefreshRisk',
    icon: Shield,
    category: 'refresh',
    promptTemplate: `【任务】重新评估股票「{{stockCode}} {{stockName}}」的风险状况。

【强制要求】
1. 必须通过联网搜索获取最新风险信息
2. 考虑近期新闻、财务变化、技术形态
3. 返回格式为 JSON：

\`\`\`json
{
  "risk": {
    "level": "low/medium/high",
    "score": 风险评分（0-100）,
    "factors": ["风险因素1", "风险因素2"],
    "warningSignals": ["预警信号1"],
    "assessedAt": 评估时间戳
  }
}
\`\`\`

当前风险评估：{{fullContext}}`,
    forceWebSearch: true,
    requiresContext: 'all',
    order: 4,
  },
];

// ═══════════════════════════════════════════════════════
// 合并所有快捷操作
// ═══════════════════════════════════════════════════════

export const ALL_QUICK_ACTIONS: QuickAction[] = [
  ...FINANCIAL_ACTIONS,
  ...TECHNICAL_ACTIONS,
  ...THESIS_ACTIONS,
  ...COMPARISON_ACTIONS,
  ...REPORT_ACTIONS,
  ...REFRESH_ACTIONS,
].sort((a, b) => {
  // 先按分类排序，再按 order 排序
  const categoryOrder: QuickActionCategory[] = ['financial', 'technical', 'thesis', 'comparison', 'report', 'refresh'];
  const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
  if (catDiff !== 0) return catDiff;
  return a.order - b.order;
});

// ═══════════════════════════════════════════════════════
// 按分类获取快捷操作
// ═══════════════════════════════════════════════════════

export function getQuickActionsByCategory(category: QuickActionCategory): QuickAction[] {
  return ALL_QUICK_ACTIONS.filter(a => a.category === category);
}

export function getQuickActionById(id: string): QuickAction | undefined {
  return ALL_QUICK_ACTIONS.find(a => a.id === id);
}

/** 获取 prompt 模板 */
export function getPromptForAction(action: QuickAction): string | undefined {
  if (action.promptTemplate) return action.promptTemplate;
  if (action.promptId) {
    const promptDef = ALL_PROMPTS[action.promptId as keyof typeof ALL_PROMPTS];
    return promptDef?.prompt;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════
// DocTypeDefinition 需要的 aiQuickActions 格式
// ═══════════════════════════════════════════════════════

export const AI_QUICK_ACTIONS_FOR_DEFINITION = [
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
];
