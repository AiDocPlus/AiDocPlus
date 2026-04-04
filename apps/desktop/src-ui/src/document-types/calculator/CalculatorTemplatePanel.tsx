/**
 * CalculatorTemplatePanel — 计算模板面板（增强版）
 * 支持下拉菜单分类、用户自定义模板、收藏、导入导出
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calculator,
  Search, Star, X, Plus, Download, Upload, Edit2, Trash2, Copy,
  MoreHorizontal
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { saveTextFileWithDialog } from '@/lib/tauriSaveTextFile';

// ============================================================
// 类型定义
// ============================================================

export interface CalculatorTemplate {
  id: string;
  categoryId: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  /** 适用场景 / 假设（简短说明，可选） */
  assumptions?: string;
  assumptionsEn?: string;
  expressions: string[];
  variables: Record<string, string>;
  /** 是否为用户自定义 */
  isCustom?: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

// ============================================================
// 内置数据
// ============================================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'financial', name: '财务计算', nameEn: 'Financial', icon: 'DollarSign' },
  { id: 'datetime', name: '日期时间', nameEn: 'Date & Time', icon: 'Calendar' },
  { id: 'percent', name: '百分比', nameEn: 'Percentage', icon: 'Percent' },
  { id: 'life', name: '生活实用', nameEn: 'Daily Life', icon: 'Heart' },
  { id: 'statistics', name: '统计分析', nameEn: 'Statistics', icon: 'BarChart3' },
  { id: 'list', name: '列表', nameEn: 'Lists', icon: 'List' },
  { id: 'equities', name: '股市与估值', nameEn: 'Equities & valuation', icon: 'TrendingUp' },
  { id: 'custom', name: '自定义', nameEn: 'Custom', icon: 'Star' },
];

export const BUILT_IN_TEMPLATES: CalculatorTemplate[] = [
  // 财务计算
  {
    id: 'tmpl_mortgage',
    categoryId: 'financial',
    name: '房贷计算',
    nameEn: 'Mortgage Calculator',
    icon: 'Home',
    description: '计算房贷月供、总利息',
    descriptionEn: 'Calculate monthly payment and total interest',
    expressions: [
      '// 房贷计算',
      '贷款金额 = 1000000 "元"',
      '年利率 = 4.2%',
      '贷款年限 = 30 "年"',
      '月供 = pmt(年利率/12, 贷款年限*12, -贷款金额)',
      '总还款 = 月供 * 贷款年限 * 12',
      '总利息 = 总还款 - 贷款金额',
    ],
    variables: {
      '贷款金额': '贷款本金（元）',
      '年利率': '年利率（如 4.2%）',
      '贷款年限': '贷款年数',
    },
  },
  {
    id: 'tmpl_car_loan',
    categoryId: 'financial',
    name: '车贷计算',
    nameEn: 'Car Loan Calculator',
    icon: 'Car',
    description: '计算车贷月供和利息',
    descriptionEn: 'Calculate car loan monthly payment',
    expressions: [
      '// 车贷计算',
      '车价 = 200000 "元"',
      '首付 = 50000 "元"',
      '贷款金额 = 车价 - 首付',
      '年利率 = 3.5%',
      '期限 = 3 "年"',
      '月供 = pmt(年利率/12, 期限*12, -贷款金额)',
      '总利息 = 月供 * 期限 * 12 - 贷款金额',
    ],
    variables: {
      '车价': '车辆总价',
      '首付': '首付金额',
      '年利率': '贷款年利率',
      '期限': '贷款期限（年）',
    },
  },
  {
    id: 'tmpl_compound',
    categoryId: 'financial',
    name: '复利增长',
    nameEn: 'Compound Interest',
    icon: 'TrendingUp',
    description: '计算复利投资的终值',
    descriptionEn: 'Calculate compound interest future value',
    expressions: [
      '// 复利计算',
      '本金 = 10000 "元"',
      '年利率 = 8%',
      '年数 = 10 "年"',
      '终值 = 本金 * (1 + 年利率)^年数',
      '收益 = 终值 - 本金',
      '收益率 = 收益 / 本金 * 100%',
    ],
    variables: {
      '本金': '初始投资金额',
      '年利率': '年化收益率',
      '年数': '投资年限',
    },
  },
  {
    id: 'tmpl_npv',
    categoryId: 'financial',
    name: 'NPV 净现值',
    nameEn: 'NPV Calculator',
    icon: 'BarChart3',
    description: '计算投资项目净现值',
    descriptionEn: 'Calculate net present value',
    expressions: [
      '// NPV 净现值计算',
      '折现率 = 10%',
      '初始投资 = -100000 "元"',
      '第一年现金流 = 30000 "元"',
      '第二年现金流 = 35000 "元"',
      '第三年现金流 = 40000 "元"',
      '第四年现金流 = 45000 "元"',
      '第五年现金流 = 50000 "元"',
      '现金流 = [初始投资, 第一年现金流, 第二年现金流, 第三年现金流, 第四年现金流, 第五年现金流]',
      '净现值 = npv(现金流, 折现率)',
    ],
    variables: {
      '折现率': '要求的回报率',
      '初始投资': '初始投资金额（负数）',
    },
  },

  // 日期时间
  {
    id: 'tmpl_date_diff',
    categoryId: 'datetime',
    name: '日期差计算',
    nameEn: 'Date Difference',
    icon: 'Calendar',
    description: '计算两个日期之间的天数',
    descriptionEn: 'Calculate days between dates',
    expressions: [
      '// 日期差计算',
      '起始日期 = 2024-01-01',
      '结束日期 = 2024-12-31',
      '天数差 = 结束日期 - 起始日期 "天"',
      '周数 = 天数差 / 7 "周"',
      '月数 = 天数差 / 30 "月"',
    ],
    variables: {
      '起始日期': '开始日期',
      '结束日期': '结束日期',
    },
  },
  {
    id: 'tmpl_age',
    categoryId: 'datetime',
    name: '年龄计算',
    nameEn: 'Age Calculator',
    icon: 'User',
    description: '计算当前年龄',
    descriptionEn: 'Calculate current age',
    expressions: [
      '// 年龄计算',
      '出生日期 = 1990-05-15',
      '当前日期 = today()',
      '年龄 = (当前日期 - 出生日期) / 365 "岁"',
      '天数 = 当前日期 - 出生日期 "天"',
    ],
    variables: {
      '出生日期': '出生年月日',
    },
  },
  {
    id: 'tmpl_countdown',
    categoryId: 'datetime',
    name: '倒计时',
    nameEn: 'Countdown',
    icon: 'Clock',
    description: '计算距离目标日期的天数',
    descriptionEn: 'Calculate days until target date',
    expressions: [
      '// 倒计时',
      '目标日期 = 2025-01-01',
      '今天 = today()',
      '剩余天数 = 目标日期 - 今天 "天"',
      '剩余周数 = 剩余天数 / 7 "周"',
    ],
    variables: {
      '目标日期': '目标日期',
    },
  },

  // 百分比
  {
    id: 'tmpl_discount',
    categoryId: 'percent',
    name: '折扣计算',
    nameEn: 'Discount Calculator',
    icon: 'Tag',
    description: '计算折扣后的价格',
    descriptionEn: 'Calculate discounted price',
    expressions: [
      '// 折扣计算',
      '原价 = 500 "元"',
      '折扣率 = 20%',
      '折后价 = 原价 * (1 - 折扣率)',
      '节省金额 = 原价 - 折后价',
    ],
    variables: {
      '原价': '商品原价',
      '折扣率': '折扣比例（如 20%）',
    },
  },
  {
    id: 'tmpl_growth',
    categoryId: 'percent',
    name: '增长率计算',
    nameEn: 'Growth Rate',
    icon: 'TrendingUp',
    description: '计算数值的增长率',
    descriptionEn: 'Calculate growth rate',
    expressions: [
      '// 增长率计算',
      '旧值 = 1000 "元"',
      '新值 = 1500 "元"',
      '增长量 = 新值 - 旧值',
      '增长率 = 增长量 / 旧值 * 100%',
    ],
    variables: {
      '旧值': '原始数值',
      '新值': '新数值',
    },
  },

  // 生活实用
  {
    id: 'tmpl_bmi',
    categoryId: 'life',
    name: 'BMI 计算',
    nameEn: 'BMI Calculator',
    icon: 'Heart',
    description: '计算身体质量指数',
    descriptionEn: 'Calculate body mass index',
    expressions: [
      '// BMI 计算',
      '身高cm = 175 "厘米"',
      '体重kg = 70 "千克"',
      '身高m = 身高cm / 100',
      'BMI = 体重kg / (身高m)^2',
      '// BMI 参考标准',
      '// < 18.5: 偏瘦',
      '// 18.5-24: 正常',
      '// 24-28: 超重',
      '// > 28: 肥胖',
    ],
    variables: {
      '身高cm': '身高（厘米）',
      '体重kg': '体重（千克）',
    },
  },
  {
    id: 'tmpl_tip',
    categoryId: 'life',
    name: '小费计算',
    nameEn: 'Tip Calculator',
    icon: 'DollarSign',
    description: '计算餐厅小费',
    descriptionEn: 'Calculate restaurant tip',
    expressions: [
      '// 小费计算',
      '账单金额 = 200 "元"',
      '小费比例 = 15%',
      '小费 = 账单金额 * 小费比例',
      '总计 = 账单金额 + 小费',
      '人数 = 4 "人"',
      '每人应付 = 总计 / 人数',
    ],
    variables: {
      '账单金额': '账单金额',
      '小费比例': '小费比例（如 15%）',
      '人数': '用餐人数',
    },
  },
  {
    id: 'tmpl_split',
    categoryId: 'life',
    name: 'AA 分摊',
    nameEn: 'Bill Split',
    icon: 'Users',
    description: '计算费用分摊',
    descriptionEn: 'Split the bill',
    expressions: [
      '// AA 分摊',
      '总金额 = 500 "元"',
      '人数 = 5 "人"',
      '每人应付 = 总金额 / 人数',
      '// 保留2位小数',
      '每人应付_取整 = round(每人应付, 2)',
    ],
    variables: {
      '总金额': '费用总额',
      '人数': '参与人数',
    },
  },

  // 统计分析
  {
    id: 'tmpl_stats_basic',
    categoryId: 'statistics',
    name: '基础统计',
    nameEn: 'Basic Statistics',
    icon: 'BarChart3',
    description: '计算均值、标准差等统计量',
    descriptionEn: 'Calculate mean, std, etc.',
    expressions: [
      '// 基础统计',
      '数据 = [12, 15, 18, 22, 25, 28, 30, 33, 36, 40]',
      '总和 = sum(数据)',
      '均值 = mean(数据)',
      '中位数 = median(数据)',
      '标准差 = std(数据)',
      '最小值 = min(数据)',
      '最大值 = max(数据)',
      '极差 = 最大值 - 最小值',
    ],
    variables: {
      '数据': '数据数组',
    },
  },
  {
    id: 'tmpl_irr',
    categoryId: 'financial',
    name: 'IRR 内部收益率',
    nameEn: 'IRR (Internal Rate of Return)',
    icon: 'Percent',
    description: '由现金流估算 IRR（irr 函数）',
    descriptionEn: 'IRR from cash flows using irr()',
    expressions: [
      '// IRR：初始投资 + 各期现金流（单位：元）',
      '现金流 = [-100000, 12000, 15000, 18000, 20000, 22000, 25000]',
      '内部收益率 = irr(现金流)',
    ],
    variables: {
      '现金流': '含初始投资（负）与后续净流入的数组',
    },
  },
  {
    id: 'tmpl_savings_fv',
    categoryId: 'financial',
    name: '定期储蓄终值',
    nameEn: 'Savings Future Value',
    icon: 'PiggyBank',
    description: '每期定额、固定利率下的终值（fv）',
    descriptionEn: 'FV with periodic deposits (fv)',
    expressions: [
      '// 每月存固定金额，按月复利',
      '年利率 = 3.5%',
      '年限 = 10 "年"',
      '月利率 = 年利率 / 12',
      '期数 = 年限 * 12',
      '每月存款 = -500 "元"',
      '现值 = 0',
      '终值 = fv(月利率, 期数, 每月存款, 现值)',
    ],
    variables: {
      '年利率': '年化利率',
      '年限': '储蓄年数',
      '每月存款': '每月存入（支出为负）',
    },
  },
  {
    id: 'tmpl_pmt_simple',
    categoryId: 'financial',
    name: '等额本息月供',
    nameEn: 'Fixed Payment (PMT)',
    icon: 'CreditCard',
    description: '已知利率、期数、本金的月供（pmt）',
    descriptionEn: 'Monthly payment with pmt()',
    expressions: [
      '// 等额本息：贷款本金为负',
      '贷款本金 = 800000 "元"',
      '年利率 = 4.2%',
      '还款年数 = 30 "年"',
      '月供 = pmt(年利率/12, 还款年数*12, -贷款本金)',
    ],
    variables: {
      '贷款本金': '贷款总额',
      '年利率': '年利率',
      '还款年数': '按揭年数',
    },
  },
  {
    id: 'tmpl_unit_length',
    categoryId: 'life',
    name: '长度单位换算',
    nameEn: 'Length Unit Convert',
    icon: 'Ruler',
    description: '千米/米/厘米互相换算',
    descriptionEn: 'km, m, cm conversion',
    expressions: [
      '// 使用「数值 源单位 to 目标单位」',
      '3 km to m',
      '150 cm to m',
      '2.5 km to cm',
    ],
    variables: {},
  },
  {
    id: 'tmpl_variance',
    categoryId: 'statistics',
    name: '方差与标准差',
    nameEn: 'Variance & Std Dev',
    icon: 'Activity',
    description: 'variance、std',
    descriptionEn: 'variance and std',
    expressions: [
      '// 方差与标准差',
      '样本 = [2, 4, 6, 8, 10]',
      '方差 = variance(样本)',
      '标准差 = std(样本)',
      '均值 = mean(样本)',
    ],
    variables: {
      '样本': '数值数组',
    },
  },

  // 列表（与函数目录「列表」一致：索引 1-based；完整数列结果请用变量赋值行）
  {
    id: 'tmpl_list_all_lines',
    categoryId: 'list',
    name: '所有行求和',
    nameEn: 'Sum of all lines',
    icon: 'List',
    description: '多行数值后用 sum(所有行) 聚合',
    descriptionEn: 'Aggregate with sum(all lines) after numeric lines',
    assumptions: '「所有行」为当前行上方已成功求值的数值行；不含注释/空行/错误行',
    assumptionsEn: 'all lines = numeric results above; excludes comments/blanks/errors',
    expressions: [
      '// 先写若干行纯数值，再在下一行对「所有行」求和',
      '10',
      '20',
      '30',
      '上方合计 = sum(所有行)',
    ],
    variables: {},
  },
  {
    id: 'tmpl_list_at_slice',
    categoryId: 'list',
    name: '索引与闭区间切片',
    nameEn: 'listAt & listSlice',
    icon: 'List',
    description: 'listAt 按 1-based；listSlice 为闭区间，赋值行可显示完整数列',
    descriptionEn: '1-based index; inclusive slice; assign to see full vector',
    expressions: [
      '// listAt(数据, i) 标量；切片赋值行可展示数列',
      '数据 = [1, 2, 3, 4, 5]',
      '第二项 = listAt(数据, 2)',
      '前三个 = listSlice(数据, 1, 3)',
    ],
    variables: {
      数据: '一维数值数组',
    },
  },
  {
    id: 'tmpl_list_rank_cumsum',
    categoryId: 'list',
    name: '平均秩与累加',
    nameEn: 'Rank & cumulative sum',
    icon: 'BarChart3',
    description: 'listRank（并列平均秩）；listCumsum 与 cumsum 等价',
    descriptionEn: 'listRank ties averaged; listCumsum alias of cumsum',
    expressions: [
      '// 并列时 listRank 取平均秩；累加可用 cumsum 或 listCumsum',
      '序列 = [3, 1, 2, 1]',
      '平均秩 = listRank(序列)',
      '前缀和 = listCumsum(序列)',
    ],
    variables: {
      序列: '数值数组',
    },
  },
  {
    id: 'tmpl_list_roll_lookup',
    categoryId: 'list',
    name: '滚动与键值查找',
    nameEn: 'Rolling & lookup',
    icon: 'Activity',
    description: 'rollMean；listLookup(keys, values 等长)',
    descriptionEn: 'rollMean; listLookup with parallel keys/values',
    assumptions: 'rollMean 前 window-1 项为 NaN',
    assumptionsEn: 'Leading NaNs for rollMean until window fills',
    expressions: [
      '// 尾部滚动窗口；查找为精确匹配首个 key',
      '价格 = [10, 11, 12, 11, 13]',
      '三日均线 = rollMean(价格, 3)',
      '键 = [1, 2, 3]',
      '值 = [100, 200, 300]',
      '查价 = listLookup(2, 键, 值)',
    ],
    variables: {
      价格: '时间序列',
      键: '与值等长',
      值: '与键等长',
    },
  },

  {
    id: 'tmpl_equal_principal',
    categoryId: 'financial',
    name: '等额本金（首月）',
    nameEn: 'Equal Principal (First Month)',
    icon: 'CreditCard',
    description: '每月固定还本 + 当期利息；展示首月还款',
    descriptionEn: 'Fixed principal per month plus interest; first payment shown',
    assumptions: '按月计息；第 1 期起算；未含宽限期与手续费',
    assumptionsEn: 'Monthly interest; period 1; no grace fees',
    expressions: [
      '// 等额本金：月供随利息递减，首月最高',
      '贷款本金 = 800000 "元"',
      '年利率 = 4.2%',
      '还款月数 = 360',
      '每月还本 = 贷款本金 / 还款月数',
      '首月利息 = 贷款本金 * 年利率/12',
      '首月还款 = 每月还本 + 首月利息',
      '// 对比：等额本息月供（固定）',
      '等额本息月供 = pmt(年利率/12, 还款月数, -贷款本金)',
    ],
    variables: {
      '贷款本金': '贷款总额（元）',
      '年利率': '年利率（如 4.2%）',
      '还款月数': '总还款月数',
    },
  },
  {
    id: 'tmpl_dti',
    categoryId: 'financial',
    name: '债务收入比 DTI',
    nameEn: 'Debt-to-Income (DTI)',
    icon: 'Scale',
    description: '月债务还款占月收入比例（简化）',
    descriptionEn: 'Monthly debt payments over gross monthly income',
    assumptions: 'DTI 为示意指标；放贷口径因机构而异',
    assumptionsEn: 'Illustrative ratio; lenders use varying rules',
    expressions: [
      '// 债务收入比 = 月债务合计 / 月收入',
      '月收入 = 18000 "元"',
      '房贷月供 = pmt(4.2%/12, 30*12, -800000)',
      '其他月债 = 1500 "元"',
      '月债务合计 = 房贷月供 + 其他月债',
      'DTI = 月债务合计 / 月收入',
    ],
    variables: {
      '月收入': '税前或税后口径请自行统一',
      '其他月债': '信用卡最低还款、车贷等',
    },
  },
  {
    id: 'tmpl_nper_payoff',
    categoryId: 'financial',
    name: '多久能还清（期数）',
    nameEn: 'Payoff Period (nper)',
    icon: 'Calendar',
    description: '在固定利率与目标月供下估算剩余期数',
    descriptionEn: 'Periods to pay off at a target payment',
    assumptions: '使用 nper(rate, -月供, 剩余本金)；本金与现金流符号与 pmt 一致',
    assumptionsEn: 'Uses nper(rate, -payment, balance); sign convention matches pmt',
    expressions: [
      '// 已知剩余本金与计划月供，估算还清所需月数',
      '剩余本金 = 320000 "元"',
      '年利率 = 4.2%',
      '计划月供 = 5800 "元"',
      '还清月数 = nper(年利率/12, -计划月供, 剩余本金)',
    ],
    variables: {
      '剩余本金': '当前欠款余额',
      '计划月供': '每期偿还额（与 pmt 输出同号约定时取正，公式内用负号）',
    },
  },
  {
    id: 'tmpl_mirr_simple',
    categoryId: 'financial',
    name: '修正收益率 MIRR',
    nameEn: 'MIRR (Modified IRR)',
    icon: 'Percent',
    description: '融资成本与再投资率不同的修正内部收益率',
    descriptionEn: 'MIRR with finance and reinvestment rates',
    assumptions: '现金流需至少一正一负；率为每期小数',
    assumptionsEn: 'Needs mixed-sign flows; rates as decimals per period',
    expressions: [
      '// mirr(现金流, 融资成本, 再投资率)',
      '现金流 = [-50000, 12000, 14000, 16000, 18000]',
      '融资成本 = 6%',
      '再投资率 = 4%',
      'MIRR = mirr(现金流, 融资成本, 再投资率)',
    ],
    variables: {
      '现金流': '含初始流出（负）与后续流入',
    },
  },
  {
    id: 'tmpl_prepay_reduce_payment',
    categoryId: 'financial',
    name: '提前还款（缩月供示意）',
    nameEn: 'Prepay (Lower Payment Hint)',
    icon: 'TrendingUp',
    description: '一次性提前还本后，在剩余期数不变时新月供对比',
    descriptionEn: 'Compare payment after lump-sum prepayment, same term',
    assumptions: '未重算精确剩余本金摊还表；仅演示 pmt 参数变化',
    assumptionsEn: 'Not a full amortization schedule; demo only',
    expressions: [
      '// 提前还本后，期数不变则月供下降（示意）',
      '本金 = 900000 "元"',
      '年利率 = 4.2%',
      '剩余月数 = 300',
      '原月供 = pmt(年利率/12, 剩余月数, -本金)',
      '提前还 = 100000 "元"',
      '新月供 = pmt(年利率/12, 剩余月数, -(本金 - 提前还))',
      '月供减少 = 原月供 - 新月供',
    ],
    variables: {
      '本金': '提前还款前的剩余本金',
      '提前还': '一次性归还本金',
    },
  },
  {
    id: 'tmpl_vat_convert',
    categoryId: 'percent',
    name: '含税价 / 不含税价',
    nameEn: 'Tax-Inclusive / Exclusive',
    icon: 'Receipt',
    description: '增值税式价税互算（单一税率）',
    descriptionEn: 'Price with/without one tax rate',
    assumptions: '单一税率；不含阶梯税与优惠政策',
    assumptionsEn: 'Single rate; no tiered rules',
    expressions: [
      '// 不含税 * (1+税率) = 含税；含税 / (1+税率) = 不含税',
      '不含税价 = 10000 "元"',
      '税率 = 13%',
      '含税价 = 不含税价 * (1 + 税率)',
      '税额 = 含税价 - 不含税价',
      '验证不含税 = 含税价 / (1 + 税率)',
    ],
    variables: {
      '不含税价': '标价不含税部分',
      '税率': '如 13%、9%',
    },
  },
  {
    id: 'tmpl_margin_simple',
    categoryId: 'percent',
    name: '毛利率与净利率（简）',
    nameEn: 'Gross & Net Margin (Simple)',
    icon: 'PieChart',
    description: '营收、成本、费用的简化利润率',
    descriptionEn: 'Simple margins from revenue, COGS, expenses',
    assumptions: '未扣所得税；费用为示意汇总',
    assumptionsEn: 'Pre-tax; illustrative expenses',
    expressions: [
      '// 简易经营利润结构（非财报级）',
      '营收 = 80000 "元"',
      '营业成本 = 52000 "元"',
      '毛利 = 营收 - 营业成本',
      '毛利率 = 毛利 / 营收',
      '费用 = 12000 "元"',
      '净利 = 毛利 - 费用',
      '净利率 = 净利 / 营收',
    ],
    variables: {
      '营收': '销售收入',
      '营业成本': '直接成本',
      '费用': '销售与管理费用等合计',
    },
  },
  {
    id: 'tmpl_hourly_overtime',
    categoryId: 'life',
    name: '时薪与日薪 + 加班',
    nameEn: 'Hourly, Daily & Overtime',
    icon: 'Clock',
    description: '按小时计薪与 1.5 倍加班示例',
    descriptionEn: 'Hourly wage with 1.5x overtime example',
    assumptions: '倍率按当地法规自行调整',
    assumptionsEn: 'Adjust multiplier per local law',
    expressions: [
      '// 日薪 = 时薪 * 标准工时；加班费 = 时薪 * 倍率 * 加班小时',
      '时薪 = 45 "元/时"',
      '标准日工时 = 8 "小时"',
      '日薪 = 时薪 * 标准日工时',
      '加班小时 = 2.5',
      '加班倍率 = 1.5',
      '加班费 = 时薪 * 加班倍率 * 加班小时',
      '当日应得 = 日薪 + 加班费',
    ],
    variables: {
      '时薪': '基础时薪',
      '加班倍率': '如 1.5、2',
    },
  },
  {
    id: 'tmpl_thirteenth_salary',
    categoryId: 'life',
    name: '十三薪折算月均',
    nameEn: '13th Month to Monthly',
    icon: 'Wallet',
    description: '年薪 + 十三薪后的平均月收入',
    descriptionEn: 'Average monthly income with 13th-month bonus',
    assumptions: '十三薪按一个月工资计；不计其他奖金',
    assumptionsEn: 'One extra month; no other bonus',
    expressions: [
      '// 年均月入 = (12 个月薪 + 十三薪) / 12',
      '月薪 = 15000 "元"',
      '十三薪 = 月薪',
      '年均月入 = (月薪 * 12 + 十三薪) / 12',
    ],
    variables: {
      '月薪': '约定月工资',
    },
  },
  {
    id: 'tmpl_tdee_simple',
    categoryId: 'life',
    name: '基础代谢与 TDEE（简）',
    nameEn: 'BMR & TDEE (Simple)',
    icon: 'Activity',
    description: 'Mifflin-St Jeor 男性公式 × 活动系数',
    descriptionEn: 'Mifflin-St Jeor (male) × activity factor',
    assumptions: '男性公式；女性常数改为 -161；仅估算',
    assumptionsEn: 'Male formula; female uses -161; estimate only',
    expressions: [
      '// BMR（男）≈ 10*kg + 6.25*cm - 5*age + 5；TDEE = BMR * 活动系数',
      '体重kg = 72',
      '身高cm = 176',
      '年龄 = 32',
      'BMR = 10 * 体重kg + 6.25 * 身高cm - 5 * 年龄 + 5',
      '活动系数 = 1.55',
      'TDEE = BMR * 活动系数',
    ],
    variables: {
      '活动系数': '久坐约1.2，中等1.55，高强度更高',
    },
  },
  {
    id: 'tmpl_pace_time',
    categoryId: 'life',
    name: '配速与跑步时长',
    nameEn: 'Pace & Running Time',
    icon: 'Gauge',
    description: '距离 × 每公里分钟 = 总分钟',
    descriptionEn: 'Distance × min/km = total minutes',
    assumptions: '配速单位为分钟/公里',
    assumptionsEn: 'Pace in minutes per km',
    expressions: [
      '// 总时长(分钟) = 距离_km * 配速_min/km',
      '距离_km = 10',
      '配速_分每公里 = 6',
      '总时长_分钟 = 距离_km * 配速_分每公里',
      '总时长_小时 = 总时长_分钟 / 60',
    ],
    variables: {
      '配速_分每公里': '如 6 表示每公里 6 分钟',
    },
  },
  {
    id: 'tmpl_fuel_use',
    categoryId: 'life',
    name: '油耗估算',
    nameEn: 'Fuel Consumption',
    icon: 'Fuel',
    description: '百公里升数与里程',
    descriptionEn: 'L/100km and distance',
    assumptions: '匀速理想化；实际路况不同',
    assumptionsEn: 'Idealized; real driving varies',
    expressions: [
      '// 耗油(升) = 里程_km / 100 * 百公里升',
      '百公里升 = 7.2',
      '里程_km = 350',
      '耗油升 = 里程_km / 100 * 百公里升',
    ],
    variables: {
      '百公里升': '车辆表显或经验值',
    },
  },
  {
    id: 'tmpl_breakeven_qty',
    categoryId: 'financial',
    name: '保本销量（量本利）',
    nameEn: 'Break-Even Units',
    icon: 'Target',
    description: '固定成本、单位贡献毛利下的保本数量',
    descriptionEn: 'Units to break even from fixed cost and margin per unit',
    assumptions: '线性模型；单价>单位变动成本',
    assumptionsEn: 'Linear; price > variable cost per unit',
    expressions: [
      '// 保本量 = 固定成本 / (单价 - 单位变动成本)',
      '固定成本 = 480000 "元"',
      '单价 = 120 "元"',
      '单位变动成本 = 68 "元"',
      '单位贡献毛利 = 单价 - 单位变动成本',
      '保本销量 = 固定成本 / 单位贡献毛利',
    ],
    variables: {
      '固定成本': '租金、人工等固定开支合计',
      '单位变动成本': '材料、计件人工等',
    },
  },
  {
    id: 'tmpl_ear_nominal',
    categoryId: 'financial',
    name: '名义利率转有效年利率',
    nameEn: 'Nominal to Effective APR',
    icon: 'Percent',
    description: '年内多次复利下的有效年化',
    descriptionEn: 'Effective annual rate from nominal and compounding periods',
    assumptions: '名义利率为年化报价；n 为每年复利次数',
    assumptionsEn: 'Nominal APR; n compounding periods per year',
    expressions: [
      '// EAR = (1 + 名义年利率/n)^n - 1',
      '名义年利率 = 6%',
      '年复利次数 = 12',
      '有效年利率 = (1 + 名义年利率 / 年复利次数) ^ 年复利次数 - 1',
    ],
    variables: {
      '年复利次数': '如月供 12、季供 4',
    },
  },
  {
    id: 'tmpl_subscription_save',
    categoryId: 'financial',
    name: '订阅年付省多少',
    nameEn: 'Annual vs Monthly Subscription',
    icon: 'ShoppingCart',
    description: '月付总价与年付优惠价对比',
    descriptionEn: 'Compare paying monthly vs discounted annual',
    assumptions: '未计资金时间价值',
    assumptionsEn: 'Ignores time value of money',
    expressions: [
      '// 节省比例 = (月价*12 - 年付价) / (月价*12)',
      '月价 = 68 "元"',
      '年付优惠价 = 588 "元"',
      '若按月付全年 = 月价 * 12',
      '年付节省额 = 若按月付全年 - 年付优惠价',
      '节省比例 = 年付节省额 / 若按月付全年',
    ],
    variables: {},
  },
  {
    id: 'tmpl_commission_tier',
    categoryId: 'financial',
    name: '阶梯提成（两段）',
    nameEn: 'Tiered Commission (2 Brackets)',
    icon: 'CircleDollarSign',
    description: '超额部分更高提成率',
    descriptionEn: 'Higher rate above a threshold',
    assumptions: '两档线性；可按实际档数扩展',
    assumptionsEn: 'Two linear brackets',
    expressions: [
      '// 佣金 = 低档部分*低率 + 超额*高率',
      '销售额 = 180000 "元"',
      '第一档上限 = 100000 "元"',
      '第一档提成率 = 3%',
      '第二档提成率 = 6%',
      '佣金 = min(销售额, 第一档上限) * 第一档提成率 + max(0, 销售额 - 第一档上限) * 第二档提成率',
    ],
    variables: {},
  },
  {
    id: 'tmpl_rent_burden',
    categoryId: 'life',
    name: '房租收入比',
    nameEn: 'Rent-to-Income',
    icon: 'Home',
    description: '月租占月收入比例',
    descriptionEn: 'Monthly rent over income',
    assumptions: '口径需与收入一致（税前/税后）',
    assumptionsEn: 'Match gross vs net income convention',
    expressions: [
      '// 房租收入比 = 月租 / 月收入',
      '月租 = 4200 "元"',
      '月收入 = 15000 "元"',
      '房租收入比 = 月租 / 月收入',
    ],
    variables: {},
  },
  {
    id: 'tmpl_breakeven_revenue',
    categoryId: 'percent',
    name: '保本销售额（毛利率法）',
    nameEn: 'Break-Even Revenue (Margin)',
    icon: 'TrendingUp',
    description: '用毛利率覆盖固定成本',
    descriptionEn: 'Fixed cost divided by gross margin rate',
    assumptions: '毛利率 = (营收-变动成本)/营收；未扣税费',
    assumptionsEn: 'Gross margin = (rev - var cost) / rev',
    expressions: [
      '// 保本营收 = 固定成本 / 毛利率',
      '固定成本 = 360000 "元"',
      '毛利率 = 42%',
      '保本销售额 = 固定成本 / 毛利率',
    ],
    variables: {},
  },
  {
    id: 'tmpl_utility_tier',
    categoryId: 'life',
    name: '阶梯电费（两档）',
    nameEn: 'Tiered Electricity (2 Rates)',
    icon: 'Zap',
    description: '超额电量更高单价',
    descriptionEn: 'Higher rate above allowance kWh',
    assumptions: '仅两档示意；不含基础电费与附加费',
    assumptionsEn: 'Two-tier demo only',
    expressions: [
      '// 电费 = min(用量,限额)*低价 + max(0,用量-限额)*高价',
      '用量_kWh = 420',
      '第一档限额 = 260',
      '第一档单价 = 0.52',
      '第二档单价 = 0.78',
      '电费 = min(用量_kWh, 第一档限额) * 第一档单价 + max(0, 用量_kWh - 第一档限额) * 第二档单价',
    ],
    variables: {},
  },
  {
    id: 'tmpl_markup_price',
    categoryId: 'percent',
    name: '成本加价定价',
    nameEn: 'Cost-Plus Pricing',
    icon: 'Tag',
    description: '售价 = 成本 × (1 + 加价率)',
    descriptionEn: 'Price = cost × (1 + markup)',
    assumptions: '加价率为成本利润率',
    assumptionsEn: 'Markup on cost',
    expressions: [
      '// 售价 = 成本 * (1 + 加价率)',
      '成本 = 85 "元"',
      '加价率 = 65%',
      '售价 = 成本 * (1 + 加价率)',
    ],
    variables: {},
  },
  {
    id: 'tmpl_quantile_demo',
    categoryId: 'statistics',
    name: '分位数与中位数',
    nameEn: 'Quantiles & Median',
    icon: 'BarChart3',
    description: 'quantileSeq 与 median 对照',
    descriptionEn: 'quantileSeq vs median',
    assumptions: 'quantileSeq(数据, p) 中 p 为 0~1',
    assumptionsEn: 'prob p in [0,1]',
    expressions: [
      '// 分位数：quantileSeq(数组, 概率)',
      '数据 = [12, 15, 18, 22, 28, 31, 35, 40]',
      '中位数 = median(数据)',
      '下四分位 = quantileSeq(数据, 0.25)',
      '上四分位 = quantileSeq(数据, 0.75)',
    ],
    variables: {},
  },

  // 股市与估值（与函数目录「equities」一致，数据为示意）
  {
    id: 'tmpl_stock_pe_pb',
    categoryId: 'equities',
    name: 'PE / PB / 股息率',
    nameEn: 'PE, PB & Dividend Yield',
    icon: 'TrendingUp',
    description: '市盈率、市净率、股息率一行一套变量',
    descriptionEn: 'PE, PB, dividend yield',
    assumptions: 'EPS、净资产为归属母公司、股本加权；口径与行情一致',
    assumptionsEn: 'Align TTM vs annual data with your data source',
    expressions: [
      '// 填入行情与财报一致口径',
      '股价 = 18.6 "元"',
      'EPS = 1.25 "元/股"',
      '每股净资产 = 8.2 "元/股"',
      '每股股息 = 0.45 "元/股"',
      'PE = 股价 / EPS',
      'PB = 股价 / 每股净资产',
      '股息率 = 每股股息 / 股价',
    ],
    variables: {
      'EPS': '每股收益（注意 TTM/年报）',
    },
  },
  {
    id: 'tmpl_stock_roe_dupont',
    categoryId: 'equities',
    name: 'ROE 与杜邦拆解',
    nameEn: 'ROE & DuPont',
    icon: 'PieChart',
    description: '净利率 × 资产周转率 × 权益乘数',
    descriptionEn: 'DuPont decomposition',
    assumptions: '利润表与资产负债表同一报告期',
    assumptionsEn: 'Same reporting period for margin and turnover',
    expressions: [
      '// 杜邦三因子',
      '净利润 = 120 "亿元"',
      '营业收入 = 800 "亿元"',
      '总资产 = 1500 "亿元"',
      '净资产 = 600 "亿元"',
      '净利率 = 净利润 / 营业收入',
      '资产周转率 = 营业收入 / 总资产',
      '权益乘数 = 总资产 / 净资产',
      'ROE = 净利率 * 资产周转率 * 权益乘数',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_ps_fcf',
    categoryId: 'equities',
    name: '市销率与 FCF 收益率',
    nameEn: 'PS & FCF Yield',
    icon: 'BarChart3',
    description: '总市值 / 营收；FCF / 市值',
    descriptionEn: 'Market cap / revenue; FCF / cap',
    assumptions: 'FCF = 经营现金流 − 资本开支（示意）',
    assumptionsEn: 'FCF definition per your filing',
    expressions: [
      '总市值 = 3200 "亿元"',
      '营业收入 = 580 "亿元"',
      '自由现金流 = 95 "亿元"',
      '市销率 = 总市值 / 营业收入',
      'FCF收益率 = 自由现金流 / 总市值',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_peg',
    categoryId: 'equities',
    name: 'PEG',
    nameEn: 'PEG',
    icon: 'Percent',
    description: 'PE / 盈利增速（百分数写法）',
    descriptionEn: 'PE / growth rate',
    assumptions: '增速与 PE 同为未来 1～3 年预期时需注明',
    assumptionsEn: 'Match forward PE with forward growth',
    expressions: [
      'PE = 22 "倍"',
      '盈利增速 = 18%',
      'PEG = PE / 盈利增速',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_cagr',
    categoryId: 'equities',
    name: '营收或利润 CAGR',
    nameEn: 'Revenue/Earnings CAGR',
    icon: 'Activity',
    description: '(终/初)^(1/n)−1',
    descriptionEn: 'Geometric growth',
    assumptions: '初终值为同一指标、同单位',
    assumptionsEn: 'Same metric and units',
    expressions: [
      '初值 = 45 "亿元"',
      '终值 = 78 "亿元"',
      '年数 = 4',
      'CAGR = (终值 / 初值) ^ (1 / 年数) - 1',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_hpr',
    categoryId: 'equities',
    name: '持有期收益率',
    nameEn: 'Holding Period Return',
    icon: 'LineChart',
    description: '(卖−买)/买，可加股息',
    descriptionEn: 'Price return; add dividend if needed',
    assumptions: '未计交易费用',
    assumptionsEn: 'Ex fees',
    expressions: [
      '买入价 = 42 "元"',
      '卖出价 = 48.5 "元"',
      '每股股息 = 0.8 "元"',
      '价差收益率 = (卖出价 - 买入价) / 买入价',
      '含息收益率 = (卖出价 - 买入价 + 每股股息) / 买入价',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_interest_cover',
    categoryId: 'equities',
    name: '利息覆盖倍数',
    nameEn: 'Interest Coverage',
    icon: 'Shield',
    description: '息税前利润 / 利息费用',
    descriptionEn: 'EBIT / interest',
    assumptions: 'EBIT 与利息费用同口径',
    assumptionsEn: 'Consistent EBIT definition',
    expressions: [
      '息税前利润 = 35 "亿元"',
      '利息费用 = 6.5 "亿元"',
      '利息覆盖倍数 = 息税前利润 / 利息费用',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_position_risk',
    categoryId: 'equities',
    name: '按风险定额算股数',
    nameEn: 'Shares from Risk Budget',
    icon: 'Target',
    description: '风险预算 / (止损幅度×股价)',
    descriptionEn: 'Risk / (stop % × price)',
    assumptions: '止损幅度为小数，如 8% 写 8%',
    assumptionsEn: 'Stop as percent',
    expressions: [
      '账户权益 = 500000 "元"',
      '单笔风险比例 = 2%',
      '风险预算 = 账户权益 * 单笔风险比例',
      '股价 = 26 "元"',
      '止损幅度 = 8%',
      '可买股数 = 风险预算 / (止损幅度 * 股价)',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_kelly',
    categoryId: 'equities',
    name: '凯利仓位（简化）',
    nameEn: 'Kelly (simplified)',
    icon: 'Zap',
    description: '(胜率×盈亏比−败率)/盈亏比',
    descriptionEn: 'Kelly fraction',
    assumptions: '实务常乘 0.25～0.5 系数；全凯利波动大',
    assumptionsEn: 'Use fractional Kelly in practice',
    expressions: [
      '胜率 = 55%',
      '盈亏比 = 1.15',
      '凯利仓位 = (胜率 * 盈亏比 - (1 - 胜率)) / 盈亏比',
      '建议仓位_半凯利 = 凯利仓位 * 50%',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_sharpe',
    categoryId: 'equities',
    name: '夏普比率（简）',
    nameEn: 'Sharpe (simple)',
    icon: 'Activity',
    description: '(组合收益−无风险)/波动',
    descriptionEn: 'Excess return / volatility',
    assumptions: '收益与无风险利率为同一期度',
    assumptionsEn: 'Same period for return and Rf',
    expressions: [
      '组合期收益率 = 3.2%',
      '无风险利率 = 0.25%',
      '收益率标准差 = 4.1%',
      '夏普_简 = (组合期收益率 - 无风险利率) / 收益率标准差',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_dcf_sketch',
    categoryId: 'equities',
    name: '现金流折现示意（npv）',
    nameEn: 'DCF sketch (npv)',
    icon: 'Landmark',
    description: '预测期现金流 + 终值，用 npv',
    descriptionEn: 'Forecast flows + terminal, npv',
    assumptions: '极简示意；终值用倍数法非永续公式',
    assumptionsEn: 'Illustrative; terminal as multiple',
    expressions: [
      '// 折现率与现金流须同周期（年/季）；终值用倍数法示意；npv 第二参数用小数（9% -> 0.09）结果类型为数值',
      '折现率 = 0.09',
      '终值 = 18 * 12',
      '全部现金流 = [12, 14, 16, 18, 终值]',
      '现值合计 = npv(全部现金流, 折现率)',
    ],
    variables: {},
  },
  {
    id: 'tmpl_stock_ev_multiple',
    categoryId: 'equities',
    name: 'EV / EBITDA',
    nameEn: 'EV / EBITDA',
    icon: 'Building2',
    description: '企业价值 / EBITDA',
    descriptionEn: 'EV multiple',
    assumptions: 'EV = 市值 + 净债务（示意）',
    assumptionsEn: 'Define EV consistently',
    expressions: [
      '总市值 = 900 "亿元"',
      '净债务 = 120 "亿元"',
      '企业价值 = 总市值 + 净债务',
      'EBITDA = 105 "亿元"',
      'EV_EBITDA = 企业价值 / EBITDA',
    ],
    variables: {},
  },
];

// ============================================================
// 存储 Key
// ============================================================

const STORAGE_KEY_CUSTOM_TEMPLATES = 'calculator-custom-templates';
const STORAGE_KEY_FAVORITES = 'calculator-template-favorites';

// ============================================================
// 工具函数
// ============================================================

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; iconNode?: any }>>)[name];
  if (!IconComponent) return <Calculator className={className} />;
  return <IconComponent className={className} />;
}

export function loadCustomTemplates(): CalculatorTemplate[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_TEMPLATES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (t: unknown) => t && typeof t === 'object' && typeof (t as Record<string, unknown>).id === 'string',
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCustomTemplates(templates: CalculatorTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_TEMPLATES, JSON.stringify(templates));
  } catch {
    // ignore
  }
}

export function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((id: unknown) => typeof id === 'string');
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveFavorites(favorites: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  } catch {
    // ignore
  }
}

// ============================================================
// 编辑模板对话框
// ============================================================

interface TemplateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: CalculatorTemplate | null;
  onSave: (template: CalculatorTemplate) => void;
}

function TemplateEditDialog({ open, onOpenChange, template, onSave }: TemplateEditDialogProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [categoryId, setCategoryId] = useState('custom');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [assumptionsEn, setAssumptionsEn] = useState('');
  const [expressionsText, setExpressionsText] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setNameEn(template.nameEn);
      setCategoryId(template.categoryId);
      setDescription(template.description);
      setDescriptionEn(template.descriptionEn);
      setAssumptions(template.assumptions || '');
      setAssumptionsEn(template.assumptionsEn || '');
      setExpressionsText(template.expressions.join('\n'));
    } else {
      setName('');
      setNameEn('');
      setCategoryId('custom');
      setDescription('');
      setDescriptionEn('');
      setAssumptions('');
      setAssumptionsEn('');
      setExpressionsText('');
    }
  }, [template, open]);

  const handleSave = () => {
    const newTemplate: CalculatorTemplate = {
      id: template?.id || `tmpl_custom_${Date.now()}`,
      categoryId,
      name: name || t('calculator.newTemplateName', { defaultValue: '新模板' }),
      nameEn: nameEn || t('calculator.newTemplateNameEn', { defaultValue: 'New Template' }),
      icon: 'Star',
      description: description || '',
      descriptionEn: descriptionEn || '',
      assumptions: assumptions.trim() || undefined,
      assumptionsEn: assumptionsEn.trim() || undefined,
      expressions: expressionsText.split('\n').filter(Boolean),
      variables: {},
      isCustom: true,
      createdAt: template?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(newTemplate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {template?.id
              ? (isEn ? 'Edit Template' : '编辑模板')
              : (isEn ? 'New Template' : '新建模板')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isEn ? 'Name (Chinese)' : '名称（中文）'}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Name (English)' : '名称（英文）'}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isEn ? 'Category' : '分类'}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {isEn ? cat.nameEn : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isEn ? 'Description (Chinese)' : '描述（中文）'}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Description (English)' : '描述（英文）'}</Label>
              <Input value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {isEn
                  ? 'Assumptions / scope (Chinese, optional)'
                  : '适用假设（中文，可选）'}
              </Label>
              <Input value={assumptions} onChange={(e) => setAssumptions(e.target.value)} placeholder={isEn ? '' : '如：等额本息、按月复利'}
            />
            </div>
            <div className="space-y-2">
              <Label>
                {isEn
                  ? 'Assumptions (English, optional)'
                  : '适用假设（英文，可选）'}
              </Label>
              <Input value={assumptionsEn} onChange={(e) => setAssumptionsEn(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isEn ? 'Expressions (one per line)' : '表达式（每行一个）'}</Label>
            <Textarea
              value={expressionsText}
              onChange={(e) => setExpressionsText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder="// 注释&#10;变量 = 100&#10;结果 = 变量 * 2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleSave}>
            {t('common.save', { defaultValue: '保存' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 主组件
// ============================================================

interface CalculatorTemplatePanelProps {
  onSelectTemplate: (expressions: string[]) => void;
  onClose?: () => void;
}

export function CalculatorTemplatePanel({
  onSelectTemplate,
  onClose,
}: CalculatorTemplatePanelProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [customTemplates, setCustomTemplates] = useState<CalculatorTemplate[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CalculatorTemplate | null>(null);

  // 加载自定义模板和收藏
  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
    setFavorites(loadFavorites());
  }, []);

  // 合并内置和自定义模板
  const allTemplates = useMemo(() => {
    return [...BUILT_IN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  // 过滤模板
  const filteredTemplates = useMemo(() => {
    let templates = allTemplates;

    // 分类过滤
    if (selectedCategoryId === 'favorites') {
      templates = templates.filter(t => favorites.includes(t.id));
    } else if (selectedCategoryId !== 'all') {
      templates = templates.filter(t => t.categoryId === selectedCategoryId);
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.nameEn.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.descriptionEn.toLowerCase().includes(query) ||
        (t.assumptions && t.assumptions.toLowerCase().includes(query)) ||
        (t.assumptionsEn && t.assumptionsEn.toLowerCase().includes(query))
      );
    }

    // 排序：收藏在前
    return templates.sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [allTemplates, selectedCategoryId, searchQuery, favorites]);

  // 选择模板
  const handleSelectTemplate = useCallback((template: CalculatorTemplate) => {
    onSelectTemplate(template.expressions);
    onClose?.();
  }, [onSelectTemplate, onClose]);

  // 切换收藏
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(id)
        ? prev.filter(f => f !== id)
        : [...prev, id];
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, []);

  // 保存自定义模板
  const handleSaveTemplate = useCallback((template: CalculatorTemplate) => {
    setCustomTemplates(prev => {
      const existingIndex = prev.findIndex(t => t.id === template.id);
      let newTemplates: CalculatorTemplate[];
      if (existingIndex >= 0) {
        newTemplates = [...prev];
        newTemplates[existingIndex] = template;
      } else {
        newTemplates = [...prev, template];
      }
      saveCustomTemplates(newTemplates);
      return newTemplates;
    });
  }, []);

  // 删除自定义模板
  const handleDeleteTemplate = useCallback((id: string) => {
    setCustomTemplates(prev => {
      const newTemplates = prev.filter(t => t.id !== id);
      saveCustomTemplates(newTemplates);
      return newTemplates;
    });
    setFavorites(prev => {
      const newFavorites = prev.filter(f => f !== id);
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, []);

  // 复制模板
  const handleDuplicateTemplate = useCallback((template: CalculatorTemplate) => {
    const isEn = i18n.language.startsWith('en');
    const suffix = isEn ? ' (copy)' : ' (副本)';
    const newTemplate: CalculatorTemplate = {
      ...template,
      id: `tmpl_custom_${Date.now()}`,
      name: `${template.name}${suffix}`,
      nameEn: `${template.nameEn}${suffix}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    handleSaveTemplate(newTemplate);
  }, [handleSaveTemplate]);

  // 导出模板
  const handleExportTemplates = useCallback(async () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: customTemplates,
      favorites,
    };
    const text = JSON.stringify(exportData, null, 2);
    try {
      await saveTextFileWithDialog({
        defaultPath: 'calculator-templates.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        content: text,
      });
    } catch (e) {
      console.error('[CalculatorTemplatePanel] export templates', e);
    }
  }, [customTemplates, favorites]);

  // 导入模板
  const handleImportTemplates = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.templates && Array.isArray(data.templates)) {
          setCustomTemplates(prev => {
            const newTemplates = [...prev, ...data.templates.map((t: CalculatorTemplate, i: number) => ({
              ...t,
              id: `tmpl_imported_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
              isCustom: true,
            }))];
            saveCustomTemplates(newTemplates);
            return newTemplates;
          });
        }

        if (data.favorites && Array.isArray(data.favorites)) {
          setFavorites(prev => {
            const newFavorites = [...new Set([...prev, ...data.favorites])];
            saveFavorites(newFavorites);
            return newFavorites;
          });
        }
      } catch {
        alert(isEn ? 'Failed to import templates' : '导入模板失败');
      }
    };

    input.click();
  }, [isEn]);

  return (
    <div className="h-full flex flex-col bg-card">
      {/* 头部 */}
      <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-medium">
          {isEn ? 'Calculation Templates' : '计算模板'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setEditingTemplate(null);
              setEditDialogOpen(true);
            }}
            title={isEn ? 'New Template' : '新建模板'}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 搜索和分类 */}
      <div className="px-3 py-2 border-b flex-shrink-0 space-y-2">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? 'Search templates...' : '搜索模板...'}
            className="h-8 text-sm pl-8"
          />
        </div>

        {/* 分类下拉菜单 */}
        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5" />
                {isEn ? 'All Templates' : '全部模板'}
              </div>
            </SelectItem>
            <SelectItem value="favorites">
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />
                {isEn ? 'Favorites' : '收藏'}
                {favorites.length > 0 && (
                  <span className="text-xs text-muted-foreground">({favorites.length})</span>
                )}
              </div>
            </SelectItem>
            {TEMPLATE_CATEGORIES.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <DynamicIcon name={cat.icon} className="h-3.5 w-3.5" />
                  {isEn ? cat.nameEn : cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 导入导出按钮 */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={handleImportTemplates}
          >
            <Upload className="h-3 w-3 mr-1" />
            {isEn ? 'Import' : '导入'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => void handleExportTemplates()}
            disabled={customTemplates.length === 0}
          >
            <Download className="h-3 w-3 mr-1" />
            {isEn ? 'Export' : '导出'}
          </Button>
        </div>
      </div>

      {/* 模板列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredTemplates.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {searchQuery
                ? (isEn ? 'No templates found' : '未找到匹配的模板')
                : (isEn ? 'No templates in this category' : '此分类下没有模板')}
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div
                key={template.id}
                className={cn(
                  'group flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors',
                  favorites.includes(template.id) && 'bg-primary/5'
                )}
                onClick={() => handleSelectTemplate(template)}
              >
                <DynamicIcon
                  name={template.icon}
                  className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate">
                      {isEn ? template.nameEn : template.name}
                    </span>
                    {template.isCustom && (
                      <span className="text-[10px] px-1 py-0.5 bg-muted rounded">
                        {isEn ? 'Custom' : '自定义'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {isEn ? template.descriptionEn : template.description}
                  </div>
                  {(isEn ? template.assumptionsEn : template.assumptions) && (
                    <div className="text-[10px] text-muted-foreground/90 line-clamp-2 mt-0.5">
                      {t('calculator.templateAssumptionsLine', {
                        defaultValue: '适用假设：{{text}}',
                        text: isEn ? (template.assumptionsEn as string) : (template.assumptions as string),
                      })}
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(template.id);
                    }}
                  >
                    <Star
                      className={cn(
                        'h-3.5 w-3.5',
                        favorites.includes(template.id) && 'text-yellow-500 fill-yellow-500'
                      )}
                    />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        {isEn ? 'Duplicate' : '复制'}
                      </DropdownMenuItem>
                      {template.isCustom && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingTemplate(template);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            {isEn ? 'Edit' : '编辑'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-500 focus:text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isEn ? 'Delete' : '删除'}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* 编辑模板对话框 */}
      <TemplateEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}

export default CalculatorTemplatePanel;
