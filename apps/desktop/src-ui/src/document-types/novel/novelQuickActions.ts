/**
 * 小说写作 AI 快捷操作定义
 *
 * 参照 MindMap 插件的 quickActionDefs.ts 架构：
 * 8 个分类 ~40 个操作项，全面覆盖小说写作场景。
 * 用户可自定义、收藏、查看最近使用。
 */
import type { StorageLike } from './constants';

// ── 类型定义 ──

export interface NovelQuickActionCategory {
  id: string;
  label: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

export type NovelExecutionMode = 'ai' | 'direct';

export interface NovelQuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  icon: string;
  prompt: string;
  contextMode?: 'chapter' | 'volume' | 'settings' | 'full';
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  executionMode?: NovelExecutionMode;
  directAction?: string;
  keywords?: string[];
}

export interface NovelQuickActionStore {
  categories: NovelQuickActionCategory[];
  items: NovelQuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_novel_quick_actions';
const CURRENT_VERSION = 1;

// ── 默认分类（8 类）──

const DEFAULT_CATEGORIES: NovelQuickActionCategory[] = [
  { id: 'continue',  label: '续写',   icon: 'PenLine',       order: 0, builtin: true },
  { id: 'expand',    label: '扩写',   icon: 'Maximize2',     order: 1, builtin: true },
  { id: 'simplify',  label: '精简',   icon: 'Minimize2',     order: 2, builtin: true },
  { id: 'polish',    label: '润色',   icon: 'Sparkles',      order: 3, builtin: true },
  { id: 'character', label: '角色',   icon: 'Users',         order: 4, builtin: true },
  { id: 'scene',     label: '场景',   icon: 'Mountain',      order: 5, builtin: true },
  { id: 'analyze',   label: '分析',   icon: 'BarChart3',     order: 6, builtin: true },
  { id: 'export',    label: '导出',   icon: 'FileOutput',    order: 7, builtin: true },
  { id: 'settings',  label: '设定集', icon: 'BookMarked',    order: 8, builtin: true },
];

// ── 默认操作项 ──

const DEFAULT_ITEMS: NovelQuickActionItem[] = [
  // ━━ 续写 (continue) ━━
  { id: 'cont_next',       categoryId: 'continue', label: 'AI 续写',     icon: 'PenLine',    order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['续写', 'xx', 'continue'],
    prompt: '请续写以下小说正文，保持文风和节奏一致，自然衔接：\n\n{{chapterTail}}' },
  { id: 'cont_outline',    categoryId: 'continue', label: '按大纲续写',   icon: 'ListTree',   order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['大纲', 'dg', 'outline'],
    prompt: '请根据以下大纲和已有正文续写，确保情节走向符合大纲设定：\n\n大纲：{{outline}}\n\n已有正文：\n{{chapterTail}}' },
  { id: 'cont_dialogue',   categoryId: 'continue', label: '对话续写',     icon: 'MessageSquare', order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['对话', 'dh', 'dialogue'],
    prompt: '请续写以下小说中的角色对话，注意区分不同角色的语气和性格：\n\n{{chapterTail}}' },
  { id: 'cont_action',     categoryId: 'continue', label: '动作场景续写', icon: 'Swords',     order: 3, builtin: true, contextMode: 'chapter',
    keywords: ['动作', 'dz', 'action'],
    prompt: '请续写以下动作场景，注重节奏感、打斗细节和紧张氛围：\n\n{{chapterTail}}' },
  { id: 'cont_transition',  categoryId: 'continue', label: '过渡段续写',   icon: 'ArrowRight', order: 4, builtin: true, contextMode: 'chapter',
    keywords: ['过渡', 'gd', 'transition'],
    prompt: '请为以下段落写一个自然的过渡段，引出下一个场景：\n\n{{chapterTail}}' },

  // ━━ 扩写 (expand) ━━
  { id: 'exp_paragraph',   categoryId: 'expand', label: '扩写段落',     icon: 'Maximize2',  order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['扩写', 'kx', 'expand'],
    prompt: '请对以下文本进行扩写，增加细节描写、环境渲染和人物心理：\n\n{{chapterTail}}' },
  { id: 'exp_detail',      categoryId: 'expand', label: '补充细节',     icon: 'Plus',       order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['细节', 'xj', 'detail'],
    prompt: '请为以下文本补充感官细节（视觉、听觉、嗅觉、触觉）：\n\n{{chapterTail}}' },
  { id: 'exp_environment', categoryId: 'expand', label: '添加环境描写',  icon: 'TreePine',   order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['环境', 'hj', 'environment'],
    prompt: '请为以下情节补充丰富的环境描写（天气、景色、建筑、氛围）：\n\n{{chapterTail}}' },
  { id: 'exp_psychology',  categoryId: 'expand', label: '深化心理描写',  icon: 'Brain',      order: 3, builtin: true, contextMode: 'settings',
    keywords: ['心理', 'xl', 'psychology'],
    prompt: '请为以下段落的主要角色补充深层心理描写（内心活动、潜意识、情感冲突）：\n\n{{chapterTail}}' },
  { id: 'exp_flashback',   categoryId: 'expand', label: '插入回忆',     icon: 'Clock',      order: 4, builtin: true, contextMode: 'settings',
    keywords: ['回忆', 'hy', 'flashback'],
    prompt: '请在以下情节中自然地插入一段角色回忆片段，与当前情节产生呼应：\n\n{{chapterTail}}' },

  // ━━ 精简 (simplify) ━━
  { id: 'sim_paragraph',   categoryId: 'simplify', label: '精简段落',     icon: 'Minimize2',  order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['精简', 'jj', 'simplify'],
    prompt: '请精简以下文本，去除冗余描写，保留核心信息和关键细节：\n\n{{chapterTail}}' },
  { id: 'sim_dialogue',    categoryId: 'simplify', label: '压缩对话',     icon: 'MessageSquare', order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['压缩', 'ys', 'compress'],
    prompt: '请压缩以下对话，去除废话和重复，让对话更加简洁有力：\n\n{{chapterTail}}' },
  { id: 'sim_description', categoryId: 'simplify', label: '精简描写',     icon: 'Eraser',     order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['精简描写', 'jjmx'],
    prompt: '请精简以下段落中过度的描写和修饰，使节奏更加紧凑：\n\n{{chapterTail}}' },

  // ━━ 润色 (polish) ━━
  { id: 'pol_language',    categoryId: 'polish', label: '语言润色',     icon: 'Sparkles',   order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['润色', 'rs', 'polish'],
    prompt: '请对以下文本进行语言润色，提升文学性和表现力，但保持原意不变：\n\n{{chapterTail}}' },
  { id: 'pol_literary',    categoryId: 'polish', label: '提升文学性',   icon: 'Feather',    order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['文学', 'wx', 'literary'],
    prompt: '请提升以下文本的文学性，添加修辞手法（比喻、拟人、通感等）：\n\n{{chapterTail}}' },
  { id: 'pol_fix',         categoryId: 'polish', label: '修正病句',     icon: 'Check',      order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['病句', 'bj', 'fix'],
    prompt: '请检查并修正以下文本中的语法错误、错别字和不通顺的句子：\n\n{{chapterTail}}' },
  { id: 'pol_style',       categoryId: 'polish', label: '统一文风',     icon: 'Paintbrush', order: 3, builtin: true, contextMode: 'settings',
    keywords: ['文风', 'wf', 'style'],
    prompt: '请按照以下风格要求统一润色这段文本：\n\n目标风格：{{style}}\n\n正文：\n{{chapterTail}}' },
  { id: 'pol_rhythm',      categoryId: 'polish', label: '调整节奏',     icon: 'Activity',   order: 4, builtin: true, contextMode: 'chapter',
    keywords: ['节奏', 'jz', 'rhythm'],
    prompt: '请调整以下段落的叙事节奏，使紧张处更紧凑、舒缓处更从容：\n\n{{chapterTail}}' },

  // ━━ 角色 (character) ━━
  { id: 'char_dialogue',   categoryId: 'character', label: '生成角色对话', icon: 'MessageSquare', order: 0, builtin: true, contextMode: 'settings',
    keywords: ['对话', '角色', 'dialogue'],
    prompt: '请根据以下角色设定和情节上下文，生成一段自然的角色对话。注意区分不同角色的语气和性格：\n\n{{chapterTail}}' },
  { id: 'char_monologue',  categoryId: 'character', label: '角色独白',     icon: 'User',       order: 1, builtin: true, contextMode: 'settings',
    keywords: ['独白', 'db', 'monologue'],
    prompt: '请为当前场景的主要角色写一段内心独白，展现其心理变化和情感冲突：\n\n{{chapterTail}}' },
  { id: 'char_analysis',   categoryId: 'character', label: '角色分析',     icon: 'UserSearch', order: 2, builtin: true, contextMode: 'settings',
    keywords: ['角色分析', 'jsfx', 'analysis'],
    prompt: '请分析当前章节中出现的角色，检查其言行是否符合设定中的性格特征。列出不一致的地方和改进建议。' },
  { id: 'char_consistency', categoryId: 'character', label: '一致性检查',   icon: 'ShieldCheck', order: 3, builtin: true, contextMode: 'full',
    keywords: ['一致性', 'yzx', 'consistency'],
    prompt: '请检查当前章节中角色的言行举止是否与全书设定一致，包括：性格、说话方式、能力、关系。指出任何不一致之处。' },

  // ━━ 场景 (scene) ━━
  { id: 'scene_describe',  categoryId: 'scene', label: '场景描写',     icon: 'Mountain',   order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['场景', 'cj', 'scene'],
    prompt: '请根据以下情节上下文，补充一段生动的场景描写（环境、氛围、光线、声音、气味）：\n\n{{chapterTail}}' },
  { id: 'scene_atmosphere', categoryId: 'scene', label: '氛围渲染',     icon: 'CloudFog',   order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['氛围', 'fw', 'atmosphere'],
    prompt: '请为以下场景添加浓郁的氛围渲染，营造{{mood}}的气氛：\n\n{{chapterTail}}' },
  { id: 'scene_transition', categoryId: 'scene', label: '转场过渡',     icon: 'ArrowRightLeft', order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['转场', 'zc', 'transition'],
    prompt: '请写一段自然的转场过渡，从当前场景转到新的时间/地点/视角：\n\n{{chapterTail}}' },
  { id: 'scene_opening',   categoryId: 'scene', label: '章节开头',     icon: 'Play',       order: 3, builtin: true, contextMode: 'volume',
    keywords: ['开头', 'kt', 'opening'],
    prompt: '请为新的章节写一个引人入胜的开头段落，承接上一章的内容。' },
  { id: 'scene_ending',    categoryId: 'scene', label: '章节结尾',     icon: 'Flag',       order: 4, builtin: true, contextMode: 'chapter',
    keywords: ['结尾', 'jw', 'ending'],
    prompt: '请为当前章节写一个有悬念感的结尾段落，吸引读者继续阅读下一章：\n\n{{chapterTail}}' },

  // ━━ 分析 (analyze) ━━
  { id: 'ana_rhythm',      categoryId: 'analyze', label: '节奏分析',     icon: 'Activity',   order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['节奏', 'jz', 'rhythm'],
    prompt: '请分析当前章节的叙事节奏，指出节奏过快或过慢的段落，给出具体调整建议。' },
  { id: 'ana_logic',       categoryId: 'analyze', label: '情节逻辑',     icon: 'GitBranch',  order: 1, builtin: true, contextMode: 'volume',
    keywords: ['逻辑', 'lj', 'logic'],
    prompt: '请检查当前章节的情节逻辑是否合理，时间线是否通顺，有无逻辑漏洞。' },
  { id: 'ana_foreshadow',  categoryId: 'analyze', label: '伏笔检查',     icon: 'Eye',        order: 2, builtin: true, contextMode: 'full',
    keywords: ['伏笔', 'fb', 'foreshadow'],
    prompt: '请检查当前设定中的未解伏笔，分析是否在本章中有推进或可以安排推进。列出建议。' },
  { id: 'ana_improve',     categoryId: 'analyze', label: '改进建议',     icon: 'Lightbulb',  order: 3, builtin: true, contextMode: 'chapter',
    keywords: ['建议', 'jy', 'improve'],
    prompt: '请分析当前章节的优缺点，从情节、人物、节奏、语言四个维度给出具体改进建议。' },
  { id: 'ana_wordcount',   categoryId: 'analyze', label: '篇幅建议',     icon: 'BarChart3',  order: 4, builtin: true, contextMode: 'volume',
    keywords: ['篇幅', 'pf', 'wordcount'],
    prompt: '请分析当前卷的各章节字数分布，建议哪些章节过长需要拆分，哪些过短需要扩充。' },

  // ━━ 导出 (export) ━━
  { id: 'exp_summary',     categoryId: 'export', label: '生成章节摘要', icon: 'FileText',   order: 0, builtin: true, contextMode: 'chapter',
    keywords: ['摘要', 'zy', 'summary'],
    prompt: '请为当前章节生成200-400字的摘要，概括主要情节、角色行为和情感变化。' },
  { id: 'exp_outline',     categoryId: 'export', label: '生成大纲',     icon: 'ListTree',   order: 1, builtin: true, contextMode: 'chapter',
    keywords: ['大纲', 'dg', 'outline'],
    prompt: '请将当前章节的内容提炼为分点大纲，每个大纲点简洁概括一个情节节点。' },
  { id: 'exp_char_list',   categoryId: 'export', label: '角色出场表',   icon: 'Users',      order: 2, builtin: true, contextMode: 'chapter',
    keywords: ['出场', 'cc', 'character list'],
    prompt: '请列出当前章节中出场的所有角色，包括每个角色的行为、对话和情感变化。' },
  { id: 'exp_review',      categoryId: 'export', label: '写作复盘',     icon: 'ClipboardList', order: 3, builtin: true, contextMode: 'chapter',
    keywords: ['复盘', 'fp', 'review'],
    prompt: '请对当前章节进行写作复盘：1) 完成了哪些情节推进 2) 埋了哪些伏笔 3) 下一章需要处理什么。' },

  // ━━ 连续性检查 (analyze) ━━
  { id: 'ana_continuity',  categoryId: 'analyze', label: '连续性检查',     icon: 'ShieldCheck', order: 5, builtin: true, contextMode: 'volume',
    keywords: ['连续性', 'lxx', 'continuity'],
    prompt: '请检查当前章节与上一章之间的连续性，包括：\n1. 人称是否一致\n2. 时态是否一致\n3. 场景/地点是否衔接\n4. 角色状态是否矛盾\n5. 时间线是否合理\n\n请逐项分析并指出问题。' },

  // ━━ 设定集 (settings) —— 供设定集弹窗 AI 面板使用 ━━
  { id: 'set_gen_characters', categoryId: 'settings', label: '生成人物档案', icon: 'Users',       order: 0, builtin: true, contextMode: 'full',
    keywords: ['人物', '生成', '角色', 'character'],
    prompt: '请根据以下小说梗概和已有正文，生成主要角色的详细档案。\n\n请以 JSON 数组格式输出，每个角色包含：\n```json\n[{"name": "姓名", "role": "protagonist|antagonist|supporting|minor", "description": "外貌/性格/背景", "dialogueStyle": "对话风格", "aliases": ["别名"]}]\n```' },
  { id: 'set_gen_locations',  categoryId: 'settings', label: '生成地点设定', icon: 'MapPin',      order: 1, builtin: true, contextMode: 'full',
    keywords: ['地点', '场景', 'location'],
    prompt: '请根据小说梗概和正文，提取所有重要地点/场景，生成详细设定。\n\n请以 JSON 数组格式输出：\n```json\n[{"name": "地点名", "description": "详细描述（环境/氛围/历史）"}]\n```' },
  { id: 'set_gen_worldview',  categoryId: 'settings', label: '生成世界观', icon: 'Globe',       order: 2, builtin: true, contextMode: 'full',
    keywords: ['世界观', 'worldview'],
    prompt: '请根据小说的类型（{{style}}）、时代背景和梗概，生成完整的世界观设定，包括：地理环境、社会制度、力量体系、重要组织/势力、特殊规则等。用 Markdown 格式输出。' },
  { id: 'set_gen_history',    categoryId: 'settings', label: '梳理历史背景', icon: 'Landmark',    order: 3, builtin: true, contextMode: 'full',
    keywords: ['历史', '背景', 'history'],
    prompt: '请根据小说的时代设定，梳理相关的历史背景，包括：\n- 历史时期概述\n- 重大历史事件\n- 社会制度和文化特征\n- 对故事的影响\n\n用 Markdown 格式输出。' },
  { id: 'set_detect_foreshadow', categoryId: 'settings', label: '检测伏笔', icon: 'Eye',        order: 4, builtin: true, contextMode: 'full',
    keywords: ['伏笔', '检测', 'foreshadow'],
    prompt: '请分析小说已有正文，找出所有隐含的伏笔线索，包括已回收和未回收的。\n\n请以 JSON 数组格式输出：\n```json\n[{"content": "伏笔内容", "status": "open|resolved", "note": "建议回收方式"}]\n```' },
  { id: 'set_gen_materials',  categoryId: 'settings', label: '生成素材',     icon: 'Lightbulb',   order: 5, builtin: true, contextMode: 'chapter',
    keywords: ['素材', '灵感', 'material'],
    prompt: '请根据当前章节内容，生成写作素材片段（场景描写/对话片段/情节创意/灵感火花）。\n\n请以 JSON 数组格式输出：\n```json\n[{"title": "标题", "category": "inspiration|scene|dialogue|plot", "content": "内容"}]\n```' },
  { id: 'set_expand_outline', categoryId: 'settings', label: '扩展大纲',     icon: 'ListTree',    order: 6, builtin: true, contextMode: 'full',
    keywords: ['大纲', '扩展', 'outline'],
    prompt: '请根据故事梗概，展开为详细的章节大纲。每章包含：章节标题、主要情节、角色参与、场景设定。\n\n用 Markdown 格式输出，每章一个二级标题。' },
  { id: 'set_gen_synopsis',   categoryId: 'settings', label: '生成梗概',     icon: 'FileText',    order: 7, builtin: true, contextMode: 'full',
    keywords: ['梗概', '生成', 'synopsis'],
    prompt: '请根据小说已有正文内容，反向生成一篇300-500字的故事梗概，概括主要情节、主题和角色关系。' },

  // ━━ AI 深度分析（Phase 7 新增） ━━
  { id: 'ai_batch_summary',   categoryId: 'export', label: '批量生成摘要',   icon: 'FileText',    order: 4, builtin: true, contextMode: 'full',
    keywords: ['批量', '摘要', 'batch', 'summary'],
    prompt: '请为以下章节生成200-400字的摘要。对每个章节，概括主要情节、角色行为和情感变化。格式：\n\n## 章节名\n摘要内容\n\n请逐章输出。' },
  { id: 'ai_plot_suggest',    categoryId: 'analyze', label: '情节走向建议',   icon: 'Lightbulb',   order: 6, builtin: true, contextMode: 'full',
    keywords: ['情节', '建议', 'plot', 'suggest'],
    prompt: '请根据当前小说的大纲、已有正文、未解伏笔和角色关系，给出3-5条接下来的情节发展方向。每条包含：\n1. 方向概述（一句话）\n2. 具体情节描述（2-3句）\n3. 这个方向的优势和风险\n\n请结合角色动机和已有伏笔分析。' },
  { id: 'ai_dialogue_check',  categoryId: 'character', label: '对话风格检查', icon: 'MessageSquare', order: 4, builtin: true, contextMode: 'settings',
    keywords: ['对话', '风格', '检查', 'dialogue', 'check'],
    prompt: '请检查当前章节中各角色的对话是否符合其设定的对话风格。逐段扫描所有「」或""包裹的对话，识别说话者，对比角色设定中的dialogueStyle，标出不符合的对话并给出修改建议。' },
  { id: 'ai_deep_consistency', categoryId: 'analyze', label: '全书一致性审查', icon: 'ShieldCheck', order: 7, builtin: true, contextMode: 'full',
    keywords: ['一致性', '审查', 'consistency', 'deep'],
    prompt: '请对全书进行深度一致性审查，检查以下维度：\n1. 时间线矛盾（日期/季节/年龄前后不一致）\n2. 角色位置冲突（同一时间出现在不同地点）\n3. 物品/能力设定矛盾（前文提到的物品后文消失，能力设定前后不同）\n4. 已解伏笔后续又出现\n5. 角色称谓不一致\n\n请逐项列出发现的问题，标注具体章节和位置。' },
  { id: 'ai_plotline_balance', categoryId: 'analyze', label: '情节线分析',   icon: 'GitBranch',   order: 8, builtin: true, contextMode: 'full',
    keywords: ['情节线', '平衡', 'plotline', 'balance'],
    prompt: '请分析小说中各条情节线的节奏和平衡性：\n1. 每条情节线在各章的推进频率\n2. 是否有情节线中断过久（超过3章未推进）\n3. 各线之间的交叉和呼应是否充分\n4. 主线与副线的篇幅比例是否合理\n\n请给出具体建议。' },
  { id: 'ai_character_arc',   categoryId: 'character', label: '角色弧光分析', icon: 'UserSearch',  order: 5, builtin: true, contextMode: 'full',
    keywords: ['角色', '弧光', 'arc', 'character'],
    prompt: '请分析主要角色在各章中的情感、能力和关系变化曲线：\n1. 每个主要角色的弧光是否完整（有起点→发展→高潮→转变）\n2. 角色成长是否有足够的催化事件\n3. 角色之间的关系变化是否自然\n4. 是否有角色弧光中断或缺失\n\n请按角色逐一分析。' },
  { id: 'ai_hook_rating',     categoryId: 'analyze', label: '开头结尾评分',   icon: 'Star',        order: 9, builtin: true, contextMode: 'volume',
    keywords: ['开头', '结尾', '评分', 'hook', 'rating'],
    prompt: '请分析当前卷每个章节的开头和结尾质量：\n- 开头：是否有吸引力？能否在前3行抓住读者？（1-5星）\n- 结尾：是否有悬念钩子？能否让读者想继续阅读？（1-5星）\n\n格式：\n## 章节名\n开头评分：⭐⭐⭐ — 分析原因\n结尾评分：⭐⭐⭐⭐ — 分析原因\n改进建议：...' },
  { id: 'ai_rhythm_heatmap',  categoryId: 'analyze', label: '节奏热力图',     icon: 'BarChart3',   order: 10, builtin: true, contextMode: 'full',
    keywords: ['节奏', '热力图', 'rhythm', 'heatmap'],
    prompt: '请分析全书每个章节/场景的叙事节奏紧张度（1-10分），并输出热力图数据：\n\n格式（JSON数组）：\n```json\n[{"chapter": "章节名", "scene": "场景名", "tension": 7, "reason": "动作场景，节奏紧凑"}]\n```\n\n同时分析全书节奏曲线是否合理：是否有足够的高潮低谷交替，紧张度是否逐步升级到最终高潮。' },
];

// ── 持久化 ──

export function getDefaultStore(): NovelQuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

function mergeWithDefaults(stored: NovelQuickActionStore): NovelQuickActionStore {
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

export function loadQuickActions(storage: StorageLike): NovelQuickActionStore {
  const saved = storage.get<NovelQuickActionStore>(STORAGE_KEY);
  if (saved && saved.categories && saved.items) {
    return mergeWithDefaults(saved);
  }
  const store = getDefaultStore();
  storage.set(STORAGE_KEY, store);
  return store;
}

export function saveQuickActions(storage: StorageLike, store: NovelQuickActionStore): void {
  storage.set(STORAGE_KEY, store);
}

export function recordRecentUsed(store: NovelQuickActionStore, itemId: string): NovelQuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}
