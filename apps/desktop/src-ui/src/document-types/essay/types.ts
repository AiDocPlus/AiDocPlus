/**
 * 散文文档类型 — 数据结构与工具函数
 */

// ═══ 基础类型 ═══

export type EssaySubtype = 'lyrical' | 'narrative' | 'argumentative' | 'travel' | 'philosophical' | 'custom';
export type EssayMood = 'warm' | 'melancholy' | 'heroic' | 'serene' | 'passionate' | 'custom';
export type ParagraphRole = 'open' | 'carry' | 'turn' | 'close' | 'none';
export type MasterStyle = 'zhu-ziqing' | 'yu-qiuyu' | 'lin-qingxuan' | 'wang-zengqi' | 'zhang-xiaofeng' | 'shi-tiesheng' | 'bing-xin' | 'san-mao' | 'free';
export type MaterialType = 'inspiration' | 'quote' | 'imagery' | 'reference';
export type RhetoricType =
  | 'metaphor' | 'personification' | 'parallelism' | 'synesthesia'
  | 'hyperbole' | 'rhetorical-question' | 'contrast' | 'allusion'
  | 'repetition' | 'symbolism' | 'other';

// ═══ 素材 ═══

export interface EssayMaterial {
  id: string;
  type: MaterialType;
  title: string;
  content: string;
  source?: string;
  tags: string[];
  createdAt: string;
}

// ═══ 段落信息 ═══

export interface EssayParagraph {
  id: string;
  index: number;
  preview: string;
  role: ParagraphRole;
  roleManual: boolean;
  startOffset: number;
  endOffset: number;
  wordCount: number;
}

// ═══ 修辞标注 ═══

export interface RhetoricAnnotation {
  id: string;
  type: RhetoricType;
  startOffset: number;
  endOffset: number;
  text: string;
  note?: string;
  autoDetected: boolean;
}

// ═══ 意象标注 ═══

export interface ImageryAnnotation {
  id: string;
  keyword: string;
  meaning: string;
  occurrences: number[];
}

// ═══ 写作设置 ═══

export interface EssaySettings {
  subtype: EssaySubtype;
  theme: string;
  keyImagery: string[];
  targetStyle: MasterStyle;
  customStyleDesc?: string;
  targetWordCount: number;
  mood: EssayMood;
  customMoodDesc?: string;
}

// ═══ 快照 ═══

export interface EssaySnapshot {
  id: string;
  content: string;
  wordCount: number;
  createdAt: string;
  label?: string;
}

// ═══ 大纲规划节点 ═══

export interface EssayOutlineItem {
  id: string;
  role: ParagraphRole;
  title: string;
  note: string;
  keyImagery: string;
  emotionDir: string;
  targetWords: number;
}

// ═══ 分析缓存 ═══

export interface EssayAnalysisCache {
  lastAnalyzedAt: string;
  contentHash: string;
  rhetoricsCount: number;
  imageryCount: number;
  structureScore: number;
  literaryScore: number;
  emotionFlow: number[];
  themeSummary: string;
}

// ═══ 文档顶级结构 ═══

export interface EssayDocumentContent {
  version: number;
  content: string;
  title: string;
  subtitle?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  settings: EssaySettings;
  materials: EssayMaterial[];
  paragraphs: EssayParagraph[];
  rhetorics: RhetoricAnnotation[];
  imagery: ImageryAnnotation[];
  snapshots: EssaySnapshot[];
  outline?: EssayOutlineItem[];
  analysisCache?: EssayAnalysisCache;
}

// ═══ 工具函数 ═══

/** 生成唯一 ID */
export function genId(prefix = 'e'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 创建空文档内容 */
export function createEmptyEssayContent(): EssayDocumentContent {
  const now = new Date().toISOString();
  return {
    version: 1,
    content: '',
    title: '',
    createdAt: now,
    updatedAt: now,
    settings: {
      subtype: 'lyrical',
      theme: '',
      keyImagery: [],
      targetStyle: 'free',
      targetWordCount: 2000,
      mood: 'warm',
    },
    materials: [],
    paragraphs: [],
    rhetorics: [],
    imagery: [],
    snapshots: [],
  };
}

/** 解析文档 JSON */
export function parseEssayContent(raw: string): EssayDocumentContent | null {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && 'version' in data && 'content' in data) {
      return data as EssayDocumentContent;
    }
    return null;
  } catch {
    return null;
  }
}

/** 提取纯文本 */
export function extractPlainText(essay: EssayDocumentContent): string {
  return essay.content || '';
}

// ── 字数统计 ──

/** 字数统计（中文按字数，英文按词数） */
export function getWordCount(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/\s/g, '');
  return cleaned.length;
}

/** 估算阅读时间（分钟） */
export function getReadingTime(text: string): number {
  const wc = getWordCount(text);
  return Math.max(1, Math.ceil(wc / 300));
}

/** 段落数量 */
export function getParagraphCount(text: string): number {
  if (!text.trim()) return 0;
  return text.split(/\n\s*\n/).filter(p => p.trim()).length;
}

// ── 段落解析 ──

/** 自动解析段落 */
export function parseParagraphs(content: string, existingParagraphs?: EssayParagraph[]): EssayParagraph[] {
  if (!content.trim()) return [];

  // 逐字符扫描，精确追踪每个段落块的起止偏移（避免 indexOf 在重复内容时错位）
  const result: EssayParagraph[] = [];
  const len = content.length;
  let pos = 0;         // 当前扫描位置
  let paraIndex = 0;  // 有内容的段落序号

  while (pos < len) {
    // 跳过段间空白行
    const blockStart = pos;
    // 找到本块结束（连续两个换行或到文末）
    let blockEnd = pos;
    while (blockEnd < len) {
      // 检测 \n\n 或 \n + 空白 + \n
      if (content[blockEnd] === '\n') {
        let look = blockEnd + 1;
        // 吸收行内空白
        while (look < len && content[look] !== '\n' && /\s/.test(content[look])) look++;
        if (look < len && content[look] === '\n') {
          // 遇到段落分隔符
          break;
        }
      }
      blockEnd++;
    }

    const raw = content.slice(blockStart, blockEnd);
    const trimmed = raw.trim();

    if (trimmed) {
      const preview = trimmed.slice(0, 30) + (trimmed.length > 30 ? '...' : '');
      const wordCount = trimmed.replace(/\s/g, '').length;
      const existingId = `para_${paraIndex}`;
      const existing = existingParagraphs?.find(p => p.id === existingId || p.index === paraIndex);
      const role: ParagraphRole = existing?.roleManual ? existing.role : 'none';
      const roleManual = existing?.roleManual || false;

      result.push({
        id: existingId,
        index: paraIndex,
        preview,
        role,
        roleManual,
        startOffset: blockStart,
        endOffset: blockEnd,
        wordCount,
      });
      paraIndex++;
    }

    // 跳过段落分隔符（吸收所有空白行）
    pos = blockEnd;
    while (pos < len && /[\n\r\s]/.test(content[pos])) {
      if (content[pos] === '\n') {
        pos++;
        // 吸收下一行行内空白
        while (pos < len && content[pos] !== '\n' && /[ \t]/.test(content[pos])) pos++;
        if (pos < len && content[pos] === '\n') {
          // 段落空行已消费，继续
        } else {
          // 非空行，到达下一段开头
          break;
        }
      } else {
        pos++;
      }
    }
    // 若未前进则强制前进防止死循环
    if (pos <= blockEnd && blockEnd < len) pos = blockEnd + 1;
  }

  return result;
}

/** 更新段落角色 */
export function updateParagraphRole(
  essay: EssayDocumentContent,
  paragraphId: string,
  role: ParagraphRole,
): EssayDocumentContent {
  return {
    ...essay,
    paragraphs: essay.paragraphs.map(p =>
      p.id === paragraphId ? { ...p, role, roleManual: true } : p,
    ),
    updatedAt: new Date().toISOString(),
  };
}

// ── 素材管理 ──

/** 添加素材 */
export function addMaterial(
  essay: EssayDocumentContent,
  material: Omit<EssayMaterial, 'id' | 'createdAt'>,
): EssayDocumentContent {
  const newMat: EssayMaterial = {
    ...material,
    id: genId('mat'),
    createdAt: new Date().toISOString(),
  };
  return {
    ...essay,
    materials: [...essay.materials, newMat],
    updatedAt: new Date().toISOString(),
  };
}

/** 更新素材 */
export function updateMaterial(
  essay: EssayDocumentContent,
  id: string,
  updates: Partial<EssayMaterial>,
): EssayDocumentContent {
  return {
    ...essay,
    materials: essay.materials.map(m => m.id === id ? { ...m, ...updates } : m),
    updatedAt: new Date().toISOString(),
  };
}

/** 删除素材 */
export function deleteMaterial(essay: EssayDocumentContent, id: string): EssayDocumentContent {
  return {
    ...essay,
    materials: essay.materials.filter(m => m.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

/** 按类型获取素材 */
export function getMaterialsByType(essay: EssayDocumentContent, type: MaterialType): EssayMaterial[] {
  return essay.materials.filter(m => m.type === type);
}

// ── 修辞标注 ──

/** 添加修辞标注 */
export function addRhetoric(
  essay: EssayDocumentContent,
  rhetoric: Omit<RhetoricAnnotation, 'id'>,
): EssayDocumentContent {
  return {
    ...essay,
    rhetorics: [...essay.rhetorics, { ...rhetoric, id: genId('rhet') }],
    updatedAt: new Date().toISOString(),
  };
}

/** 删除修辞标注 */
export function removeRhetoric(essay: EssayDocumentContent, id: string): EssayDocumentContent {
  return {
    ...essay,
    rhetorics: essay.rhetorics.filter(r => r.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

// ── 意象标注 ──

/** 添加意象标注 */
export function addImagery(
  essay: EssayDocumentContent,
  img: Omit<ImageryAnnotation, 'id'>,
): EssayDocumentContent {
  return {
    ...essay,
    imagery: [...essay.imagery, { ...img, id: genId('img') }],
    updatedAt: new Date().toISOString(),
  };
}

/** 删除意象标注 */
export function removeImagery(essay: EssayDocumentContent, id: string): EssayDocumentContent {
  return {
    ...essay,
    imagery: essay.imagery.filter(i => i.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

// ── 快照 ──

/** 创建快照 */
export function createSnapshot(essay: EssayDocumentContent, label?: string): EssayDocumentContent {
  const snap: EssaySnapshot = {
    id: genId('snap'),
    content: essay.content,
    wordCount: getWordCount(essay.content),
    createdAt: new Date().toISOString(),
    label,
  };
  return {
    ...essay,
    snapshots: [...essay.snapshots, snap].slice(-50),
    updatedAt: new Date().toISOString(),
  };
}

/** 恢复快照 */
export function restoreSnapshot(essay: EssayDocumentContent, snapshotId: string): EssayDocumentContent {
  const snap = essay.snapshots.find(s => s.id === snapshotId);
  if (!snap) return essay;
  return {
    ...essay,
    content: snap.content,
    paragraphs: parseParagraphs(snap.content, essay.paragraphs),
    updatedAt: new Date().toISOString(),
  };
}

/** 删除快照 */
export function deleteSnapshot(essay: EssayDocumentContent, snapshotId: string): EssayDocumentContent {
  return {
    ...essay,
    snapshots: essay.snapshots.filter(s => s.id !== snapshotId),
    updatedAt: new Date().toISOString(),
  };
}

/** 更新设置 */
export function updateSettings(
  essay: EssayDocumentContent,
  updates: Partial<EssaySettings>,
): EssayDocumentContent {
  return {
    ...essay,
    settings: { ...essay.settings, ...updates },
    updatedAt: new Date().toISOString(),
  };
}

/** 更新正文内容 */
export function updateContent(
  essay: EssayDocumentContent,
  content: string,
): EssayDocumentContent {
  return {
    ...essay,
    content,
    paragraphs: parseParagraphs(content, essay.paragraphs),
    updatedAt: new Date().toISOString(),
  };
}
