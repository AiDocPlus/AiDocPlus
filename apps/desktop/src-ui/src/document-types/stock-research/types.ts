/**
 * 股票研究文档类型 — 内部数据结构和操作函数
 * 所有数据存储在 Document.content 字段中的 JSON
 */

// ═══════════════════════════════════════════════════════
// 枚举类型
// ═══════════════════════════════════════════════════════

/** 研究阶段 */
export type StockResearchPhase = 'watching' | 'holding' | 'closed' | 'archived';

/** 交易方向 */
export type TradeDirection = 'buy' | 'sell' | 'dividend';

/** 交易类型 */
export type TradeType = 'market' | 'limit' | 'short' | 'option';

/** 风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

/** 论点状态 */
export type ThesisStatus = 'bullish' | 'bearish' | 'neutral';

/** 论点置信度 */
export type ThesisConfidence = 'speculative' | 'moderate' | 'high' | 'very_high';

/** 数据来源 */
export type StockDataSource = 'manual' | 'tushare';

// ═══════════════════════════════════════════════════════
// 核心数据模型
// ═══════════════════════════════════════════════════════

/** 股票研究文档内容（顶层结构） */
export interface StockResearchDocumentContent {
  version: 1;
  stock: StockInfo;
  financials: StockFinancials;
  technicals: TechnicalIndicators | null;
  news: StockNews[];
  theses: InvestmentThesis[];
  trades: TradeRecord[];
  positions: PositionSnapshot[];
  risk: RiskAssessment | null;
  peers: PeerComparison[];
  notes: ResearchNote[];
  settings: StockResearchSettings;
  metadata: StockResearchMetadata;
  dataFreshnessMap?: Record<string, number>;
}

/** 股票基础信息 */
export interface StockInfo {
  code: string;                    // 股票代码（如 600519, AAPL）
  name: string;                    // 股票名称
  market: string;                  // 市场（SH/SZ/NASDAQ/NYSE/HK）
  industry: string;                // 所属行业
  sector: string;                  // 所属板块
  tags: string[];                  // 自定义标签
  description: string;             // 公司简介
  marketCap?: number;              // 市值（亿元/亿美元）
  currency: string;                // 货币单位
}

/** 财务数据 */
export interface StockFinancials {
  current: FinancialMetrics;       // 当前财务指标
  history: FinancialHistory[];     // 历史财务数据
}

/** 财务指标 */
export interface FinancialMetrics {
  pe?: number;                     // 市盈率
  pb?: number;                     // 市净率
  ps?: number;                     // 市销率
  roe?: number;                    // 净资产收益率 (%)
  roa?: number;                    // 总资产收益率 (%)
  grossMargin?: number;            // 毛利率 (%)
  netMargin?: number;              // 净利率 (%)
  revenue?: number;                // 营收（亿元/亿美元）
  revenueGrowth?: number;          // 营收增长率 (%)
  netIncome?: number;              // 净利润（亿元/亿美元）
  netIncomeGrowth?: number;        // 净利润增长率 (%)
  eps?: number;                    // 每股收益
  dividendYield?: number;          // 股息率 (%)
  debtToEquity?: number;           // 资产负债率 (%)
  currentRatio?: number;           // 流动比率
  quickRatio?: number;             // 速动比率
  freeCashFlow?: number;           // 自由现金流
  operatingCashFlow?: number;      // 经营现金流
  bookValuePerShare?: number;      // 每股净资产
  updatedAt?: number;              // 更新时间戳
}

/** 历史财务数据 */
export interface FinancialHistory {
  year: number;                    // 年份
  quarter?: number;                // 季度（可选）
  metrics: FinancialMetrics;
}

/** 日线行情数据（供 K 线图使用） */
export interface DailyQuote {
  date: string;                    // 日期 YYYY-MM-DD
  open: number;                    // 开盘价
  high: number;                    // 最高价
  low: number;                     // 最低价
  close: number;                   // 收盘价
  volume: number;                  // 成交量（手）
  amount?: number;                 // 成交额（万元）
}

/** 技术指标 */
export interface TechnicalIndicators {
  price: number;                   // 当前价格
  changePercent: number;           // 涨跌幅 (%)
  volume: number;                  // 成交量
  turnoverRate?: number;           // 换手率 (%)
  ma5?: number;                    // 5日均线
  ma10?: number;                   // 10日均线
  ma20?: number;                   // 20日均线
  ma60?: number;                   // 60日均线
  ma120?: number;                  // 120日均线
  macd?: {                         // MACD 指标
    dif: number;
    dea: number;
    histogram: number;
  };
  rsi?: number;                    // RSI 指标
  kdj?: {                          // KDJ 指标
    k: number;
    d: number;
    j: number;
  };
  support?: number;                // 支撑位
  resistance?: number;             // 阻力位
  trend?: 'up' | 'down' | 'sideways'; // 趋势方向
  dailyData?: DailyQuote[];        // 日线数据（供 K 线图使用）
  updatedAt?: number;              // 更新时间戳
  fetchedAt?: number;              // 数据获取时间戳
}

/** 新闻/公告 */
export interface StockNews {
  id: string;
  title: string;                   // 标题
  summary: string;                 // 摘要
  source: string;                  // 来源
  url?: string;                    // 链接
  sentiment?: 'positive' | 'negative' | 'neutral'; // 情感倾向
  importance?: 'high' | 'medium' | 'low'; // 重要性
  publishedAt: number;             // 发布时间
  createdAt: number;               // 记录创建时间
}

/** 投资论点 */
export interface InvestmentThesis {
  id: string;
  status: ThesisStatus;            // 多空立场
  confidence: ThesisConfidence;    // 置信度
  title: string;                   // 论点标题
  content: string;                 // 论点内容
  bullishFactors: string[];        // 看多因素
  bearishFactors: string[];        // 看空因素
  targetPrice?: number;            // 目标价
  stopLoss?: number;               // 止损位
  catalysts: string[];             // 催化剂
  risks: string[];                 // 风险因素
  validUntil?: number;             // 有效期
  createdAt: number;
  updatedAt: number;
}

/** 交易记录 */
export interface TradeRecord {
  id: string;
  direction: TradeDirection;       // 买卖方向
  type: TradeType;                 // 交易类型
  price: number;                   // 成交价格
  quantity: number;                // 成交数量
  amount: number;                  // 成交金额
  fee?: number;                    // 手续费
  note?: string;                   // 备注
  executedAt: number;              // 执行时间
  createdAt: number;
}

/** 持仓快照 */
export interface PositionSnapshot {
  id: string;
  quantity: number;                // 持仓数量
  avgCost?: number;                // 平均成本
  currentPrice?: number;           // 当前价格
  marketValue?: number;            // 市值
  profitLoss?: number;             // 盈亏金额
  profitLossPercent?: number;      // 盈亏比例 (%)
  snapshotAt: number;              // 快照时间
}

/** 风险评估 */
export interface RiskAssessment {
  level: RiskLevel;                // 风险等级
  score?: number;                  // 风险评分（0-100）
  factors: string[];               // 风险因素
  mitigation?: string;             // 风险缓释措施
  warningSignals: string[];        // 预警信号
  assessedAt: number;              // 评估时间
}

/** 同业对比 */
export interface PeerComparison {
  id: string;
  code: string;                    // 对比公司代码
  name: string;                    // 对比公司名称
  metrics: Partial<FinancialMetrics>; // 对比指标
  advantage?: string;              // 相对优势
  disadvantage?: string;           // 相对劣势
  note?: string;                   // 备注
}

/** 研究笔记 */
export interface ResearchNote {
  id: string;
  title: string;                   // 标题
  content: string;                 // Markdown 内容
  tags: string[];                  // 标签
  createdAt: number;
  updatedAt: number;
}

/** 文档设置 */
export interface StockResearchSettings {
  currency: string;                // 默认货币
  riskTolerance: RiskLevel;        // 风险偏好
  defaultPositionSize?: number;    // 默认仓位大小
  enableReminders: boolean;        // 是否启用提醒
  customFields: Record<string, string>; // 自定义字段
}

/** 文档元数据 */
export interface StockResearchMetadata {
  phase: StockResearchPhase;       // 研究阶段
  createdAt: number;
  updatedAt: number;
  totalTheses: number;             // 论点统计
  totalTrades: number;             // 交易统计
  totalNotes: number;              // 笔记统计
  lastReviewAt?: number;           // 上次复审时间
}

// ═══════════════════════════════════════════════════════
// ID 生成
// ═══════════════════════════════════════════════════════

function genId(prefix: string): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(2, 8);
  return `${prefix}_${randomPart}`;
}

// ═══════════════════════════════════════════════════════
// 解析与创建
// ═══════════════════════════════════════════════════════

export function parseStockResearchContent(raw: string): StockResearchDocumentContent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data && data.version === 1 && data.stock) {
      return data as StockResearchDocumentContent;
    }
    return null;
  } catch {
    return null;
  }
}

export function createEmptyStockResearchContent(
  code: string = '',
  name: string = '',
): StockResearchDocumentContent {
  const now = Date.now();
  return {
    version: 1,
    stock: {
      code,
      name,
      market: '',
      industry: '',
      sector: '',
      tags: [],
      description: '',
      currency: 'CNY',
    },
    financials: {
      current: {},
      history: [],
    },
    technicals: null,
    news: [],
    theses: [],
    trades: [],
    positions: [],
    risk: null,
    peers: [],
    notes: [],
    settings: {
      currency: 'CNY',
      riskTolerance: 'medium',
      enableReminders: false,
      customFields: {},
    },
    metadata: {
      phase: 'watching',
      createdAt: now,
      updatedAt: now,
      totalTheses: 0,
      totalTrades: 0,
      totalNotes: 0,
    },
  };
}

export function extractStockResearchPlainText(content: string): string {
  const research = parseStockResearchContent(content);
  if (!research) return content;

  const parts: string[] = [
    `股票: ${research.stock.name} (${research.stock.code})`,
    `行业: ${research.stock.industry}`,
    `板块: ${research.stock.sector}`,
    '',
    `简介: ${research.stock.description}`,
    '',
  ];

  // 财务指标
  const f = research.financials.current;
  if (Object.keys(f).length > 0) {
    parts.push('=== 财务指标 ===');
    if (f.pe) parts.push(`市盈率: ${f.pe}`);
    if (f.pb) parts.push(`市净率: ${f.pb}`);
    if (f.roe) parts.push(`ROE: ${f.roe}%`);
    if (f.revenue) parts.push(`营收: ${f.revenue}亿`);
    if (f.netIncome) parts.push(`净利润: ${f.netIncome}亿`);
    parts.push('');
  }

  // 投资论点
  if (research.theses.length > 0) {
    parts.push('=== 投资论点 ===');
    for (const thesis of research.theses) {
      parts.push(`[${thesis.status === 'bullish' ? '看多' : thesis.status === 'bearish' ? '看空' : '中性'}] ${thesis.title}`);
      parts.push(thesis.content);
      parts.push('');
    }
  }

  // 研究笔记
  if (research.notes.length > 0) {
    parts.push('=== 研究笔记 ===');
    for (const note of research.notes) {
      parts.push(`## ${note.title}`);
      parts.push(note.content);
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════
// 股票信息操作
// ═══════════════════════════════════════════════════════

export function updateStockInfo(
  research: StockResearchDocumentContent,
  patch: Partial<StockInfo>,
): StockResearchDocumentContent {
  return {
    ...research,
    stock: { ...research.stock, ...patch },
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 财务数据操作
// ═══════════════════════════════════════════════════════

export function updateFinancialMetrics(
  research: StockResearchDocumentContent,
  metrics: Partial<FinancialMetrics>,
): StockResearchDocumentContent {
  return {
    ...research,
    financials: {
      ...research.financials,
      current: { ...research.financials.current, ...metrics, updatedAt: Date.now() },
    },
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function addFinancialHistory(
  research: StockResearchDocumentContent,
  year: number,
  quarter: number | undefined,
  metrics: FinancialMetrics,
): StockResearchDocumentContent {
  const history: FinancialHistory = { year, quarter, metrics };
  return {
    ...research,
    financials: {
      ...research.financials,
      history: [...research.financials.history, history],
    },
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 技术指标操作
// ═══════════════════════════════════════════════════════

export function updateTechnicals(
  research: StockResearchDocumentContent,
  technicals: TechnicalIndicators | null,
): StockResearchDocumentContent {
  return {
    ...research,
    technicals: technicals ? { ...technicals, updatedAt: Date.now() } : null,
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 新闻操作
// ═══════════════════════════════════════════════════════

export function addNews(
  research: StockResearchDocumentContent,
  news: Omit<StockNews, 'id' | 'createdAt'>,
): StockResearchDocumentContent {
  const now = Date.now();
  const newItem: StockNews = {
    ...news,
    id: genId('news'),
    createdAt: now,
  };
  return {
    ...research,
    news: [newItem, ...research.news],
    metadata: { ...research.metadata, updatedAt: now },
  };
}

export function updateNews(
  research: StockResearchDocumentContent,
  newsId: string,
  patch: Partial<StockNews>,
): StockResearchDocumentContent {
  return {
    ...research,
    news: research.news.map(n => n.id === newsId ? { ...n, ...patch } : n),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function deleteNews(
  research: StockResearchDocumentContent,
  newsId: string,
): StockResearchDocumentContent {
  return {
    ...research,
    news: research.news.filter(n => n.id !== newsId),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 投资论点操作
// ═══════════════════════════════════════════════════════

export function addThesis(
  research: StockResearchDocumentContent,
  thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>,
): StockResearchDocumentContent {
  const now = Date.now();
  const newItem: InvestmentThesis = {
    ...thesis,
    id: genId('thesis'),
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...research,
    theses: [...research.theses, newItem],
    metadata: {
      ...research.metadata,
      totalTheses: research.theses.length + 1,
      updatedAt: now,
    },
  };
}

export function updateThesis(
  research: StockResearchDocumentContent,
  thesisId: string,
  patch: Partial<InvestmentThesis>,
): StockResearchDocumentContent {
  return {
    ...research,
    theses: research.theses.map(t =>
      t.id === thesisId ? { ...t, ...patch, updatedAt: Date.now() } : t
    ),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function deleteThesis(
  research: StockResearchDocumentContent,
  thesisId: string,
): StockResearchDocumentContent {
  return {
    ...research,
    theses: research.theses.filter(t => t.id !== thesisId),
    metadata: {
      ...research.metadata,
      totalTheses: Math.max(0, research.theses.length - 1),
      updatedAt: Date.now(),
    },
  };
}

// ═══════════════════════════════════════════════════════
// 交易记录操作
// ═══════════════════════════════════════════════════════

export function addTrade(
  research: StockResearchDocumentContent,
  trade: Omit<TradeRecord, 'id' | 'createdAt'>,
): StockResearchDocumentContent {
  const now = Date.now();
  const newItem: TradeRecord = {
    ...trade,
    id: genId('trade'),
    createdAt: now,
  };
  return {
    ...research,
    trades: [...research.trades, newItem],
    metadata: {
      ...research.metadata,
      totalTrades: research.trades.length + 1,
      updatedAt: now,
    },
  };
}

export function updateTrade(
  research: StockResearchDocumentContent,
  tradeId: string,
  patch: Partial<TradeRecord>,
): StockResearchDocumentContent {
  return {
    ...research,
    trades: research.trades.map(t =>
      t.id === tradeId ? { ...t, ...patch } : t
    ),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function deleteTrade(
  research: StockResearchDocumentContent,
  tradeId: string,
): StockResearchDocumentContent {
  return {
    ...research,
    trades: research.trades.filter(t => t.id !== tradeId),
    metadata: {
      ...research.metadata,
      totalTrades: Math.max(0, research.trades.length - 1),
      updatedAt: Date.now(),
    },
  };
}

// ═══════════════════════════════════════════════════════
// 持仓快照操作
// ═══════════════════════════════════════════════════════

export function addPositionSnapshot(
  research: StockResearchDocumentContent,
  position: Omit<PositionSnapshot, 'id'>,
): StockResearchDocumentContent {
  const newItem: PositionSnapshot = {
    ...position,
    id: genId('pos'),
  };
  return {
    ...research,
    positions: [...research.positions, newItem],
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 风险评估操作
// ═══════════════════════════════════════════════════════

export function updateRiskAssessment(
  research: StockResearchDocumentContent,
  assessment: RiskAssessment | null,
): StockResearchDocumentContent {
  return {
    ...research,
    risk: assessment,
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 同业对比操作
// ═══════════════════════════════════════════════════════

export function addPeer(
  research: StockResearchDocumentContent,
  peer: Omit<PeerComparison, 'id'>,
): StockResearchDocumentContent {
  const newItem: PeerComparison = {
    ...peer,
    id: genId('peer'),
  };
  return {
    ...research,
    peers: [...research.peers, newItem],
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function updatePeer(
  research: StockResearchDocumentContent,
  peerId: string,
  patch: Partial<PeerComparison>,
): StockResearchDocumentContent {
  return {
    ...research,
    peers: research.peers.map(p =>
      p.id === peerId ? { ...p, ...patch } : p
    ),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function deletePeer(
  research: StockResearchDocumentContent,
  peerId: string,
): StockResearchDocumentContent {
  return {
    ...research,
    peers: research.peers.filter(p => p.id !== peerId),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 研究笔记操作
// ═══════════════════════════════════════════════════════

export function addNote(
  research: StockResearchDocumentContent,
  note: Omit<ResearchNote, 'id' | 'createdAt' | 'updatedAt'>,
): StockResearchDocumentContent {
  const now = Date.now();
  const newItem: ResearchNote = {
    ...note,
    id: genId('note'),
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...research,
    notes: [...research.notes, newItem],
    metadata: {
      ...research.metadata,
      totalNotes: research.notes.length + 1,
      updatedAt: now,
    },
  };
}

export function updateNote(
  research: StockResearchDocumentContent,
  noteId: string,
  patch: Partial<ResearchNote>,
): StockResearchDocumentContent {
  return {
    ...research,
    notes: research.notes.map(n =>
      n.id === noteId ? { ...n, ...patch, updatedAt: Date.now() } : n
    ),
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function deleteNote(
  research: StockResearchDocumentContent,
  noteId: string,
): StockResearchDocumentContent {
  return {
    ...research,
    notes: research.notes.filter(n => n.id !== noteId),
    metadata: {
      ...research.metadata,
      totalNotes: Math.max(0, research.notes.length - 1),
      updatedAt: Date.now(),
    },
  };
}

export function reorderNotes(
  research: StockResearchDocumentContent,
  noteIds: string[],
): StockResearchDocumentContent {
  const noteMap = new Map(research.notes.map(n => [n.id, n]));
  const reorderedNotes = noteIds
    .map(id => noteMap.get(id))
    .filter((n): n is ResearchNote => n !== undefined);
  return {
    ...research,
    notes: reorderedNotes,
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 设置与元数据操作
// ═══════════════════════════════════════════════════════

export function updateSettings(
  research: StockResearchDocumentContent,
  settings: Partial<StockResearchSettings>,
): StockResearchDocumentContent {
  return {
    ...research,
    settings: { ...research.settings, ...settings },
    metadata: { ...research.metadata, updatedAt: Date.now() },
  };
}

export function updatePhase(
  research: StockResearchDocumentContent,
  phase: StockResearchPhase,
): StockResearchDocumentContent {
  return {
    ...research,
    metadata: { ...research.metadata, phase, updatedAt: Date.now() },
  };
}

// ═══════════════════════════════════════════════════════
// 统计计算
// ═══════════════════════════════════════════════════════

/** 计算累计盈亏 */
export function calculateTotalProfitLoss(
  research: StockResearchDocumentContent,
): number {
  let total = 0;
  for (const trade of research.trades) {
    if (trade.direction === 'buy') {
      total -= trade.amount;
    } else if (trade.direction === 'sell') {
      total += trade.amount;
    } else if (trade.direction === 'dividend') {
      total += trade.amount;
    }
    if (trade.fee) {
      total -= trade.fee;
    }
  }
  return total;
}

/** 获取当前持仓数量 */
export function getCurrentPosition(research: StockResearchDocumentContent): number {
  let quantity = 0;
  for (const trade of research.trades) {
    if (trade.direction === 'buy') {
      quantity += trade.quantity;
    } else if (trade.direction === 'sell') {
      quantity -= trade.quantity;
    }
  }
  return Math.max(0, quantity);
}

/** 计算平均成本 */
export function calculateAverageCost(research: StockResearchDocumentContent): number | null {
  let totalCost = 0;
  let totalQuantity = 0;
  for (const trade of research.trades) {
    if (trade.direction === 'buy') {
      totalCost += trade.amount;
      totalQuantity += trade.quantity;
    } else if (trade.direction === 'sell') {
      // 按当前平均成本减少
      if (totalQuantity > 0) {
        const avgCost = totalCost / totalQuantity;
        totalCost -= avgCost * trade.quantity;
        totalQuantity -= trade.quantity;
      }
    }
  }
  return totalQuantity > 0 ? totalCost / totalQuantity : null;
}

/** 获取活跃论点（未过期的） */
export function getActiveTheses(research: StockResearchDocumentContent): InvestmentThesis[] {
  const now = Date.now();
  return research.theses.filter(t => !t.validUntil || t.validUntil > now);
}

/** 获取看多/看空论点 */
export function getThesesByStatus(
  research: StockResearchDocumentContent,
  status: ThesisStatus,
): InvestmentThesis[] {
  return research.theses.filter(t => t.status === status);
}

// ═══════════════════════════════════════════════════════
// Tushare 相关类型
// ═══════════════════════════════════════════════════════

/** Tushare API 凭证状态 */
export interface TushareCredential {
  token: string;
  isValid: boolean;
  points: number; // 剩余积分
  userId?: string;
  email?: string;
  tokenPrefix?: string; // 脱敏显示
}

/** Tushare API 返回的原始数据格式 */
export interface TushareResponse {
  fields: string[];
  items: unknown[][];
  count?: number;
}

/** Tushare 日线数据 */
export interface TushareDailyData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

/** Tushare 财务数据 */
export interface TushareFinancialData {
  ts_code: string;
  ann_date: string;
  end_date: string;
  report_type: number;
  basic_eps?: number;
  diluted_eps?: number;
  total_revenue?: number;
  revenue?: number;
  total_profit?: number;
  profit_to_cost?: number;
  total_assets?: number;
  total_liab?: number;
  equity?: number;
  net_profit?: number;
  roe?: number;
  roa?: number;
  gross_profit_margin?: number;
  net_profit_margin?: number;
  pe_ttm?: number;
  pb?: number;
}

/** Tushare 资金流向数据 */
export interface TushareMoneyflowData {
  ts_code: string;
  trade_date: string;
  buy_sm_amount: number;
  buy_sm_vol: number;
  buy_md_amount: number;
  buy_md_vol: number;
  buy_lg_amount: number;
  buy_lg_vol: number;
  buy_elg_amount: number;
  buy_elg_vol: number;
}

/** Tushare 工具调用参数 */
export interface TushareToolParams {
  ts_code?: string;
  start_date?: string;
  end_date?: string;
  trade_date?: string;
  period?: string;
  search?: string;
  index_code?: string;
  name?: string;
  keyword?: string;
  suspend_date?: string;
  resume_date?: string;
}

/** 数据获取状态 */
export type DataFetchStatus = 'idle' | 'loading' | 'success' | 'error';
