/**
 * 小说写作 AI 智能上下文引擎
 *
 * 参照 MindMap 插件的 mindmapContext.ts 架构：
 * - 阶段检测（blank/drafting/revising/polishing）
 * - 分层上下文构建（chapter/volume/settings/full）
 * - 智能系统提示词
 */

import type {
  NovelDocumentContent, NovelChapter, NovelVolume,
} from './types';
import { getChapterById, getTotalWordCount, getVolumeByChapterId, getEffectiveContent, getChapterWordCount } from './types';

// ═══ Token 预算系统 ═══

export type TokenBudgetLevel = '8k' | '16k' | '32k' | '64k' | '128k';

export const TOKEN_BUDGETS: Record<TokenBudgetLevel, number> = {
  '8k': 8000,
  '16k': 16000,
  '32k': 32000,
  '64k': 64000,
  '128k': 128000,
};

/**
 * 估算中文文本的 token 数（中文约 1.5 字/token，英文约 4 字符/token）
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let zhCount = 0;
  let enCount = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) {
      zhCount++;
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      enCount++;
    }
  }
  // 中文: ~1.5 字/token, 英文: ~4 字符/token, 标点等按中文算
  const otherCount = text.length - zhCount - enCount;
  return Math.ceil(zhCount / 1.5 + enCount / 4 + otherCount / 1.5);
}

/**
 * 根据 token 预算智能裁剪文本，保留开头和结尾
 */
function trimToTokenBudget(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  // 按比例保留开头和结尾（开头 30%，结尾 70%）
  const ratio = maxTokens / currentTokens;
  const totalChars = text.length;
  const headChars = Math.floor(totalChars * ratio * 0.3);
  const tailChars = Math.floor(totalChars * ratio * 0.7);

  const head = text.slice(0, headChars);
  const tail = text.slice(-tailChars);
  const omitted = totalChars - headChars - tailChars;
  return `${head}\n\n[…省略约 ${omitted} 字…]\n\n${tail}`;
}

export interface ContextTokenInfo {
  systemPromptTokens: number;
  contextTokens: number;
  totalTokens: number;
  budgetTokens: number;
  usage: number; // 0-1
  overBudget: boolean;
}

/**
 * 获取当前上下文的 token 使用信息（用于 UI 显示）
 */
export function getContextTokenInfo(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  mode: NovelContextMode,
  budget: TokenBudgetLevel = '16k',
  customPrompt?: string,
  activeSceneId?: string | null,
): ContextTokenInfo {
  const systemPrompt = customPrompt || buildSmartSystemPrompt(novel, activeChapterId, { activeSceneId });
  const context = buildContextForMode(novel, activeChapterId, mode);
  const systemPromptTokens = estimateTokens(systemPrompt);
  const contextTokens = estimateTokens(context);
  const totalTokens = systemPromptTokens + contextTokens;
  const budgetTokens = TOKEN_BUDGETS[budget];
  // 预留 30% 给对话历史和 AI 回复
  const effectiveBudget = Math.floor(budgetTokens * 0.7);
  return {
    systemPromptTokens,
    contextTokens,
    totalTokens,
    budgetTokens: effectiveBudget,
    usage: effectiveBudget > 0 ? totalTokens / effectiveBudget : 0,
    overBudget: totalTokens > effectiveBudget,
  };
}

/**
 * 根据 token 预算构建上下文（自动裁剪以适应预算）
 * 优先级：系统提示词 > 当前章节正文尾部 > 大纲/摘要 > 设定概览 > 前文回顾
 */
export function buildContextWithBudget(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  mode: NovelContextMode,
  budget: TokenBudgetLevel = '16k',
  reserveForHistory: number = 0,
): string {
  if (!activeChapterId) return '';
  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return '';

  const budgetTokens = TOKEN_BUDGETS[budget];
  // 预留 30% 给对话历史 + AI 回复 + 额外预留
  const contextBudget = Math.floor(budgetTokens * 0.7) - reserveForHistory;
  if (contextBudget <= 0) return '';

  // 先正常构建
  const fullContext = buildContextForMode(novel, activeChapterId, mode);
  const fullTokens = estimateTokens(fullContext);

  // 在预算内直接返回
  if (fullTokens <= contextBudget) return fullContext;

  // 超预算：智能裁剪策略
  // 策略：降级上下文模式 full → settings → volume → chapter
  const modeDowngrade: NovelContextMode[] = ['full', 'settings', 'volume', 'chapter'];
  const modeIdx = modeDowngrade.indexOf(mode);

  for (let i = modeIdx + 1; i < modeDowngrade.length; i++) {
    const downgraded = buildContextForMode(novel, activeChapterId, modeDowngrade[i]);
    if (estimateTokens(downgraded) <= contextBudget) {
      return downgraded;
    }
  }

  // 即使 chapter 模式也超预算，对章节内容进行裁剪
  return trimToTokenBudget(fullContext, contextBudget);
}

// ═══ 写作阶段 ═══

export type NovelPhase = 'blank' | 'drafting' | 'revising' | 'polishing';

export function detectNovelPhase(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  activeSceneId?: string | null,
): NovelPhase {
  if (!activeChapterId) return 'blank';
  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return 'blank';

  // 场景级：优先用活动场景判断
  if (activeSceneId && ch.scenes) {
    const sc = ch.scenes.find(s => s.id === activeSceneId);
    if (sc) {
      const wc = sc.content.replace(/\s/g, '').length;
      if (wc === 0) return 'blank';
      if (sc.status === 'done') return 'polishing';
      if (sc.status === 'revised') return 'revising';
      return 'drafting';
    }
  }

  const wordCount = getEffectiveContent(ch).replace(/\s/g, '').length;
  if (wordCount === 0) return 'blank';
  if (ch.status === 'done') return 'polishing';
  if (ch.status === 'revised') return 'revising';
  if (wordCount < 500) return 'drafting';
  return 'drafting';
}

// ═══ 上下文模式 ═══

export type NovelContextMode = 'chapter' | 'volume' | 'settings' | 'full';

/**
 * 根据上下文模式构建 AI 上下文字符串
 */
export function buildContextForMode(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  mode: NovelContextMode,
): string {
  if (!activeChapterId) return '';

  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return '';

  // 找到当前章节所属的卷
  let currentVolume: NovelVolume | null = null;
  for (const v of novel.volumes) {
    if (v.chapters.some(c => c.id === activeChapterId)) {
      currentVolume = v;
      break;
    }
  }

  switch (mode) {
    case 'chapter':
      return buildChapterContext(ch);
    case 'volume':
      return buildVolumeContext(novel, currentVolume, ch);
    case 'settings':
      return buildSettingsContext(novel, ch);
    case 'full':
      return buildFullContext(novel, currentVolume, ch);
    default:
      return buildChapterContext(ch);
  }
}

function buildChapterContext(ch: NovelChapter, cursorPos?: number): string {
  const parts: string[] = [];
  parts.push(`\n\n--- 当前章节：${ch.title} ---`);
  if (ch.outline) parts.push(`大纲：${ch.outline}`);
  if (ch.summary) parts.push(`摘要：${ch.summary}`);
  if (ch.authorNotes) parts.push(`作者注：${ch.authorNotes}`);
  // 场景模式：列出场景结构
  if (ch.scenes && ch.scenes.length > 0) {
    parts.push(`场景结构（${ch.scenes.length}个场景）：`);
    for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const swc = sc.content.replace(/\s/g, '').length;
      parts.push(`  ${sc.title} [${sc.status}] ${swc}字${sc.synopsis ? ' — ' + sc.synopsis.slice(0, 60) : ''}`);
    }
  }
  const effectiveContent = getEffectiveContent(ch);
  if (cursorPos !== undefined && cursorPos >= 0 && effectiveContent.length > 0) {
    const before = effectiveContent.slice(Math.max(0, cursorPos - 1000), cursorPos);
    const after = effectiveContent.slice(cursorPos, cursorPos + 1000);
    if (before) parts.push(`正文（光标前）：\n${before}`);
    if (after) parts.push(`正文（光标后）：\n${after}`);
  } else {
    const contentLen = effectiveContent.length;
    if (contentLen > 4000) {
      const head = effectiveContent.slice(0, 500);
      const tail = effectiveContent.slice(-1500);
      parts.push(`正文（开头）：\n${head}`);
      if (ch.outline || ch.summary) {
        parts.push(`[中间部分省略，参考大纲/摘要]`);
      } else {
        parts.push(`[中间 ${contentLen - 2000} 字省略]`);
      }
      parts.push(`正文（尾部）：\n${tail}`);
    } else {
      const tail = effectiveContent.slice(-2000);
      if (tail) parts.push(`正文（尾部）：\n${tail}`);
    }
  }
  return parts.join('\n');
}

/**
 * Phase 2: 带光标位置的上下文构建
 */
export function buildContextWithCursor(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  mode: NovelContextMode,
  cursorPos?: number,
): string {
  if (!activeChapterId) return '';
  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return '';

  let currentVolume: NovelVolume | null = null;
  for (const v of novel.volumes) {
    if (v.chapters.some(c => c.id === activeChapterId)) {
      currentVolume = v;
      break;
    }
  }

  switch (mode) {
    case 'chapter':
      return buildChapterContext(ch, cursorPos);
    case 'volume':
      return buildVolumeContext(novel, currentVolume, ch);
    case 'settings':
      return buildSettingsContext(novel, ch);
    case 'full':
      return buildFullContext(novel, currentVolume, ch);
    default:
      return buildChapterContext(ch, cursorPos);
  }
}

function buildVolumeContext(
  _novel: NovelDocumentContent,
  volume: NovelVolume | null,
  currentCh: NovelChapter,
): string {
  const parts: string[] = [];
  if (volume) {
    parts.push(`\n\n--- 当前卷：${volume.title}（${volume.chapters.length} 章）---`);
    for (const ch of volume.chapters) {
      const wc = getChapterWordCount(ch);
      const statusLabel = ch.status === 'done' ? '✅' : ch.status === 'revised' ? '🔵' : '🟡';
      if (ch.id === currentCh.id) {
        parts.push(`  ▶ ${ch.title} ${statusLabel} ${wc}字（当前）`);
      } else {
        parts.push(`    ${ch.title} ${statusLabel} ${wc}字${ch.summary ? ' — ' + ch.summary.slice(0, 80) : ''}`);
      }
    }
  }
  parts.push(buildChapterContext(currentCh));
  return parts.join('\n');
}

function buildSettingsContext(
  novel: NovelDocumentContent,
  currentCh: NovelChapter,
): string {
  const parts: string[] = [];
  const s = novel.settings;

  parts.push('\n\n--- 小说设定 ---');
  if (s.genre) parts.push(`类型：${s.genre}`);
  if (s.era) parts.push(`时代：${s.era}`);
  if (s.style) parts.push(`风格：${s.style}`);
  if (s.synopsis) parts.push(`简介：${s.synopsis.slice(0, 300)}`);
  if (s.worldView) parts.push(`世界观：${s.worldView.slice(0, 300)}`);

  if (s.characters.length > 0) {
    parts.push('\n角色：');
    for (const c of s.characters.slice(0, 10)) {
      const roleLabel = c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '路人';
      parts.push(`  ${c.name}（${roleLabel}）${c.description.slice(0, 60)}`);
    }
  }

  if (s.characterRelations && s.characterRelations.length > 0) {
    parts.push('\n人物关系：');
    for (const r of s.characterRelations.slice(0, 10)) {
      const from = s.characters.find(c => c.id === r.fromId)?.name || '?';
      const to = s.characters.find(c => c.id === r.toId)?.name || '?';
      parts.push(`  ${from} ${r.bidirectional !== false ? '⟷' : '→'} ${to}：${r.type}${r.label ? `（${r.label}）` : ''}`);
    }
  }

  if (s.factions && s.factions.length > 0) {
    parts.push('\n阵营/势力：');
    for (const f of s.factions.slice(0, 5)) {
      const memberNames = f.memberIds.map(id => s.characters.find(c => c.id === id)?.name).filter(Boolean);
      parts.push(`  ${f.name}${f.type ? `（${f.type}）` : ''}：${f.description.slice(0, 60)}${memberNames.length > 0 ? ` [${memberNames.join('、')}]` : ''}`);
    }
  }

  if (s.foreshadowing.length > 0) {
    const open = s.foreshadowing.filter(f => f.status === 'open');
    if (open.length > 0) {
      parts.push(`\n未解伏笔（${open.length}）：`);
      for (const f of open.slice(0, 5)) {
        parts.push(`  • ${f.content.slice(0, 60)}`);
      }
    }
  }

  if (s.timeline && s.timeline.length > 0) {
    parts.push(`\n时间线（${s.timeline.length}事件）：`);
    for (const e of s.timeline.slice(0, 8)) {
      parts.push(`  ${e.date || '?'} | ${e.title}${e.description ? '：' + e.description.slice(0, 40) : ''}`);
    }
  }

  if (s.historicalBackground) {
    parts.push(`\n历史背景：${s.historicalBackground.slice(0, 300)}`);
  }

  if (s.materials && s.materials.length > 0) {
    parts.push(`\n素材库（${s.materials.length}条）：`);
    for (const m of s.materials.slice(0, 5)) {
      parts.push(`  [${m.category}] ${m.title}: ${m.content.slice(0, 40)}`);
    }
  }

  parts.push(buildChapterContext(currentCh));
  return parts.join('\n');
}

function buildFullContext(
  novel: NovelDocumentContent,
  currentVolume: NovelVolume | null,
  currentCh: NovelChapter,
): string {
  const parts: string[] = [];
  const totalWords = getTotalWordCount(novel);
  const totalChapters = novel.volumes.reduce((s, v) => s + v.chapters.length, 0);

  parts.push(`\n\n--- 全书概览 ---`);
  parts.push(`全书 ${totalWords} 字 · ${novel.volumes.length} 卷 · ${totalChapters} 章`);

  if (novel.settings.outlineGlobal) {
    parts.push(`全局大纲：${novel.settings.outlineGlobal.slice(0, 500)}`);
  }

  // 各卷概览
  for (const v of novel.volumes) {
    const vWords = v.chapters.reduce((s, c) => s + getChapterWordCount(c), 0);
    const isCurrent = v.id === currentVolume?.id;
    parts.push(`${isCurrent ? '▶' : ' '} ${v.title}（${v.chapters.length}章 ${vWords}字）`);
  }

  parts.push(buildSettingsContext(novel, currentCh));
  return parts.join('\n');
}

// ═══ 智能系统提示词 ═══

export function getDefaultNovelSystemPrompt(): string {
  return `你是一位专业的小说写作助手。你擅长：
1. 续写和扩写小说正文，保持文风一致、情节连贯、人物性格稳定
2. 润色和改写文本，提升文学性和可读性
3. 生成角色对话，区分不同角色的语气和性格
4. 场景描写，包括环境渲染、氛围营造、感官细节
5. 分析情节逻辑、节奏、伏笔和角色一致性

输出规则：
- 续写/扩写/场景等创作类请求：直接输出正文内容，不要添加说明
- 分析/建议类请求：用中文条理清晰地回答
- 保持已有的人称、时态和叙事视角一致`;
}

export function buildSmartSystemPrompt(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  options?: { coachMode?: boolean; activeSceneId?: string | null },
): string {
  // Phase 8: 教练模式 — 不直接生成正文，而是通过提问引导
  if (options?.coachMode) {
    return `你是一位经验丰富的小说写作教练。你的职责是：
1. 不要直接写正文，而是通过提问和建议帮助作者推进情节
2. 分析当前情节的优势和改进空间
3. 提出"接下来会发生什么？"等引导性问题
4. 建议角色行为的合理性和情感深度
5. 指出潜在的伏笔机会和冲突升级方向

用中文回答，语气鼓励且专业。`;
  }

  const base = getDefaultNovelSystemPrompt();
  const phase = detectNovelPhase(novel, activeChapterId);
  const parts: string[] = [base];

  // 阶段提示
  switch (phase) {
    case 'blank':
      parts.push('\n\n当前状态：章节空白。帮助用户开始写作，可以根据大纲或设定开始。');
      break;
    case 'drafting':
      parts.push('\n\n当前状态：初稿阶段。专注于推进情节和内容产出，不过度追求完美。');
      break;
    case 'revising':
      parts.push('\n\n当前状态：修订阶段。关注情节逻辑、角色一致性、伏笔处理。');
      break;
    case 'polishing':
      parts.push('\n\n当前状态：定稿润色。专注于语言表达、节奏、细节打磨。');
      break;
  }

  if (!activeChapterId) return parts.join('');
  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return parts.join('');

  // Phase 8.2: POV 角色档案注入（场景级优先）
  const activePovId = (() => {
    if (options?.activeSceneId && ch.scenes) {
      const sc = ch.scenes.find(s => s.id === options.activeSceneId);
      if (sc?.povCharacterId) return sc.povCharacterId;
    }
    return ch.povCharacterId;
  })();
  if (activePovId) {
    const povChar = novel.settings.characters.find(c => c.id === activePovId);
    if (povChar) {
      parts.push(`\n\n--- POV 角色档案 ---`);
      parts.push(`姓名：${povChar.name}${povChar.aliases?.length ? `（${povChar.aliases.join('、')}）` : ''}`);
      if (povChar.personality) parts.push(`性格：${povChar.personality}`);
      if (povChar.dialogueStyle) parts.push(`对话风格：${povChar.dialogueStyle}`);
      if (povChar.background) parts.push(`背景：${povChar.background.slice(0, 200)}`);
      if (povChar.motivation) parts.push(`动机：${povChar.motivation.slice(0, 150)}`);
      // N1.2: 注入角色对话样本
      if (povChar.dialogueSamples && povChar.dialogueSamples.length > 0) {
        parts.push(`\n对话样本（参考该角色的说话方式）：`);
        for (const sample of povChar.dialogueSamples.slice(0, 3)) {
          parts.push(`  「${sample.slice(0, 150)}」`);
        }
      }
      // N1.2: 注入角色当前情感状态
      if (povChar.emotionArc && povChar.emotionArc.length > 0 && activeChapterId) {
        const currentEmotion = povChar.emotionArc.find(e => e.chapterId === activeChapterId);
        const recentEmotions = povChar.emotionArc.slice(-3);
        if (currentEmotion) {
          parts.push(`当前情感：${currentEmotion.emotion}（强度 ${currentEmotion.intensity}/10）`);
        } else if (recentEmotions.length > 0) {
          const last = recentEmotions[recentEmotions.length - 1];
          parts.push(`近期情感：${last.emotion}（强度 ${last.intensity}/10）`);
        }
      }
      parts.push('请确保续写内容符合该角色的性格和说话方式。');
    }
  }

  // Phase 8.4: 大纲驱动写作
  if (ch.outline) {
    parts.push(`\n\n--- 本章大纲 ---\n${ch.outline}\n请严格按照大纲推进情节。`);
  }

  // Phase 8.1: 前文回顾注入（上一章摘要）
  const prevChapter = getPreviousChapter(novel, activeChapterId);
  if (prevChapter?.summary) {
    parts.push(`\n\n--- 前文回顾（${prevChapter.title}）---\n${prevChapter.summary.slice(0, 400)}`);
  }

  // Phase 8.3: 风格样本注入（从已完成章节中提取）
  const styleSamples = extractStyleSamples(novel);
  if (styleSamples) {
    parts.push(`\n\n--- 文风参考样本 ---\n${styleSamples}\n请参考以上风格续写。`);
  }

  return parts.join('');
}

/**
 * Phase 8.1: 获取当前章节的上一章
 */
function getPreviousChapter(novel: NovelDocumentContent, chapterId: string): NovelChapter | null {
  const vol = getVolumeByChapterId(novel, chapterId);
  if (!vol) return null;
  const sorted = [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex(c => c.id === chapterId);
  if (idx > 0) return sorted[idx - 1];
  // 如果是卷的第一章，查找上一卷最后一章
  const volSorted = [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder);
  const volIdx = volSorted.findIndex(v => v.id === vol.id);
  if (volIdx > 0) {
    const prevVol = volSorted[volIdx - 1];
    const prevChs = [...prevVol.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
    return prevChs.length > 0 ? prevChs[prevChs.length - 1] : null;
  }
  return null;
}

/**
 * Phase 8.3: 从已完成章节中提取风格样本（3个200-300字段落）
 */
function extractStyleSamples(novel: NovelDocumentContent): string | null {
  const doneChapters = novel.volumes.flatMap(v => v.chapters).filter(c => c.status === 'done' && c.content.length > 500);
  if (doneChapters.length === 0) return null;

  const samples: string[] = [];
  const used = new Set<number>();

  for (let i = 0; i < Math.min(3, doneChapters.length); i++) {
    const chIdx = doneChapters.length <= 3 ? i : Math.floor(Math.random() * doneChapters.length);
    if (used.has(chIdx)) continue;
    used.add(chIdx);
    const ch = doneChapters[chIdx];
    // 从章节中间提取一个段落
    const paragraphs = ch.content.split(/\n\s*\n/).filter(p => p.trim().length > 100 && p.trim().length < 500);
    if (paragraphs.length > 0) {
      const pIdx = Math.floor(paragraphs.length / 2);
      samples.push(paragraphs[pIdx].trim().slice(0, 300));
    }
  }

  return samples.length > 0 ? samples.join('\n\n') : null;
}

// ═══ 上下文摘要（用于 UI 显示）═══

export function getContextSummary(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
): string {
  if (!activeChapterId) return '未选择章节';
  const ch = getChapterById(novel, activeChapterId);
  if (!ch) return '未选择章节';
  const wc = ch.content.replace(/\s/g, '').length;
  return `${ch.title} · ${wc}字`;
}

/** 默认 Token 预算等级 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetLevel = '16k';

/**
 * 根据阶段自动选择上下文模式
 */
export function autoContextMode(phase: NovelPhase): NovelContextMode {
  switch (phase) {
    case 'blank': return 'settings';
    case 'drafting': return 'chapter';
    case 'revising': return 'volume';
    case 'polishing': return 'chapter';
    default: return 'chapter';
  }
}
