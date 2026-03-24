/**
 * AI 输出解析器
 * 解析 AI 返回的结构化 JSON 数据，自动填充研究文档
 */

import type {
  StockResearchDocumentContent,
  StockInfo,
  FinancialMetrics,
  TechnicalIndicators,
  InvestmentThesis,
  StockNews,
  PeerComparison,
  RiskAssessment,
  ThesisStatus,
  ThesisConfidence,
  RiskLevel,
} from '../types';

// AI 研究输出格式
export interface AIResearchOutput {
  stock?: Partial<StockInfo>;
  financials?: Partial<FinancialMetrics>;
  technicals?: Partial<TechnicalIndicators>;
  theses?: Array<Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>>;
  risk?: Partial<RiskAssessment>;
  news?: Array<Omit<StockNews, 'id' | 'createdAt'>>;
  peers?: Array<Omit<PeerComparison, 'id'>>;
}

/**
 * 验证 AI 输出中的数值合理性
 * 防止 AI 编造明显不合理的数据
 */
function validateFinancialMetrics(metrics: Partial<FinancialMetrics>): Partial<FinancialMetrics> {
  const validated: Partial<FinancialMetrics> = {};
  
  // PE 验证：正常范围 -1000 ~ 1000（亏损公司可以为负，但不应极端）
  if (metrics.pe !== undefined && metrics.pe !== null) {
    if (typeof metrics.pe === 'number' && metrics.pe >= -1000 && metrics.pe <= 1000) {
      validated.pe = metrics.pe;
    }
  }
  
  // PB 验证：正常范围 -100 ~ 100
  if (metrics.pb !== undefined && metrics.pb !== null) {
    if (typeof metrics.pb === 'number' && metrics.pb >= -100 && metrics.pb <= 100) {
      validated.pb = metrics.pb;
    }
  }
  
  // ROE 验证：正常范围 -200% ~ 200%
  if (metrics.roe !== undefined && metrics.roe !== null) {
    if (typeof metrics.roe === 'number' && metrics.roe >= -200 && metrics.roe <= 200) {
      validated.roe = metrics.roe;
    }
  }
  
  // ROA 验证：正常范围 -100% ~ 100%
  if (metrics.roa !== undefined && metrics.roa !== null) {
    if (typeof metrics.roa === 'number' && metrics.roa >= -100 && metrics.roa <= 100) {
      validated.roa = metrics.roa;
    }
  }
  
  // 毛利率/净利率：-100% ~ 100%
  if (metrics.grossMargin !== undefined && metrics.grossMargin !== null) {
    if (typeof metrics.grossMargin === 'number' && metrics.grossMargin >= -100 && metrics.grossMargin <= 100) {
      validated.grossMargin = metrics.grossMargin;
    }
  }
  if (metrics.netMargin !== undefined && metrics.netMargin !== null) {
    if (typeof metrics.netMargin === 'number' && metrics.netMargin >= -100 && metrics.netMargin <= 100) {
      validated.netMargin = metrics.netMargin;
    }
  }
  
  // 营收/利润：合理范围（亿元级别）
  if (metrics.revenue !== undefined && metrics.revenue !== null) {
    if (typeof metrics.revenue === 'number' && metrics.revenue >= 0 && metrics.revenue < 1000000) {
      validated.revenue = metrics.revenue;
    }
  }
  if (metrics.netIncome !== undefined && metrics.netIncome !== null) {
    if (typeof metrics.netIncome === 'number' && metrics.netIncome > -1000000 && metrics.netIncome < 1000000) {
      validated.netIncome = metrics.netIncome;
    }
  }
  
  // 增长率：-1000% ~ 1000%
  if (metrics.revenueGrowth !== undefined && metrics.revenueGrowth !== null) {
    if (typeof metrics.revenueGrowth === 'number' && metrics.revenueGrowth >= -1000 && metrics.revenueGrowth <= 1000) {
      validated.revenueGrowth = metrics.revenueGrowth;
    }
  }
  if (metrics.netIncomeGrowth !== undefined && metrics.netIncomeGrowth !== null) {
    if (typeof metrics.netIncomeGrowth === 'number' && metrics.netIncomeGrowth >= -1000 && metrics.netIncomeGrowth <= 1000) {
      validated.netIncomeGrowth = metrics.netIncomeGrowth;
    }
  }
  
  // 股息率：0% ~ 100%
  if (metrics.dividendYield !== undefined && metrics.dividendYield !== null) {
    if (typeof metrics.dividendYield === 'number' && metrics.dividendYield >= 0 && metrics.dividendYield <= 100) {
      validated.dividendYield = metrics.dividendYield;
    }
  }
  
  // 保存更新时间戳（如果存在且合理）
  if (metrics.updatedAt && typeof metrics.updatedAt === 'number') {
    // 验证时间戳是否在合理范围内（过去10年内到未来1天）
    const tenYearsAgo = Date.now() - 10 * 365 * 24 * 60 * 60 * 1000;
    const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
    if (metrics.updatedAt >= tenYearsAgo && metrics.updatedAt <= oneDayFromNow) {
      validated.updatedAt = metrics.updatedAt;
    }
  }
  
  return validated;
}

/**
 * 验证技术指标
 */
function validateTechnicalIndicators(tech: Partial<TechnicalIndicators>): Partial<TechnicalIndicators> {
  const validated: Partial<TechnicalIndicators> = {};
  
  // 价格验证：正数且合理范围（0.001 ~ 1000000）
  if (tech.price !== undefined && tech.price !== null) {
    if (typeof tech.price === 'number' && tech.price > 0 && tech.price < 1000000) {
      validated.price = tech.price;
    }
  }
  
  // 涨跌幅：-100% ~ +100%
  if (tech.changePercent !== undefined && tech.changePercent !== null) {
    if (typeof tech.changePercent === 'number' && tech.changePercent >= -100 && tech.changePercent <= 100) {
      validated.changePercent = tech.changePercent;
    }
  }
  
  // 成交量：正整数
  if (tech.volume !== undefined && tech.volume !== null) {
    if (typeof tech.volume === 'number' && tech.volume >= 0 && tech.volume < 1e15) {
      validated.volume = tech.volume;
    }
  }
  
  // 均线值：正数
  const maFields = ['ma5', 'ma10', 'ma20', 'ma60', 'ma120', 'support', 'resistance'] as const;
  for (const field of maFields) {
    const value = tech[field];
    if (value !== undefined && value !== null) {
      if (typeof value === 'number' && value > 0 && value < 1000000) {
        (validated as Record<string, number>)[field] = value;
      }
    }
  }
  
  // RSI：0 ~ 100
  if (tech.rsi !== undefined && tech.rsi !== null) {
    if (typeof tech.rsi === 'number' && tech.rsi >= 0 && tech.rsi <= 100) {
      validated.rsi = tech.rsi;
    }
  }
  
  // 趋势值验证
  if (tech.trend !== undefined) {
    if (['up', 'down', 'sideways'].includes(tech.trend)) {
      validated.trend = tech.trend as 'up' | 'down' | 'sideways';
    }
  }
  
  return validated;
}

/** 校验并规范化为 Tushare ts_code（6 位 + .SH/.SZ/.BJ） */
export function normalizeTsCodeForTushare(code: string | undefined | null): string | null {
  if (code == null || typeof code !== 'string') return null;
  const t = code.trim();
  const m = t.match(/^(\d{6})\.(SH|SZ|BJ)$/i);
  if (!m) return null;
  return `${m[1]}.${m[2].toUpperCase()}`;
}

function normalizeThesisStatus(s: unknown): ThesisStatus | undefined {
  if (typeof s !== 'string') return undefined;
  const x = s.toLowerCase().trim().replace(/\s+/g, '_');
  const alias: Record<string, ThesisStatus> = {
    bullish: 'bullish',
    bearish: 'bearish',
    neutral: 'neutral',
    long: 'bullish',
    short: 'bearish',
    hold: 'neutral',
    buy: 'bullish',
    sell: 'bearish',
  };
  if (alias[x]) return alias[x];
  if (x === 'bullish' || x === 'bearish' || x === 'neutral') return x;
  return undefined;
}

function normalizeThesisConfidence(c: unknown): ThesisConfidence | undefined {
  if (typeof c !== 'string' && typeof c !== 'number') return undefined;
  const x = String(c).toLowerCase().trim().replace(/\s+/g, '_');
  const alias: Record<string, ThesisConfidence> = {
    speculative: 'speculative',
    moderate: 'moderate',
    high: 'high',
    very_high: 'very_high',
    veryhigh: 'very_high',
    low: 'speculative',
    medium: 'moderate',
    med: 'moderate',
  };
  if (alias[x]) return alias[x];
  if (['speculative', 'moderate', 'high', 'very_high'].includes(x)) return x as ThesisConfidence;
  return undefined;
}

function normalizeRiskLevel(l: unknown): RiskLevel | undefined {
  if (typeof l !== 'string') return undefined;
  const x = l.toLowerCase().trim();
  const alias: Record<string, RiskLevel> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    extreme: 'extreme',
    mid: 'medium',
    moderate: 'medium',
    severe: 'high',
    critical: 'extreme',
  };
  if (alias[x]) return alias[x];
  if (['low', 'medium', 'high', 'extreme'].includes(x)) return x as RiskLevel;
  return undefined;
}

/**
 * 应用前规范化：ts_code、论点枚举、风险等级；剔除无法识别的值
 */
export function sanitizeAIResearchOutput(output: AIResearchOutput): AIResearchOutput {
  const o = JSON.parse(JSON.stringify(output)) as AIResearchOutput;
  if (o.stock && typeof o.stock === 'object') {
    if (o.stock.code != null && String(o.stock.code).trim() !== '') {
      const n = normalizeTsCodeForTushare(String(o.stock.code));
      if (n) o.stock.code = n;
      else delete o.stock.code;
    }
  }
  if (o.theses?.length) {
    o.theses = o.theses.map((th) => ({
      ...th,
      status: normalizeThesisStatus(th.status) ?? 'neutral',
      confidence: normalizeThesisConfidence(th.confidence) ?? 'moderate',
    }));
  }
  if (o.risk && typeof o.risk === 'object' && o.risk.level !== undefined && o.risk.level !== null) {
    const nl = normalizeRiskLevel(o.risk.level);
    if (nl) o.risk.level = nl;
    else delete o.risk.level;
  }
  return o;
}

/**
 * 生成唯一 ID
 */
function genId(prefix: string): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(2, 8);
  return `${prefix}_${randomPart}`;
}

/** 括号平衡截取 JSON 对象（忽略字符串内的 { }） */
function extractBalancedJsonObject(text: string, startIdx: number): string | null {
  if (text[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

const RESEARCH_TOP_KEYS = new Set([
  'stock',
  'financials',
  'technicals',
  'theses',
  'risk',
  'news',
  'peers',
]);

function looksLikeResearchPayload(o: unknown): boolean {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return Object.keys(o as object).some((k) => RESEARCH_TOP_KEYS.has(k));
}

/**
 * 从全文提取第一段可解析的研究 JSON（嵌入在 Markdown / 说明文字中间也可）
 */
function extractRawResearchJson(content: string): string | null {
  // 1. ```json ... ```（大小写不敏感）
  const fencedJson = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedJson) {
    const inner = fencedJson[1].trim();
    if (inner.startsWith('{')) {
      const balanced = extractBalancedJsonObject(inner, 0);
      if (balanced) return balanced;
    }
  }

  // 2. 任意 ``` 代码块内以 { 开头的对象（模型有时不写 json 语言标签）
  for (const m of content.matchAll(/```(?:[\w-]*)\s*([\s\S]*?)```/g)) {
    const inner = m[1].trim();
    if (!inner.startsWith('{')) continue;
    const balanced = extractBalancedJsonObject(inner, 0);
    if (balanced) return balanced;
  }

  // 3. 锚点：一键研究模板均以 "stock" 为顶层键之一（嵌入正文中的裸 JSON）
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const rel = content.slice(searchFrom).search(/\{\s*"stock"\s*:/);
    if (rel < 0) break;
    const start = searchFrom + rel;
    const balanced = extractBalancedJsonObject(content, start);
    if (balanced) return balanced;
    searchFrom = start + 1;
  }

  // 4. 兜底：自每个 { 起尝试平衡截取，解析后须含研究顶层字段
  let braceIdx = content.indexOf('{');
  while (braceIdx !== -1) {
    const balanced = extractBalancedJsonObject(content, braceIdx);
    if (balanced) {
      try {
        const p = JSON.parse(balanced);
        if (looksLikeResearchPayload(p)) return balanced;
      } catch {
        /* continue */
      }
    }
    braceIdx = content.indexOf('{', braceIdx + 1);
  }

  // 5. 整段即单个对象（旧逻辑）
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  return null;
}

/**
 * 从 AI 响应文本中提取 JSON
 * 支持：
 *   1. Markdown 代码块 (```json ... ```)
 *   2. 嵌入在正文中的裸 JSON 对象（含一键研究模板顶层字段）
 *   3. 整段为纯 JSON
 */
export function parseAIResearchOutput(content: string): AIResearchOutput | null {
  const rawJson = extractRawResearchJson(content);
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    if (!looksLikeResearchPayload(parsed)) {
      return null;
    }
    return parsed as AIResearchOutput;
  } catch {
    return null;
  }
}

/**
 * 将 AI 研究输出应用到研究文档
 */
export function applyResearchOutput(
  research: StockResearchDocumentContent,
  output: AIResearchOutput,
): StockResearchDocumentContent {
  const o = sanitizeAIResearchOutput(output);
  const now = Date.now();

  // 更新股票信息
  let updated = { ...research };
  if (o.stock) {
    updated = {
      ...updated,
      stock: { ...research.stock, ...o.stock },
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  // 更新财务指标（带验证）
  if (o.financials) {
    const validatedFinancials = validateFinancialMetrics(o.financials);
    updated = {
      ...updated,
      financials: {
        ...research.financials,
        current: { ...research.financials.current, ...validatedFinancials, updatedAt: now },
      },
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  // 更新技术指标（带验证）
  if (o.technicals) {
    const validatedTechnicals = validateTechnicalIndicators(o.technicals);
    updated = {
      ...updated,
      technicals: { ...research.technicals, ...validatedTechnicals, updatedAt: now } as TechnicalIndicators | null,
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  // 添加投资论点
  if (o.theses && o.theses.length > 0) {
    const newTheses: InvestmentThesis[] = o.theses.map(thesis => ({
      ...thesis,
      id: genId('thesis'),
      createdAt: now,
      updatedAt: now,
    }));
    updated = {
      ...updated,
      theses: [...research.theses, ...newTheses],
      metadata: {
        ...research.metadata,
        updatedAt: now,
        totalTheses: research.theses.length + newTheses.length,
      },
    };
  }

  // 更新风险评估
  if (o.risk) {
    updated = {
      ...updated,
      risk: {
        ...o.risk,
        level: o.risk.level || 'medium', // 默认中风险
        factors: o.risk.factors || [],
        warningSignals: o.risk.warningSignals || [],
        assessedAt: o.risk.assessedAt || now,
      } as RiskAssessment,
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  // 添加新闻
  if (o.news && o.news.length > 0) {
    const newNews: StockNews[] = o.news.map(news => ({
      ...news,
      id: genId('news'),
      createdAt: now,
      publishedAt: news.publishedAt || now,
    }));
    updated = {
      ...updated,
      news: [...newNews, ...research.news], // 新新闻放前面
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  // 添加对标公司
  if (o.peers && o.peers.length > 0) {
    const newPeers: PeerComparison[] = o.peers.map(peer => ({
      ...peer,
      id: genId('peer'),
    }));
    updated = {
      ...updated,
      peers: [...research.peers, ...newPeers],
      metadata: { ...research.metadata, updatedAt: now },
    };
  }

  return updated;
}

/**
 * 统计填充的字段数量
 */
export function countFilledFields(output: AIResearchOutput): number {
  let count = 0;
  if (output.stock) {
    count += Object.keys(output.stock).filter(k => output.stock![k as keyof StockInfo] !== undefined).length;
  }
  if (output.financials) {
    count += Object.keys(output.financials).filter(k => output.financials![k as keyof FinancialMetrics] !== undefined).length;
  }
  if (output.technicals) {
    count += Object.keys(output.technicals).filter(k => output.technicals![k as keyof TechnicalIndicators] !== undefined).length;
  }
  if (output.theses) {
    count += output.theses.length;
  }
  if (output.risk) {
    count += Object.keys(output.risk).filter(k => output.risk![k as keyof RiskAssessment] !== undefined).length;
  }
  if (output.news) {
    count += output.news.length;
  }
  if (output.peers) {
    count += output.peers.length;
  }
  return count;
}
