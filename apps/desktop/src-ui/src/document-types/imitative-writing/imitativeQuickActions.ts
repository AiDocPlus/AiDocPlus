/**
 * 仿写 AI 快捷操作定义（30+）
 * 8 大类：分析、仿写、指导、润色、评估、素材、小说专项、诗歌专项
 */

export interface ImitativeQuickAction {
  id: string;
  label: string;
  icon: string;
  category: string;
  promptTemplate: string;
}

export const IMITATIVE_QUICK_ACTIONS: ImitativeQuickAction[] = [
  // ── 分析类 ──
  {
    id: 'analyze-full',
    label: '全文分析',
    icon: '🔎',
    category: '分析',
    promptTemplate: '请对以下原文进行全面的文学分析，包括：写作手法、修辞特点、意象运用、结构安排、语言风格：\n\n【原文】\n{{source}}',
  },
  {
    id: 'analyze-paragraph',
    label: '段落精析',
    icon: '📌',
    category: '分析',
    promptTemplate: '请对以下段落进行精细分析，逐句解读写作技法，并指出值得仿写的关键点：\n\n{{source}}',
  },
  {
    id: 'analyze-rhetoric',
    label: '修辞分析',
    icon: '✨',
    category: '分析',
    promptTemplate: '请逐一列举以下文段中的修辞手法（比喻、拟人、排比、对偶等），分析其表达效果：\n\n{{source}}',
  },
  {
    id: 'analyze-imagery',
    label: '意象分析',
    icon: '🎨',
    category: '分析',
    promptTemplate: '请分析以下文段中的意象系统：列出核心意象、分析象征含义、解读意象间的关联：\n\n{{source}}',
  },
  {
    id: 'analyze-structure',
    label: '结构分析',
    icon: '🏗️',
    category: '分析',
    promptTemplate: '请分析以下文章的篇章结构：开头方式、段落安排、线索贯穿、结尾处理，并绘制结构简图：\n\n{{source}}',
  },
  {
    id: 'analyze-style',
    label: '风格识别',
    icon: '🎭',
    category: '分析',
    promptTemplate: '请识别以下文章的写作风格：语言特色、句式偏好、情感基调、文学流派倾向：\n\n{{source}}',
  },

  // ── 仿写类 ──
  {
    id: 'imitate-fragment',
    label: '片段仿写',
    icon: '✏️',
    category: '仿写',
    promptTemplate: '请仿照以下原文片段的写法（修辞、句式、意象），写一段同类内容，保持神韵但换用不同题材：\n\n【原文片段】\n{{source}}\n\n【仿写作品（参考）】\n{{imitation}}',
  },
  {
    id: 'imitate-style',
    label: '风格仿写',
    icon: '🎯',
    category: '仿写',
    promptTemplate: '请参考以下原文的语言风格，帮我改写仿写作品，使其在风格上更贴近原文：\n\n【原文风格参考】\n{{source}}\n\n【当前仿写】\n{{imitation}}',
  },
  {
    id: 'imitate-opening',
    label: '开头仿写',
    icon: '🌅',
    category: '仿写',
    promptTemplate: '参考以下原文的开头方式，帮我写3种不同的仿写开头（保持原文的开头节奏和氛围）：\n\n【原文开头】\n{{source}}',
  },
  {
    id: 'imitate-ending',
    label: '结尾仿写',
    icon: '🌇',
    category: '仿写',
    promptTemplate: '参考以下原文的结尾技法，帮我写3种不同的仿写结尾（保持余韵悠长的效果）：\n\n【原文结尾】\n{{source}}\n\n【仿写正文】\n{{imitation}}',
  },

  // ── 指导类 ──
  {
    id: 'guide-paragraph',
    label: '逐段指导',
    icon: '📝',
    category: '指导',
    promptTemplate: '请对比原文与仿写，逐段给出具体的改进指导，指出差距所在和改进方向：\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'guide-rhetoric',
    label: '修辞练习',
    icon: '🔧',
    category: '指导',
    promptTemplate: '请给我设计5个针对性的修辞训练练习，参考原文风格，帮助我提升修辞能力：\n\n【原文参考】\n{{source}}',
  },
  {
    id: 'guide-description',
    label: '描写训练',
    icon: '🖌️',
    category: '指导',
    promptTemplate: '请分析原文的描写技法，并给我设计专项描写训练（景物/人物/细节），从仿写中总结规律：\n\n{{source}}',
  },
  {
    id: 'guide-improve',
    label: '写作锦囊',
    icon: '💡',
    category: '指导',
    promptTemplate: '结合原文特点，给我10条具体的写作建议，帮助我仿写时更好地掌握原文精髓：\n\n{{source}}',
  },

  // ── 润色类 ──
  {
    id: 'polish-language',
    label: '语言润色',
    icon: '💎',
    category: '润色',
    promptTemplate: '请对以下仿写作品进行语言润色，使语言更优美、流畅，接近原文的文学水准：\n\n【原文参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'polish-rhetoric',
    label: '修辞增强',
    icon: '🌟',
    category: '润色',
    promptTemplate: '请为以下仿写作品增加修辞手法，参考原文的修辞风格，增强文学感染力：\n\n【原文修辞参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'polish-imagery',
    label: '意象丰富',
    icon: '🌈',
    category: '润色',
    promptTemplate: '请参考原文的意象系统，丰富仿写作品中的意象，使其更有画面感和象征意味：\n\n【原文意象参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'polish-rhythm',
    label: '节奏调整',
    icon: '🎵',
    category: '润色',
    promptTemplate: '请分析原文的语言节奏，调整仿写作品的句式长短、停顿安排，使节奏更贴近原文：\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'polish-vocab',
    label: '词汇升级',
    icon: '📚',
    category: '润色',
    promptTemplate: '请参考原文的用词风格，对仿写作品进行词汇优化，用更准确、更有文学性的词语替换普通词汇：\n\n【原文用词参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },

  // ── 评估类 ──
  {
    id: 'evaluate-score',
    label: '多维评分',
    icon: '⭐',
    category: '评估',
    promptTemplate: '请从以下维度为仿写作品打分（1-10分）并详细说明：修辞运用、意象营造、节奏韵律、结构安排、情感表达、整体神韵：\n\n【原文参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'evaluate-compare',
    label: '逐段对比',
    icon: '⚖️',
    category: '评估',
    promptTemplate: '请逐段对比原文与仿写，分析相似之处和差距，指出仿写成功和需要改进的地方：\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'evaluate-report',
    label: '整体评析',
    icon: '📊',
    category: '评估',
    promptTemplate: '请写一份详细的仿写评析报告，包括：仿写亮点、主要不足、改进建议、学习收获总结：\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },

  // ── 素材类 ──
  {
    id: 'material-quotes',
    label: '名句推荐',
    icon: '📜',
    category: '素材',
    promptTemplate: '请推荐10句与以下原文主题、风格相近的名家名句，并说明适用场景和化用方式：\n\n{{source}}',
  },
  {
    id: 'material-similar',
    label: '同类名篇',
    icon: '📖',
    category: '素材',
    promptTemplate: '请推荐5篇与以下作品体裁、风格相近的经典名篇，简介写作特色和仿写价值：\n\n{{source}}',
  },

  // ── 小说专项 ──
  {
    id: 'novel-character',
    label: '人物塑造',
    icon: '👤',
    category: '小说专项',
    promptTemplate: '请分析以下小说片段的人物塑造技法（外貌、语言、心理、行动描写），并指导如何在仿写中塑造鲜明人物：\n\n{{source}}',
  },
  {
    id: 'novel-plot',
    label: '情节推进',
    icon: '⚡',
    category: '小说专项',
    promptTemplate: '请分析以下片段的情节推进技法（冲突设计、节奏控制、伏笔照应），并指导如何在仿写中运用：\n\n{{source}}',
  },
  {
    id: 'novel-suspense',
    label: '悬念设置',
    icon: '🎭',
    category: '小说专项',
    promptTemplate: '请分析以下片段的悬念设置方式，并帮我在仿写中设计类似的悬念结构：\n\n【原文参考】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'novel-dialogue',
    label: '对话风格',
    icon: '💬',
    category: '小说专项',
    promptTemplate: '请分析以下对话的写作特色（语气、潜台词、节奏），并指导如何在仿写中写出类似风格的对话：\n\n{{source}}',
  },

  // ── 诗歌专项 ──
  {
    id: 'poetry-rhythm',
    label: '韵律分析',
    icon: '🎶',
    category: '诗歌专项',
    promptTemplate: '请分析以下诗歌的韵律特征（押韵方式、音节节拍、停顿安排），并指导仿写时如何把握韵律：\n\n{{source}}',
  },
  {
    id: 'poetry-imagery',
    label: '意境营造',
    icon: '🌙',
    category: '诗歌专项',
    promptTemplate: '请分析以下诗歌的意境营造方式，并帮助我在仿写中营造相似的诗意氛围：\n\n【原诗】\n{{source}}\n\n【仿诗草稿】\n{{imitation}}',
  },
  {
    id: 'poetry-eye',
    label: '诗眼识别',
    icon: '👁️',
    category: '诗歌专项',
    promptTemplate: '请识别以下诗歌中的"诗眼"（最传神、最关键的词语），分析其妙处，并在仿写中找出或强化"诗眼"：\n\n{{source}}',
  },

  // ── 综合教练（高阶） ──
  {
    id: 'coach-next-three',
    label: '下一步三动作',
    icon: '▶',
    category: '综合',
    promptTemplate:
      '请根据当前原文与仿写进度（{{contextSummary}}），只输出三件事：① 下一小时最该写的 1 段内容（给提纲）② 必须对照原文核对的 1 个技法点 ③ 一句自我检查提问。要求极简条目。\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'weak-spots-scan',
    label: '弱项扫描',
    icon: '◎',
    category: '综合',
    promptTemplate:
      '请扫描仿写相对原文的弱项：分别从词汇语域、句长分布、意象连贯、叙事距离四方面各写「症状—原因—练法」一条，避免空话。\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
  {
    id: 'rewrite-with-constraints',
    label: '带约束改写',
    icon: '◇',
    category: '综合',
    promptTemplate:
      '请指定 3 条「硬性约束」（如：必须出现某一意象、限制段内句长波动、必须使用某一修辞），并在我仿写最后一段上示范一次改写前后对照。\n\n【原文】\n{{source}}\n\n【仿写】\n{{imitation}}',
  },
];

export function getQuickActionsByCategory(
  actions: ImitativeQuickAction[],
): Record<string, ImitativeQuickAction[]> {
  const result: Record<string, ImitativeQuickAction[]> = {};
  for (const action of actions) {
    if (!result[action.category]) result[action.category] = [];
    result[action.category].push(action);
  }
  return result;
}
