/**
 * 股票研究文档类型 — 常量定义
 */

import type { RiskLevel, StockResearchPhase, ThesisStatus, ThesisConfidence } from './types';

// ═══════════════════════════════════════════════════════
// 市场代码
// ═══════════════════════════════════════════════════════

export const MARKET_CODES: Record<string, { name: string; currency: string; timezone: string }> = {
  SH: { name: '上海证券交易所', currency: 'CNY', timezone: 'Asia/Shanghai' },
  SZ: { name: '深圳证券交易所', currency: 'CNY', timezone: 'Asia/Shanghai' },
  BJ: { name: '北京证券交易所', currency: 'CNY', timezone: 'Asia/Shanghai' },
  NASDAQ: { name: '纳斯达克', currency: 'USD', timezone: 'America/New_York' },
  NYSE: { name: '纽约证券交易所', currency: 'USD', timezone: 'America/New_York' },
  HK: { name: '香港证券交易所', currency: 'HKD', timezone: 'Asia/Hong_Kong' },
  LSE: { name: '伦敦证券交易所', currency: 'GBP', timezone: 'Europe/London' },
  TSE: { name: '东京证券交易所', currency: 'JPY', timezone: 'Asia/Tokyo' },
};

// ═══════════════════════════════════════════════════════
// 行业分类（申万一级行业 + 国际通用）
// ═══════════════════════════════════════════════════════

export const INDUSTRIES_CN: { key: string; name: string; icon: string }[] = [
  { key: 'banking', name: '银行', icon: '🏦' },
  { key: 'securities', name: '证券', icon: '📈' },
  { key: 'insurance', name: '保险', icon: '🛡️' },
  { key: 'real_estate', name: '房地产', icon: '🏠' },
  { key: 'construction', name: '建筑装饰', icon: '🏗️' },
  { key: 'building_materials', name: '建筑材料', icon: '🧱' },
  { key: 'steel', name: '钢铁', icon: '🔩' },
  { key: 'nonferrous', name: '有色金属', icon: '⛏️' },
  { key: 'coal', name: '煤炭', icon: '⚫' },
  { key: 'oil_gas', name: '石油石化', icon: '⛽' },
  { key: 'chemical', name: '基础化工', icon: '🧪' },
  { key: 'pharmaceutical', name: '医药生物', icon: '💊' },
  { key: 'medical_devices', name: '医疗器械', icon: '🏥' },
  { key: 'food_beverage', name: '食品饮料', icon: '🍷' },
  { key: 'agriculture', name: '农林牧渔', icon: '🌾' },
  { key: 'automobile', name: '汽车', icon: '🚗' },
  { key: 'machinery', name: '机械设备', icon: '⚙️' },
  { key: 'power_equipment', name: '电力设备', icon: '⚡' },
  { key: 'military', name: '国防军工', icon: '🛡️' },
  { key: 'electronics', name: '电子', icon: '📱' },
  { key: 'computer', name: '计算机', icon: '💻' },
  { key: 'media', name: '传媒', icon: '📺' },
  { key: 'communication', name: '通信', icon: '📡' },
  { key: 'internet', name: '互联网', icon: '🌐' },
  { key: 'retail', name: '商贸零售', icon: '🛒' },
  { key: 'consumer_services', name: '社会服务', icon: '🏨' },
  { key: 'textile', name: '纺织服饰', icon: '👔' },
  { key: 'light_manufacturing', name: '轻工制造', icon: '📦' },
  { key: 'utilities', name: '公用事业', icon: '💡' },
  { key: 'transportation', name: '交通运输', icon: '✈️' },
  { key: 'environmental', name: '环保', icon: '🌿' },
  { key: 'beauty_health', name: '美容护理', icon: '💄' },
];

export const INDUSTRIES_US: { key: string; name: string; icon: string }[] = [
  { key: 'technology', name: 'Technology', icon: '💻' },
  { key: 'healthcare', name: 'Healthcare', icon: '🏥' },
  { key: 'financial', name: 'Financial Services', icon: '💰' },
  { key: 'consumer_discretionary', name: 'Consumer Discretionary', icon: '🛍️' },
  { key: 'consumer_staples', name: 'Consumer Staples', icon: '🛒' },
  { key: 'energy', name: 'Energy', icon: '⛽' },
  { key: 'industrial', name: 'Industrials', icon: '🏭' },
  { key: 'materials', name: 'Materials', icon: '🧱' },
  { key: 'real_estate', name: 'Real Estate', icon: '🏠' },
  { key: 'utilities', name: 'Utilities', icon: '💡' },
  { key: 'communication', name: 'Communication Services', icon: '📡' },
];

// ═══════════════════════════════════════════════════════
// 研究阶段
// ═══════════════════════════════════════════════════════

export const RESEARCH_PHASES: { key: StockResearchPhase; labelKey: string; icon: string; color: string }[] = [
  { key: 'watching', labelKey: 'stockResearch.phaseWatching', icon: '👀', color: 'text-blue-500' },
  { key: 'holding', labelKey: 'stockResearch.phaseHolding', icon: '📊', color: 'text-green-500' },
  { key: 'closed', labelKey: 'stockResearch.phaseClosed', icon: '✅', color: 'text-gray-500' },
  { key: 'archived', labelKey: 'stockResearch.phaseArchived', icon: '📦', color: 'text-muted-foreground' },
];

// ═══════════════════════════════════════════════════════
// 风险等级
// ═══════════════════════════════════════════════════════

export const RISK_LEVELS: { key: RiskLevel; labelKey: string; icon: string; color: string; scoreRange: [number, number] }[] = [
  { key: 'low', labelKey: 'stockResearch.riskLow', icon: '🟢', color: 'text-green-500', scoreRange: [0, 25] },
  { key: 'medium', labelKey: 'stockResearch.riskMedium', icon: '🟡', color: 'text-yellow-500', scoreRange: [26, 50] },
  { key: 'high', labelKey: 'stockResearch.riskHigh', icon: '🟠', color: 'text-orange-500', scoreRange: [51, 75] },
  { key: 'extreme', labelKey: 'stockResearch.riskExtreme', icon: '🔴', color: 'text-red-500', scoreRange: [76, 100] },
];

// ═══════════════════════════════════════════════════════
// 论点状态
// ═══════════════════════════════════════════════════════

export const THESIS_STATUSES: { key: ThesisStatus; labelKey: string; icon: string; color: string }[] = [
  { key: 'bullish', labelKey: 'stockResearch.thesisBullish', icon: '📈', color: 'text-green-500' },
  { key: 'bearish', labelKey: 'stockResearch.thesisBearish', icon: '📉', color: 'text-red-500' },
  { key: 'neutral', labelKey: 'stockResearch.thesisNeutral', icon: '➖', color: 'text-gray-500' },
];

// ═══════════════════════════════════════════════════════
// 论点置信度
// ═══════════════════════════════════════════════════════

export const THESIS_CONFIDENCES: { key: ThesisConfidence; labelKey: string; color: string }[] = [
  { key: 'speculative', labelKey: 'stockResearch.confidenceSpeculative', color: 'text-purple-400' },
  { key: 'moderate', labelKey: 'stockResearch.confidenceModerate', color: 'text-blue-500' },
  { key: 'high', labelKey: 'stockResearch.confidenceHigh', color: 'text-green-500' },
  { key: 'very_high', labelKey: 'stockResearch.confidenceVeryHigh', color: 'text-emerald-600' },
];

// ═══════════════════════════════════════════════════════
// 交易方向
// ═══════════════════════════════════════════════════════

export const TRADE_DIRECTIONS: { key: string; labelKey: string; icon: string; color: string }[] = [
  { key: 'buy', labelKey: 'stockResearch.tradeBuy', icon: '⬆️', color: 'text-green-500' },
  { key: 'sell', labelKey: 'stockResearch.tradeSell', icon: '⬇️', color: 'text-red-500' },
  { key: 'dividend', labelKey: 'stockResearch.tradeDividend', icon: '💰', color: 'text-blue-500' },
];

// ═══════════════════════════════════════════════════════
// 货币符号
// ═══════════════════════════════════════════════════════

export const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  GBP: '£',
  JPY: '¥',
  EUR: '€',
};

// ═══════════════════════════════════════════════════════
// 布局默认值
// ═══════════════════════════════════════════════════════

export const DEFAULT_LEFT_PANEL_WIDTH = 220;
export const DEFAULT_DATA_PANEL_WIDTH = 280;
export const DEFAULT_AI_PANEL_WIDTH = 320;
export const MIN_PANEL_WIDTH = 160;
export const MAX_PANEL_WIDTH = 500;

// ═══════════════════════════════════════════════════════
// 保存相关常量
// ═══════════════════════════════════════════════════════

export const CONTENT_SAVE_DEBOUNCE_MS = 2000;
export const META_SAVE_DEBOUNCE_MS = 500;
export const SAVE_STATUS_DISPLAY_MS = 1500;

// ═══════════════════════════════════════════════════════
// 一键研究 Prompt 模板
// ═══════════════════════════════════════════════════════

/**
 * 一键研究默认 Prompt 模板
 * 支持变量：{{stockIdentifier}}、{{today}}
 */
export const DEFAULT_ONE_CLICK_PROMPT = `请全面研究股票「{{stockIdentifier}}」，今日日期：{{today}}。

【研究目标】
获取以下维度的真实数据并进行综合分析：
- **标识解析**：将输入转换为标准股票代码（ts_code）
- **基本面**：公司简介、行业、股本、上市信息
- **行情**：近期价格走势、涨跌幅、成交量
- **财务指标**：PE、PB、ROE、毛利率、净利率、EPS
- **财务报表**：营业收入、净利润及同比增长
- **资金面**：主力/散户资金流向
- **新闻舆情**：最新公告、新闻、市场评论（联网搜索获取）

【数据要求】
- 所有数值必须来自工具返回的真实数据，禁止编造
- 工具返回空数据的字段填 null 并说明原因
- 财务数据使用最新一期报告期数据
- 先用 stock_search 解析股票代码，再获取其他数据

【输出格式】
请输出以下 JSON（用 \`\`\`json 代码块包裹）：
\`\`\`json
{
  "stock": { "code": "", "name": "", "market": "SH/SZ", "industry": "", "sector": "", "description": "100-200字公司简介", "marketCap": null, "currency": "CNY" },
  "financials": { "pe": null, "pb": null, "roe": null, "grossMargin": null, "netMargin": null, "revenue": null, "revenueGrowth": null, "netIncome": null, "netIncomeGrowth": null, "updatedAt": {{timestamp}} },
  "technicals": { "price": null, "changePercent": null, "volume": null, "ma5": null, "ma20": null, "support": null, "resistance": null, "trend": "up/down/sideways", "updatedAt": {{timestamp}} },
  "theses": [{ "status": "bullish/bearish/neutral", "confidence": "speculative/moderate/high/very_high", "title": "", "content": "200-300字", "bullishFactors": [], "bearishFactors": [], "catalysts": [], "risks": [] }],
  "risk": { "level": "low/medium/high", "score": 0, "factors": [], "warningSignals": [] },
  "news": [{ "title": "", "summary": "", "source": "", "sentiment": "positive/negative/neutral", "importance": "high/medium/low" }],
  "peers": [{ "code": "", "name": "", "advantage": "", "disadvantage": "" }]
}
\`\`\``;
