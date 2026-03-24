/**
 * stockResearchTemplates — 研究模板系统
 *
 * 预设模板：
 * - 价值投资模板（巴菲特式）
 * - 成长投资模板（彼得·林奇式）
 * - 技术分析模板
 */

// ═══════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════

export interface ResearchTemplateSection {
  id: string;
  title: string;
  description?: string;
  prompts: string[];  // 引导性问题
  required?: boolean;
}

export interface ResearchTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  author?: string;
  category: 'value' | 'growth' | 'technical' | 'mixed';
  sections: ResearchTemplateSection[];
  systemPromptAddition?: string;
  defaultThesisStatus?: 'bullish' | 'bearish' | 'neutral';
  riskTolerance?: 'low' | 'medium' | 'high';
}

// ═══════════════════════════════════════════════════════
// 价值投资模板（巴菲特式）
// ═══════════════════════════════════════════════════════

export const VALUE_INVESTING_TEMPLATE: ResearchTemplate = {
  id: 'value_investing',
  name: '价值投资模板',
  description: '巴菲特式价值投资分析框架，注重护城河、管理层质量和安全边际',
  icon: '🏰',
  author: 'Warren Buffett',
  category: 'value',
  sections: [
    {
      id: 'moat',
      title: '护城河分析',
      description: '评估公司的竞争优势和可持续性',
      prompts: [
        '公司的主要竞争优势是什么？（品牌、专利、网络效应、转换成本、成本优势）',
        '护城河在过去5年是否在扩大还是缩小？',
        '竞争对手能否轻易复制其商业模式？',
        '定价权如何？能否在不损失客户的情况下提价？',
      ],
      required: true,
    },
    {
      id: 'management',
      title: '管理层评估',
      description: '评估管理层的能力和诚信',
      prompts: [
        'CEO 的背景和过往业绩如何？',
        '管理层的薪酬结构是否与股东利益一致？',
        '管理层如何配置资本？（回购、分红、并购、再投资）',
        '管理层是否诚实透明地与股东沟通？',
        '是否有内部人持股？比例如何？',
      ],
      required: true,
    },
    {
      id: 'financial_health',
      title: '财务健康度',
      description: '评估财务报表的质量和风险',
      prompts: [
        'ROE 过去5年的趋势如何？是否稳定在15%以上？',
        '经营现金流是否持续覆盖净利润？',
        '资产负债率是否合理？（<50%为佳）',
        '自由现金流是否为正且持续增长？',
        '是否有表外负债或复杂的财务结构？',
      ],
      required: true,
    },
    {
      id: 'margin_of_safety',
      title: '安全边际',
      description: '计算内在价值和买入价格的安全边际',
      prompts: [
        '使用 DCF 模型估算的内在价值是多少？',
        '当前价格相对内在价值的折扣是多少？（建议30%以上）',
        '在悲观假设下，最大可能损失是多少？',
        '什么情况下安全边际会消失？',
      ],
      required: true,
    },
    {
      id: 'long_term_prospects',
      title: '长期前景',
      description: '评估5-10年的发展空间',
      prompts: [
        '公司在10年后是否还会存在？业务模式是否会过时？',
        '行业增长空间还有多大？',
        '公司是否有清晰的增长战略？',
        '潜在的颠覆性威胁有哪些？',
      ],
    },
  ],
  systemPromptAddition: `在分析时，请遵循价值投资的核心原则：
1. 只投资于你能理解的公司（能力圈）
2. 寻找有持久护城河的公司
3. 关注管理层素质和诚信
4. 只在价格远低于价值时买入（安全边际）
5. 长期持有，忽略短期波动`,
  defaultThesisStatus: 'bullish',
  riskTolerance: 'low',
};

// ═══════════════════════════════════════════════════════
// 成长投资模板（彼得·林奇式）
// ═══════════════════════════════════════════════════════

export const GROWTH_INVESTING_TEMPLATE: ResearchTemplate = {
  id: 'growth_investing',
  name: '成长投资模板',
  description: '彼得·林奇式成长股分析框架，关注增长质量、PEG和行业空间',
  icon: '🚀',
  author: 'Peter Lynch',
  category: 'growth',
  sections: [
    {
      id: 'growth_quality',
      title: '增长质量评估',
      description: '评估增长的可持续性和来源',
      prompts: [
        '过去3-5年的营收和利润增速是多少？',
        '增长主要来自哪里？（销量增长、提价、并购、新市场）',
        '增长率是否在加速还是放缓？',
        '增长是否需要大量资本投入？',
      ],
      required: true,
    },
    {
      id: 'peg_analysis',
      title: 'PEG分析',
      description: '评估估值与增长的匹配度',
      prompts: [
        '当前PE是多少？',
        '未来3年预期增长率是多少？',
        'PEG = PE / 增长率，是否 < 1？（理想情况）',
        '与历史估值相比，当前PE处于什么位置？',
      ],
      required: true,
    },
    {
      id: 'industry_space',
      title: '行业空间分析',
      description: '评估所在行业的增长潜力',
      prompts: [
        '行业的TAM（总可触达市场）是多少？',
        '行业增速是多少？处于生命周期的哪个阶段？',
        '公司的市场份额？是否还有提升空间？',
        '行业是否存在天花板风险？',
      ],
    },
    {
      id: 'competitive_position',
      title: '竞争地位',
      description: '评估公司在行业中的地位',
      prompts: [
        '公司是行业领导者还是挑战者？',
        '与主要竞争对手相比，优势劣势是什么？',
        '是否有被颠覆的风险？',
        '新进入者的门槛有多高？',
      ],
    },
    {
      id: 'scaling_potential',
      title: '扩张潜力',
      description: '评估规模化的可能性',
      prompts: [
        '商业模式是否可以复制到新市场？',
        '边际成本是否随规模下降？',
        '是否有网络效应或规模效应？',
        '扩张需要多少资本？',
      ],
    },
  ],
  systemPromptAddition: `在分析时，请遵循成长投资的核心原则：
1. 寻找"十倍股"潜力（能在5年内增长10倍）
2. 关注PEG而非单纯的PE
3. 增长要可持续，不是靠会计手段
4. 行业空间要足够大
5. 管理层要有执行力`,
  defaultThesisStatus: 'bullish',
  riskTolerance: 'medium',
};

// ═══════════════════════════════════════════════════════
// 技术分析模板
// ═══════════════════════════════════════════════════════

export const TECHNICAL_ANALYSIS_TEMPLATE: ResearchTemplate = {
  id: 'technical_trading',
  name: '技术分析模板',
  description: '技术派交易分析框架，关注趋势、形态和量价关系',
  icon: '📊',
  category: 'technical',
  sections: [
    {
      id: 'trend_analysis',
      title: '趋势判断',
      description: '判断当前的主要趋势方向',
      prompts: [
        '日线、周线、月线的趋势方向是什么？',
        '价格位于主要均线的上方还是下方？',
        '均线系统是否呈现多头/空头排列？',
        '趋势强度如何？ADX 指标是多少？',
      ],
      required: true,
    },
    {
      id: 'support_resistance',
      title: '支撑阻力位',
      description: '识别关键的价格支撑和阻力区域',
      prompts: [
        '最近的支撑位在哪里？是如何形成的？',
        '最近的阻力位在哪里？突破需要什么条件？',
        '历史高点/低点是多少？',
        '成交密集区在哪里？',
      ],
      required: true,
    },
    {
      id: 'volume_analysis',
      title: '量价关系',
      description: '分析成交量与价格的关系',
      prompts: [
        '上涨时放量还是缩量？下跌时呢？',
        '近期的量能趋势如何？',
        '是否出现异常放量或缩量？',
        '换手率水平如何？',
      ],
    },
    {
      id: 'pattern_recognition',
      title: '形态识别',
      description: '识别常见的K线形态和整理形态',
      prompts: [
        '是否存在头肩形、双顶/双底等反转形态？',
        '是否存在三角形、旗形等整理形态？',
        '形态的目标位和止损位如何计算？',
        '形态是否得到成交量的确认？',
      ],
    },
    {
      id: 'indicator_analysis',
      title: '技术指标分析',
      description: '综合分析主要技术指标',
      prompts: [
        'MACD 的 DIF 和 DEA 线的关系如何？金叉/死叉？',
        'RSI 处于什么区域？是否超买/超卖？',
        'KDJ 指标的信号如何？',
        '布林带的位置？价格接近上轨还是下轨？',
      ],
    },
    {
      id: 'trading_plan',
      title: '交易计划',
      description: '制定具体的交易计划',
      prompts: [
        '当前的交易方向是做多还是做空？',
        '入场点位在哪里？等待什么信号？',
        '止损位设在哪里？止损比例是多少？',
        '目标价位是多少？风险收益比如何？',
        '仓位大小如何确定？',
      ],
      required: true,
    },
  ],
  systemPromptAddition: `在分析时，请遵循技术分析的核心原则：
1. 趋势是朋友，顺势而为
2. 严格止损，保护本金
3. 量价配合是关键
4. 多周期共振增加胜率
5. 不追求买在最低卖在最高`,
  riskTolerance: 'high',
};

// ═══════════════════════════════════════════════════════
// 合并所有模板
// ═══════════════════════════════════════════════════════

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
  VALUE_INVESTING_TEMPLATE,
  GROWTH_INVESTING_TEMPLATE,
  TECHNICAL_ANALYSIS_TEMPLATE,
];

// 获取模板
export function getTemplateById(id: string): ResearchTemplate | undefined {
  return RESEARCH_TEMPLATES.find(t => t.id === id);
}

// 获取模板分类
export function getTemplatesByCategory(category: ResearchTemplate['category']): ResearchTemplate[] {
  return RESEARCH_TEMPLATES.filter(t => t.category === category);
}

// 根据模板生成研究笔记内容
export function generateTemplateNoteContent(template: ResearchTemplate): string {
  const lines: string[] = [];

  lines.push(`# ${template.name}`);
  lines.push('');
  lines.push(`> ${template.description}`);
  if (template.author) {
    lines.push(`> ${template.author} 风格`);
  }
  lines.push('');

  template.sections.forEach((section, i) => {
    lines.push(`## ${i + 1}. ${section.title}`);
    if (section.description) {
      lines.push(`*${section.description}*`);
    }
    lines.push('');
    section.prompts.forEach(prompt => {
      lines.push(`- [ ] ${prompt}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}
