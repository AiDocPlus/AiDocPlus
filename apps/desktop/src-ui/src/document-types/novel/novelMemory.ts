/**
 * novelMemory.ts — 四层记忆构建器
 *
 * P1: 四层记忆架构核心模块
 * - Layer 0: 风格层 (~800-1500 token)
 * - Layer 1: 设定层 (~1000-2000 token)
 * - Layer 2: 近章层 (~1500 token)
 * - Layer 3: 当前章节层 (~2000-4000 token)
 *
 * 总计: ~5300-9000 token
 */

import type {
  NovelDocumentContent,
  NovelChapter,
  NovelVolume,
  NovelMemoryContext,
} from './types';
import {
  getChapterById,
  getEffectiveContent,
} from './types';
import { buildStyleInjectionPrompt } from './styleProfileGenerator';
import { estimateTokens, trimToTokenBudget } from './novelContext';

// ═══ Token 预算分配 ═══

export const MEMORY_TOKEN_BUDGETS = {
  layer0Style: { min: 400, max: 1500, target: 800 },
  layer1Settings: { min: 500, max: 2000, target: 1200 },
  layer2RecentChapters: { min: 800, max: 2000, target: 1500 },
  layer3CurrentChapter: { min: 1500, max: 4000, target: 2500 },
};

/** 获取上一章 */
function getPreviousChapters(
  novel: NovelDocumentContent,
  chapterId: string,
  count: number = 3,
): NovelChapter[] {
  const allChapters: { chapter: NovelChapter; volume: NovelVolume }[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      allChapters.push({ chapter: ch, volume: vol });
    }
  }

  // 按 volume.sortOrder 和 chapter.sortOrder 排序
  allChapters.sort((a, b) => {
    if (a.volume.sortOrder !== b.volume.sortOrder) {
      return a.volume.sortOrder - b.volume.sortOrder;
    }
    return a.chapter.sortOrder - b.chapter.sortOrder;
  });

  const currentIdx = allChapters.findIndex(c => c.chapter.id === chapterId);
  if (currentIdx <= 0) return [];

  const result: NovelChapter[] = [];
  for (let i = currentIdx - 1; i >= 0 && result.length < count; i--) {
    result.unshift(allChapters[i].chapter);
  }

  return result;
}

// ═══ Layer 0: 风格层 ═══

/**
 * 构建 Layer 0: 风格层
 * - 风格画像摘要
 * - RAG 检索风格样本（可选）
 */
function buildLayer0Style(
  novel: NovelDocumentContent,
  maxTokens: number = MEMORY_TOKEN_BUDGETS.layer0Style.max,
): { content: string; tokens: number } {
  if (!novel.settings.activeStyleProfile) {
    return { content: '', tokens: 0 };
  }

  const profile = novel.settings.activeStyleProfile;
  const prompt = buildStyleInjectionPrompt(profile, maxTokens);
  const tokens = estimateTokens(prompt);

  return { content: prompt, tokens };
}

// ═══ Layer 1: 设定层 ═══

/**
 * 构建 Layer 1: 设定层
 * - 世界观/规则摘要
 * - 相关角色档案
 * - 未解伏笔列表
 * - 活跃情节线
 */
function buildLayer1Settings(
  novel: NovelDocumentContent,
  currentChapter: NovelChapter,
  maxTokens: number = MEMORY_TOKEN_BUDGETS.layer1Settings.max,
): { content: string; tokens: number } {
  const parts: string[] = [];
  const s = novel.settings;

  // 世界观/规则
  if (s.worldView || s.worldRules) {
    parts.push('【世界观设定】');
    if (s.worldRules) parts.push(s.worldRules.slice(0, 500));
    if (s.worldView) parts.push(s.worldView.slice(0, 300));
    parts.push('');
  }

  // POV 角色档案
  const povChar = currentChapter.povCharacterId
    ? s.characters.find(c => c.id === currentChapter.povCharacterId)
    : null;

  if (povChar) {
    parts.push('【POV 角色档案】');
    parts.push(`姓名：${povChar.name}${povChar.aliases?.length ? `（${povChar.aliases.join('、')}）` : ''}`);
    if (povChar.personality) parts.push(`性格：${povChar.personality}`);
    if (povChar.dialogueStyle) parts.push(`对话风格：${povChar.dialogueStyle}`);
    if (povChar.background) parts.push(`背景：${povChar.background.slice(0, 200)}`);
    if (povChar.motivation) parts.push(`动机：${povChar.motivation.slice(0, 150)}`);
    parts.push('');
  }

  // 本章涉及角色（从角色状态或场景中提取）
  const involvedCharacterIds = new Set<string>();
  if (currentChapter.characterStates) {
    currentChapter.characterStates.forEach(cs => involvedCharacterIds.add(cs.characterId));
  }
  if (currentChapter.scenes) {
    currentChapter.scenes.forEach(sc => {
      sc.characterIds?.forEach(id => involvedCharacterIds.add(id));
    });
  }

  const involvedCharacters = s.characters.filter(c => involvedCharacterIds.has(c.id) && c.id !== povChar?.id);
  if (involvedCharacters.length > 0) {
    parts.push('【相关角色】');
    for (const c of involvedCharacters.slice(0, 5)) {
      const roleLabel = c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '';
      parts.push(`  ${c.name}${roleLabel ? `（${roleLabel}）` : ''}：${c.description.slice(0, 60)}`);
    }
    parts.push('');
  }

  // 未解伏笔
  const openForeshadowing = s.foreshadowing.filter(f => f.status === 'open');
  if (openForeshadowing.length > 0) {
    parts.push(`【未解伏笔（${openForeshadowing.length}）】`);
    for (const f of openForeshadowing.slice(0, 5)) {
      parts.push(`  • ${f.content.slice(0, 80)}`);
    }
    parts.push('');
  }

  // 活跃情节线
  const activePlotlines = s.plotlines.filter(p => p.description);
  if (activePlotlines.length > 0) {
    parts.push('【情节线】');
    for (const p of activePlotlines.slice(0, 3)) {
      parts.push(`  ${p.title}：${p.description?.slice(0, 60) || ''}`);
    }
    parts.push('');
  }

  const content = parts.join('\n');
  const tokens = estimateTokens(content);

  if (tokens > maxTokens) {
    return { content: trimToTokenBudget(content, maxTokens), tokens: maxTokens };
  }

  return { content, tokens };
}

// ═══ Layer 2: 近章层 ═══

/**
 * 构建 Layer 2: 近章层
 * - 前 3-5 章摘要（每章 200-300 字）
 * - 关键情节节点
 */
function buildLayer2RecentChapters(
  novel: NovelDocumentContent,
  currentChapterId: string,
  maxTokens: number = MEMORY_TOKEN_BUDGETS.layer2RecentChapters.max,
): { content: string; tokens: number } {
  const prevChapters = getPreviousChapters(novel, currentChapterId, 5);

  if (prevChapters.length === 0) {
    return { content: '', tokens: 0 };
  }

  const parts: string[] = [];
  parts.push('【前文回顾】');

  for (const ch of prevChapters) {
    const summary = ch.autoSummary || ch.summary;
    if (summary) {
      parts.push(`\n${ch.title}：${summary.slice(0, 300)}`);
    } else {
      // 没有摘要时，提取正文尾部
      const content = getEffectiveContent(ch);
      if (content.length > 100) {
        const tail = content.slice(-200);
        parts.push(`\n${ch.title}（尾部）：${tail}...`);
      }
    }

    // 关键情节节点
    if (ch.keyEvents && ch.keyEvents.length > 0) {
      parts.push(`  关键事件：${ch.keyEvents.slice(0, 3).join('、')}`);
    }
  }

  const content = parts.join('\n');
  const tokens = estimateTokens(content);

  if (tokens > maxTokens) {
    return { content: trimToTokenBudget(content, maxTokens), tokens: maxTokens };
  }

  return { content, tokens };
}

// ═══ Layer 3: 当前章节层 ═══

/**
 * 构建 Layer 3: 当前章节层
 * - 章节大纲
 * - 正文尾部
 * - POV 角色状态
 * - 角色状态快照
 */
function buildLayer3CurrentChapter(
  novel: NovelDocumentContent,
  currentChapter: NovelChapter,
  maxTokens: number = MEMORY_TOKEN_BUDGETS.layer3CurrentChapter.max,
): { content: string; tokens: number } {
  const parts: string[] = [];

  // 章节大纲
  parts.push(`【当前章节：${currentChapter.title}】`);
  if (currentChapter.outline) {
    parts.push(`大纲：${currentChapter.outline}`);
    parts.push('');
  }

  // POV 角色状态
  if (currentChapter.povCharacterId) {
    const povChar = novel.settings.characters.find(c => c.id === currentChapter.povCharacterId);
    if (povChar?.emotionArc && povChar.emotionArc.length > 0) {
      const currentEmotion = povChar.emotionArc.find(e => e.chapterId === currentChapter.id);
      if (currentEmotion) {
        parts.push(`当前情感：${currentEmotion.emotion}（强度 ${currentEmotion.intensity}/10）`);
      }
    }
  }

  // 角色状态快照
  if (currentChapter.characterStates && currentChapter.characterStates.length > 0) {
    parts.push('\n【角色状态】');
    for (const cs of currentChapter.characterStates.slice(0, 5)) {
      const char = novel.settings.characters.find(c => c.id === cs.characterId);
      if (char) {
        parts.push(`  ${char.name}：${cs.emotion || ''}${cs.changes ? ` — ${cs.changes.slice(0, 50)}` : ''}`);
      }
    }
  }

  // 正文尾部（最重要的上下文）
  const content = getEffectiveContent(currentChapter);
  if (content.length > 0) {
    parts.push('\n【正文尾部】');
    const tail = content.slice(-1500);
    parts.push(tail);
  }

  const result = parts.join('\n');
  const tokens = estimateTokens(result);

  if (tokens > maxTokens) {
    return { content: trimToTokenBudget(result, maxTokens), tokens: maxTokens };
  }

  return { content: result, tokens };
}

// ═══ 主构建函数 ═══

export interface BuildMemoryOptions {
  /** 是否包含 Layer 0 风格层 */
  includeStyle?: boolean;
  /** 是否包含 Layer 1 设定层 */
  includeSettings?: boolean;
  /** 是否包含 Layer 2 近章层 */
  includeRecentChapters?: boolean;
  /** 近章数量 */
  recentChapterCount?: number;
  /** 最大总 token 数 */
  maxTotalTokens?: number;
}

/**
 * 构建四层记忆上下文
 */
export function buildMemoryContext(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
  options: BuildMemoryOptions = {},
): NovelMemoryContext {
  const {
    includeStyle = true,
    includeSettings = true,
    includeRecentChapters = true,
    recentChapterCount = 3,
  } = options;

  const context: NovelMemoryContext = {};
  const tokenUsage = { layer0: 0, layer1: 0, layer2: 0, layer3: 0, total: 0 };

  if (!activeChapterId) {
    return context;
  }

  const currentChapter = getChapterById(novel, activeChapterId);
  if (!currentChapter) {
    return context;
  }

  // Layer 0: 风格层
  if (includeStyle && novel.settings.activeStyleProfile) {
    const layer0 = buildLayer0Style(novel);
    if (layer0.content) {
      context.layer0Style = {
        profile: novel.settings.activeStyleProfile,
      };
      tokenUsage.layer0 = layer0.tokens;
    }
  }

  // Layer 1: 设定层
  if (includeSettings) {
    const layer1 = buildLayer1Settings(novel, currentChapter);
    if (layer1.content) {
      const relatedCharacters = novel.settings.characters.filter(c =>
        currentChapter.characterStates?.some(cs => cs.characterId === c.id) ||
        currentChapter.scenes?.some(sc => sc.characterIds?.includes(c.id)),
      );
      const openForeshadowing = novel.settings.foreshadowing.filter(f => f.status === 'open');
      const activePlotlines = novel.settings.plotlines;

      context.layer1Settings = {
        worldRules: novel.settings.worldRules,
        relatedCharacters,
        openForeshadowing,
        activePlotlines,
      };
      tokenUsage.layer1 = layer1.tokens;
    }
  }

  // Layer 2: 近章层
  if (includeRecentChapters) {
    const prevChapters = getPreviousChapters(novel, activeChapterId, recentChapterCount);
    if (prevChapters.length > 0) {
      const layer2 = buildLayer2RecentChapters(novel, activeChapterId);
      if (layer2.content) {
        context.layer2RecentChapters = {
          summaries: prevChapters.map(ch => ({
            chapterId: ch.id,
            chapterTitle: ch.title,
            summary: ch.autoSummary || ch.summary || '',
            keyEvents: ch.keyEvents || [],
          })),
        };
        tokenUsage.layer2 = layer2.tokens;
      }
    }
  }

  // Layer 3: 当前章节层
  const layer3 = buildLayer3CurrentChapter(novel, currentChapter);
  if (layer3.content) {
    const povCharacter = currentChapter.povCharacterId
      ? novel.settings.characters.find(c => c.id === currentChapter.povCharacterId)
      : undefined;

    context.layer3CurrentChapter = {
      outline: currentChapter.outline,
      contentTail: getEffectiveContent(currentChapter).slice(-1500),
      povCharacter,
      characterStates: currentChapter.characterStates,
    };
    tokenUsage.layer3 = layer3.tokens;
  }

  tokenUsage.total = tokenUsage.layer0 + tokenUsage.layer1 + tokenUsage.layer2 + tokenUsage.layer3;
  context.tokenUsage = tokenUsage;

  return context;
}

/**
 * 将四层记忆转换为 AI 系统提示词字符串
 */
export function memoryContextToPrompt(context: NovelMemoryContext): string {
  const parts: string[] = [];

  // Layer 0: 风格层
  if (context.layer0Style) {
    const stylePrompt = buildStyleInjectionPrompt(context.layer0Style.profile, 800);
    if (stylePrompt) {
      parts.push(stylePrompt);
      parts.push('');
    }
  }

  // Layer 1: 设定层
  if (context.layer1Settings) {
    const s = context.layer1Settings;
    if (s.worldRules) {
      parts.push('【世界观规则】');
      parts.push(s.worldRules.slice(0, 500));
      parts.push('');
    }

    if (s.relatedCharacters && s.relatedCharacters.length > 0) {
      parts.push('【相关角色】');
      for (const c of s.relatedCharacters.slice(0, 5)) {
        parts.push(`  ${c.name}：${c.description.slice(0, 60)}`);
      }
      parts.push('');
    }

    if (s.openForeshadowing && s.openForeshadowing.length > 0) {
      parts.push(`【未解伏笔（${s.openForeshadowing.length}）】`);
      for (const f of s.openForeshadowing.slice(0, 3)) {
        parts.push(`  • ${f.content.slice(0, 80)}`);
      }
      parts.push('');
    }
  }

  // Layer 2: 近章层
  if (context.layer2RecentChapters && context.layer2RecentChapters.summaries.length > 0) {
    parts.push('【前文回顾】');
    for (const s of context.layer2RecentChapters.summaries) {
      if (s.summary) {
        parts.push(`${s.chapterTitle}：${s.summary.slice(0, 250)}`);
      }
    }
    parts.push('');
  }

  // Layer 3: 当前章节层
  if (context.layer3CurrentChapter) {
    const c = context.layer3CurrentChapter;
    if (c.outline) {
      parts.push('【本章大纲】');
      parts.push(c.outline);
      parts.push('');
    }

    if (c.povCharacter) {
      parts.push(`【POV 角色】${c.povCharacter.name}`);
      if (c.povCharacter.personality) {
        parts.push(`性格：${c.povCharacter.personality}`);
      }
      parts.push('');
    }

    if (c.contentTail) {
      parts.push('【正文尾部】');
      parts.push(c.contentTail);
    }
  }

  return parts.join('\n');
}

/**
 * 生成章节摘要（用于 AI 调用）
 */
export function buildChapterSummaryPrompt(chapter: NovelChapter): string {
  const content = getEffectiveContent(chapter);
  if (content.length < 200) {
    return '';
  }

  return `请为以下小说章节生成一段 200-300 字的摘要，概括主要情节和关键事件。

章节标题：${chapter.title}
${chapter.outline ? `章节大纲：${chapter.outline}\n` : ''}
正文内容：
${content.slice(0, 5000)}

请输出：
1. 摘要（200-300字）
2. 关键事件列表（3-5个简短描述）

格式：
【摘要】
...

【关键事件】
- ...
- ...`;
}

/**
 * 解析 AI 返回的摘要
 */
export function parseChapterSummaryResult(result: string): {
  summary: string;
  keyEvents: string[];
} | null {
  const summaryMatch = result.match(/【摘要】\s*([\s\S]*?)(?=【关键事件】|$)/);
  const eventsMatch = result.match(/【关键事件】\s*([\s\S]*?)$/);

  if (!summaryMatch) {
    return null;
  }

  const summary = summaryMatch[1].trim();
  const keyEvents: string[] = [];

  if (eventsMatch) {
    const eventsText = eventsMatch[1].trim();
    const eventLines = eventsText.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
    for (const line of eventLines) {
      const event = line.replace(/^[-•]\s*/, '').trim();
      if (event) {
        keyEvents.push(event);
      }
    }
  }

  return { summary, keyEvents };
}
