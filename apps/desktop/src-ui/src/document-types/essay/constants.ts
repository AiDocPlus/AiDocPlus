/**
 * 散文文档类型 — 共享常量
 */

/** 对话框/弹窗统一样式 */
export const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

/** 统一 Storage 接口 */
export interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 保存机制
// ═══════════════════════════════════════════════════════════════════════════════

/** 内容自动保存 debounce 时间 (ms) */
export const CONTENT_SAVE_DEBOUNCE_MS = 5000;

/** 保存状态显示时间 (ms) */
export const SAVE_STATUS_DISPLAY_MS = 1500;

// ═══════════════════════════════════════════════════════════════════════════════
// 版本快照
// ═══════════════════════════════════════════════════════════════════════════════

/** 快照最大数量 */
export const MAX_SNAPSHOTS = 50;

// ═══════════════════════════════════════════════════════════════════════════════
// 布局
// ═══════════════════════════════════════════════════════════════════════════════

/** 左栏默认宽度 (px) */
export const DEFAULT_LEFT_WIDTH = 240;

/** 右栏默认宽度 (px) */
export const DEFAULT_RIGHT_WIDTH = 360;

/** 左栏最小宽度 (px) */
export const LEFT_MIN_WIDTH = 180;

/** 左栏最大宽度 (px) */
export const LEFT_MAX_WIDTH = 350;

/** 右栏最小宽度 (px) */
export const RIGHT_MIN_WIDTH = 280;

/** 右栏最大宽度 (px) */
export const RIGHT_MAX_WIDTH = 500;

// ═══ 散文子类型 ═══

export const ESSAY_SUBTYPE_OPTIONS = [
  { value: 'lyrical' as const, label: '抒情散文', desc: '注重意象营造、情感渲染、修辞运用、抒情节奏' },
  { value: 'narrative' as const, label: '叙事散文', desc: '注重故事线索、人物刻画、细节描写、叙事视角' },
  { value: 'argumentative' as const, label: '议论散文', desc: '注重论点提炼、论据选择、逻辑推理、说服力' },
  { value: 'travel' as const, label: '游记散文', desc: '注重景物描写、文化底蕴、感官体验、行文节奏' },
  { value: 'philosophical' as const, label: '哲理散文', desc: '注重思辨深度、哲理提炼、意象象征、深层感悟' },
  { value: 'custom' as const, label: '自定义', desc: '' },
] as const;

export const ESSAY_SUBTYPE_LABEL: Record<string, string> = {
  lyrical: '抒情散文',
  narrative: '叙事散文',
  argumentative: '议论散文',
  travel: '游记散文',
  philosophical: '哲理散文',
  custom: '自定义',
};

// ═══ 情感基调 ═══

export const ESSAY_MOOD_OPTIONS = [
  { value: 'warm' as const, label: '温暖', emoji: '☀️' },
  { value: 'melancholy' as const, label: '忧伤', emoji: '🌧️' },
  { value: 'heroic' as const, label: '豪放', emoji: '🔥' },
  { value: 'serene' as const, label: '淡然', emoji: '🍃' },
  { value: 'passionate' as const, label: '激昂', emoji: '⚡' },
  { value: 'custom' as const, label: '自定义', emoji: '🎨' },
] as const;

export const ESSAY_MOOD_LABEL: Record<string, string> = {
  warm: '温暖', melancholy: '忧伤', heroic: '豪放',
  serene: '淡然', passionate: '激昂', custom: '自定义',
};

// ═══ 结构角色（起承转合）═══

export const PARAGRAPH_ROLE_OPTIONS = [
  { value: 'open' as const, label: '开', color: 'text-red-500', bg: 'bg-red-500/10' },
  { value: 'carry' as const, label: '承', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'turn' as const, label: '转', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { value: 'close' as const, label: '合', color: 'text-green-500', bg: 'bg-green-500/10' },
  { value: 'none' as const, label: '—', color: 'text-muted-foreground', bg: '' },
] as const;

export const PARAGRAPH_ROLE_LABEL: Record<string, string> = {
  open: '开', carry: '承', turn: '转', close: '合', none: '—',
};

// ═══ 名家风格 ═══

export const MASTER_STYLE_OPTIONS = [
  { value: 'free' as const, label: '自由风格', desc: '' },
  { value: 'zhu-ziqing' as const, label: '朱自清', desc: '清新质朴，细腻真挚' },
  { value: 'yu-qiuyu' as const, label: '余秋雨', desc: '厚重磅礴，历史文化' },
  { value: 'lin-qingxuan' as const, label: '林清玄', desc: '禅意悠远，淡泊宁静' },
  { value: 'wang-zengqi' as const, label: '汪曾祺', desc: '平淡从容，烟火气' },
  { value: 'zhang-xiaofeng' as const, label: '张晓风', desc: '华美深情，哲思飞扬' },
  { value: 'shi-tiesheng' as const, label: '史铁生', desc: '沉静深邃，生命省思' },
  { value: 'bing-xin' as const, label: '冰心', desc: '温婉细腻，爱与美' },
  { value: 'san-mao' as const, label: '三毛', desc: '洒脱自由，异域风情' },
] as const;

export const MASTER_STYLE_LABEL: Record<string, string> = {
  free: '自由风格',
  'zhu-ziqing': '朱自清', 'yu-qiuyu': '余秋雨', 'lin-qingxuan': '林清玄',
  'wang-zengqi': '汪曾祺', 'zhang-xiaofeng': '张晓风', 'shi-tiesheng': '史铁生',
  'bing-xin': '冰心', 'san-mao': '三毛',
};

// ═══ 修辞类型 ═══

export const RHETORIC_TYPE_OPTIONS = [
  { value: 'metaphor' as const, label: '比喻', color: '#ef4444' },
  { value: 'personification' as const, label: '拟人', color: '#f97316' },
  { value: 'parallelism' as const, label: '排比', color: '#eab308' },
  { value: 'synesthesia' as const, label: '通感', color: '#22c55e' },
  { value: 'hyperbole' as const, label: '夸张', color: '#3b82f6' },
  { value: 'rhetorical-question' as const, label: '反问', color: '#8b5cf6' },
  { value: 'contrast' as const, label: '对比', color: '#ec4899' },
  { value: 'allusion' as const, label: '引用/用典', color: '#14b8a6' },
  { value: 'repetition' as const, label: '反复', color: '#6366f1' },
  { value: 'symbolism' as const, label: '象征', color: '#a855f7' },
  { value: 'other' as const, label: '其他', color: '#6b7280' },
] as const;

export const RHETORIC_TYPE_LABEL: Record<string, string> = {
  metaphor: '比喻', personification: '拟人', parallelism: '排比',
  synesthesia: '通感', hyperbole: '夸张', 'rhetorical-question': '反问',
  contrast: '对比', allusion: '引用/用典', repetition: '反复',
  symbolism: '象征', antithesis: '对偶', anadiplosis: '顶真', other: '其他',
};

// ═══ 素材类型 ═══

export const MATERIAL_TYPE_OPTIONS = [
  { value: 'inspiration' as const, label: '灵感片段', icon: '📌' },
  { value: 'quote' as const, label: '引用语录', icon: '💬' },
  { value: 'imagery' as const, label: '意象笔记', icon: '🎨' },
  { value: 'reference' as const, label: '参考文段', icon: '📎' },
] as const;

export const MATERIAL_TYPE_LABEL: Record<string, string> = {
  inspiration: '灵感片段', quote: '引用语录',
  imagery: '意象笔记', reference: '参考文段',
};

// ═══ 意象感官类型 ═══

export const IMAGERY_SENSE_LABEL: Record<string, string> = {
  visual: '视觉', auditory: '听觉', olfactory: '嗅觉',
  tactile: '触觉', gustatory: '味觉', abstract: '抽象',
};

export const IMAGERY_SENSE_COLORS: Record<string, string> = {
  visual: 'bg-red-400', auditory: 'bg-blue-400',
  olfactory: 'bg-green-400', tactile: 'bg-orange-400',
  gustatory: 'bg-pink-400', abstract: 'bg-purple-400',
};

// ═══ 修辞背景色（用于仪表盘等统计展示）═══

export const RHETORIC_BG_COLORS: Record<string, string> = {
  metaphor: 'bg-blue-400', personification: 'bg-green-400',
  parallelism: 'bg-purple-400', antithesis: 'bg-orange-400',
  hyperbole: 'bg-red-400', 'rhetorical-question': 'bg-cyan-400',
  synesthesia: 'bg-pink-400', anadiplosis: 'bg-yellow-400',
  contrast: 'bg-amber-400', allusion: 'bg-teal-400',
  repetition: 'bg-indigo-400', symbolism: 'bg-violet-400', other: 'bg-muted',
};
