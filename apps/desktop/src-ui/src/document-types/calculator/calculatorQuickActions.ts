/**
 * 计算文档 AI 快捷操作定义
 *
 * 多分类（含股市与估值）、与函数目录及模板对齐。
 *
 * 与「插入函数」目录（calculatorFunctionCatalog）的映射说明：
 * - 本文件中的 financial / equities / statistics / list 与 fnCategory 同名同义。
 * - datetime、unit、percent、professional、helper 为工作流向分类，能力仍落在目录的金融/数学/统计/列表/语法等中。
 */
import type { LucideIcon } from 'lucide-react';

// ── 类型定义 ──

export interface CalculatorQuickActionCategory {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

export interface CalculatorQuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  labelEn: string;
  icon: string;
  prompt: string;
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  keywords?: string[];
}

export interface CalculatorQuickActionStore {
  categories: CalculatorQuickActionCategory[];
  items: CalculatorQuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_calculator_quick_actions';
const CURRENT_VERSION = 2;

// ── 默认分类 ──

export const DEFAULT_CATEGORIES: CalculatorQuickActionCategory[] = [
  { id: 'financial', label: '财务计算', labelEn: 'Financial', icon: 'DollarSign', order: 0, builtin: true },
  { id: 'datetime', label: '日期时间', labelEn: 'Date & Time', icon: 'Calendar', order: 1, builtin: true },
  { id: 'unit', label: '单位转换', labelEn: 'Unit Conversion', icon: 'Ruler', order: 2, builtin: true },
  { id: 'percent', label: '百分比', labelEn: 'Percentage', icon: 'Percent', order: 3, builtin: true },
  { id: 'equities', label: '股市与估值', labelEn: 'Equities & valuation', icon: 'TrendingUp', order: 4, builtin: true },
  { id: 'statistics', label: '统计分析', labelEn: 'Statistics', icon: 'BarChart3', order: 5, builtin: true },
  { id: 'list', label: '列表', labelEn: 'Lists', icon: 'List', order: 6, builtin: true },
  { id: 'life', label: '生活实用', labelEn: 'Daily Life', icon: 'Heart', order: 7, builtin: true },
  { id: 'professional', label: '专业计算', labelEn: 'Professional', icon: 'Calculator', order: 8, builtin: true },
  { id: 'helper', label: '公式助手', labelEn: 'Formula Helper', icon: 'HelpCircle', order: 9, builtin: true },
];

// ── 默认操作项 ──

export const DEFAULT_ITEMS: CalculatorQuickActionItem[] = [
  // ━━ 财务计算 (financial) ━━
  { id: 'fin_loan', categoryId: 'financial', label: '贷款计算', labelEn: 'Loan Calculator', icon: 'Calculator', order: 0, builtin: true,
    keywords: ['贷款', 'dk', 'loan', 'mortgage'],
    prompt: '帮我设计贷款计算表达式：\n贷款金额 = {{amount}}\n年利率 = {{rate}}%\n贷款年限 = {{years}}\n\n请计算：\n1. 月供\n2. 总利息\n3. 还款总额\n\n使用 PMT 函数：pmt(年利率/12, 年限*12, -贷款金额)' },
  { id: 'fin_interest', categoryId: 'financial', label: '利息计算', labelEn: 'Interest Calculator', icon: 'Percent', order: 1, builtin: true,
    keywords: ['利息', 'lx', 'interest'],
    prompt: '帮我设计利息计算表达式：\n本金 = {{principal}}\n利率 = {{rate}}%\n期限 = {{periods}}\n\n请计算单利和复利两种情况下的利息总额。' },
  { id: 'fin_investment', categoryId: 'financial', label: '投资回报', labelEn: 'Investment Return', icon: 'TrendingUp', order: 2, builtin: true,
    keywords: ['投资', 'tz', 'investment', 'roi'],
    prompt: '帮我设计投资回报计算：\n投入成本 = {{cost}}\n收益金额 = {{gain}}\n持有天数 = {{days}}\n\n请计算：\n1. 绝对收益\n2. 收益率 (ROI)\n3. 年化收益率' },
  { id: 'fin_compound', categoryId: 'financial', label: '复利计算', labelEn: 'Compound Interest', icon: 'RefreshCw', order: 3, builtin: true,
    keywords: ['复利', 'fl', 'compound'],
    prompt: '帮我设计复利计算表达式：\n本金 = {{principal}}\n年利率 = {{rate}}%\n复利年数 = {{years}}\n\n请计算复利终值：本金 * (1 + 年利率)^年数' },
  { id: 'fin_discount', categoryId: 'financial', label: '折现计算', labelEn: 'Discount Calculator', icon: 'ArrowDown', order: 4, builtin: true,
    keywords: ['折现', 'zx', 'discount', 'pv'],
    prompt: '帮我设计折现计算：\n未来值 = {{futureValue}}\n折现率 = {{rate}}%\n年数 = {{years}}\n\n请计算现值：未来值 / (1 + 折现率)^年数' },
  { id: 'fin_npv', categoryId: 'financial', label: 'NPV计算', labelEn: 'NPV Calculator', icon: 'DollarSign', order: 5, builtin: true,
    keywords: ['npv', '净现值', 'jz'],
    prompt: '帮我设计 NPV（净现值）计算表达式：\n折现率 = {{rate}}%\n现金流 = [{{cashFlows}}]\n\n使用 npv(现金流, 折现率) 函数计算净现值，并解释结果含义。' },
  { id: 'fin_irr', categoryId: 'financial', label: 'IRR计算', labelEn: 'IRR Calculator', icon: 'BarChart3', order: 6, builtin: true,
    keywords: ['irr', '内部收益率', 'nbsyl'],
    prompt: '帮我设计 IRR（内部收益率）计算表达式：\n现金流 = [{{cashFlows}}]\n\n使用 irr(现金流) 函数计算内部收益率，并解释结果含义。' },
  { id: 'fin_currency', categoryId: 'financial', label: '货币转换', labelEn: 'Currency Converter', icon: 'Coins', order: 7, builtin: true,
    keywords: ['货币', 'hb', 'currency', '汇率', 'hl'],
    prompt: '帮我设计货币转换表达式：\n金额 = {{amount}}\n源货币 = {{fromCurrency}}\n目标货币 = {{toCurrency}}\n汇率 = {{rate}}\n\n请计算转换后的金额。' },
  { id: 'fin_nper', categoryId: 'financial', label: '还清期数', labelEn: 'Payoff Periods', icon: 'Calendar', order: 8, builtin: true,
    keywords: ['nper', '期数', '还清', '多久'],
    prompt: '帮我写「多久能还清」的计算行：已知剩余本金、年利率（或月利率）、计划每期还款额。\n使用 nper(每期利率, -计划月供, 剩余本金)；注意 pmt/nper 现金流符号与引擎一致（还本付息额在 nper 中常为负）。\n用 ```formula 给出多行可执行表达式。' },
  { id: 'fin_equal_principal', categoryId: 'financial', label: '等额本金', labelEn: 'Equal Principal', icon: 'CreditCard', order: 9, builtin: true,
    keywords: ['等额本金', 'debj', '本金'],
    prompt: '帮我设计「等额本金」首月或第 k 期还款的表达式：每月固定归还本金 = 贷款总额/总月数；当期利息 = 剩余本金*月利率；当期还款 = 当月本金+当月利息。\n可对比同一笔贷款的等额本息 pmt(月利率, 总月数, -本金)。\n用 ```formula 输出。' },
  { id: 'fin_dti', categoryId: 'financial', label: '债务收入比', labelEn: 'DTI', icon: 'Scale', order: 10, builtin: true,
    keywords: ['dti', '债务收入比', '月供压力'],
    prompt: '帮我设计债务收入比 DTI：月债务合计（房贷 pmt、车贷、信用卡最低还款等）/ 月收入。\n房贷可用 pmt(年利率/12, 年数*12, -本金)。\n用 ```formula 输出多行变量与最终 DTI。' },
  { id: 'fin_mirr', categoryId: 'financial', label: 'MIRR', labelEn: 'MIRR', icon: 'Percent', order: 11, builtin: true,
    keywords: ['mirr', '修正收益率'],
    prompt: '帮我写修正内部收益率 mirr：现金流数组须含至少一正一负；语法 mirr(现金流, 融资成本, 再投资率)，率为小数。\n用 ```formula 给出示例。' },
  { id: 'fin_breakeven_q', categoryId: 'financial', label: '保本销量', labelEn: 'Break-Even Units', icon: 'Target', order: 12, builtin: true,
    keywords: ['保本', '量本利', 'breakeven'],
    prompt: '帮我写保本销量：固定成本、单价、单位变动成本。\n公式：保本销量 = 固定成本 / (单价 - 单位变动成本)。\n用 ```formula 多行变量+一行结果。' },
  { id: 'fin_ear', categoryId: 'financial', label: '有效年利率', labelEn: 'Effective APR', icon: 'Percent', order: 13, builtin: true,
    keywords: ['有效年利率', 'ear', '复利次数'],
    prompt: '帮我写名义年利率转有效年利率：EAR = (1 + 名义年利率/n)^n - 1，n 为每年复利次数（如月供 n=12）。\n用 ```formula 输出。' },
  { id: 'fin_sub_save', categoryId: 'financial', label: '订阅年付对比', labelEn: 'Sub Annual Save', icon: 'ShoppingCart', order: 14, builtin: true,
    keywords: ['订阅', '年付', '会员'],
    prompt: '帮我对比月付全年总价与年付优惠价：节省额、节省比例。\n仅用四则运算与百分数。\n用 ```formula 输出。' },
  { id: 'fin_commission', categoryId: 'financial', label: '阶梯提成', labelEn: 'Tier Commission', icon: 'CircleDollarSign', order: 15, builtin: true,
    keywords: ['提成', '阶梯', 'commission'],
    prompt: '帮我写两段阶梯提成：销售额分段，低档用 min(销售额,上限)*低率，超额用 max(0,销售额-上限)*高率；总佣金为两段之和。\n用 ```formula 输出。' },

  // ━━ 日期时间 (datetime) ━━
  { id: 'date_diff', categoryId: 'datetime', label: '日期差计算', labelEn: 'Date Difference', icon: 'Calendar', order: 0, builtin: true,
    keywords: ['日期差', 'rqc', 'datediff'],
    prompt: '帮我计算两个日期之间的天数：\n起始日期 = {{startDate}}\n结束日期 = {{endDate}}\n\n请使用日期计算：结束日期 - 起始日期，并换算为周数、月数。' },
  { id: 'date_add', categoryId: 'datetime', label: '日期加减', labelEn: 'Date Arithmetic', icon: 'Plus', order: 1, builtin: true,
    keywords: ['日期加减', 'rqjj', 'dateadd'],
    prompt: '帮我设计日期加减表达式：\n基准日期 = {{date}}\n加减数值 = {{value}}\n单位 = {{unit}}（天/周/月/年）\n\n请计算结果日期。' },
  { id: 'date_workday', categoryId: 'datetime', label: '工作日计算', labelEn: 'Workday Calculator', icon: 'Briefcase', order: 2, builtin: true,
    keywords: ['工作日', 'gzr', 'workday'],
    prompt: '帮我计算工作日：\n起始日期 = {{startDate}}\n结束日期 = {{endDate}}\n\n请计算两个日期之间的工作日数量（排除周末）。' },
  { id: 'date_age', categoryId: 'datetime', label: '年龄计算', labelEn: 'Age Calculator', icon: 'User', order: 3, builtin: true,
    keywords: ['年龄', 'nl', 'age', '生日', 'sr'],
    prompt: '帮我计算年龄：\n出生日期 = {{birthday}}\n\n请计算：\n1. 当前年龄（周岁）\n2. 生肖\n3. 星座\n4. 距离下次生日还有多少天' },
  { id: 'date_countdown', categoryId: 'datetime', label: '倒计时', labelEn: 'Countdown', icon: 'Clock', order: 4, builtin: true,
    prompt: '帮我计算倒计时：\n目标日期 = {{targetDate}}\n\n请计算距离目标日期还有多少天、多少周、多少月。' },
  { id: 'date_duration', categoryId: 'datetime', label: '时长计算', labelEn: 'Duration Calculator', icon: 'Timer', order: 5, builtin: true,
    keywords: ['时长', 'sc', 'duration'],
    prompt: '帮我计算时长：\n开始时间 = {{startTime}}\n结束时间 = {{endTime}}\n\n请计算：\n1. 总时长（小时:分钟:秒）\n2. 总分钟数\n3. 总秒数' },

  // ━━ 单位转换 (unit) ━━
  { id: 'unit_length', categoryId: 'unit', label: '长度转换', labelEn: 'Length Converter', icon: 'Ruler', order: 0, builtin: true,
    keywords: ['长度', 'cd', 'length'],
    prompt: '帮我设计长度转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（m/km/mi/ft/in/cm/mm）\n目标单位 = {{to}}\n\n请使用单位转换语法：数值 source_unit to target_unit' },
  { id: 'unit_weight', categoryId: 'unit', label: '重量转换', labelEn: 'Weight Converter', icon: 'Scale', order: 1, builtin: true,
    keywords: ['重量', 'zl', 'weight'],
    prompt: '帮我设计重量转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（kg/g/lb/oz/mg/t）\n目标单位 = {{to}}\n\n请使用单位转换语法计算。' },
  { id: 'unit_temp', categoryId: 'unit', label: '温度转换', labelEn: 'Temperature Converter', icon: 'Thermometer', order: 2, builtin: true,
    keywords: ['温度', 'wd', 'temperature'],
    prompt: '帮我设计温度转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（°C/°F/K）\n目标单位 = {{to}}\n\n请给出转换公式和结果。' },
  { id: 'unit_area', categoryId: 'unit', label: '面积转换', labelEn: 'Area Converter', icon: 'Square', order: 3, builtin: true,
    keywords: ['面积', 'mj', 'area'],
    prompt: '帮我设计面积转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（m²/km²/ha/acres/ft²）\n目标单位 = {{to}}\n\n请计算转换结果。' },
  { id: 'unit_volume', categoryId: 'unit', label: '体积转换', labelEn: 'Volume Converter', icon: 'Box', order: 4, builtin: true,
    keywords: ['体积', 'tj', 'volume'],
    prompt: '帮我设计体积转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（L/mL/gal/cup/m³）\n目标单位 = {{to}}\n\n请计算转换结果。' },
  { id: 'unit_speed', categoryId: 'unit', label: '速度转换', labelEn: 'Speed Converter', icon: 'Zap', order: 5, builtin: true,
    keywords: ['速度', 'sd', 'speed'],
    prompt: '帮我设计速度转换表达式：\n数值 = {{value}}\n源单位 = {{from}}（km/h/mph/m/s/knot）\n目标单位 = {{to}}\n\n请计算转换结果。' },

  // ━━ 百分比计算 (percent) ━━
  { id: 'pct_discount', categoryId: 'percent', label: '折扣计算', labelEn: 'Discount Calculator', icon: 'Tag', order: 0, builtin: true,
    keywords: ['折扣', 'zk', 'discount'],
    prompt: '帮我设计折扣计算：\n原价 = {{price}}\n折扣率 = {{discount}}%\n\n请计算折后价：原价 * (1 - 折扣率/100)\n或使用中文语法：原价 打 (100-折扣率)折' },
  { id: 'pct_increase', categoryId: 'percent', label: '增长率', labelEn: 'Growth Rate', icon: 'TrendingUp', order: 1, builtin: true,
    keywords: ['增长', 'zz', 'growth'],
    prompt: '帮我设计增长率计算：\n旧值 = {{oldValue}}\n新值 = {{newValue}}\n\n请计算增长百分比：(新值 - 旧值) / 旧值 * 100%' },
  { id: 'pct_portion', categoryId: 'percent', label: '占比计算', labelEn: 'Portion', icon: 'PieChart', order: 2, builtin: true,
    keywords: ['占比', 'zb', 'portion'],
    prompt: '帮我设计占比计算：\n部分值 = {{part}}\n总体值 = {{total}}\n\n请计算占比百分比：部分 / 总体 * 100%' },
  { id: 'pct_compare', categoryId: 'percent', label: '百分比对比', labelEn: 'Percentage Compare', icon: 'GitCompare', order: 3, builtin: true,
    keywords: ['对比', 'db', 'compare'],
    prompt: '帮我计算百分比差：\n第一个百分比 = {{pct1}}%\n第二个百分比 = {{pct2}}%\n\n请计算两者相差多少个百分点。' },
  { id: 'pct_change', categoryId: 'percent', label: '变化率', labelEn: 'Change Rate', icon: 'RefreshCw', order: 4, builtin: true,
    keywords: ['变化', 'bh', 'change'],
    prompt: '帮我设计变化率计算：\n变化前 = {{before}}\n变化后 = {{after}}\n\n请计算变化了百分之几：(变化后 - 变化前) / 变化前 * 100%' },
  { id: 'pct_markup', categoryId: 'percent', label: '成本加价', labelEn: 'Cost Markup', icon: 'Tag', order: 5, builtin: true,
    keywords: ['加价', '定价', 'markup'],
    prompt: '帮我写成本加价定价：售价 = 成本 * (1 + 加价率)，加价率可用百分数。\n用 ```formula 输出。' },
  { id: 'pct_breakeven_rev', categoryId: 'percent', label: '保本销售额', labelEn: 'Break-Even Sales', icon: 'TrendingUp', order: 6, builtin: true,
    keywords: ['保本', '营收', '毛利率'],
    prompt: '帮我写保本销售额（毛利率法）：保本销售额 = 固定成本 / 毛利率，毛利率为 (营收-变动成本)/营收 的百分数写法。\n用 ```formula 输出。' },

  // ━━ 股市与估值 (equities) ━━
  { id: 'eq_pe_pb_div', categoryId: 'equities', label: 'PE/PB/股息率', labelEn: 'PE, PB, yield', icon: 'TrendingUp', order: 0, builtin: true,
    keywords: ['PE', 'PB', '股息', '市盈率'],
    prompt: '帮我写股票估值多行算式：PE=股价/EPS，PB=股价/每股净资产，股息率=每股股息/股价。用中文变量；单位用双引号；说明 TTM 与年报口径须一致。\n用 ```formula 输出。' },
  { id: 'eq_dupont', categoryId: 'equities', label: '杜邦ROE', labelEn: 'DuPont ROE', icon: 'PieChart', order: 1, builtin: true,
    keywords: ['杜邦', 'ROE', '净利率'],
    prompt: '帮我写杜邦拆解：净利率=净利润/营业收入，资产周转率=营业收入/总资产，权益乘数=总资产/净资产，ROE=三者相乘。\n用 ```formula 输出。' },
  { id: 'eq_peg', categoryId: 'equities', label: 'PEG', labelEn: 'PEG', icon: 'Percent', order: 2, builtin: true,
    keywords: ['PEG', '成长'],
    prompt: '帮我写 PEG：PEG = PE / 盈利增速；盈利增速用本计算器百分数写法（如 20%）并与 PE 口径匹配。\n用 ```formula 输出。' },
  { id: 'eq_cagr', categoryId: 'equities', label: 'CAGR', labelEn: 'CAGR', icon: 'Activity', order: 3, builtin: true,
    keywords: ['CAGR', '复合增长', '年化'],
    prompt: '帮我写复合年化收益率：CAGR = (终值/初值)^(1/年数) - 1；初终值同一指标、同单位。\n用 ```formula 输出。' },
  { id: 'eq_fcf_yield', categoryId: 'equities', label: 'FCF收益率', labelEn: 'FCF yield', icon: 'BarChart3', order: 4, builtin: true,
    keywords: ['自由现金流', 'FCF', '收益率'],
    prompt: '帮我写自由现金流收益率：FCF收益率 = 自由现金流 / 总市值；注明 FCF 定义（如经营现金流-资本开支）。\n用 ```formula 输出。' },
  { id: 'eq_ev_multiple', categoryId: 'equities', label: 'EV/EBITDA', labelEn: 'EV/EBITDA', icon: 'Building2', order: 5, builtin: true,
    keywords: ['EV', 'EBITDA', '企业价值'],
    prompt: '帮我写 EV/EBITDA：企业价值 = 总市值 + 净债务（按你定义的净债务），再除以 EBITDA。\n用 ```formula 输出。' },
  { id: 'eq_position', categoryId: 'equities', label: '止损与仓位', labelEn: 'Stop & size', icon: 'Target', order: 6, builtin: true,
    keywords: ['止损', '仓位', '股数'],
    prompt: '帮我按风险预算算可买股数：风险预算=账户权益*单笔风险%；可买股数=风险预算/(止损幅度*股价)；止损幅度用百分数。\n用 ```formula 输出。' },
  { id: 'eq_kelly', categoryId: 'equities', label: '凯利公式', labelEn: 'Kelly', icon: 'Zap', order: 7, builtin: true,
    keywords: ['凯利', '仓位', '胜率'],
    prompt: '帮我写简化凯利：凯利=(胜率*盈亏比-(1-胜率))/盈亏比；并建议一行半凯利=凯利*50%。\n用 ```formula 输出。' },
  { id: 'eq_sharpe', categoryId: 'equities', label: '夏普(简)', labelEn: 'Sharpe (simple)', icon: 'LineChart', order: 8, builtin: true,
    keywords: ['夏普', '波动', '无风险'],
    prompt: '帮我写简化夏普比率：(组合期收益率-无风险利率)/收益率标准差；期度须一致。\n用 ```formula 输出。' },
  { id: 'eq_dcf_npv', categoryId: 'equities', label: '现金流折现示意', labelEn: 'DCF npv sketch', icon: 'Landmark', order: 9, builtin: true,
    keywords: ['DCF', 'npv', '折现'],
    prompt: '帮我写极简 DCF 示意：列出若干期现金流与终值，用 npv(现金流数组, 折现率)；折现率用小数（如 0.09 表示 9%），避免整行结果被识别为百分比类型；说明仅为教学示意。\n用 ```formula 输出。' },
  { id: 'eq_peer_row', categoryId: 'equities', label: '对标比率表', labelEn: 'Peer ratios', icon: 'GitCompare', order: 10, builtin: true,
    keywords: ['对标', '可比', '横向'],
    prompt: '帮我生成多公司横向对比的计算文档行：每家用注释或变量前缀区分，对比 PE、ROE、毛利率等同口径指标；缺失数据用占位变量。\n用 ```formula 输出。' },
  { id: 'eq_interest_cover', categoryId: 'equities', label: '利息覆盖', labelEn: 'Interest cover', icon: 'Shield', order: 11, builtin: true,
    keywords: ['利息', '偿债', 'EBIT'],
    prompt: '帮我写利息覆盖倍数：息税前利润/利息费用。\n用 ```formula 输出。' },

  // ━━ 统计分析 (statistics) ━━
  { id: 'stat_mean', categoryId: 'statistics', label: '均值计算', labelEn: 'Mean Calculator', icon: 'BarChart3', order: 0, builtin: true,
    keywords: ['平均', 'pj', 'mean', 'average'],
    prompt: '帮我计算以下数据的平均值（均值）：\n数据 = [{{numbers}}]\n\n请使用 mean() 函数计算，并解释结果。' },
  { id: 'stat_median', categoryId: 'statistics', label: '中位数', labelEn: 'Median', icon: 'AlignHorizontalMid', order: 1, builtin: true,
    keywords: ['中位数', 'zws', 'median'],
    prompt: '帮我计算以下数据的中位数：\n数据 = [{{numbers}}]\n\n请使用 median() 函数计算，并解释结果含义。' },
  { id: 'stat_stddev', categoryId: 'statistics', label: '标准差', labelEn: 'Standard Deviation', icon: 'Activity', order: 2, builtin: true,
    keywords: ['标准差', 'bzc', 'stddev'],
    prompt: '帮我计算以下数据的标准差：\n数据 = [{{numbers}}]\n\n请使用 std() 函数计算，并解释数据的离散程度。' },
  { id: 'stat_sum', categoryId: 'statistics', label: '求和', labelEn: 'Sum', icon: 'Sigma', order: 3, builtin: true,
    keywords: ['求和', 'qh', 'sum', 'total'],
    prompt: '帮我计算以下数据的总和：\n数据 = [{{numbers}}]\n\n请使用 sum() 函数计算。' },
  { id: 'stat_count', categoryId: 'statistics', label: '计数', labelEn: 'Count', icon: 'Hash', order: 4, builtin: true,
    keywords: ['计数', 'js', 'count'],
    prompt: '帮我计算以下数据中的非空数量：\n数据 = [{{items}}]\n\n请使用 count() 函数计算。' },
  { id: 'stat_minmax', categoryId: 'statistics', label: '最值', labelEn: 'Min/Max', icon: 'Minus2', order: 5, builtin: true,
    keywords: ['最值', 'zz', 'min', 'max'],
    prompt: '帮我计算以下数据的最小值和最大值：\n数据 = [{{numbers}}]\n\n请使用 min() 和 max() 函数计算，并计算极差（max - min）。' },
  { id: 'stat_quantile', categoryId: 'statistics', label: '分位数', labelEn: 'Quantiles', icon: 'Activity', order: 6, builtin: true,
    keywords: ['分位数', '四分位', 'quantile'],
    prompt: '帮我写分位数：使用 quantileSeq(数据数组, p)，p 为 0~1（如 0.25、0.5、0.75）；可与 median(数据) 对照。\n用 ```formula 输出。' },

  // ━━ 列表（与函数目录「列表」一致；索引 1-based） ━━
  { id: 'list_all_lines_combo', categoryId: 'list', label: '所有行与列表函数', labelEn: 'All lines + list', icon: 'List', order: 0, builtin: true,
    keywords: ['所有行', 'listAt', 'listLen', 'sum'],
    prompt: '请写可粘贴的多行表达式：用「所有行」得到当前行上方数值数组，再演示与列表函数组合，例如 sum(所有行)、listLen(数据)、listAt(数据, 1)（索引从 1 起）。若需完整数列结果展示，用「变量 = 列表表达式」赋值行。\n函数名须与侧栏注入的语法摘要一致，勿臆造。\n用 ```formula 输出。' },
  { id: 'list_rank_argsort', categoryId: 'list', label: '秩与排序索引', labelEn: 'Rank & argSort', icon: 'ArrowDownWideNarrow', order: 1, builtin: true,
    keywords: ['listRank', 'listArgSort', '秩'],
    prompt: '请用 listRank、listArgSort 写最小示例：说明 listRank 并列取平均秩；listArgSort 返回升序对应的原位置（1-based）。\n用 ```formula 输出，每行一条。' },
  { id: 'list_rolling', categoryId: 'list', label: '滚动均值/和', labelEn: 'Rolling mean/sum', icon: 'Activity', order: 2, builtin: true,
    keywords: ['rollMean', 'rollSum', '滚动'],
    prompt: '请写 rollMean(数据, 窗口)、rollSum(数据, 窗口) 的示例；说明前 window-1 项为 NaN。\n数据用变量赋值为数组。\n用 ```formula 输出。' },
  { id: 'list_range_fill', categoryId: 'list', label: '整数范围与填充', labelEn: 'Range & fill', icon: 'Hash', order: 3, builtin: true,
    keywords: ['listRange', 'listFill'],
    prompt: '请写 listRange(起点, 终点, 步长?)（步长可为负）与 listFill(n, 值) 的简短示例。\n用 ```formula 输出。' },
  { id: 'list_lookup_slice', categoryId: 'list', label: '查找与切片', labelEn: 'Lookup & slice', icon: 'Search', order: 4, builtin: true,
    keywords: ['listLookup', 'listSlice', 'listConcat'],
    prompt: '请写 listLookup(值, keys, values)、listSlice(数据, start, end)（1-based 闭区间）、listConcat(段1, 段2, …) 的最小可执行示例；keys 与 values 等长。\n用 ```formula 输出。' },

  // ━━ 生活实用 (life) ━━
  { id: 'life_bmi', categoryId: 'life', label: 'BMI计算', labelEn: 'BMI Calculator', icon: 'Heart', order: 0, builtin: true,
    keywords: ['bmi', '体重', 'tz', '身高', 'sg'],
    prompt: '帮我设计 BMI 计算表达式：\n身高 = {{height}}cm\n体重 = {{weight}}kg\n\n请计算 BMI = 体重 / (身高/100)²，并给出健康建议（偏瘦/正常/超重/肥胖）。' },
  { id: 'life_tip', categoryId: 'life', label: '小费计算', labelEn: 'Tip Calculator', icon: 'DollarSign', order: 1, builtin: true,
    keywords: ['小费', 'xf', 'tip'],
    prompt: '帮我设计小费计算：\n账单金额 = {{bill}}\n小费比例 = {{tipPercent}}%\n\n请计算：\n1. 小费金额\n2. 总计金额\n3. 如需 AA，每人应付（假设 {{people}} 人）' },
  { id: 'life_tax', categoryId: 'life', label: '税费计算', labelEn: 'Tax Calculator', icon: 'Receipt', order: 2, builtin: true,
    keywords: ['税费', 'sf', 'tax'],
    prompt: '帮我设计价税互算（单一税率）：不含税价 * (1 + 税率) = 含税价；含税价 / (1 + 税率) = 不含税价。税率可用 13%、9% 等百分数写法。\n税额 = 含税价 - 不含税价。\n用 ```formula 输出，仅使用本计算器支持的运算符与函数。' },
  { id: 'life_split', categoryId: 'life', label: '分摊计算', labelEn: 'Bill Split', icon: 'Users', order: 3, builtin: true,
    keywords: ['分摊', 'ft', 'split', 'aa'],
    prompt: '帮我设计分摊计算：\n总金额 = {{total}}\n人数 = {{people}}\n\n请计算每人应付金额，并考虑以下情况：\n1. 平均分摊\n2. 某人付 {{extra}}（该人应付更多）' },
  { id: 'life_deal', categoryId: 'life', label: '优惠计算', labelEn: 'Deal Calculator', icon: 'Ticket', order: 4, builtin: true,
    keywords: ['优惠', 'yh', 'deal', 'coupon'],
    prompt: '帮我设计优惠计算：\n原价 = {{price}}\n优惠方案：{{dealDescription}}\n\n请计算最终价格，常见优惠类型：\n1. 满减（满{{threshold}}减{{discount}}）\n2. 折扣（{{discount}}折）\n3. 优惠券（减{{coupon}}元）' },
  { id: 'life_tdee_pace', categoryId: 'life', label: 'TDEE与配速', labelEn: 'TDEE & Pace', icon: 'Activity', order: 5, builtin: true,
    keywords: ['tdee', '配速', '跑步', '代谢'],
    prompt: '帮我写两类可执行行（分开多行）：\n1) TDEE 简化：BMR（男）≈ 10*体重kg + 6.25*身高cm - 5*年龄 + 5；TDEE = BMR * 活动系数。\n2) 跑步时长：总分钟 = 距离_km * 配速(分钟/公里)。\n用 ```formula 输出。' },
  { id: 'life_rent_ratio', categoryId: 'life', label: '房租收入比', labelEn: 'Rent-to-Income', icon: 'Home', order: 6, builtin: true,
    keywords: ['房租', '租金', '收入比'],
    prompt: '帮我写房租收入比：月租/月收入，两者单位一致；结果为小数可再乘 100% 展示。\n用 ```formula 输出。' },
  { id: 'life_utility_tier', categoryId: 'life', label: '阶梯电费', labelEn: 'Tiered Power Bill', icon: 'Zap', order: 7, builtin: true,
    keywords: ['电费', '阶梯', '电价'],
    prompt: '帮我写两档阶梯电费：电费 = min(用量,限额)*低价 + max(0,用量-限额)*高价。\n用 ```formula 输出，变量名用中文或英文均可。' },

  // ━━ 专业计算 (professional) ━━
  { id: 'pro_scientific', categoryId: 'professional', label: '科学计数法', labelEn: 'Scientific Notation', icon: 'Atom', order: 0, builtin: true,
    keywords: ['科学计数', 'kxjs', 'scientific'],
    prompt: '帮我将以下数字转换为科学计数法：\n数字 = {{number}}\n\n请输出：\n1. 科学计数法表示（如 1.23e+10）\n2. 保留 {{decimals}} 位小数' },
  { id: 'pro_quadratic', categoryId: 'professional', label: '二次方程', labelEn: 'Quadratic Equation', icon: 'Variable', order: 1, builtin: true,
    keywords: ['方程', 'fc', 'equation', '求解'],
    prompt: '帮我求解二次方程：\n方程：{{equation}}（形如 ax² + bx + c = 0）\n\n请使用求根公式：x = (-b ± √(b²-4ac)) / 2a\n给出两个根（如有）和解题步骤。' },
  { id: 'pro_ratio', categoryId: 'professional', label: '比例计算', labelEn: 'Ratio Calculator', icon: 'Scale', order: 2, builtin: true,
    keywords: ['比例', 'bl', 'ratio'],
    prompt: '帮我设计比例计算：\n已知：{{a}} : {{b}} = {{c}} : {{?}}\n\n请使用交叉相乘法求解未知数：? = (b * c) / a' },
  { id: 'pro_scale', categoryId: 'professional', label: '缩放计算', labelEn: 'Scale Calculator', icon: 'Maximize2', order: 3, builtin: true,
    keywords: ['缩放', 'sf', 'scale'],
    prompt: '帮我设计缩放计算：\n原始值 = {{value}}\n缩放比例 = {{scale}}\n\n请计算缩放后的值：原始值 * 缩放比例\n同时计算反向缩放：原始值 / 缩放比例' },
  { id: 'pro_round', categoryId: 'professional', label: '取整计算', labelEn: 'Round Calculator', icon: 'Check', order: 4, builtin: true,
    keywords: ['取整', 'qz', 'round'],
    prompt: '帮我设计取整表达式：\n数值 = {{number}}\n小数位数 = {{decimals}}\n\n请计算以下三种取整方式：\n1. 四舍五入：round(number, decimals)\n2. 向上取整：ceil(number)\n3. 向下取整：floor(number)' },

  // ━━ 公式助手 (helper) ━━
  { id: 'help_explain', categoryId: 'helper', label: '解释公式', labelEn: 'Explain Formula', icon: 'HelpCircle', order: 0, builtin: true,
    keywords: ['解释', 'js', 'explain'],
    prompt: '请解释以下计算公式的含义和用途：\n{{formula}}\n\n请说明：\n1. 公式中每个变量/符号的含义\n2. 公式的用途和应用场景\n3. 计算步骤示例' },
  { id: 'help_suggest', categoryId: 'helper', label: '公式建议', labelEn: 'Formula Suggestion', icon: 'Lightbulb', order: 1, builtin: true,
    keywords: ['建议', 'jy', 'suggest'],
    prompt: '我想计算：{{userInput}}\n\n请给出合适的计算表达式或公式建议，包括：\n1. 具体表达式\n2. 使用方法\n3. 示例计算' },
  { id: 'help_verify', categoryId: 'helper', label: '验证结果', labelEn: 'Verify Result', icon: 'CheckCircle', order: 2, builtin: true,
    keywords: ['验证', 'yz', 'verify'],
    prompt: '请验证以下计算是否正确：\n{{expression}} = {{result}}\n\n请：\n1. 逐步验算\n2. 指出是否有误\n3. 如有错误，给出正确答案' },
  { id: 'help_convert', categoryId: 'helper', label: '格式转换', labelEn: 'Format Converter', icon: 'RefreshCw', order: 3, builtin: true,
    keywords: ['转换', 'zh', 'convert'],
    prompt: '请将以下计算结果转换为另一种格式：\n{{value}}\n\n请转换为：\n1. 小数转分数\n2. 百分比转小数\n3. 弧度转角度\n4. 其他相关格式' },
  { id: 'help_template', categoryId: 'helper', label: '公式模板', labelEn: 'Formula Template', icon: 'FileCode', order: 4, builtin: true,
    keywords: ['模板', 'mb', 'template'],
    prompt: '请提供 {{category}} 计算公式模板，包括：\n1. 常用公式列表\n2. 每个公式的用途说明\n3. 使用示例\n\n分类可选：财务、统计、物理、化学、工程' },
  { id: 'help_debug_errors', categoryId: 'helper', label: '错误排查', labelEn: 'Debug Errors', icon: 'Bug', order: 5, builtin: true,
    keywords: ['错误', 'cw', 'debug', '报错', '排查'],
    prompt: '根据我当前工作表里出现的错误行（见上下文），请逐项说明：\n1. 可能原因\n2. 如何改成可执行表达式\n3. 只使用本应用已注入的「语法摘要」与工具栏「插入函数」目录中出现的函数名；禁止臆造未在摘要/目录中的名称（含 Excel 风格别名须以摘要为准）。股市估值类多为四则与幂的组合。\n若合适，在回复末尾用 ```formula 给出一条修正后的示例行。' },
  { id: 'help_optimize_sheet', categoryId: 'helper', label: '整表优化', labelEn: 'Optimize Sheet', icon: 'LayoutList', order: 6, builtin: true,
    keywords: ['优化', 'yh', 'optimize', '整理', '重构'],
    prompt: '请阅读上下文中的多行表达式，给出「整表」层面的优化建议：\n1. 变量命名与复用\n2. 是否可用行引用（line n / 第 n 行）与「所有行」减少重复\n3. 金融、统计、列表等函数是否与侧栏注入的语法摘要一致\n4. 如需替换表达式，用 ```formula 逐条给出建议行（每块一行）。' },
  { id: 'help_unify_units', categoryId: 'helper', label: '单位统一', labelEn: 'Unify Units', icon: 'Ruler', order: 7, builtin: true,
    keywords: ['单位', 'dw', 'unit', '万', 'k', '%'],
    prompt: '请检查上下文中的数量写法，建议统一单位与百分数表示（如 k/m/b、万/亿、50%、打8折 等与本计算器一致的语法），并说明各行应如何改写；需要示例时用 ```formula 给出单行。' },
  { id: 'help_nl_to_lines', categoryId: 'helper', label: '自然语言改可执行', labelEn: 'NL to Executable', icon: 'Wand2', order: 8, builtin: true,
    keywords: ['自然语言', 'zryy', '改写', '可执行', '算式'],
    prompt: '用户描述（自然语言）：\n{{userInput}}\n\n请改写成本计算器可直接粘贴的多行表达式：\n- 使用变量赋值行、支持的函数与百分数/单位简写；\n- 每行一条；\n- 在回复中用 ```formula 代码块给出完整可执行片段（可多行，每行一条表达式）。' },
  { id: 'help_fin_signs', categoryId: 'helper', label: '金融函数符号', labelEn: 'Finance Sign Rules', icon: 'Info', order: 9, builtin: true,
    keywords: ['符号', 'pmt', 'nper', '现金流'],
    prompt: '请用要点说明本计算器中 pmt、nper、rate、fv、pv 的常见符号约定：贷款本金 pv 常为负；与 nper 配合时还款额常与 pmt 输出同号取负；并各给一行 ```formula 最小示例。函数名与参数顺序以侧栏注入的语法摘要为准，勿编造未出现的名称。' },
];

// ── 持久化 ──

export function getDefaultStore(): CalculatorQuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

function mergeWithDefaults(stored: CalculatorQuickActionStore): CalculatorQuickActionStore {
  const cats = [...stored.categories];
  for (const dc of DEFAULT_CATEGORIES) {
    if (!cats.find(c => c.id === dc.id)) cats.push({ ...dc });
  }
  const items = [...stored.items];
  for (const di of DEFAULT_ITEMS) {
    if (!items.find(i => i.id === di.id)) items.push({ ...di });
  }
  return { ...stored, categories: cats, items, version: CURRENT_VERSION };
}

export function loadQuickActions(storage: {
  get: <T>(key: string) => T | null;
  set: (key: string, value: unknown) => void;
}): CalculatorQuickActionStore {
  const saved = storage.get<CalculatorQuickActionStore>(STORAGE_KEY);
  if (saved && saved.categories && saved.items) {
    return mergeWithDefaults(saved);
  }
  const store = getDefaultStore();
  storage.set(STORAGE_KEY, store);
  return store;
}

export function saveQuickActions(
  storage: { set: (key: string, value: unknown) => void },
  store: CalculatorQuickActionStore
): void {
  storage.set(STORAGE_KEY, store);
}

export function recordRecentUsed(
  store: CalculatorQuickActionStore,
  itemId: string
): CalculatorQuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}

export function toggleFavorite(
  store: CalculatorQuickActionStore,
  itemId: string
): CalculatorQuickActionStore {
  const favorites = store.favorites || [];
  if (favorites.includes(itemId)) {
    return { ...store, favorites: favorites.filter(id => id !== itemId) };
  }
  return { ...store, favorites: [...favorites, itemId] };
}
