/**
 * novelAudit.ts — 连续性审计系统
 *
 * P2: 33 维度检查系统
 * - 本地规则检查（快速）
 * - AI 深度检查（按类别）
 * - 问题汇总报告
 */

import type {
  NovelDocumentContent,
  NovelChapter,
  NovelCharacter,
  NovelForeshadowing,
} from './types';
import { getChapterById, getEffectiveContent, getVolumeByChapterId } from './types';

// ═══ 审计维度定义 ═══

export type AuditCategory =
  | 'character'      // 角色相关
  | 'timeline'       // 时间线
  | 'setting'        // 设定
  | 'foreshadowing'  // 伏笔
  | 'style'          // 文风
  | 'pacing'         // 节奏
  | 'structure';     // 结构

export type AuditSeverity = 'error' | 'warning' | 'info';

export interface AuditDimension {
  id: string;
  category: AuditCategory;
  name: string;
  description: string;
  checkType: 'local' | 'ai';  // local = 本地规则，ai = 需要 AI 分析
}

export interface AuditIssue {
  id: string;
  dimensionId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  chapterId?: string;
  chapterTitle?: string;
  title: string;
  description: string;
  suggestion?: string;
  evidence?: string;  // 问题证据（相关文本片段）
}

export interface AuditReport {
  generatedAt: number;
  totalIssues: number;
  byCategory: Record<AuditCategory, AuditIssue[]>;
  bySeverity: {
    errors: AuditIssue[];
    warnings: AuditIssue[];
    infos: AuditIssue[];
  };
  allIssues: AuditIssue[];
}

// ═══ 33 维度定义 ═══

export const AUDIT_DIMENSIONS: AuditDimension[] = [
  // ── 角色类 ──
  { id: 'char-ooc', category: 'character', name: '角色 OOC', description: '角色行为与性格设定不符', checkType: 'ai' },
  { id: 'char-power', category: 'character', name: '战力崩坏', description: '角色能力前后矛盾或突然增强/削弱', checkType: 'ai' },
  { id: 'char-emotion', category: 'character', name: '情感连贯', description: '角色情感变化缺少铺垫', checkType: 'ai' },
  { id: 'char-memory', category: 'character', name: '记忆一致', description: '角色对已知信息的遗忘或重复', checkType: 'ai' },
  { id: 'char-name', category: 'character', name: '称谓统一', description: '同一角色有多种称呼未解释', checkType: 'local' },

  // ── 时间线类 ──
  { id: 'time-date', category: 'timeline', name: '日期矛盾', description: '时间线上的日期冲突', checkType: 'local' },
  { id: 'time-season', category: 'timeline', name: '季节一致', description: '季节描述与时间线不符', checkType: 'ai' },
  { id: 'time-age', category: 'timeline', name: '年龄匹配', description: '角色年龄与时间线不符', checkType: 'local' },
  { id: 'time-sequence', category: 'timeline', name: '事件顺序', description: '事件发生顺序逻辑矛盾', checkType: 'ai' },

  // ── 设定类 ──
  { id: 'set-world', category: 'setting', name: '世界观规则', description: '违反世界观设定规则', checkType: 'ai' },
  { id: 'set-item', category: 'setting', name: '物品一致', description: '物品属性或存在状态矛盾', checkType: 'local' },
  { id: 'set-location', category: 'setting', name: '地点一致', description: '地点描述或位置矛盾', checkType: 'local' },
  { id: 'set-ability', category: 'setting', name: '能力体系', description: '能力/魔法体系设定矛盾', checkType: 'ai' },

  // ── 伏笔类 ──
  { id: 'foreshadow-open', category: 'foreshadowing', name: '未解伏笔', description: '长时间未解决的伏笔', checkType: 'local' },
  { id: 'foreshadow-repeat', category: 'foreshadowing', name: '重复伏笔', description: '相似伏笔重复设置', checkType: 'ai' },
  { id: 'foreshadow-conflict', category: 'foreshadowing', name: '矛盾伏笔', description: '伏笔与后续情节矛盾', checkType: 'ai' },
  { id: 'foreshadow-forgot', category: 'foreshadowing', name: '伏笔遗忘', description: '重要伏笔未在后续提及', checkType: 'ai' },

  // ── 文风类 ──
  { id: 'style-paragraph', category: 'style', name: '段落等长', description: '段落长度过于均匀（AI 味）', checkType: 'local' },
  { id: 'style-cliche', category: 'style', name: '套话密度', description: 'AI 常用套话过多', checkType: 'local' },
  { id: 'style-transition', category: 'style', name: '公式化转折', description: '转折词使用过于规律', checkType: 'local' },
  { id: 'style-vocab', category: 'style', name: '词汇疲劳', description: '同一词汇高频重复', checkType: 'local' },
  { id: 'style-tense', category: 'style', name: '时态一致', description: '时态混用或切换不当', checkType: 'local' },
  { id: 'style-pov', category: 'style', name: '视角混乱', description: '叙事视角切换不当', checkType: 'ai' },

  // ── 节奏类 ──
  { id: 'pace-monotone', category: 'pacing', name: '节奏单调', description: '情节推进节奏过于平淡', checkType: 'ai' },
  { id: 'pace-overload', category: 'pacing', name: '信息过载', description: '单章信息量过大', checkType: 'ai' },
  { id: 'pace-sidekick', category: 'pacing', name: '配角降智', description: '配角行为不合理以配合主角', checkType: 'ai' },
  { id: 'pace-dialogue', category: 'pacing', name: '对话密度', description: '对话/叙述比例失调', checkType: 'local' },

  // ── 结构类 ──
  { id: 'struct-pov', category: 'structure', name: 'POV 混乱', description: '场景 POV 切换频繁', checkType: 'local' },
  { id: 'struct-scene', category: 'structure', name: '场景跳跃', description: '场景转换缺少过渡', checkType: 'ai' },
  { id: 'struct-plotline', category: 'structure', name: '情节线平衡', description: '某些情节线长期未推进', checkType: 'ai' },
  { id: 'struct-cliffhanger', category: 'structure', name: '悬念设置', description: '章节结尾缺少钩子', checkType: 'ai' },
  { id: 'struct-scene-length', category: 'structure', name: '场景长度', description: '场景长度差异过大', checkType: 'local' },
];

// ═══ 本地规则检查器 ═══

/**
 * 检查角色名称变体
 */
function checkNameVariants(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const characters = novel.settings.characters;

  // 构建名称 -> ID 映射
  const nameToChar = new Map<string, NovelCharacter>();
  for (const char of characters) {
    nameToChar.set(char.name, char);
    if (char.aliases) {
      for (const alias of char.aliases) {
        nameToChar.set(alias, char);
      }
    }
  }

  // 检查各章节中出现的名称
  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content) continue;

      // 简单检测：未在角色表中的专有名词
      // 这里用启发式规则：2-4 个字的中文词，且不是常见词
      const potentialNames = content.match(/[\u4e00-\u9fff]{2,4}/g) || [];
      const uniqueNames = new Set(potentialNames);

      for (const name of uniqueNames) {
        // 检查是否可能是人名（首字母大写模式或包含常见姓氏）
        const commonSurnames = ['李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高'];
        const isLikelyName = commonSurnames.some(s => name.startsWith(s));

        if (isLikelyName && !nameToChar.has(name)) {
          // 检查是否是已注册角色的变体
          let foundVariant = false;
          for (const [existingName, char] of nameToChar) {
            if (name !== existingName && isSimilarName(name, existingName)) {
              issues.push({
                id: `name-variant-${ch.id}-${name}`,
                dimensionId: 'char-name',
                category: 'character',
                severity: 'warning',
                chapterId: ch.id,
                chapterTitle: ch.title,
                title: `角色名称变体：「${name}」`,
                description: `"${name}" 可能是 "${existingName}" 的变体，但未在角色表中注册为别名。`,
                suggestion: `在角色「${char.name}」中添加「${name}」作为别名，或确认为不同角色。`,
              });
              foundVariant = true;
              break;
            }
          }

          if (!foundVariant) {
            issues.push({
              id: `name-unknown-${ch.id}-${name}`,
              dimensionId: 'char-name',
              category: 'character',
              severity: 'info',
              chapterId: ch.id,
              chapterTitle: ch.title,
              title: `未注册名称：「${name}」`,
              description: `"${name}" 看起来是人名，但未在角色表中注册。`,
              suggestion: `确认是否为新角色，如是则添加到角色表。`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 简单的名称相似度检测
 */
function isSimilarName(a: string, b: string): boolean {
  if (a === b) return false;
  // 编辑距离为 1 视为相似
  if (Math.abs(a.length - b.length) > 1) return false;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  let diff = 0;
  let i = 0, j = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i++;
      j++;
    } else {
      diff++;
      if (diff > 1) return false;
      if (longer.length > shorter.length) {
        i++;
      } else {
        j++;
      }
    }
  }
  return diff <= 1;
}

/**
 * 检查未解伏笔
 */
function checkOpenForeshadowing(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const foreshadowing = novel.settings.foreshadowing;
  const now = Date.now();
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const f of foreshadowing) {
    if (f.status === 'open') {
      const createdAt = f.createdAt || 0;
      const age = now - createdAt;

      // 超过 30 天未解决
      if (createdAt > 0 && age > oneMonthAgo) {
        const daysOpen = Math.floor(age / (24 * 60 * 60 * 1000));
        issues.push({
          id: `foreshadow-open-${f.id}`,
          dimensionId: 'foreshadow-open',
          category: 'foreshadowing',
          severity: 'warning',
          title: `长期未解伏笔：「${f.content.slice(0, 30)}...」`,
          description: `此伏笔已悬置 ${daysOpen} 天未解决。`,
          suggestion: '考虑在近期章节中呼应或解决此伏笔。',
        });
      }
    }
  }

  return issues;
}

/**
 * 检查段落等长（AI 味指标）
 */
function checkParagraphUniformity(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content || content.length < 500) continue;

      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      if (paragraphs.length < 5) continue;

      const lengths = paragraphs.map(p => p.replace(/\s/g, '').length);
      const avgLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;
      const variance = lengths.reduce((s, l) => s + (l - avgLength) ** 2, 0) / lengths.length;
      const stdDev = Math.sqrt(variance);
      const cv = avgLength > 0 ? stdDev / avgLength : 0;

      // CV 值过低（< 0.3）说明段落过于均匀
      if (cv < 0.3) {
        issues.push({
          id: `para-uniform-${ch.id}`,
          dimensionId: 'style-paragraph',
          category: 'style',
          severity: 'warning',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: '段落长度过于均匀',
          description: `本章段落长度变异系数仅为 ${cv.toFixed(2)}，可能具有 AI 生成特征。`,
          suggestion: '尝试调整段落长度，增加长短句交替，打破均匀节奏。',
        });
      }
    }
  }

  return issues;
}

/**
 * 检查套话密度
 */
function checkClicheDensity(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // AI 常用套话列表
  const AI_CLICHES = [
    { pattern: /突然/g, name: '突然' },
    { pattern: /缓缓/g, name: '缓缓' },
    { pattern: /微微/g, name: '微微' },
    { pattern: /默默/g, name: '默默' },
    { pattern: /淡淡/g, name: '淡淡' },
    { pattern: /不禁/g, name: '不禁' },
    { pattern: /忍不住/g, name: '忍不住' },
    { pattern: /不由得/g, name: '不由得' },
    { pattern: /心中一动/g, name: '心中一动' },
    { pattern: /眼中闪过.*神色/g, name: '眼中闪过神色' },
    { pattern: /嘴角.*上扬/g, name: '嘴角上扬' },
    { pattern: /深吸.*气/g, name: '深吸气' },
    { pattern: /倒吸.*凉气/g, name: '倒吸凉气' },
    { pattern: /犹如.*般/g, name: '犹如...般' },
    { pattern: /仿佛.*一般/g, name: '仿佛...一般' },
    { pattern: /心中暗想/g, name: '心中暗想' },
    { pattern: /不知为何/g, name: '不知为何' },
    { pattern: /莫名.*感/g, name: '莫名...感' },
    { pattern: /一股.*涌上/g, name: '一股...涌上' },
    { pattern: /时间仿佛静止/g, name: '时间仿佛静止' },
  ];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content || content.length < 500) continue;

      const found: { name: string; count: number }[] = [];

      for (const { pattern, name } of AI_CLICHES) {
        const matches = content.match(pattern);
        if (matches && matches.length >= 3) {
          found.push({ name, count: matches.length });
        }
      }

      if (found.length > 0) {
        issues.push({
          id: `cliche-${ch.id}`,
          dimensionId: 'style-cliche',
          category: 'style',
          severity: 'warning',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: 'AI 套话密度过高',
          description: `检测到高频套话：${found.map(f => `"${f.name}"(${f.count}次)`).join('、')}`,
          suggestion: '尝试用具体描写替代抽象表达，如"微微一笑"改为具体的笑容描写。',
        });
      }
    }
  }

  return issues;
}

/**
 * 检查转折词重复
 */
function checkTransitionRepetition(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const TRANSITIONS = ['但是', '然而', '不过', '可是', '却', '但', '然而', '此时', '这时', '随后', '接着'];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content || content.length < 500) continue;

      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const transitionCounts: Record<string, number> = {};

      for (const p of paragraphs) {
        for (const t of TRANSITIONS) {
          const count = (p.match(new RegExp(t, 'g')) || []).length;
          if (count > 0) {
            transitionCounts[t] = (transitionCounts[t] || 0) + count;
          }
        }
      }

      // 单个转折词使用超过 5 次
      for (const [t, count] of Object.entries(transitionCounts)) {
        if (count > 5) {
          issues.push({
            id: `transition-${ch.id}-${t}`,
            dimensionId: 'style-transition',
            category: 'style',
            severity: 'info',
            chapterId: ch.id,
            chapterTitle: ch.title,
            title: `转折词「${t}」使用过多`,
            description: `本章「${t}」使用了 ${count} 次。`,
            suggestion: '尝试使用其他转折词或通过情节推进自然过渡。',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * 检查词汇疲劳
 */
function checkVocabularyFatigue(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content || content.length < 500) continue;

      // 提取二元组
      const hanzi = content.replace(/[^\u4e00-\u9fff]/g, '');
      if (hanzi.length < 100) continue;

      const bigramCounts = new Map<string, number>();
      for (let i = 0; i < hanzi.length - 1; i++) {
        const bigram = hanzi.slice(i, i + 2);
        bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
      }

      // 找出出现超过 10 次的二元组
      const fatigued: string[] = [];
      for (const [bigram, count] of bigramCounts) {
        if (count > 10) {
          fatigued.push(`"${bigram}"(${count}次)`);
        }
      }

      if (fatigued.length > 5) {
        issues.push({
          id: `vocab-fatigue-${ch.id}`,
          dimensionId: 'style-vocab',
          category: 'style',
          severity: 'info',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: '词汇重复度过高',
          description: `高频词汇：${fatigued.slice(0, 5).join('、')}`,
          suggestion: '尝试使用同义词替换或改变表达方式。',
        });
      }
    }
  }

  return issues;
}

/**
 * 检查对话/叙述比例
 */
function checkDialogueRatio(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (!content || content.length < 500) continue;

      const charCount = content.replace(/\s/g, '').length;
      const dialogueMatches = content.match(/[「"""][^「""」]*[」"""]/g) || [];
      const dialogueChars = dialogueMatches.reduce((s, m) => s + m.replace(/\s/g, '').length, 0);
      const dialogueRatio = charCount > 0 ? dialogueChars / charCount : 0;

      // 对话比例过低或过高
      if (dialogueRatio < 0.1) {
        issues.push({
          id: `dialogue-low-${ch.id}`,
          dimensionId: 'pace-dialogue',
          category: 'pacing',
          severity: 'info',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: '对话比例过低',
          description: `本章对话占比仅 ${Math.round(dialogueRatio * 100)}%，叙述可能过于冗长。`,
          suggestion: '考虑增加角色对话，让情节通过对话推进。',
        });
      } else if (dialogueRatio > 0.7) {
        issues.push({
          id: `dialogue-high-${ch.id}`,
          dimensionId: 'pace-dialogue',
          category: 'pacing',
          severity: 'info',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: '对话比例过高',
          description: `本章对话占比 ${Math.round(dialogueRatio * 100)}%，可能缺少环境描写和心理刻画。`,
          suggestion: '适当增加环境描写和人物心理活动。',
        });
      }
    }
  }

  return issues;
}

/**
 * 检查场景长度差异
 */
function checkSceneLength(novel: NovelDocumentContent): AuditIssue[] {
  const issues: AuditIssue[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      if (!ch.scenes || ch.scenes.length < 3) continue;

      const lengths = ch.scenes.map(s => s.content.replace(/\s/g, '').length);
      const maxLen = Math.max(...lengths);
      const minLen = Math.min(...lengths);

      // 最长场景是最短的 5 倍以上
      if (minLen > 0 && maxLen / minLen > 5) {
        issues.push({
          id: `scene-length-${ch.id}`,
          dimensionId: 'struct-scene-length',
          category: 'structure',
          severity: 'info',
          chapterId: ch.id,
          chapterTitle: ch.title,
          title: '场景长度差异过大',
          description: `最长场景 ${maxLen} 字，最短 ${minLen} 字，差异 ${Math.round(maxLen / minLen)} 倍。`,
          suggestion: '考虑拆分过长场景或合并过短场景。',
        });
      }
    }
  }

  return issues;
}

// ═══ 主审计函数 ═══

/**
 * 执行本地规则审计（快速）
 */
export function runLocalAudit(novel: NovelDocumentContent): AuditIssue[] {
  const allIssues: AuditIssue[] = [];

  // 执行所有本地检查
  allIssues.push(...checkNameVariants(novel));
  allIssues.push(...checkOpenForeshadowing(novel));
  allIssues.push(...checkParagraphUniformity(novel));
  allIssues.push(...checkClicheDensity(novel));
  allIssues.push(...checkTransitionRepetition(novel));
  allIssues.push(...checkVocabularyFatigue(novel));
  allIssues.push(...checkDialogueRatio(novel));
  allIssues.push(...checkSceneLength(novel));

  return allIssues;
}

/**
 * 生成本地审计报告
 */
export function generateLocalAuditReport(novel: NovelDocumentContent): AuditReport {
  const issues = runLocalAudit(novel);

  const byCategory: Record<AuditCategory, AuditIssue[]> = {
    character: [],
    timeline: [],
    setting: [],
    foreshadowing: [],
    style: [],
    pacing: [],
    structure: [],
  };

  const errors: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];
  const infos: AuditIssue[] = [];

  for (const issue of issues) {
    byCategory[issue.category].push(issue);

    if (issue.severity === 'error') errors.push(issue);
    else if (issue.severity === 'warning') warnings.push(issue);
    else infos.push(issue);
  }

  return {
    generatedAt: Date.now(),
    totalIssues: issues.length,
    byCategory,
    bySeverity: { errors, warnings, infos },
    allIssues: issues,
  };
}

/**
 * 构建 AI 深度审计提示词
 */
export function buildAIAuditPrompt(
  novel: NovelDocumentContent,
  category: AuditCategory,
): string {
  const categoryDimensions = AUDIT_DIMENSIONS.filter(d => d.category === category);
  const dimensionList = categoryDimensions.map(d => `- ${d.name}：${d.description}`).join('\n');

  const categoryNames: Record<AuditCategory, string> = {
    character: '角色',
    timeline: '时间线',
    setting: '设定',
    foreshadowing: '伏笔',
    style: '文风',
    pacing: '节奏',
    structure: '结构',
  };

  // 收集相关上下文
  let contextText = '';

  if (category === 'character') {
    contextText = `【角色设定】\n${novel.settings.characters.map(c =>
      `${c.name}（${c.role}）：${c.description.slice(0, 100)}`
    ).join('\n')}`;
  } else if (category === 'setting') {
    contextText = `【世界观】\n${novel.settings.worldView?.slice(0, 500) || '未设置'}\n【规则】\n${novel.settings.worldRules?.slice(0, 300) || '未设置'}`;
  } else if (category === 'foreshadowing') {
    contextText = `【伏笔列表】\n${novel.settings.foreshadowing.map(f =>
      `${f.status === 'open' ? '🔴' : '🟢'} ${f.content.slice(0, 60)}`
    ).join('\n')}`;
  }

  // 收集近期章节内容
  const recentChapters: NovelChapter[] = [];
  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      if (ch.content.length > 500) {
        recentChapters.push(ch);
      }
    }
  }
  const last5Chapters = recentChapters.slice(-5);
  const chapterContent = last5Chapters.map(ch =>
    `【${ch.title}】\n${getEffectiveContent(ch).slice(0, 2000)}`
  ).join('\n\n');

  return `你是专业的小说审稿编辑。请对以下小说内容进行「${categoryNames[category]}」类别的审计检查。

需要检查的维度：
${dimensionList}

${contextText}

【近期章节内容】
${chapterContent}

请检查以上内容是否存在问题，输出 JSON 格式：
{
  "issues": [
    {
      "dimension": "维度 ID（如 char-ooc）",
      "chapter": "章节标题",
      "severity": "error|warning|info",
      "title": "问题标题",
      "description": "问题详细描述",
      "suggestion": "修改建议"
    }
  ]
}

如果没有发现问题，返回 {"issues": []}`;
}

/**
 * 解析 AI 审计结果
 */
export function parseAIAuditResult(
  result: string,
  category: AuditCategory,
): AuditIssue[] {
  try {
    const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : result;
    const parsed = JSON.parse(jsonStr);

    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      return [];
    }

    return parsed.issues.map((issue: any, idx: number) => ({
      id: `ai-audit-${category}-${idx}`,
      dimensionId: issue.dimension || `${category}-unknown`,
      category,
      severity: issue.severity as AuditSeverity || 'info',
      chapterTitle: issue.chapter,
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
    }));
  } catch (e) {
    console.error('Failed to parse AI audit result:', e);
    return [];
  }
}
