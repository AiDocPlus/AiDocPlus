/**
 * 散文 AI 快捷操作定义
 *
 * 8 大类：创作、修辞、意象、结构、风格、润色、审阅、素材
 */

export interface EssayQuickAction {
  id: string;
  label: string;
  icon: string;
  category: string;
  promptTemplate: string;
}

export const ESSAY_QUICK_ACTIONS: EssayQuickAction[] = [
  // ── 创作类 ──
  {
    id: 'continue',
    label: '续写',
    icon: '✏️',
    category: '创作',
    promptTemplate: '请续写以下散文正文，保持文风和情感基调一致，自然衔接上文：\n\n{{content}}',
  },
  {
    id: 'expand',
    label: '扩写段落',
    icon: '📝',
    category: '创作',
    promptTemplate: '请对以下段落进行扩写，增加细节描写、感官体验和情感渲染：\n\n{{content}}',
  },
  {
    id: 'opening',
    label: '生成开头',
    icon: '🌅',
    category: '创作',
    promptTemplate: '请根据以下主题和设定，为散文创作一个引人入胜的开头（3-5种风格供选择）：\n\n{{content}}',
  },
  {
    id: 'ending',
    label: '生成结尾',
    icon: '🌇',
    category: '创作',
    promptTemplate: '请根据以下散文内容，创作一个余韵悠长、令人回味的结尾（3种风格供选择）：\n\n{{content}}',
  },

  // ── 修辞类 ──
  {
    id: 'rhetoric-suggest',
    label: '修辞建议',
    icon: '✨',
    category: '修辞',
    promptTemplate: '请分析以下段落，建议可以使用哪些修辞手法来增强表达效果，并给出具体的改写示例：\n\n{{content}}',
  },
  {
    id: 'rhetoric-enhance',
    label: '修辞增强',
    icon: '💎',
    category: '修辞',
    promptTemplate: '请对以下段落增加修辞手法（比喻、拟人、排比、通感等），提升文学感染力：\n\n{{content}}',
  },
  {
    id: 'rhetoric-detect',
    label: '修辞分析',
    icon: '🔍',
    category: '修辞',
    promptTemplate: '请逐句分析以下文段中使用的修辞手法，标注类型和效果：\n\n{{content}}',
  },

  // ── 意象类 ──
  {
    id: 'imagery-create',
    label: '意象营造',
    icon: '🎨',
    category: '意象',
    promptTemplate: '请为以下段落营造更丰富的意象，通过具体的视觉、听觉、触觉描写增强画面感：\n\n{{content}}',
  },
  {
    id: 'imagery-symbol',
    label: '象征分析',
    icon: '🔮',
    category: '意象',
    promptTemplate: '请分析以下文段中的意象和象征意义，并建议可以深化的象征手法：\n\n{{content}}',
  },
  {
    id: 'sensory',
    label: '感官描写',
    icon: '👁️',
    category: '意象',
    promptTemplate: '请丰富以下段落的感官描写（视觉、听觉、嗅觉、触觉、味觉），使读者身临其境：\n\n{{content}}',
  },

  // ── 结构类 ──
  {
    id: 'structure-analyze',
    label: '结构分析',
    icon: '📐',
    category: '结构',
    promptTemplate: '请分析以下散文的整体结构（起承转合），指出结构上的优势和可改进之处：\n\n{{content}}',
  },
  {
    id: 'structure-optimize',
    label: '结构优化',
    icon: '🏗️',
    category: '结构',
    promptTemplate: '请对以下散文的段落顺序和过渡进行优化建议，使行文更加流畅自然：\n\n{{content}}',
  },
  {
    id: 'transition',
    label: '过渡衔接',
    icon: '🔗',
    category: '结构',
    promptTemplate: '请为以下两个段落之间创作自然的过渡衔接句：\n\n{{content}}',
  },

  // ── 风格类 ──
  {
    id: 'style-match',
    label: '风格模仿',
    icon: '🎭',
    category: '风格',
    promptTemplate: '请按照当前设定的目标风格，改写以下段落使其更贴近目标风格：\n\n{{content}}',
  },
  {
    id: 'tone-adjust',
    label: '语调调整',
    icon: '🎵',
    category: '风格',
    promptTemplate: '请调整以下段落的语调和节奏，使情感表达更加到位：\n\n{{content}}',
  },

  // ── 润色类 ──
  {
    id: 'polish',
    label: '语言润色',
    icon: '💫',
    category: '润色',
    promptTemplate: '请对以下散文段落进行语言润色，提升文学性和表达质量，保持原意不变：\n\n{{content}}',
  },
  {
    id: 'condense',
    label: '精简',
    icon: '✂️',
    category: '润色',
    promptTemplate: '请精简以下段落，去除冗余表达，使语言更加凝练有力：\n\n{{content}}',
  },
  {
    id: 'vocabulary',
    label: '词汇升级',
    icon: '📚',
    category: '润色',
    promptTemplate: '请替换以下段落中平淡的词汇，使用更精准、更有文学性的表达：\n\n{{content}}',
  },

  // ── 审阅类 ──
  {
    id: 'review',
    label: '全文审阅',
    icon: '📋',
    category: '审阅',
    promptTemplate: '请从以下维度全面审阅这篇散文并给出评分和改进建议：\n1. 主题表达（是否清晰深刻）\n2. 结构布局（起承转合是否合理）\n3. 语言风格（是否统一且有文学性）\n4. 修辞运用（是否恰当有效）\n5. 意象营造（是否生动深刻）\n6. 情感感染力\n\n{{content}}',
  },
  {
    id: 'score',
    label: '文学评分',
    icon: '⭐',
    category: '审阅',
    promptTemplate: '请为以下散文打分（满分100分），从修辞密度、意象丰富度、情感深度、结构完整度、语言美感五个维度分别评分，并给出总评：\n\n{{content}}',
  },

  // ── 素材类 ──
  {
    id: 'quote-suggest',
    label: '引用建议',
    icon: '💬',
    category: '素材',
    promptTemplate: '请根据以下散文的主题和内容，推荐适合引用的名言警句或经典诗句（5-8条）：\n\n{{content}}',
  },
  {
    id: 'imagery-bank',
    label: '意象库',
    icon: '🌸',
    category: '素材',
    promptTemplate: '请根据以下散文的主题，生成相关的意象词汇及其象征含义（10-15个意象）：\n\n{{content}}',
  },
];

/** 按类别分组 */
export function getQuickActionsByCategory(): { category: string; actions: EssayQuickAction[] }[] {
  const categories = [...new Set(ESSAY_QUICK_ACTIONS.map(a => a.category))];
  return categories.map(cat => ({
    category: cat,
    actions: ESSAY_QUICK_ACTIONS.filter(a => a.category === cat),
  }));
}
