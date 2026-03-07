/**
 * 快捷按钮管理器 — 数据定义、默认数据、持久化
 * 所有快捷操作按分类组织，用户可完全自定义
 */

// ── 类型定义 ──

export interface QuickActionCategory {
  id: string;
  label: string;
  icon: string;          // lucide 图标名
  order: number;
  builtin?: boolean;
}

export interface QuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  icon: string;          // lucide 图标名
  prompt: string;
  contextMode?: 'body' | 'account' | 'recipients' | 'template' | 'none';
  requiresBody?: boolean;
  order: number;
  builtin?: boolean;
  hidden?: boolean;
}

export interface QuickActionStore {
  categories: QuickActionCategory[];
  items: QuickActionItem[];
  version: number;
}

const STORAGE_KEY = '_quick_actions';
const CURRENT_VERSION = 2;

// ── 默认内置分类（7 类） ──

const DEFAULT_CATEGORIES: QuickActionCategory[] = [
  { id: 'compose',   label: '撰写',   icon: 'Wand2',       order: 0, builtin: true },
  { id: 'reply',     label: '回复',   icon: 'Reply',       order: 1, builtin: true },
  { id: 'enhance',   label: '优化',   icon: 'Sparkles',    order: 2, builtin: true },
  { id: 'format',    label: '排版',   icon: 'Paintbrush',  order: 3, builtin: true },
  { id: 'translate', label: '翻译',   icon: 'Languages',   order: 4, builtin: true },
  { id: 'check',     label: '检查',   icon: 'ShieldCheck', order: 5, builtin: true },
  { id: 'tools',     label: '工具',   icon: 'Settings',    order: 6, builtin: true },
];

// ── 默认内置操作项 ──

const DEFAULT_ITEMS: QuickActionItem[] = [

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 撰写 (compose) — 按场景一键生成邮件
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'compose_formal',       categoryId: 'compose', label: '正式商务',   icon: 'Wand2',     order: 0,  builtin: true, contextMode: 'body',
    prompt: '根据当前文档正文和邮件主题、收件人信息，撰写一封正式的商务邮件正文。语言专业、措辞严谨、结构清晰。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_brief',        categoryId: 'compose', label: '简洁通知',   icon: 'Wand2',     order: 1,  builtin: true, contextMode: 'body',
    prompt: '根据当前文档正文和邮件主题，撰写一封简洁的通知邮件正文，突出关键信息，控制在200字以内。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_academic',     categoryId: 'compose', label: '学术交流',   icon: 'Wand2',     order: 2,  builtin: true, contextMode: 'body',
    prompt: '根据当前文档正文和邮件主题，撰写一封学术交流邮件正文，语言规范、逻辑严密。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_friendly',     categoryId: 'compose', label: '轻松友好',   icon: 'Wand2',     order: 3,  builtin: true, contextMode: 'body',
    prompt: '根据当前文档正文和邮件主题，撰写一封轻松友好的邮件正文，语气亲切自然。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_submission',   categoryId: 'compose', label: '投稿邮件',   icon: 'Wand2',     order: 4,  builtin: true, contextMode: 'body',
    prompt: '根据当前文档正文和邮件主题，撰写一封投稿邮件正文，简要介绍稿件主题和亮点，表达发表意愿，语气专业谦逊。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_apology',      categoryId: 'compose', label: '诚恳致歉',   icon: 'Wand2',     order: 5,  builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封诚恳的致歉邮件正文。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_thanks',       categoryId: 'compose', label: '感谢邮件',   icon: 'Wand2',     order: 6,  builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封感谢邮件正文。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_followup',     categoryId: 'compose', label: '跟进提醒',   icon: 'Wand2',     order: 7,  builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封跟进邮件正文，礼貌提醒对方之前的沟通并询问进展。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_invitation',   categoryId: 'compose', label: '邀请函',     icon: 'Wand2',     order: 8,  builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封邀请邮件正文，包含活动/会议的时间、地点、议程等关键信息，语气热情且正式。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_intro',        categoryId: 'compose', label: '自我介绍',   icon: 'Wand2',     order: 9,  builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封自我介绍邮件正文，用于首次联系对方。简要介绍身份背景、联系目的，语气专业真诚。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_recommendation', categoryId: 'compose', label: '推荐信',   icon: 'Wand2',     order: 10, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封推荐邮件正文，突出被推荐人的核心优势和与目标岗位/机会的匹配度，语气诚挚可信。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_reminder',     categoryId: 'compose', label: '催促提醒',   icon: 'Wand2',     order: 11, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封催促/提醒邮件正文，礼貌但明确地提醒对方待处理事项和截止时间。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_congratulation', categoryId: 'compose', label: '祝贺邮件', icon: 'Wand2',     order: 12, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封祝贺邮件正文，表达真诚的祝贺和美好祝愿。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_condolence',   categoryId: 'compose', label: '慰问邮件',   icon: 'Wand2',     order: 13, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封慰问邮件正文，表达关切和支持，语气温暖体贴。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_resignation',  categoryId: 'compose', label: '辞职信',     icon: 'Wand2',     order: 14, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封辞职邮件正文，表达离职意愿、感谢公司培养、说明交接意愿，语气专业得体。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'compose_leave',        categoryId: 'compose', label: '请假申请',   icon: 'Wand2',     order: 15, builtin: true, contextMode: 'body',
    prompt: '根据当前邮件上下文，撰写一封请假申请邮件正文，说明请假类型、时间、原因和工作交接安排。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 回复 (reply) — 智能生成回复邮件
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'reply_agree',     categoryId: 'reply', label: '同意接受', icon: 'Reply', order: 0, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封表示同意/接受的回复邮件正文，语气专业友好。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_decline',   categoryId: 'reply', label: '礼貌婉拒', icon: 'Reply', order: 1, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封礼貌婉拒的回复邮件正文，语气委婉得体，适当说明原因。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_askmore',   categoryId: 'reply', label: '追问细节', icon: 'Reply', order: 2, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封询问更多细节的回复邮件正文，列出需要对方补充的信息。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_confirm',   categoryId: 'reply', label: '确认收到', icon: 'Reply', order: 3, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封确认收到并表示会跟进的回复邮件正文。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_negotiate',  categoryId: 'reply', label: '协商讨论', icon: 'Reply', order: 4, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封协商/讨价还价的回复邮件正文，提出替代方案或条件调整，语气友好但坚定。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_postpone',   categoryId: 'reply', label: '请求延期', icon: 'Reply', order: 5, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封请求延期的回复邮件正文，说明延期原因并提出新的时间安排。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_forward',    categoryId: 'reply', label: '转介绍',   icon: 'Reply', order: 6, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封转介绍的回复邮件正文，将来信方介绍给更合适的对接人，并说明转介原因。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_escalate',   categoryId: 'reply', label: '上报领导', icon: 'Reply', order: 7, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封上报/转交上级的回复邮件正文，简要概括情况并说明需要上级介入的原因。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'reply_thank',      categoryId: 'reply', label: '简短感谢', icon: 'Reply', order: 8, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '根据当前邮件正文内容，生成一封简短的感谢回复，表达收到并感谢对方的信息/帮助。控制在100字以内。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 优化 (enhance) — 内容润色与改写
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'enhance_polish',       categoryId: 'enhance', label: '润色优化',   icon: 'Sparkles',   order: 0,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请润色优化当前邮件正文，改善措辞和结构，使其更加专业得体。保持原文核心意思不变。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_proofread',    categoryId: 'enhance', label: '校对纠错',   icon: 'Sparkles',   order: 1,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请对当前邮件正文进行严格校对：检查并修正错别字、拼写错误、标点符号、语法问题。仅修正错误，不改变原文风格和表达。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_rewrite',     categoryId: 'enhance', label: '换角度重写', icon: 'Sparkles',   order: 2,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请用不同的表达方式重写当前邮件正文，保持相同的核心信息但采用全新的措辞和结构，使邮件焕然一新。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_tone_formal',  categoryId: 'enhance', label: '更正式',     icon: 'Volume2',    order: 3,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文的语气调整为更加正式、专业，适合商务场合。保持原文核心意思不变。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_tone_casual',  categoryId: 'enhance', label: '更轻松',     icon: 'Volume2',    order: 4,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文的语气调整为更加轻松、友好，适合非正式沟通。保持原文核心意思不变。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_tone_concise', categoryId: 'enhance', label: '更简洁',     icon: 'Volume2',    order: 5,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文精简为更加简洁的版本，去除冗余表达，保留核心信息。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_tone_detailed', categoryId: 'enhance', label: '更详细',    icon: 'Volume2',    order: 6,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文扩展为更加详细的版本，补充必要的背景信息和细节说明。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_continue',    categoryId: 'enhance', label: '续写',       icon: 'ArrowRight',  order: 7,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请基于当前邮件正文继续撰写，保持一致的语气和风格，自然衔接。只输出续写部分的HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_shorten',     categoryId: 'enhance', label: '精简缩短',   icon: 'Sparkles',   order: 8,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文大幅精简缩短，只保留最核心的信息和要求，去掉所有客套和冗余段落，目标缩减至原文的一半以内。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_expand',      categoryId: 'enhance', label: '展开要点',   icon: 'Sparkles',   order: 9,  builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文中的要点和列表项展开为完整的段落描述，补充解释和论据，使内容更加充实有说服力。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_add_greeting', categoryId: 'enhance', label: '补充问候语', icon: 'Sparkles',  order: 10, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请为当前邮件正文补充一个合适的开头问候语，根据收件人和邮件语境选择恰当的称呼和问候。保持原文其余部分不变。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'enhance_add_closing',  categoryId: 'enhance', label: '补充结尾语', icon: 'Sparkles',  order: 11, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请为当前邮件正文补充一个合适的结尾敬语和署名格式，根据邮件正式程度选择恰当的结束语。保持原文其余部分不变。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 排版 (format) — 视觉排版美化
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'format_clean',     categoryId: 'format', label: '格式清理',     icon: 'Paintbrush', order: 0, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请对当前邮件正文进行格式清理和规范化排版：统一字体、字号、行高，段落间距适当，去除多余空行和格式混乱。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构，保持原文语义不变。' },
  { id: 'format_biz',       categoryId: 'format', label: '商务风格',     icon: 'Paintbrush', order: 1, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文排版为专业商务风格：深色正文、清晰段落层次、标题加粗、关键信息突出。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_modern',    categoryId: 'format', label: '现代简约',     icon: 'Paintbrush', order: 2, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文排版为现代简约风格：无衬线字体、适当留白、柔和色彩、清晰视觉层次。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_minimal',   categoryId: 'format', label: '极简风格',     icon: 'Paintbrush', order: 3, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文排版为极简风格：最少装饰、大量留白、精简排版、突出核心内容。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_news',      categoryId: 'format', label: '新闻简报',     icon: 'Paintbrush', order: 4, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文排版为新闻简报风格：添加分隔线、标题样式、引用框、列表美化。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_numbering', categoryId: 'format', label: '添加编号列表', icon: 'Paintbrush', order: 5, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文中的要点、步骤、条目整理为清晰的编号列表或项目符号列表格式，提升可读性。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_highlight', categoryId: 'format', label: '高亮关键信息', icon: 'Paintbrush', order: 6, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请对当前邮件正文中的关键信息（日期、金额、截止时间、重要人名、核心要求）进行加粗或颜色高亮标注，使收件人一目了然。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'format_table',     categoryId: 'format', label: '表格化数据',   icon: 'Paintbrush', order: 7, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文中适合用表格呈现的数据（如对比、列表、时间安排等）整理为美观的HTML表格格式。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 翻译 (translate) — 多语言翻译
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'translate_en',       categoryId: 'translate', label: '翻译为英文',   icon: 'Languages', order: 0, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为英文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_zh',       categoryId: 'translate', label: '翻译为中文',   icon: 'Languages', order: 1, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为中文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_ja',       categoryId: 'translate', label: '翻译为日文',   icon: 'Languages', order: 2, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为日文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_ko',       categoryId: 'translate', label: '翻译为韩文',   icon: 'Languages', order: 3, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为韩文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_fr',       categoryId: 'translate', label: '翻译为法文',   icon: 'Languages', order: 4, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为法文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_de',       categoryId: 'translate', label: '翻译为德文',   icon: 'Languages', order: 5, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为德文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_es',       categoryId: 'translate', label: '翻译为西班牙文', icon: 'Languages', order: 6, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为西班牙文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_ru',       categoryId: 'translate', label: '翻译为俄文',   icon: 'Languages', order: 7, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将以下邮件正文翻译为俄文，保持专业的商务邮件风格和原文的格式结构。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'translate_bilingual', categoryId: 'translate', label: '中英双语对照', icon: 'Languages', order: 8, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请将当前邮件正文制作为中英双语对照版本：每一段先显示中文原文，紧接着显示对应的英文翻译，用分隔线或不同颜色区分。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 检查 (check) — 质量分析与信息提取
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'check_precheck',    categoryId: 'check', label: '发送前检查',   icon: 'ShieldCheck',  order: 0, builtin: true, contextMode: 'body',
    prompt: '请对当前邮件进行全面的发送前检查。请使用结构化 JSON 报告格式输出检查结果。' },
  { id: 'check_summarize',   categoryId: 'check', label: '生成摘要',     icon: 'ListCollapse', order: 1, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请为当前邮件正文生成简洁摘要，提取关键信息点，用3-5个要点概括。' },
  { id: 'check_subject',     categoryId: 'check', label: '主题建议',     icon: 'Lightbulb',    order: 2, builtin: true, contextMode: 'body',
    prompt: '请根据当前邮件内容建议5个合适的邮件主题。请使用结构化 JSON 格式输出。' },
  { id: 'check_actions',     categoryId: 'check', label: '提取待办事项', icon: 'Check',        order: 3, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请从当前邮件正文中提取所有待办事项、行动项和需要跟进的任务，按优先级排列，标注负责人和截止时间（如有）。以清晰的列表格式输出。' },
  { id: 'check_tone',        categoryId: 'check', label: '语气分析',     icon: 'Brain',        order: 4, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请分析当前邮件正文的语气和情感倾向：整体语气（正式/非正式/紧急/友好等）、情感色彩（积极/消极/中性）、是否存在可能引起误解的表达，并给出改进建议。' },
  { id: 'check_sensitive',   categoryId: 'check', label: '敏感信息检查', icon: 'ShieldCheck',  order: 5, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请检查当前邮件正文中是否包含敏感信息：个人身份信息（身份证号、手机号等）、财务信息（银行账号、金额等）、机密标记内容、不当措辞。列出所有发现并建议处理方式。' },
  { id: 'check_read_time',   categoryId: 'check', label: '可读性评估',   icon: 'Clock',        order: 6, builtin: true, contextMode: 'body', requiresBody: true,
    prompt: '请评估当前邮件正文的可读性：预估阅读时间、句子平均长度、段落结构是否合理、是否有过长段落、专业术语使用是否恰当，并给出可读性改进建议。' },
  { id: 'check_recipients',  categoryId: 'check', label: '收件人匹配',   icon: 'Users',        order: 7, builtin: true, contextMode: 'recipients',
    prompt: '请根据当前邮件的收件人信息和邮件内容，分析：收件人是否合适、是否遗漏了应该抄送的人、称呼是否与收件人匹配、语言和语气是否适合收件人的身份和关系。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 工具 (tools) — 账户管理与实用生成
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'tools_add_account',   categoryId: 'tools', label: '配置邮箱',     icon: 'UserPlus', order: 0, builtin: true, contextMode: 'account',
    prompt: '请帮我配置邮箱账户。请告诉我你的邮箱地址，我会自动识别服务商并指导你获取授权码。' },
  { id: 'tools_gen_signature', categoryId: 'tools', label: '生成签名',     icon: 'PenLine',  order: 1, builtin: true, contextMode: 'account',
    prompt: '请为我生成一个专业的邮件签名，输出 HTML 格式。使用简洁现代的设计，包含姓名、职位、联系方式等常见字段。' },
  { id: 'tools_diagnose',     categoryId: 'tools', label: '诊断发送',     icon: 'Bug',      order: 2, builtin: true, contextMode: 'account',
    prompt: '请帮我诊断邮件发送问题，分析最近的发送失败记录并给出解决方案。' },
  { id: 'tools_gen_template',  categoryId: 'tools', label: '生成邮件模板', icon: 'FileText', order: 3, builtin: true, contextMode: 'template',
    prompt: '请根据当前邮件的结构和内容，生成一个可复用的邮件模板，将具体信息替换为占位变量（如{{收件人姓名}}、{{日期}}等），并说明各变量的用途。' },
  { id: 'tools_gen_cover',    categoryId: 'tools', label: '附件说明',     icon: 'FileText', order: 4, builtin: true, contextMode: 'body',
    prompt: '请根据当前邮件上下文，生成一段附件说明/传送函正文，简要介绍所附文件的内容、用途和注意事项。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'tools_gen_ooo',      categoryId: 'tools', label: '外出自动回复', icon: 'Clock',    order: 5, builtin: true, contextMode: 'account',
    prompt: '请生成一段专业的外出自动回复邮件正文，包含：外出时间段、紧急联系人信息、预计回复时间。提供中英双语版本。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
  { id: 'tools_gen_disclaimer', categoryId: 'tools', label: '免责声明',   icon: 'ShieldCheck', order: 6, builtin: true, contextMode: 'none',
    prompt: '请生成一段专业的邮件免责声明/隐私声明，适用于商务邮件底部，包含保密提示、免责条款和隐私保护说明。提供中英双语版本。只输出HTML片段，所有样式使用内联style属性，不要输出完整网页结构。' },
];

// ── 获取默认数据 ──

export function getDefaultStore(): QuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
  };
}

// ── v1→v2 迁移：旧 ID → 新 ID 映射（分类重组后的项 ID 变更） ──

const V1_TO_V2_ID_MAP: Record<string, string> = {
  // 回复类：从 tools → reply
  'tools_reply_agree':   'reply_agree',
  'tools_reply_decline': 'reply_decline',
  'tools_reply_askmore': 'reply_askmore',
  'tools_reply_confirm': 'reply_confirm',
  // 排版类：从 enhance → format
  'enhance_typo_clean':   'format_clean',
  'enhance_typo_biz':     'format_biz',
  'enhance_typo_modern':  'format_modern',
  'enhance_typo_minimal': 'format_minimal',
  'enhance_typo_news':    'format_news',
  // 翻译类：从 check → translate
  'check_translate_en': 'translate_en',
  'check_translate_zh': 'translate_zh',
  'check_translate_ja': 'translate_ja',
};

// ── 合并内置项（确保新版本的内置项被补充） ──

function mergeWithDefaults(stored: QuickActionStore): QuickActionStore {
  const result = { ...stored, version: CURRENT_VERSION };

  // v1→v2 迁移：将旧 ID 的项迁移为新 ID（保留用户自定义的 prompt 等）
  if (stored.version < 2) {
    for (const item of result.items) {
      const newId = V1_TO_V2_ID_MAP[item.id];
      if (newId) {
        const defaultNew = DEFAULT_ITEMS.find(d => d.id === newId);
        if (defaultNew) {
          item.id = newId;
          item.categoryId = defaultNew.categoryId;
          item.order = defaultNew.order;
        }
      }
    }
  }

  // 补充缺失的内置分类
  for (const dc of DEFAULT_CATEGORIES) {
    if (!result.categories.find(c => c.id === dc.id)) {
      result.categories.push({ ...dc });
    }
  }

  // 补充缺失的内置操作项（保留用户对已有项的修改）
  for (const di of DEFAULT_ITEMS) {
    if (!result.items.find(i => i.id === di.id)) {
      result.items.push({ ...di });
    }
  }

  return result;
}

// ── Storage 接口（与 PluginHostAPI 的 storage 兼容） ──

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

// ── 加载 ──

export function loadQuickActions(storage: StorageLike): QuickActionStore {
  const stored = storage.get<QuickActionStore>(STORAGE_KEY);
  if (!stored || !stored.categories || !stored.items) {
    return getDefaultStore();
  }
  return mergeWithDefaults(stored);
}

// ── 保存 ──

export function saveQuickActions(storage: StorageLike, data: QuickActionStore): void {
  storage.set(STORAGE_KEY, { ...data, version: CURRENT_VERSION });
}

// ── 重置为默认 ──

export function resetQuickActions(storage: StorageLike): QuickActionStore {
  const defaults = getDefaultStore();
  saveQuickActions(storage, defaults);
  return defaults;
}

// ── 获取某内置项的默认提示词 ──

export function getBuiltinPrompt(itemId: string): string | undefined {
  return DEFAULT_ITEMS.find(i => i.id === itemId)?.prompt;
}

// ── 获取某内置分类的默认标签 ──

export function getBuiltinCategoryLabel(catId: string): string | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === catId)?.label;
}

// ── 生成唯一 ID ──

export function genActionId(): string {
  return `qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── 导出配置为 JSON 字符串 ──

export function exportConfig(data: QuickActionStore): string {
  return JSON.stringify(data, null, 2);
}

// ── 导入配置 ──

export function importConfig(json: string): QuickActionStore | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
      return mergeWithDefaults(parsed as QuickActionStore);
    }
  } catch { /* 解析失败 */ }
  return null;
}
