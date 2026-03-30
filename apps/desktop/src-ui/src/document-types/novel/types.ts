/**
 * 小说文档类型 — 内部数据结构
 * 所有数据存储在 Document.content 字段中的 JSON
 */

export interface NovelDocumentContent {
  version: 1;
  settings: NovelDocSettings;
  volumes: NovelVolume[];
  metadata: NovelDocMetadata;
}

export interface NovelDocSettings {
  genre: string;
  era: string;
  style: string;
  synopsis: string;
  worldView: string;
  outlineGlobal: string;
  historicalBackground: string;
  characters: NovelCharacter[];
  characterRelations: NovelCharacterRelation[];
  locations: NovelLocation[];
  factions: NovelFaction[];
  foreshadowing: NovelForeshadowing[];
  materials: NovelMaterial[];
  timeline: NovelTimelineEvent[];
  plotlines: NovelPlotline[];
  worldRules?: string;
  worldGeography?: string;
  worldCulture?: string;
  /** P0: 风格学习 — 关联的风格语料库 ID 列表 */
  styleCorpusIds?: string[];
  /** P0: 风格学习 — 风格语料库权重（用于多语料混合） */
  styleCorpusWeights?: Record<string, number>;
  /** P0: 风格学习 — 当前激活的合成风格画像 */
  activeStyleProfile?: StyleProfile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// P0: 风格学习系统类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 风格语料库（存储在项目目录的 style-corpora/{id}/ 下） */
export interface StyleCorpus {
  id: string;
  name: string;
  authorName?: string;
  /** 来源类型 */
  sourceType: 'upload' | 'chapter' | 'external';
  /** 语料文件列表 */
  files: StyleCorpusFile[];
  /** 总字数 */
  totalWords: number;
  /** 总块数 */
  totalChunks: number;
  /** AI 分析后的风格画像 */
  styleProfile?: StyleProfile;
  /** 导入时间 */
  importedAt: number;
  /** 最后分析时间 */
  analyzedAt?: number;
}

/** 风格语料库文件 */
export interface StyleCorpusFile {
  id: string;
  /** 原始文件名 */
  fileName: string;
  /** 文本块列表 */
  chunks: StyleTextChunk[];
  /** 文件字数 */
  wordCount: number;
  /** 导入时间 */
  importedAt: number;
}

/** 风格文本块（用于 RAG 检索） */
export interface StyleTextChunk {
  id: string;
  /** 块内容 */
  content: string;
  /** 字数 */
  wordCount: number;
  /** 场景类型（用于按场景类型检索） */
  sceneType?: 'dialogue' | 'action' | 'description' | 'internal' | 'transition';
  /** 关键词列表（用于 BM25 检索） */
  keywords?: string[];
}

/** 风格画像（AI 分析生成） */
export interface StyleProfile {
  // ═══ 统计特征 ═══
  /** 平均句长（字符） */
  avgSentenceLength: number;
  /** 句长标准差 */
  sentenceLengthStdDev: number;
  /** 平均段落长度 */
  avgParagraphLength: number;
  /** 段落长度范围 */
  paragraphLengthRange: { min: number; max: number };
  /** 对话比例 */
  dialogueRatio: number;
  /** 叙述比例 */
  narrationRatio: number;
  /** 词汇多样性（TTR） */
  vocabularyDiversity: number;

  // ═══ 文风特征 ═══
  /** 叙事视角：第一人称/第三人称/全知视角 */
  narrativeVoice: string;
  /** 时态偏好：过去/现在/混合 */
  tensePreference: string;
  /** 语调风格：严肃/幽默/抒情/平实 */
  toneStyle: string;

  // ═══ 修辞特征 ═══
  /** 常用比喻模式 */
  commonMetaphors: string[];
  /** 修辞手法：排比/反问/夸张/拟人 */
  rhetoricalDevices: string[];
  /** 高频句式 */
  topPatterns: string[];

  // ═══ 对话风格 ═══
  /** 对话风格：简洁/冗长/书面化/口语化 */
  dialogueStyle: string;
  /** 对话标签动词偏好：说/道/问/答 */
  tagVerbPreference: string[];

  // ═══ 场景描写 ═══
  /** 五感偏好：视觉/听觉/嗅觉/触觉/味觉 */
  sensoryFocus: string[];
  /** 节奏偏好：快节奏/慢节奏/张弛有致 */
  pacingPreference: string;

  // ═══ AI 定性分析 ═══
  /** 整体风格概述（200-300 字） */
  summary: string;
  /** 标志性特征 */
  signature: string;
  /** AI 原始分析结果 */
  rawAnalysis?: string;
  /** 分析时间 */
  analyzedAt: number;
}

/** 风格语料库 */
export interface StyleCorpus {
  id: string;
  name: string;
  authorName?: string;
  /** 来源类型：上传文件/从章节提取/外部导入 */
  sourceType: 'upload' | 'chapter' | 'external';
  files: StyleCorpusFile[];
  totalWords: number;
  totalChunks: number;
  /** 风格画像（AI 分析后生成） */
  styleProfile?: StyleProfile;
  importedAt: number;
  analyzedAt?: number;
}

/** 风格语料库文件 */
export interface StyleCorpusFile {
  id: string;
  fileName: string;
  /** 文本块列表 */
  chunks: StyleTextChunk[];
  wordCount: number;
  importedAt: number;
}

/** 风格文本块（用于 RAG 检索） */
export interface StyleTextChunk {
  id: string;
  content: string;
  wordCount: number;
  /** 场景类型（对话/动作/描写/心理/过渡） */
  sceneType?: 'dialogue' | 'action' | 'description' | 'internal' | 'transition';
  /** 关键词列表（用于检索） */
  keywords?: string[];
}

export interface NovelWritingSession {
  date: string;
  startTime: number;
  endTime: number;
  wordsWritten: number;
}

export interface NovelMilestone {
  id: string;
  label: string;
  targetWords: number;
  reached: boolean;
}

export interface NovelDocMetadata {
  dailyGoal?: number;
  totalGoal?: number;
  dailyWordStats?: { date: string; words: number }[];
  chapterDefaultGoal?: number;
  deadline?: string;
  writingSessions?: NovelWritingSession[];
  milestones?: NovelMilestone[];
}

export interface NovelVolume {
  id: string;
  title: string;
  sortOrder: number;
  chapters: NovelChapter[];
  synopsis?: string;
  wordGoal?: number;
}

export type NovelSceneType = 'action' | 'dialogue' | 'description' | 'transition' | 'flashback';

export interface NovelChapter {
  id: string;
  title: string;
  sortOrder: number;
  content: string;
  outline?: string;
  summary?: string;
  status: 'draft' | 'revised' | 'done';
  authorNotes?: string;
  wordGoal?: number;
  povCharacterId?: string;
  colorLabel?: string;
  sceneType?: NovelSceneType;
  lastEditedAt?: number;
  tags?: string[];
  scenes?: NovelScene[];
  /** N2.4: 章节批注列表 */
  annotations?: NovelAnnotation[];

  // ═══ P1: 四层记忆架构 ═══
  /** P1: AI 自动生成的摘要（200-300 字） */
  autoSummary?: string;
  /** P1: 关键情节节点（用于上下文注入） */
  keyEvents?: string[];
  /** P1: 角色状态快照（本章结束时各角色状态） */
  characterStates?: ChapterCharacterState[];
  /** P1: 摘要生成时间 */
  summaryGeneratedAt?: number;
}

export interface NovelScene {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
  synopsis?: string;
  povCharacterId?: string;
  locationId?: string;
  characterIds?: string[];
  plotlineIds?: string[];
  sceneType?: NovelSceneType;
  colorLabel?: string;
  wordGoal?: number;
  status: 'draft' | 'revised' | 'done';
  tags?: string[];
  timelineDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1: 四层记忆架构
// ═══════════════════════════════════════════════════════════════════════════════

/** P1: 章节角色状态快照（记录本章结束时角色的状态） */
export interface ChapterCharacterState {
  /** 角色 ID */
  characterId: string;
  /** 角色在本章的情感状态 */
  emotion?: string;
  /** 角色在本章的关键行动 */
  keyActions?: string[];
  /** 角色在本章的关键变化 */
  changes?: string;
  /** 角色当前所在地 */
  currentLocation?: string;
  /** 角色在本章说过的关键台词 */
  keyDialogue?: string;
  /** 角色与其他角色的关系变化 */
  relationChanges?: {
    targetId: string;
    change: string;
  }[];
}

/** P1: 四层记忆上下文 */
export interface NovelMemoryContext {
  /** Layer 0: 风格层（来自风格学习系统） */
  layer0Style?: {
    profile: StyleProfile;
    samples?: string[];
  };
  /** Layer 1: 设定层 */
  layer1Settings?: {
    worldRules?: string;
    relatedCharacters?: NovelCharacter[];
    openForeshadowing?: NovelForeshadowing[];
    activePlotlines?: NovelPlotline[];
  };
  /** Layer 2: 近章层 */
  layer2RecentChapters?: {
    summaries: {
      chapterId: string;
      chapterTitle: string;
      summary: string;
      keyEvents: string[];
    }[];
  };
  /** Layer 3: 当前章节层 */
  layer3CurrentChapter?: {
    outline?: string;
    contentTail: string;
    povCharacter?: NovelCharacter;
    characterStates?: ChapterCharacterState[];
  };
  /** Token 使用统计 */
  tokenUsage?: {
    layer0: number;
    layer1: number;
    layer2: number;
    layer3: number;
    total: number;
  };
}

export interface NovelPlotline {
  id: string;
  title: string;
  color: string;
  sortOrder: number;
  description?: string;
}

/** N1.2: 角色情感弧线节点 */
export interface NovelCharacterEmotion {
  chapterId: string;
  emotion: string;       // 如"愤怒""悲伤""坚定""迷茫"
  intensity: number;     // 1-10
  note?: string;
}

export interface NovelCharacter {
  id: string;
  name: string;
  aliases: string[];
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  gender?: string;
  age?: string;
  appearance?: string;
  personality?: string;
  background?: string;
  motivation?: string;
  arc?: string;
  strengths?: string;
  weaknesses?: string;
  dialogueStyle?: string;
  /** N1.2: 角色对话样本（3-5段典型对话，AI 学习角色语气） */
  dialogueSamples?: string[];
  /** N1.2: 角色情感弧线（按章节记录情感状态变化） */
  emotionArc?: NovelCharacterEmotion[];
  factionId?: string;
  tags?: string[];
  color?: string;
  sortOrder: number;
}

export interface NovelCharacterRelation {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  label?: string;
  description?: string;
  bidirectional?: boolean;
}

export interface NovelLocation {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  type?: string;
  atmosphere?: string;
  significance?: string;
  tags?: string[];
  sortOrder: number;
}

export interface NovelFaction {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  leader?: string;
  type?: string;
  goal?: string;
  relationships?: string;
  tags?: string[];
  color?: string;
  sortOrder: number;
}

export type NovelTimelineImportance = 'major' | 'minor' | 'turning-point';

export interface NovelTimelineEvent {
  id: string;
  title: string;
  description?: string;
  date?: string;
  sortOrder: number;
  chapterIds?: string[];
  characterIds?: string[];
  locationId?: string;
  importance: NovelTimelineImportance;
  tags?: string[];
}

export interface NovelForeshadowing {
  id: string;
  content: string;
  chapterId: string;
  status: 'open' | 'resolved' | 'abandoned';
  resolvedChapterId?: string;
  note?: string;
}

export type NovelMaterialCategory = 'inspiration' | 'scene' | 'dialogue' | 'plot' | 'other';

export interface NovelMaterial {
  id: string;
  title: string;
  category: NovelMaterialCategory;
  content: string;
  chapterId?: string;
  createdAt: number;
}

/** N2.4: 批注类别 */
export type NovelAnnotationCategory = 'todo' | 'verify' | 'idea' | 'plot-issue' | 'style' | 'general';

/** N2.4: 章节行内批注 */
export interface NovelAnnotation {
  id: string;
  chapterId: string;
  /** 批注锚定的正文起始位置（字符偏移） */
  from: number;
  /** 批注锚定的正文结束位置 */
  to: number;
  /** 锚定的原文片段（用于位置漂移后重新定位） */
  anchor: string;
  category: NovelAnnotationCategory;
  content: string;
  resolved: boolean;
  createdAt: number;
  resolvedAt?: number;
}

export const ANNOTATION_CATEGORY_LABELS: Record<NovelAnnotationCategory, string> = {
  'todo': '待修改',
  'verify': '需查证',
  'idea': '灵感',
  'plot-issue': '剧情问题',
  'style': '文风问题',
  'general': '一般',
};

export function createEmptyNovelContent(): NovelDocumentContent {
  const vol1Id = genId();
  const vol2Id = genId();
  return {
    version: 1,
    settings: {
      genre: '',
      era: '',
      style: '',
      synopsis: '',
      worldView: '',
      outlineGlobal: '',
      historicalBackground: '',
      characters: [],
      characterRelations: [],
      locations: [],
      factions: [],
      foreshadowing: [],
      materials: [],
      timeline: [],
      plotlines: [],
    },
    volumes: [
      {
        id: vol1Id, title: '第一卷 开端', sortOrder: 0,
        chapters: [
          { id: genId(), title: '第一章 序幕', sortOrder: 0, content: '', status: 'draft' },
          { id: genId(), title: '第二章 相遇', sortOrder: 1, content: '', status: 'draft' },
          { id: genId(), title: '第三章 冲突', sortOrder: 2, content: '', status: 'draft' },
        ],
      },
      {
        id: vol2Id, title: '第二卷 发展', sortOrder: 1,
        chapters: [
          { id: genId(), title: '第四章 转折', sortOrder: 0, content: '', status: 'draft' },
          { id: genId(), title: '第五章 高潮', sortOrder: 1, content: '', status: 'draft' },
          { id: genId(), title: '第六章 结局', sortOrder: 2, content: '', status: 'draft' },
        ],
      },
    ],
    metadata: {},
  };
}

export function parseNovelContent(content: string): NovelDocumentContent | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.volumes)) {
      // 向后兼容迁移：补充旧文档缺少的字段
      const s = parsed.settings;
      if (!s.materials) s.materials = [];
      if (!s.historicalBackground) s.historicalBackground = '';
      if (!s.factions) s.factions = [];
      if (!s.foreshadowing) s.foreshadowing = [];
      if (!s.locations) s.locations = [];
      if (!s.characters) s.characters = [];
      if (!s.outlineGlobal) s.outlineGlobal = '';
      if (!s.worldView) s.worldView = '';
      if (!s.synopsis) s.synopsis = '';
      if (!s.characterRelations) s.characterRelations = [];
      if (!s.timeline) s.timeline = [];
      if (!s.plotlines) s.plotlines = [];
      if (!parsed.metadata) parsed.metadata = {};
      return parsed as NovelDocumentContent;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractNovelPlainText(content: string): string {
  const novel = parseNovelContent(content);
  if (!novel) return content;
  const texts: string[] = [];
  for (const vol of novel.volumes) {
    texts.push(vol.title);
    for (const ch of vol.chapters) {
      texts.push(ch.title);
      if (ch.scenes && ch.scenes.length > 0) {
        for (const sc of ch.scenes) {
          if (sc.content) texts.push(sc.content);
        }
      } else if (ch.content) {
        texts.push(ch.content);
      }
    }
  }
  return texts.join('\n');
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function addVolume(novel: NovelDocumentContent, title: string): NovelDocumentContent {
  const maxSort = novel.volumes.length > 0 ? Math.max(...novel.volumes.map(v => v.sortOrder)) + 1 : 0;
  return {
    ...novel,
    volumes: [...novel.volumes, { id: genId(), title, sortOrder: maxSort, chapters: [] }],
  };
}

export function addChapter(novel: NovelDocumentContent, volumeId: string, title: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => {
      if (v.id !== volumeId) return v;
      const maxSort = v.chapters.length > 0 ? Math.max(...v.chapters.map(c => c.sortOrder)) + 1 : 0;
      return {
        ...v,
        chapters: [...v.chapters, {
          id: genId(), title, sortOrder: maxSort, content: '', status: 'draft' as const,
        }],
      };
    }),
  };
}

export function updateChapterContent(
  novel: NovelDocumentContent, chapterId: string, content: string,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, content } : c),
    })),
  };
}

export function getChapterById(novel: NovelDocumentContent, chapterId: string): NovelChapter | null {
  for (const v of novel.volumes) {
    const ch = v.chapters.find(c => c.id === chapterId);
    if (ch) return ch;
  }
  return null;
}

export function getTotalWordCount(novel: NovelDocumentContent): number {
  let total = 0;
  for (const v of novel.volumes) {
    for (const ch of v.chapters) {
      total += getChapterWordCount(ch);
    }
  }
  return total;
}

/** 获取章节所在的卷 */
export function getVolumeByChapterId(novel: NovelDocumentContent, chapterId: string): NovelVolume | null {
  for (const v of novel.volumes) {
    if (v.chapters.some(c => c.id === chapterId)) return v;
  }
  return null;
}

// ═══ 卷管理 ═══

export function deleteVolume(novel: NovelDocumentContent, volId: string): NovelDocumentContent {
  return { ...novel, volumes: novel.volumes.filter(v => v.id !== volId) };
}

export function renameVolume(novel: NovelDocumentContent, volId: string, newTitle: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => v.id === volId ? { ...v, title: newTitle } : v),
  };
}

export function moveVolumeUp(novel: NovelDocumentContent, volId: string): NovelDocumentContent {
  const sorted = [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(v => v.id === volId);
  if (idx <= 0) return novel;
  const temp = sorted[idx].sortOrder;
  sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx - 1].sortOrder };
  sorted[idx - 1] = { ...sorted[idx - 1], sortOrder: temp };
  return { ...novel, volumes: sorted };
}

export function moveVolumeDown(novel: NovelDocumentContent, volId: string): NovelDocumentContent {
  const sorted = [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(v => v.id === volId);
  if (idx < 0 || idx >= sorted.length - 1) return novel;
  const temp = sorted[idx].sortOrder;
  sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx + 1].sortOrder };
  sorted[idx + 1] = { ...sorted[idx + 1], sortOrder: temp };
  return { ...novel, volumes: sorted };
}

// ═══ 章节管理 ═══

export function deleteChapter(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.filter(c => c.id !== chapterId),
    })),
  };
}

export function renameChapter(novel: NovelDocumentContent, chapterId: string, newTitle: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, title: newTitle } : c),
    })),
  };
}

export function moveChapterUp(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => {
      const sorted = [...v.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex(c => c.id === chapterId);
      if (idx <= 0) return v;
      const temp = sorted[idx].sortOrder;
      sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx - 1].sortOrder };
      sorted[idx - 1] = { ...sorted[idx - 1], sortOrder: temp };
      return { ...v, chapters: sorted };
    }),
  };
}

export function moveChapterDown(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => {
      const sorted = [...v.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex(c => c.id === chapterId);
      if (idx < 0 || idx >= sorted.length - 1) return v;
      const temp = sorted[idx].sortOrder;
      sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx + 1].sortOrder };
      sorted[idx + 1] = { ...sorted[idx + 1], sortOrder: temp };
      return { ...v, chapters: sorted };
    }),
  };
}

export function moveChapterToVolume(novel: NovelDocumentContent, chapterId: string, targetVolId: string): NovelDocumentContent {
  let chapter: NovelChapter | null = null;
  // 从源卷中移除
  const volumesAfterRemove = novel.volumes.map(v => {
    const ch = v.chapters.find(c => c.id === chapterId);
    if (ch) {
      chapter = ch;
      return { ...v, chapters: v.chapters.filter(c => c.id !== chapterId) };
    }
    return v;
  });
  if (!chapter) return novel;
  // 添加到目标卷末尾
  const volumes = volumesAfterRemove.map(v => {
    if (v.id !== targetVolId) return v;
    const maxSort = v.chapters.length > 0 ? Math.max(...v.chapters.map(c => c.sortOrder)) + 1 : 0;
    return { ...v, chapters: [...v.chapters, { ...chapter!, sortOrder: maxSort }] };
  });
  return { ...novel, volumes };
}

// ═══ 章节字段更新 ═══

export function updateChapterStatus(
  novel: NovelDocumentContent, chapterId: string, status: NovelChapter['status'],
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, status } : c),
    })),
  };
}

export function updateChapterOutline(
  novel: NovelDocumentContent, chapterId: string, outline: string,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, outline } : c),
    })),
  };
}

export function updateChapterSummary(
  novel: NovelDocumentContent, chapterId: string, summary: string,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, summary } : c),
    })),
  };
}

export function updateChapterNotes(
  novel: NovelDocumentContent, chapterId: string, authorNotes: string,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, authorNotes } : c),
    })),
  };
}

// ═══ 地点管理 ═══

export function addLocation(novel: NovelDocumentContent, name: string): NovelDocumentContent {
  const maxSort = novel.settings.locations.length > 0 ? Math.max(...novel.settings.locations.map(l => l.sortOrder)) + 1 : 0;
  return {
    ...novel,
    settings: {
      ...novel.settings,
      locations: [...novel.settings.locations, { id: genId(), name, description: '', sortOrder: maxSort }],
    },
  };
}

export function updateLocation(novel: NovelDocumentContent, locId: string, patch: Partial<NovelLocation>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      locations: novel.settings.locations.map(l => l.id === locId ? { ...l, ...patch } : l),
    },
  };
}

export function deleteLocation(novel: NovelDocumentContent, locId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      locations: novel.settings.locations.filter(l => l.id !== locId),
    },
  };
}

// ═══ 伏笔管理 ═══

export function addForeshadowing(novel: NovelDocumentContent, chapterId: string, content: string): NovelDocumentContent {
  const fs: NovelForeshadowing = { id: genId(), content, chapterId, status: 'open' };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      foreshadowing: [...novel.settings.foreshadowing, fs],
    },
  };
}

export function updateForeshadowing(novel: NovelDocumentContent, fsId: string, patch: Partial<NovelForeshadowing>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      foreshadowing: novel.settings.foreshadowing.map(f => f.id === fsId ? { ...f, ...patch } : f),
    },
  };
}

export function deleteForeshadowing(novel: NovelDocumentContent, fsId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      foreshadowing: novel.settings.foreshadowing.filter(f => f.id !== fsId),
    },
  };
}

// ═══ 素材管理 ═══

export function addMaterial(novel: NovelDocumentContent, title: string, category: NovelMaterialCategory, content: string, chapterId?: string): NovelDocumentContent {
  const mat: NovelMaterial = { id: genId(), title, category, content, chapterId, createdAt: Date.now() };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      materials: [...novel.settings.materials, mat],
    },
  };
}

export function updateMaterial(novel: NovelDocumentContent, matId: string, patch: Partial<NovelMaterial>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      materials: novel.settings.materials.map(m => m.id === matId ? { ...m, ...patch } : m),
    },
  };
}

export function deleteMaterial(novel: NovelDocumentContent, matId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      materials: novel.settings.materials.filter(m => m.id !== matId),
    },
  };
}

// ═══ 角色管理 ═══

export function addCharacter(novel: NovelDocumentContent, name: string): NovelDocumentContent {
  const maxSort = novel.settings.characters.length > 0 ? Math.max(...novel.settings.characters.map(c => c.sortOrder)) + 1 : 0;
  const char: NovelCharacter = { id: genId(), name, aliases: [], role: 'supporting', description: '', sortOrder: maxSort };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characters: [...novel.settings.characters, char],
    },
  };
}

export function updateCharacter(novel: NovelDocumentContent, charId: string, patch: Partial<NovelCharacter>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characters: novel.settings.characters.map(c => c.id === charId ? { ...c, ...patch } : c),
    },
  };
}

export function deleteCharacter(novel: NovelDocumentContent, charId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characters: novel.settings.characters.filter(c => c.id !== charId),
      characterRelations: novel.settings.characterRelations.filter(r => r.fromId !== charId && r.toId !== charId),
    },
  };
}

// ═══ 人物关系管理 ═══

export function addCharacterRelation(novel: NovelDocumentContent, fromId: string, toId: string, type: string): NovelDocumentContent {
  const rel: NovelCharacterRelation = { id: genId(), fromId, toId, type, bidirectional: true };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characterRelations: [...novel.settings.characterRelations, rel],
    },
  };
}

export function updateCharacterRelation(novel: NovelDocumentContent, relId: string, patch: Partial<NovelCharacterRelation>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characterRelations: novel.settings.characterRelations.map(r => r.id === relId ? { ...r, ...patch } : r),
    },
  };
}

export function deleteCharacterRelation(novel: NovelDocumentContent, relId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      characterRelations: novel.settings.characterRelations.filter(r => r.id !== relId),
    },
  };
}

// ═══ 阵营管理 ═══

export function addFaction(novel: NovelDocumentContent, name: string): NovelDocumentContent {
  const maxSort = novel.settings.factions.length > 0 ? Math.max(...novel.settings.factions.map(f => f.sortOrder)) + 1 : 0;
  const faction: NovelFaction = { id: genId(), name, description: '', memberIds: [], sortOrder: maxSort };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      factions: [...novel.settings.factions, faction],
    },
  };
}

export function updateFaction(novel: NovelDocumentContent, factionId: string, patch: Partial<NovelFaction>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      factions: novel.settings.factions.map(f => f.id === factionId ? { ...f, ...patch } : f),
    },
  };
}

export function deleteFaction(novel: NovelDocumentContent, factionId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      factions: novel.settings.factions.filter(f => f.id !== factionId),
      characters: novel.settings.characters.map(c => c.factionId === factionId ? { ...c, factionId: undefined } : c),
    },
  };
}

export function addFactionMember(novel: NovelDocumentContent, factionId: string, characterId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      factions: novel.settings.factions.map(f =>
        f.id === factionId && !f.memberIds.includes(characterId)
          ? { ...f, memberIds: [...f.memberIds, characterId] }
          : f
      ),
      characters: novel.settings.characters.map(c => c.id === characterId ? { ...c, factionId } : c),
    },
  };
}

export function removeFactionMember(novel: NovelDocumentContent, factionId: string, characterId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      factions: novel.settings.factions.map(f =>
        f.id === factionId ? { ...f, memberIds: f.memberIds.filter(id => id !== characterId) } : f
      ),
      characters: novel.settings.characters.map(c => c.id === characterId && c.factionId === factionId ? { ...c, factionId: undefined } : c),
    },
  };
}

// ═══ 时间线管理 ═══

export function addTimelineEvent(novel: NovelDocumentContent, title: string): NovelDocumentContent {
  const maxSort = novel.settings.timeline.length > 0 ? Math.max(...novel.settings.timeline.map(e => e.sortOrder)) + 1 : 0;
  const event: NovelTimelineEvent = { id: genId(), title, sortOrder: maxSort, importance: 'minor' };
  return {
    ...novel,
    settings: {
      ...novel.settings,
      timeline: [...novel.settings.timeline, event],
    },
  };
}

export function updateTimelineEvent(novel: NovelDocumentContent, eventId: string, patch: Partial<NovelTimelineEvent>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      timeline: novel.settings.timeline.map(e => e.id === eventId ? { ...e, ...patch } : e),
    },
  };
}

export function deleteTimelineEvent(novel: NovelDocumentContent, eventId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      timeline: novel.settings.timeline.filter(e => e.id !== eventId),
    },
  };
}

// ═══ 章节高级操作 ═══

export function duplicateChapter(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  for (const v of novel.volumes) {
    const ch = v.chapters.find(c => c.id === chapterId);
    if (!ch) continue;
    const maxSort = Math.max(...v.chapters.map(c => c.sortOrder)) + 1;
    const copy: NovelChapter = { ...ch, id: genId(), title: ch.title + '（副本）', sortOrder: maxSort };
    return {
      ...novel,
      volumes: novel.volumes.map(vol =>
        vol.id === v.id ? { ...vol, chapters: [...vol.chapters, copy] } : vol
      ),
    };
  }
  return novel;
}

export function splitChapter(novel: NovelDocumentContent, chapterId: string, splitPos: number): NovelDocumentContent {
  for (const v of novel.volumes) {
    const idx = v.chapters.findIndex(c => c.id === chapterId);
    if (idx < 0) continue;
    const ch = v.chapters[idx];
    const content1 = ch.content.slice(0, splitPos).trimEnd();
    const content2 = ch.content.slice(splitPos).trimStart();
    const newCh: NovelChapter = {
      id: genId(), title: ch.title + '（续）', sortOrder: ch.sortOrder + 0.5,
      content: content2, status: 'draft',
    };
    const updatedCh = { ...ch, content: content1 };
    const newChapters = [...v.chapters];
    newChapters[idx] = updatedCh;
    newChapters.splice(idx + 1, 0, newCh);
    // 重新排序
    const sorted = newChapters.sort((a, b) => a.sortOrder - b.sortOrder).map((c, i) => ({ ...c, sortOrder: i }));
    return {
      ...novel,
      volumes: novel.volumes.map(vol => vol.id === v.id ? { ...vol, chapters: sorted } : vol),
    };
  }
  return novel;
}

export function mergeChapters(novel: NovelDocumentContent, chapterId1: string, chapterId2: string): NovelDocumentContent {
  for (const v of novel.volumes) {
    const ch1 = v.chapters.find(c => c.id === chapterId1);
    const ch2 = v.chapters.find(c => c.id === chapterId2);
    if (!ch1 || !ch2) continue;
    const merged: NovelChapter = {
      ...ch1,
      content: ch1.content + '\n\n' + ch2.content,
      outline: [ch1.outline, ch2.outline].filter(Boolean).join('\n') || undefined,
      summary: [ch1.summary, ch2.summary].filter(Boolean).join('\n') || undefined,
      authorNotes: [ch1.authorNotes, ch2.authorNotes].filter(Boolean).join('\n') || undefined,
    };
    return {
      ...novel,
      volumes: novel.volumes.map(vol =>
        vol.id === v.id
          ? { ...vol, chapters: vol.chapters.filter(c => c.id !== chapterId2).map(c => c.id === chapterId1 ? merged : c) }
          : vol
      ),
    };
  }
  return novel;
}

export function insertChapterBefore(novel: NovelDocumentContent, refChapterId: string, title: string): NovelDocumentContent {
  return insertChapterAt(novel, refChapterId, title, 'before');
}

export function insertChapterAfter(novel: NovelDocumentContent, refChapterId: string, title: string): NovelDocumentContent {
  return insertChapterAt(novel, refChapterId, title, 'after');
}

function insertChapterAt(novel: NovelDocumentContent, refChapterId: string, title: string, pos: 'before' | 'after'): NovelDocumentContent {
  for (const v of novel.volumes) {
    const idx = v.chapters.findIndex(c => c.id === refChapterId);
    if (idx < 0) continue;
    const sorted = [...v.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
    const refIdx = sorted.findIndex(c => c.id === refChapterId);
    const insertIdx = pos === 'before' ? refIdx : refIdx + 1;
    const newCh: NovelChapter = {
      id: genId(), title, sortOrder: 0, content: '', status: 'draft',
    };
    sorted.splice(insertIdx, 0, newCh);
    const renumbered = sorted.map((c, i) => ({ ...c, sortOrder: i }));
    return {
      ...novel,
      volumes: novel.volumes.map(vol => vol.id === v.id ? { ...vol, chapters: renumbered } : vol),
    };
  }
  return novel;
}

export function updateChapterMeta(
  novel: NovelDocumentContent, chapterId: string,
  patch: Partial<Pick<NovelChapter, 'wordGoal' | 'povCharacterId' | 'colorLabel' | 'sceneType' | 'lastEditedAt' | 'tags'>>,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => c.id === chapterId ? { ...c, ...patch } : c),
    })),
  };
}

export function updateVolumeMeta(
  novel: NovelDocumentContent, volId: string,
  patch: Partial<Pick<NovelVolume, 'synopsis' | 'wordGoal'>>,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => v.id === volId ? { ...v, ...patch } : v),
  };
}

// ═══ 字数统计工具 ═══

export function getChapterWordCount(chapter: NovelChapter): number {
  if (chapter.scenes && chapter.scenes.length > 0) {
    return chapter.scenes.reduce((s, sc) => s + sc.content.replace(/\s/g, '').length, 0);
  }
  return chapter.content.replace(/\s/g, '').length;
}

export function getSceneWordCount(scene: NovelScene): number {
  return scene.content.replace(/\s/g, '').length;
}

export function getEffectiveContent(chapter: NovelChapter): string {
  if (chapter.scenes && chapter.scenes.length > 0) {
    return [...chapter.scenes].sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.content).join('\n\n');
  }
  return chapter.content;
}

export function getVolumeWordCount(volume: NovelVolume): number {
  return volume.chapters.reduce((s, c) => s + getChapterWordCount(c), 0);
}

export function getTodayWordCount(novel: NovelDocumentContent): number {
  const today = new Date().toISOString().slice(0, 10);
  const entry = novel.metadata.dailyWordStats?.find(d => d.date === today);
  return entry?.words || 0;
}

// ═══ 场景管理 ═══

export function addScene(novel: NovelDocumentContent, chapterId: string, title: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId) return c;
        const scenes = c.scenes || [];
        const maxSort = scenes.length > 0 ? Math.max(...scenes.map(s => s.sortOrder)) + 1 : 0;
        return { ...c, scenes: [...scenes, { id: genId(), title, content: '', sortOrder: maxSort, status: 'draft' as const }] };
      }),
    })),
  };
}

export function deleteScene(novel: NovelDocumentContent, chapterId: string, sceneId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c =>
        c.id === chapterId ? { ...c, scenes: (c.scenes || []).filter(s => s.id !== sceneId) } : c
      ),
    })),
  };
}

export function renameScene(novel: NovelDocumentContent, chapterId: string, sceneId: string, title: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c =>
        c.id === chapterId ? { ...c, scenes: (c.scenes || []).map(s => s.id === sceneId ? { ...s, title } : s) } : c
      ),
    })),
  };
}

export function updateSceneContent(novel: NovelDocumentContent, chapterId: string, sceneId: string, content: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c =>
        c.id === chapterId ? { ...c, scenes: (c.scenes || []).map(s => s.id === sceneId ? { ...s, content } : s) } : c
      ),
    })),
  };
}

export function updateSceneMeta(
  novel: NovelDocumentContent, chapterId: string, sceneId: string,
  patch: Partial<Omit<NovelScene, 'id' | 'content' | 'sortOrder'>>,
): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c =>
        c.id === chapterId ? { ...c, scenes: (c.scenes || []).map(s => s.id === sceneId ? { ...s, ...patch } : s) } : c
      ),
    })),
  };
}

export function moveSceneUp(novel: NovelDocumentContent, chapterId: string, sceneId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId || !c.scenes) return c;
        const sorted = [...c.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = sorted.findIndex(s => s.id === sceneId);
        if (idx <= 0) return c;
        const temp = sorted[idx].sortOrder;
        sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx - 1].sortOrder };
        sorted[idx - 1] = { ...sorted[idx - 1], sortOrder: temp };
        return { ...c, scenes: sorted };
      }),
    })),
  };
}

export function moveSceneDown(novel: NovelDocumentContent, chapterId: string, sceneId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId || !c.scenes) return c;
        const sorted = [...c.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = sorted.findIndex(s => s.id === sceneId);
        if (idx < 0 || idx >= sorted.length - 1) return c;
        const temp = sorted[idx].sortOrder;
        sorted[idx] = { ...sorted[idx], sortOrder: sorted[idx + 1].sortOrder };
        sorted[idx + 1] = { ...sorted[idx + 1], sortOrder: temp };
        return { ...c, scenes: sorted };
      }),
    })),
  };
}

export function moveSceneToChapter(novel: NovelDocumentContent, sceneId: string, srcChapterId: string, targetChapterId: string): NovelDocumentContent {
  let scene: NovelScene | null = null;
  const afterRemove = novel.volumes.map(v => ({
    ...v,
    chapters: v.chapters.map(c => {
      if (c.id !== srcChapterId || !c.scenes) return c;
      const found = c.scenes.find(s => s.id === sceneId);
      if (found) scene = found;
      return { ...c, scenes: c.scenes.filter(s => s.id !== sceneId) };
    }),
  }));
  if (!scene) return novel;
  return {
    ...novel,
    volumes: afterRemove.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== targetChapterId) return c;
        const scenes = c.scenes || [];
        const maxSort = scenes.length > 0 ? Math.max(...scenes.map(s => s.sortOrder)) + 1 : 0;
        return { ...c, scenes: [...scenes, { ...scene!, sortOrder: maxSort }] };
      }),
    })),
  };
}

export function duplicateScene(novel: NovelDocumentContent, chapterId: string, sceneId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId || !c.scenes) return c;
        const sc = c.scenes.find(s => s.id === sceneId);
        if (!sc) return c;
        const maxSort = Math.max(...c.scenes.map(s => s.sortOrder)) + 1;
        return { ...c, scenes: [...c.scenes, { ...sc, id: genId(), title: sc.title + '（副本）', sortOrder: maxSort }] };
      }),
    })),
  };
}

export function getSceneById(novel: NovelDocumentContent, sceneId: string): { scene: NovelScene; chapter: NovelChapter; volume: NovelVolume } | null {
  for (const v of novel.volumes) {
    for (const ch of v.chapters) {
      if (!ch.scenes) continue;
      const sc = ch.scenes.find(s => s.id === sceneId);
      if (sc) return { scene: sc, chapter: ch, volume: v };
    }
  }
  return null;
}

export function splitChapterIntoScenes(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId || !c.content.trim()) return c;
        if (c.scenes && c.scenes.length > 0) return c;
        const paragraphs = c.content.split(/\n\s*\n/).filter(p => p.trim());
        if (paragraphs.length <= 1) {
          return { ...c, scenes: [{ id: genId(), title: '场景一', content: c.content, sortOrder: 0, status: c.status }] };
        }
        const mid = Math.ceil(paragraphs.length / 2);
        const scenes: NovelScene[] = [
          { id: genId(), title: '场景一', content: paragraphs.slice(0, mid).join('\n\n'), sortOrder: 0, status: c.status },
          { id: genId(), title: '场景二', content: paragraphs.slice(mid).join('\n\n'), sortOrder: 1, status: c.status },
        ];
        return { ...c, scenes };
      }),
    })),
  };
}

export function mergeScenesToChapter(novel: NovelDocumentContent, chapterId: string): NovelDocumentContent {
  return {
    ...novel,
    volumes: novel.volumes.map(v => ({
      ...v,
      chapters: v.chapters.map(c => {
        if (c.id !== chapterId || !c.scenes || c.scenes.length === 0) return c;
        const merged = [...c.scenes].sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.content).join('\n\n');
        return { ...c, content: merged, scenes: undefined };
      }),
    })),
  };
}

// ═══ 情节线管理 ═══

export function addPlotline(novel: NovelDocumentContent, title: string, color: string): NovelDocumentContent {
  const maxSort = novel.settings.plotlines.length > 0 ? Math.max(...novel.settings.plotlines.map(p => p.sortOrder)) + 1 : 0;
  return {
    ...novel,
    settings: {
      ...novel.settings,
      plotlines: [...novel.settings.plotlines, { id: genId(), title, color, sortOrder: maxSort }],
    },
  };
}

export function updatePlotline(novel: NovelDocumentContent, plotlineId: string, patch: Partial<NovelPlotline>): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      plotlines: novel.settings.plotlines.map(p => p.id === plotlineId ? { ...p, ...patch } : p),
    },
  };
}

export function deletePlotline(novel: NovelDocumentContent, plotlineId: string): NovelDocumentContent {
  return {
    ...novel,
    settings: {
      ...novel.settings,
      plotlines: novel.settings.plotlines.filter(p => p.id !== plotlineId),
    },
  };
}

export function updateDailyWordStats(novel: NovelDocumentContent, todayWords: number): NovelDocumentContent {
  const today = new Date().toISOString().slice(0, 10);
  const stats = [...(novel.metadata.dailyWordStats || [])];
  const idx = stats.findIndex(d => d.date === today);
  if (idx >= 0) {
    stats[idx] = { ...stats[idx], words: todayWords };
  } else {
    stats.push({ date: today, words: todayWords });
  }
  // 只保留最近 90 天
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const filtered = stats.filter(d => d.date >= cutoffStr);
  return {
    ...novel,
    metadata: { ...novel.metadata, dailyWordStats: filtered },
  };
}
