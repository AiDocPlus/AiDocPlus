/**
 * 股票研究 AI Prompts — 所有分析 prompt 模板
 */

// ═══════════════════════════════════════════════════════
// 系统提示词
// ═══════════════════════════════════════════════════════

export const STOCK_RESEARCH_SYSTEM_PROMPT = `你是一位资深的股票研究分析师，拥有 CFA 和 CPA 资质，在买方和卖方都有丰富经验。

【专业能力】
1. 财务分析：杜邦分析、现金流分析、财务造假识别、估值建模（DCF/可比公司）
2. 技术分析：K线形态、均线系统、量价关系、多周期分析
3. 行业研究：竞争格局、行业周期、政策影响、技术变革
4. 投资决策：风险收益评估、仓位管理、止盈止损策略
5. 实时数据获取：通过 Tushare Pro API 获取股票行情、财务、资金流向等数据（需在应用设置中配置 Tushare Token）

【工具调用】
具体可调用的函数名称与参数以对话请求中的 tools 定义为准（OpenAI 兼容 Function Calling）。请先使用 stock_search 将用户输入解析为标准 ts_code，再按需调用行情/财报/指标等工具。凭证校验与 Token 存储不在模型工具列表中，由用户在设置面板完成。

【分析原则】
- 数据驱动：每个结论都要有数据支撑
- 逻辑清晰：论点要有严密的推导过程
- 风险意识：始终提示潜在风险
- 中立客观：不预设多空立场
- 主动获取：当文档缺少所需数据时，主动调用 Tushare 工具获取

【输出规范】
- 结构化输出：使用标题、列表、表格
- 量化分析：给出具体数字和区间
- 可操作性：提供明确的监控指标和决策建议
- 数据来源：标注数据来源和时间

【免责声明】
所有分析仅供参考，不构成投资建议。投资有风险，入市需谨慎。`;

// ═══════════════════════════════════════════════════════
// 财务深度分析 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_FINANCIAL = {
  dupont_analysis: {
    id: 'dupont_analysis',
    labelKey: 'stockResearch.actionDupont',
    prompt: `请对 {{stockName}} 进行杜邦分析：

ROE 拆解：
- 净利率 = 净利润 / 营收 = ?%
- 资产周转率 = 营收 / 总资产 = ?
- 权益乘数 = 总资产 / 净资产 = ?

近5年趋势分析：
1. ROE 变化的主要驱动因素是什么？
2. 是盈利能力提升还是杠杆增加？
3. 这种趋势是否可持续？

财务数据：{{financials}}`,
    category: 'financial',
  },

  cashflow_quality: {
    id: 'cashflow_quality',
    labelKey: 'stockResearch.actionCashflow',
    prompt: `请分析 {{stockName}} 的现金流质量：

1. 经营现金流 vs 净利润：
   - 含金量 = 经营现金流 / 净利润
   - 若持续 < 1，说明利润质量存疑

2. 自由现金流趋势：
   - FCF = 经营现金流 - 资本支出
   - 是否有持续的正向 FCF？

3. 现金流结构：
   - 经营/投资/筹资现金流的比例关系
   - 公司处于什么发展阶段？

4. 预警信号：
   - 是否存在财务操纵迹象？
   - 应收账款/存货是否异常增长？

财务数据：{{financials}}`,
    category: 'financial',
  },

  financial_health: {
    id: 'financial_health',
    labelKey: 'stockResearch.actionHealthCheck',
    prompt: `请对 {{stockName}} 进行全面财务健康体检（满分100分）：

一、盈利能力（25分）
- ROE 水平及趋势
- 毛利率/净利率稳定性
- 费用控制能力

二、偿债能力（20分）
- 资产负债率
- 流动比率/速动比率
- 利息覆盖倍数

三、营运能力（20分）
- 应收账款周转天数
- 存货周转天数
- 总资产周转率

四、成长能力（20分）
- 营收增速
- 利润增速
- 增长的可持续性

五、现金流质量（15分）
- 经营现金流/净利润
- 自由现金流状况

输出格式：
- 各项评分 + 总分
- 主要风险点
- 改善建议

财务数据：{{financials}}`,
    category: 'financial',
  },

  valuation_model: {
    id: 'valuation_model',
    labelKey: 'stockResearch.actionValuation',
    prompt: `请用多种方法对 {{stockName}} 进行估值分析：

1. 相对估值法
   - PE 估值：当前 PE vs 历史分位 vs 行业平均
   - PB 估值：适用于哪些行业？
   - PS 估值：适用于高增长公司
   - PEG：PE / 增长率，是否合理？

2. 绝对估值法（DCF 思路）
   - 假设未来5年增长率：?%
   - 合理折现率：?%
   - 推算合理估值区间

3. 估值结论
   - 当前估值水平：高估/合理/低估
   - 安全边际分析
   - 估值驱动因素

财务数据：{{financials}}
当前价格：{{currentPrice}}`,
    category: 'financial',
  },

  fraud_detection: {
    id: 'fraud_detection',
    labelKey: 'stockResearch.actionFraudDetect',
    prompt: `请分析 {{stockName}} 是否存在财务异常信号：

1. 利润质量
   - 经营现金流/净利润 持续 < 0.8？
   - 非经常性损益占比是否过高？

2. 资产质量
   - 应收账款增速 > 营收增速？
   - 存货增速 > 营收增速？
   - 商誉占比是否过高？

3. 关联交易
   - 关联方交易占比
   - 是否存在利益输送嫌疑？

4. 审计信号
   - 审计意见类型
   - 会计师事务所变更

5. 综合评估
   - 风险等级：低/中/高
   - 需要重点关注的科目

财务数据：{{financials}}`,
    category: 'financial',
  },
};

// ═══════════════════════════════════════════════════════
// 技术分析 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_TECHNICAL = {
  candlestick_pattern: {
    id: 'candlestick_pattern',
    labelKey: 'stockResearch.actionCandlestick',
    prompt: `请识别 {{stockName}} 可能存在的K线形态：

反转形态：
- 头肩顶/底
- 双顶/双底
- 圆弧顶/底
- V形反转

持续形态：
- 三角形（上升/下降/对称）
- 旗形/楔形
- 矩形整理

关键信号：
- 成交量配合情况
- 形态目标位测算
- 形态失效的止损位

当前技术指标：{{technicals}}`,
    category: 'technical',
  },

  multi_period_trend: {
    id: 'multi_period_trend',
    labelKey: 'stockResearch.actionMultiPeriod',
    prompt: `请分析 {{stockName}} 的多周期趋势：

短期（日线）：
- 趋势方向、关键均线、支撑阻力

中期（周线）：
- 趋势方向、形态位置、波段空间

长期（月线）：
- 大周期位置、历史高点/低点、长期趋势

周期共振：
- 三个周期是否同向？
- 存在哪些周期冲突？
- 当前最佳操作策略？

技术数据：{{technicals}}`,
    category: 'technical',
  },

  volume_price: {
    id: 'volume_price',
    labelKey: 'stockResearch.actionVolumePrice',
    prompt: `请分析 {{stockName}} 的量价关系：

1. 量价配合度
   - 上涨放量/下跌缩量？（健康）
   - 上涨缩量/下跌放量？（警示）

2. 成交量变化
   - 近期量能趋势
   - 是否出现异常放量/缩量

3. 筹码分布
   - 成交密集区
   - 换手率水平

4. 主力行为判断
   - 吸筹/洗盘/拉升/出货迹象

技术数据：{{technicals}}`,
    category: 'technical',
  },

  tech_score: {
    id: 'tech_score',
    labelKey: 'stockResearch.actionTechScore',
    prompt: `请对 {{stockName}} 进行技术面综合评分（满分100分）：

趋势指标（30分）：
- 均线系统状态
- 趋势强度

动量指标（25分）：
- MACD 状态
- RSI 水平
- KDJ 信号

成交量（20分）：
- 量价配合度
- 量能充足性

形态位置（25分）：
- K线形态
- 支撑阻力位

输出：
- 各项评分 + 总分
- 综合技术评级：强势/偏强/中性/偏弱/弱势
- 关键技术位

技术数据：{{technicals}}`,
    category: 'technical',
  },
};

// ═══════════════════════════════════════════════════════
// 投资论点 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_THESIS = {
  investment_story: {
    id: 'investment_story',
    labelKey: 'stockResearch.actionInvestStory',
    prompt: `请为 {{stockName}} 构建一个完整的投资故事：

一、公司定位（1句话）
- 这是一家什么样的公司？
- 处于什么行业/赛道？

二、核心投资逻辑（3-5点）
- 最重要的买入理由
- 每点需有数据或事实支撑

三、成长路径
- 短期催化剂（3-6个月）
- 中期驱动力（1-2年）
- 长期护城河（3-5年）

四、风险对冲
- 主要风险因素
- 如何监控/应对

五、投资结论
- 建议操作方向
- 预期收益/风险比

参考数据：{{fullContext}}`,
    category: 'thesis',
  },

  thesis_framework: {
    id: 'thesis_framework',
    labelKey: 'stockResearch.actionThesisFramework',
    prompt: `请构建 {{stockName}} 的完整多空论点框架：

【看多理由】（Bull Case）
1. 基本面支撑
2. 行业趋势利好
3. 公司竞争优势
4. 催化剂预期

【看空理由】（Bear Case）
1. 基本面隐忧
2. 行业风险
3. 竞争威胁
4. 潜在利空

【多空博弈】
- 当前市场定价反映了什么？
- 哪些因素被低估/高估？
- 需要关注哪些关键变量？

【投资决策】
- 风险收益比评估
- 建议仓位
- 止盈止损策略

参考数据：{{fullContext}}`,
    category: 'thesis',
  },

  catalyst_tracker: {
    id: 'catalyst_tracker',
    labelKey: 'stockResearch.actionCatalyst',
    prompt: `请梳理 {{stockName}} 未来可能的价格催化剂：

短期催化剂（0-6个月）：
- 财报发布预期
- 产品发布/新品
- 政策利好
- 事件驱动

中期催化剂（6-18个月）：
- 产能释放
- 新市场拓展
- 并购整合
- 行业拐点

长期催化剂（18个月+）：
- 行业格局变化
- 技术突破
- 商业模式升级

对每个催化剂：
- 发生概率
- 潜在影响幅度
- 需要跟踪的信号

参考数据：{{fullContext}}`,
    category: 'thesis',
  },

  scenario_analysis: {
    id: 'scenario_analysis',
    labelKey: 'stockResearch.actionScenario',
    prompt: `请对 {{stockName}} 进行情景分析：

【乐观情景】（概率：?%）
- 假设条件
- 目标价格
- 时间周期

【基准情景】（概率：?%）
- 假设条件
- 目标价格
- 时间周期

【悲观情景】（概率：?%）
- 假设条件
- 目标价格
- 时间周期

【期望值计算】
- 加权平均目标价
- 风险收益比

【关键变量】
- 哪些因素会改变情景概率？
- 如何跟踪和调整？

参考数据：{{fullContext}}`,
    category: 'thesis',
  },
};

// ═══════════════════════════════════════════════════════
// 对标与新闻 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_COMPARISON = {
  peer_analysis: {
    id: 'peer_analysis',
    labelKey: 'stockResearch.actionPeerAnalysis',
    prompt: `请对 {{stockName}} 进行同业对比分析：

对比公司：{{peers}}

1. 财务指标对比
   - 营收规模
   - 盈利能力（ROE/净利率）
   - 成长性（营收/利润增速）
   - 估值水平（PE/PB）

2. 竞争优势分析
   - 护城河
   - 市场地位
   - 技术壁垒

3. 估值对比
   - 相对估值是否合理？
   - 估值差异的原因

4. 投资建议
   - 行业内首选标的
   - 配置建议`,
    category: 'comparison',
  },

  news_impact: {
    id: 'news_impact',
    labelKey: 'stockResearch.actionNewsImpact',
    prompt: `请分析以下新闻对 {{stockName}} 的影响：

新闻内容：
{{newsContent}}

1. 事件性质
   - 利好/利空/中性
   - 影响程度（短期/中期/长期）

2. 影响分析
   - 对业绩的影响
   - 对估值的影响
   - 对市场情绪的影响

3. 应对策略
   - 持有者建议
   - 观望者建议
   - 关键观察点

4. 风险提示
   - 不确定性因素
   - 需要跟踪的指标`,
    category: 'comparison',
  },
};

// ═══════════════════════════════════════════════════════
// 报告生成 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_REPORT = {
  summary: {
    id: 'research_summary',
    labelKey: 'stockResearch.actionSummary',
    prompt: `请为 {{stockName}} 生成一份1页纸投资要点摘要：

---
# {{stockName}}（{{stockCode}}）投资要点

## 公司概况
（1-2句话简介）

## 核心数据
| 指标 | 数值 | 评价 |
|------|------|------|
| PE | {{pe}} | |
| ROE | {{roe}} | |
| 营收增速 | {{revenueGrowth}} | |

## 投资逻辑
1. （最重要的一点）
2.
3.

## 风险提示
- 主要风险1
- 主要风险2

## 操作建议
- 综合评级：买入/持有/卖出
- 目标价：?
- 止损位：?
---

数据来源：{{fullContext}}
报告日期：{{currentDate}}`,
    category: 'report',
  },

  full_report: {
    id: 'full_report',
    labelKey: 'stockResearch.actionFullReport',
    prompt: `请为 {{stockName}} 生成一份完整的投资研究报告：

---
# {{stockName}}（{{stockCode}}）投资研究报告

## 一、公司概况
- 公司简介
- 主营业务
- 行业地位

## 二、财务分析
### 2.1 盈利能力
### 2.2 成长性
### 2.3 财务健康度
### 2.4 估值分析

## 三、技术分析
### 3.1 趋势判断
### 3.2 关键技术位
### 3.3 技术评分

## 四、投资论点
### 4.1 核心逻辑
### 4.2 催化剂
### 4.3 风险因素

## 五、情景分析
### 5.1 乐观情景
### 5.2 基准情景
### 5.3 悲观情景

## 六、投资建议
- 综合评级：买入/持有/卖出
- 目标价格：?
- 建议仓位：?
- 止损位：?

## 七、风险提示
---

数据来源：{{fullContext}}
报告日期：{{currentDate}}

免责声明：本报告仅供参考，不构成投资建议。`,
    category: 'report',
  },
};

// ═══════════════════════════════════════════════════════
// AI 分析增强 Prompts
// ═══════════════════════════════════════════════════════

export const PROMPTS_ENHANCED = {
  dividend_analysis: {
    id: 'dividend_analysis',
    labelKey: 'stockResearch.actionDividend',
    prompt: `请分析 {{stockName}} 的分红情况：

1. 分红历史
   - 过去5年的股息率趋势
   - 分红是否稳定？是否每年都有分红？
   - 分红比例（分红/净利润）是多少？

2. 分红政策
   - 公司的分红政策是什么？
   - 管理层对分红的承诺
   - 是否有特别分红的历史？

3. 分红可持续性
   - 经营现金流是否足以覆盖分红？
   - 分红后是否影响公司发展？
   - 负债率是否在合理范围？

4. 股息增长
   - 股息年增长率
   - 股息增长是否快于通胀？
   - 是否是"股息贵族"（连续25年增长）？

5. 投资建议
   - 对于收息投资者的吸引力
   - 与同业股息率对比
   - 风险提示

财务数据：{{financials}}`,
    category: 'financial',
  },

  management_analysis: {
    id: 'management_analysis',
    labelKey: 'stockResearch.actionManagement',
    prompt: `请分析 {{stockName}} 的管理层：

1. CEO 背景
   - CEO 姓名和年龄
   - 任职时间和过往经历
   - 在行业的声誉
   - 过往业绩表现

2. 治理结构
   - 董事会构成（独立董事比例）
   - 股权结构是否合理？
   - 是否有家族控制？
   - 中小股东利益保护

3. 股权激励
   - 是否有股权激励计划？
   - 激励对象和行权条件
   - 激励是否与业绩挂钩？
   - 管理层持股比例

4. 资本配置能力
   - 并购历史和成功率
   - 回购和分红政策
   - 再投资回报率
   - 现金管理策略

5. 诚信评估
   - 信息披露透明度
   - 是否有违规记录？
   - 关联交易情况
   - 审计意见类型

公司简介：{{stockDescription}}`,
    category: 'thesis',
  },

  industry_cycle: {
    id: 'industry_cycle',
    labelKey: 'stockResearch.actionIndustryCycle',
    prompt: `请分析 {{stockName}} 所在行业的周期：

1. 行业生命周期
   - 当前处于哪个阶段？（导入期/成长期/成熟期/衰退期）
   - 判断依据是什么？

2. 周期位置
   - 当前处于周期的哪个位置？（底部/上升/顶部/下降）
   - 周期长度通常是多久？
   - 上一个周期的高点和低点

3. 周期驱动因素
   - 主要的周期驱动因素是什么？
   - 供需关系变化
   - 价格波动规律
   - 政策影响

4. 周期预测
   - 未来1-2年的周期走势预测
   - 周期拐点的先行指标
   - 如何跟踪周期变化？

5. 投资策略
   - 当前时点的最佳策略
   - 何时是最佳买入时机？
   - 需要关注的风险信号

行业：{{stockIndustry}}
财务数据：{{financials}}`,
    category: 'comparison',
  },

  fund_flow: {
    id: 'fund_flow',
    labelKey: 'stockResearch.actionFundFlow',
    prompt: `请分析 {{stockName}} 的资金流向：

1. 主力资金
   - 近期主力资金净流入/流出情况
   - 大单交易特征
   - 主力资金持仓变化

2. 北向资金（如适用）
   - 北向资金持股比例
   - 近期买入/卖出趋势
   - 外资对该股的态度

3. 机构持仓
   - 机构投资者持股比例
   - 公募/社保/保险持仓变化
   - 最新季度的持仓变动

4. 资金成本
   - 融资余额变化
   - 融券余额变化
   - 资金成本水平

5. 资金面结论
   - 整体资金面评价
   - 资金面是否支持股价上涨？
   - 需要关注的信号

技术数据：{{technicals}}`,
    category: 'technical',
  },

  valuation_anchor: {
    id: 'valuation_anchor',
    labelKey: 'stockResearch.actionValuationAnchor',
    prompt: `请为 {{stockName}} 建立估值锚点：

1. 历史估值区间
   - 过去5年的PE区间（最高/最低/中位数）
   - 过去5年的PB区间
   - 当前估值在历史中的分位数

2. 同业估值对比
   - 主要竞争对手的PE/PB
   - 行业平均估值水平
   - 估值差异的原因分析

3. 合理估值测算
   - 基于历史分位的合理PE范围
   - 基于增长预期的PEG估值
   - DCF模型估算（简要）

4. 估值锚点
   - 安全买入价（低估区间）
   - 合理持有价（正常区间）
   - 减持价（高估区间）

5. 估值风险
   - 估值压缩的可能因素
   - 估值扩张的条件
   - 当前估值的敏感性分析

财务数据：{{financials}}
当前价格：{{currentPrice}}
同业数据：{{peers}}`,
    category: 'financial',
  },
};

// ═══════════════════════════════════════════════════════
// 合并所有 Prompts
// ═══════════════════════════════════════════════════════

export const ALL_PROMPTS = {
  ...PROMPTS_FINANCIAL,
  ...PROMPTS_TECHNICAL,
  ...PROMPTS_THESIS,
  ...PROMPTS_COMPARISON,
  ...PROMPTS_REPORT,
  ...PROMPTS_ENHANCED,
};

export type PromptId = keyof typeof ALL_PROMPTS;
export type PromptCategory = 'financial' | 'technical' | 'thesis' | 'comparison' | 'report';

export interface PromptDefinition {
  id: string;
  labelKey: string;
  prompt: string;
  category: PromptCategory;
}
