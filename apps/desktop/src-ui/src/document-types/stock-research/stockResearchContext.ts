/**
 * 股票研究 AI 上下文引擎 — 分层构建上下文
 *
 * 根据分析类型智能选择层级，控制 token 在 1500 以内
 */

import type { StockResearchDocumentContent } from './types';

// ═══════════════════════════════════════════════════════
// 上下文层级定义
// ═══════════════════════════════════════════════════════

export type ContextLayer = 'stock' | 'financials' | 'technicals' | 'theses' | 'news' | 'risk';

export type ContextMode = 'auto' | 'full' | 'minimal';

export interface ContextResult {
  text: string;
  totalTokens: number;
}

export interface ContextOptions {
  /** 需要包含的层级 */
  layers?: ContextLayer[];
  /** 分析类型（自动选择层级） */
  analysisType?: 'financial' | 'technical' | 'thesis' | 'comparison' | 'report' | 'general';
  /** 上下文模式（auto/full/minimal） */
  mode?: ContextMode;
  /** 最大 token 数（约等于字符数 / 2） */
  maxTokens?: number;
  /** 是否包含财务历史 */
  includeHistory?: boolean;
  /** 新闻数量限制 */
  newsLimit?: number;
}

const DEFAULT_OPTIONS: ContextOptions = {
  layers: undefined,
  analysisType: 'general',
  maxTokens: 1500,
  includeHistory: false,
  newsLimit: 5,
};

// ═══════════════════════════════════════════════════════
// 根据分析类型选择层级
// ═══════════════════════════════════════════════════════

const ANALYSIS_TYPE_LAYERS: Record<string, ContextLayer[]> = {
  financial: ['stock', 'financials', 'theses'],
  technical: ['stock', 'technicals', 'theses'],
  thesis: ['stock', 'financials', 'technicals', 'theses', 'news'],
  comparison: ['stock', 'financials', 'theses'],
  report: ['stock', 'financials', 'technicals', 'theses', 'news', 'risk'],
  general: ['stock', 'financials', 'theses'],
};

// ═══════════════════════════════════════════════════════
// 各层级内容构建
// ═══════════════════════════════════════════════════════

/** Layer 0: 股票基础信息（~200 token） */
function buildStockLayer(research: StockResearchDocumentContent): string {
  const { stock } = research;
  const parts: string[] = [
    `股票: ${stock.name} (${stock.code})`,
    `市场: ${stock.market}`,
    `行业: ${stock.industry}`,
    `板块: ${stock.sector}`,
  ];

  if (stock.marketCap) {
    parts.push(`市值: ${stock.marketCap}亿${stock.currency === 'USD' ? '美元' : '元'}`);
  }

  if (stock.description) {
    const desc = stock.description.slice(0, 200);
    parts.push(`简介: ${desc}${stock.description.length > 200 ? '...' : ''}`);
  }

  if (stock.tags.length > 0) {
    parts.push(`标签: ${stock.tags.join(', ')}`);
  }

  return parts.join('\n');
}

/** Layer 1: 核心财务数据（~400 token） */
function buildFinancialsLayer(research: StockResearchDocumentContent, includeHistory: boolean): string {
  const { current, history } = research.financials;
  const parts: string[] = ['=== 财务指标 ==='];

  // 估值指标
  const valuation: string[] = [];
  if (current.pe !== undefined) valuation.push(`PE: ${current.pe}`);
  if (current.pb !== undefined) valuation.push(`PB: ${current.pb}`);
  if (current.ps !== undefined) valuation.push(`PS: ${current.ps}`);
  if (valuation.length > 0) parts.push(`估值: ${valuation.join(', ')}`);

  // 盈利指标
  const profitability: string[] = [];
  if (current.roe !== undefined) profitability.push(`ROE: ${current.roe}%`);
  if (current.roa !== undefined) profitability.push(`ROA: ${current.roa}%`);
  if (current.grossMargin !== undefined) profitability.push(`毛利率: ${current.grossMargin}%`);
  if (current.netMargin !== undefined) profitability.push(`净利率: ${current.netMargin}%`);
  if (profitability.length > 0) parts.push(`盈利: ${profitability.join(', ')}`);

  // 成长指标
  const growth: string[] = [];
  if (current.revenue !== undefined) growth.push(`营收: ${current.revenue}亿`);
  if (current.revenueGrowth !== undefined) growth.push(`营收增长: ${current.revenueGrowth}%`);
  if (current.netIncome !== undefined) growth.push(`净利润: ${current.netIncome}亿`);
  if (current.netIncomeGrowth !== undefined) growth.push(`利润增长: ${current.netIncomeGrowth}%`);
  if (growth.length > 0) parts.push(`成长: ${growth.join(', ')}`);

  // 现金流
  const cashflow: string[] = [];
  if (current.freeCashFlow !== undefined) cashflow.push(`FCF: ${current.freeCashFlow}亿`);
  if (current.operatingCashFlow !== undefined) cashflow.push(`经营现金流: ${current.operatingCashFlow}亿`);
  if (cashflow.length > 0) parts.push(`现金流: ${cashflow.join(', ')}`);

  // 偿债指标
  const solvency: string[] = [];
  if (current.debtToEquity !== undefined) solvency.push(`资产负债率: ${current.debtToEquity}%`);
  if (current.currentRatio !== undefined) solvency.push(`流动比率: ${current.currentRatio}`);
  if (solvency.length > 0) parts.push(`偿债: ${solvency.join(', ')}`);

  // 分红
  if (current.dividendYield !== undefined) {
    parts.push(`股息率: ${current.dividendYield}%`);
  }

  // 历史财务数据（可选）
  if (includeHistory && history.length > 0) {
    parts.push('\n=== 历史财务数据 ===');
    const recentHistory = history.slice(-8); // 最近8个季度/年
    for (const h of recentHistory) {
      const period = h.quarter ? `${h.year}Q${h.quarter}` : `${h.year}`;
      const metrics: string[] = [];
      if (h.metrics.revenue !== undefined) metrics.push(`营收${h.metrics.revenue}亿`);
      if (h.metrics.netIncome !== undefined) metrics.push(`净利${h.metrics.netIncome}亿`);
      if (h.metrics.roe !== undefined) metrics.push(`ROE ${h.metrics.roe}%`);
      if (metrics.length > 0) {
        parts.push(`${period}: ${metrics.join(', ')}`);
      }
    }
  }

  return parts.join('\n');
}

/** Layer 2: 技术指标快照（~200 token） */
function buildTechnicalsLayer(research: StockResearchDocumentContent): string {
  const tech = research.technicals;
  if (!tech) return '=== 技术指标 ===\n（暂无数据）';

  const parts: string[] = ['=== 技术指标 ==='];

  // 价格信息
  parts.push(`当前价格: ${tech.price}`);
  parts.push(`涨跌幅: ${tech.changePercent >= 0 ? '+' : ''}${tech.changePercent}%`);
  parts.push(`成交量: ${formatVolume(tech.volume)}`);

  if (tech.turnoverRate !== undefined) {
    parts.push(`换手率: ${tech.turnoverRate}%`);
  }

  // 均线系统
  const ma: string[] = [];
  if (tech.ma5 !== undefined) ma.push(`MA5: ${tech.ma5}`);
  if (tech.ma10 !== undefined) ma.push(`MA10: ${tech.ma10}`);
  if (tech.ma20 !== undefined) ma.push(`MA20: ${tech.ma20}`);
  if (tech.ma60 !== undefined) ma.push(`MA60: ${tech.ma60}`);
  if (ma.length > 0) parts.push(`均线: ${ma.join(', ')}`);

  // MACD
  if (tech.macd) {
    parts.push(`MACD: DIF ${tech.macd.dif}, DEA ${tech.macd.dea}, 柱 ${tech.macd.histogram}`);
  }

  // RSI
  if (tech.rsi !== undefined) {
    parts.push(`RSI: ${tech.rsi}`);
  }

  // KDJ
  if (tech.kdj) {
    parts.push(`KDJ: K ${tech.kdj.k}, D ${tech.kdj.d}, J ${tech.kdj.j}`);
  }

  // 支撑阻力
  if (tech.support !== undefined || tech.resistance !== undefined) {
    const sr: string[] = [];
    if (tech.support !== undefined) sr.push(`支撑 ${tech.support}`);
    if (tech.resistance !== undefined) sr.push(`阻力 ${tech.resistance}`);
    parts.push(`关键位: ${sr.join(', ')}`);
  }

  // 趋势
  if (tech.trend) {
    const trendLabel = tech.trend === 'up' ? '上升趋势' : tech.trend === 'down' ? '下降趋势' : '横盘震荡';
    parts.push(`趋势: ${trendLabel}`);
  }

  return parts.join('\n');
}

/** Layer 3: 投资论点（~300 token） */
function buildThesesLayer(research: StockResearchDocumentContent): string {
  const { theses } = research;
  if (theses.length === 0) return '=== 投资论点 ===\n（暂无论点）';

  const parts: string[] = ['=== 投资论点 ==='];

  // 只包含最近3个论点
  const recentTheses = theses.slice(-3);

  for (const thesis of recentTheses) {
    const statusLabel = thesis.status === 'bullish' ? '[看多]' : thesis.status === 'bearish' ? '[看空]' : '[中性]';
    const confidenceLabel = {
      speculative: '投机级',
      moderate: '中置信度',
      high: '高置信度',
      very_high: '极高置信度',
    }[thesis.confidence];

    parts.push(`\n${statusLabel} ${thesis.title} (${confidenceLabel})`);

    if (thesis.content) {
      parts.push(thesis.content.slice(0, 150));
    }

    if (thesis.bullishFactors.length > 0) {
      parts.push(`看多因素: ${thesis.bullishFactors.slice(0, 3).join('; ')}`);
    }

    if (thesis.bearishFactors.length > 0) {
      parts.push(`看空因素: ${thesis.bearishFactors.slice(0, 3).join('; ')}`);
    }

    if (thesis.targetPrice !== undefined) {
      parts.push(`目标价: ${thesis.targetPrice}`);
    }

    if (thesis.stopLoss !== undefined) {
      parts.push(`止损位: ${thesis.stopLoss}`);
    }
  }

  return parts.join('\n');
}

/** Layer 4: 新闻与事件（~200 token） */
function buildNewsLayer(research: StockResearchDocumentContent, limit: number): string {
  const { news } = research;
  if (news.length === 0) return '=== 新闻 ===\n（暂无新闻）';

  const parts: string[] = ['=== 近期新闻 ==='];

  const recentNews = news.slice(0, limit);
  for (const n of recentNews) {
    const sentimentIcon = n.sentiment === 'positive' ? '📈' : n.sentiment === 'negative' ? '📉' : '➖';
    const importanceMark = n.importance === 'high' ? '⚠️' : '';
    const date = new Date(n.publishedAt).toLocaleDateString('zh-CN');
    parts.push(`${sentimentIcon}${importanceMark} [${date}] ${n.title}`);
    if (n.summary) {
      parts.push(`  ${n.summary.slice(0, 100)}${n.summary.length > 100 ? '...' : ''}`);
    }
  }

  return parts.join('\n');
}

/** Layer 5: 风险与对标（~200 token） */
function buildRiskLayer(research: StockResearchDocumentContent): string {
  const parts: string[] = ['=== 风险评估 ==='];

  const { risk, peers } = research;

  if (risk) {
    const levelLabel = {
      low: '低风险',
      medium: '中等风险',
      high: '高风险',
      extreme: '极高风险',
    }[risk.level];

    parts.push(`风险等级: ${levelLabel}`);

    if (risk.score !== undefined) {
      parts.push(`风险评分: ${risk.score}/100`);
    }

    if (risk.factors.length > 0) {
      parts.push(`风险因素: ${risk.factors.slice(0, 5).join('; ')}`);
    }

    if (risk.warningSignals.length > 0) {
      parts.push(`预警信号: ${risk.warningSignals.slice(0, 3).join('; ')}`);
    }
  } else {
    parts.push('（暂无风险评估）');
  }

  // 同业对比摘要
  if (peers.length > 0) {
    parts.push('\n=== 同业对比 ===');
    for (const peer of peers.slice(0, 3)) {
      parts.push(`${peer.name} (${peer.code})`);
      if (peer.advantage) parts.push(`  优势: ${peer.advantage}`);
      if (peer.disadvantage) parts.push(`  劣势: ${peer.disadvantage}`);
    }
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════
// 主函数：构建完整上下文
// ═══════════════════════════════════════════════════════

export function buildStockResearchContext(
  research: StockResearchDocumentContent,
  options?: ContextOptions,
): ContextResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 根据 mode 调整
  let effectiveMaxTokens = opts.maxTokens || 1500;
  let effectiveLayers: ContextLayer[];

  if (opts.mode === 'minimal') {
    effectiveLayers = ['stock'];
    effectiveMaxTokens = Math.min(effectiveMaxTokens, 500);
  } else if (opts.mode === 'full') {
    effectiveLayers = ['stock', 'financials', 'technicals', 'theses', 'news', 'risk'];
    effectiveMaxTokens = Math.max(effectiveMaxTokens, 2500);
  } else {
    effectiveLayers = opts.layers || ANALYSIS_TYPE_LAYERS[opts.analysisType || 'general'] || ANALYSIS_TYPE_LAYERS.general;
  }

  const parts: string[] = [];
  let estimatedTokens = 0;

  // 按层级构建内容
  for (const layer of effectiveLayers) {
    let content = '';

    switch (layer) {
      case 'stock':
        content = buildStockLayer(research);
        break;
      case 'financials':
        content = buildFinancialsLayer(research, opts.includeHistory || false);
        break;
      case 'technicals':
        content = buildTechnicalsLayer(research);
        break;
      case 'theses':
        content = buildThesesLayer(research);
        break;
      case 'news':
        content = buildNewsLayer(research, opts.newsLimit || 5);
        break;
      case 'risk':
        content = buildRiskLayer(research);
        break;
    }

    const contentTokens = Math.ceil(content.length / 2); // 粗略估算

    // 检查是否超出限制
    if (estimatedTokens + contentTokens > effectiveMaxTokens && parts.length > 0) {
      break;
    }

    parts.push(content);
    estimatedTokens += contentTokens;
  }

  return {
    text: parts.join('\n\n'),
    totalTokens: estimatedTokens,
  };
}

// ═══════════════════════════════════════════════════════
// 便捷函数：获取特定分析的上下文
// ═══════════════════════════════════════════════════════

export function getFinancialAnalysisContext(research: StockResearchDocumentContent): ContextResult {
  return buildStockResearchContext(research, {
    analysisType: 'financial',
    includeHistory: true,
    maxTokens: 1500,
  });
}

export function getTechnicalAnalysisContext(research: StockResearchDocumentContent): ContextResult {
  return buildStockResearchContext(research, {
    analysisType: 'technical',
    maxTokens: 1200,
  });
}

export function getThesisContext(research: StockResearchDocumentContent): ContextResult {
  return buildStockResearchContext(research, {
    analysisType: 'thesis',
    maxTokens: 1500,
  });
}

export function getFullReportContext(research: StockResearchDocumentContent): ContextResult {
  return buildStockResearchContext(research, {
    analysisType: 'report',
    includeHistory: true,
    newsLimit: 10,
    maxTokens: 2500,
  });
}

// ═══════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════

function formatVolume(volume: number): string {
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(2)}亿`;
  } else if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)}万`;
  }
  return String(volume);
}

/** 获取数据区块的更新时间戳 */
function getDataTimestamp(research: StockResearchDocumentContent, key: string): number | null {
  const { dataFreshnessMap, financials, technicals, risk } = research;
  
  // 优先使用 dataFreshnessMap
  if (dataFreshnessMap?.[key]) {
    return dataFreshnessMap[key];
  }
  
  // 回退到各数据区块的更新/获取时间戳
  switch (key) {
    case 'financials':
      return financials.current.updatedAt || null;
    case 'technicals':
      return technicals?.updatedAt || technicals?.fetchedAt || null;
    case 'risk':
      return risk?.assessedAt || null;
    default:
      return null;
  }
}

/** 计算距今多少天 */
function daysSince(timestamp: number | null): number {
  if (!timestamp) return Infinity;
  const now = Date.now();
  const diff = now - timestamp;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** 获取数据新鲜度状态（用于 UI 指示器）
 * @returns 'fresh' | 'warning' | 'stale' | 'unknown'
 */
export function getDataFreshnessStatus(research: StockResearchDocumentContent, key: string): {
  status: 'fresh' | 'warning' | 'stale' | 'unknown';
  days: number;
} {
  const timestamp = getDataTimestamp(research, key);
  const days = daysSince(timestamp);
  
  if (days === Infinity) {
    return { status: 'unknown', days: Infinity };
  }
  if (days > 7) {
    return { status: 'stale', days };
  }
  if (days > 3) {
    return { status: 'warning', days };
  }
  return { status: 'fresh', days };
}

/** 获取整体数据新鲜度（取最差状态） */
export function getOverallDataFreshness(research: StockResearchDocumentContent): {
  status: 'fresh' | 'warning' | 'stale' | 'unknown';
  maxDays: number;
  sections: { key: string; label: string; status: string; days: number }[];
} {
  const sections = [
    { key: 'financials', label: '财务数据' },
    { key: 'technicals', label: '技术指标' },
    { key: 'news', label: '新闻动态' },
    { key: 'risk', label: '风险评估' },
  ];
  
  const results = sections.map(({ key, label }) => {
    const { status, days } = getDataFreshnessStatus(research, key);
    return { key, label, status, days };
  });
  
  // 找出最差状态
  let worstStatus: 'fresh' | 'warning' | 'stale' | 'unknown' = 'fresh';
  let maxDays = 0;
  for (const r of results) {
    if (r.status === 'unknown') worstStatus = 'unknown';
    else if (r.status === 'stale' && worstStatus !== 'unknown') worstStatus = 'stale';
    else if (r.status === 'warning' && worstStatus === 'fresh') worstStatus = 'warning';
    if (r.days !== Infinity && r.days > maxDays) maxDays = r.days;
  }
  
  return { status: worstStatus, maxDays, sections: results };
}
export function buildFreshnessWarning(
  research: StockResearchDocumentContent,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const warnings: string[] = [];
  const today = new Date().toLocaleDateString('zh-CN');
  
  // 检查各数据区块的新鲜度
  const dataSections = [
    { key: 'financials', label: t('stockResearch.financialData', { defaultValue: '财务数据' }) },
    { key: 'technicals', label: t('stockResearch.technicalData', { defaultValue: '技术指标' }) },
    { key: 'news', label: t('stockResearch.newsData', { defaultValue: '新闻动态' }) },
    { key: 'risk', label: t('stockResearch.riskAssessment', { defaultValue: '风险评估' }) },
  ];
  
  for (const { key, label } of dataSections) {
    const timestamp = getDataTimestamp(research, key);
    const days = daysSince(timestamp);
    
    if (days === Infinity) {
      warnings.push(`⚠️ ${label}: ${t('stockResearch.dataNotAvailable', { defaultValue: '暂无数据' })}`);
    } else if (days > 30) {
      warnings.push(`⚠️ ${label}: ${t('stockResearch.dataStale', { days, defaultValue: `${days}天未更新，数据可能已过时` })}`);
    } else if (days > 7) {
      warnings.push(`⚠️ ${label}: ${t('stockResearch.dataOld', { days, defaultValue: `${days}天前更新` })}`);
    }
  }
  
  if (warnings.length === 0) {
    return `\n【数据状态】${t('stockResearch.dataFresh', { defaultValue: '所有数据均为近期更新' })}\n今日: ${today}`;
  }
  
  return `\n【数据状态】\n${warnings.join('\n')}\n\n${t('stockResearch.webSearchRequired', { defaultValue: '建议开启联网搜索获取最新数据' })}\n今日: ${today}`;
}

/** 更新数据新鲜度映射表 */
export function updateDataFreshnessMap(
  research: StockResearchDocumentContent,
  key: string,
  timestamp?: number,
): StockResearchDocumentContent {
  const now = timestamp || Date.now();
  return {
    ...research,
    dataFreshnessMap: {
      ...research.dataFreshnessMap,
      [key]: now,
    },
  };
}

/** 获取模板变量替换后的 prompt */
export function fillPromptTemplate(
  template: string,
  research: StockResearchDocumentContent,
  extraVars?: Record<string, string>,
): string {
  const { stock, financials, technicals, news, peers } = research;

  const vars: Record<string, string> = {
    stockName: stock.name,
    stockCode: stock.code,
    market: stock.market,
    industry: stock.industry,
    sector: stock.sector,

    // 财务指标
    pe: financials.current.pe !== undefined ? String(financials.current.pe) : 'N/A',
    pb: financials.current.pb !== undefined ? String(financials.current.pb) : 'N/A',
    roe: financials.current.roe !== undefined ? `${financials.current.roe}%` : 'N/A',
    revenueGrowth: financials.current.revenueGrowth !== undefined ? `${financials.current.revenueGrowth}%` : 'N/A',

    // 技术指标
    currentPrice: technicals?.price !== undefined ? String(technicals.price) : 'N/A',

    // 上下文
    financials: buildFinancialsLayer(research, false),
    technicals: buildTechnicalsLayer(research),
    fullContext: buildStockResearchContext(research, { analysisType: 'general', maxTokens: 2000 }).text,
    peers: peers.map(p => `${p.name}(${p.code})`).join(', ') || '无',
    newsContent: news.length > 0 ? news[0].summary : '无',

    // 当前日期
    currentDate: new Date().toLocaleDateString('zh-CN'),

    // 额外变量
    ...extraVars,
  };

  // 替换模板变量
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return result;
}

/** 获取近 N 个交易日的日期 */
export function getRecentTradeDates(count: number = 20): string[] {
  const dates: string[] = [];
  const now = new Date();
  let daysAdded = 0;
  let daysBack = 0;

  while (daysAdded < count && daysBack < 365) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysBack);
    const dayOfWeek = date.getDay();

    // 跳过周末
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}${month}${day}`);
      daysAdded++;
    }
    daysBack++;
  }

  return dates;
}

/** 计算日期范围（最近 N 个月） */
export function getDateRange(months: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

/** 格式化 Tushare 日线数据为 Markdown 表格 */
export function formatDailyToMarkdown(data: unknown): string {
  if (!data || typeof data !== 'object') return '无数据';

  const result = data as { data?: unknown[]; fields?: string[] };
  const rows = result.data || [];
  const fields = result.fields || ['ts_code', 'trade_date', 'open', 'high', 'low', 'close', 'vol', 'amount'];

  if (!Array.isArray(rows) || rows.length === 0) return '无数据';

  const header = `| ${fields.join(' | ')} |`;
  const separator = `| ${fields.map(() => '---').join(' | ')} |`;

  const body = rows.slice(0, 20).map((row: unknown) => {
    if (!Array.isArray(row)) return '';
    return `| ${row.map((v) => (v !== null && v !== undefined ? String(v) : '-')).join(' | ')} |`;
  }).join('\n');

  return `${header}\n${separator}\n${body}`;
}

/** 格式化资金流向数据为 Markdown */
export function formatMoneyflowToMarkdown(data: unknown): string {
  if (!data || typeof data !== 'object') return '无数据';

  const result = data as { data?: unknown[] };
  const rows = result.data || [];

  if (!Array.isArray(rows) || rows.length === 0) return '无数据';

  const header = `| 日期 | 小单净流入 | 中单净流入 | 大单净流入 | 超大单净流入 |`;
  const separator = `| --- | --- | --- | --- | --- |`;

  const body = rows.slice(0, 10).map((row: unknown) => {
    if (!Array.isArray(row)) return '';
    return `| ${row.slice(0, 5).map((v) => (v !== null && v !== undefined ? String(v) : '-')).join(' | ')} |`;
  }).join('\n');

  return `${header}\n${separator}\n${body}`;
}
