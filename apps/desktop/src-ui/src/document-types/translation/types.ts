/**
 * 翻译文档类型 — 内部数据结构
 * V3：新增 settings（翻译风格、保留格式、字体大小等）、时间戳
 */

// ============================================================
// 翻译设置
// ============================================================

export interface TranslationSettings {
  /** 默认翻译风格 */
  defaultStyle: 'general' | 'formal' | 'academic' | 'literary' | 'technical' | 'casual' | 'legal';
  /** 是否保留原文格式（段落结构、标记等） */
  preserveFormatting: boolean;
  /** 自动保存（debounce 3s） */
  autoSave: boolean;
  /** 字体大小 */
  fontSize: 'small' | 'medium' | 'large';
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  defaultStyle: 'general',
  preserveFormatting: true,
  autoSave: true,
  fontSize: 'medium',
};

// ============================================================
// 翻译风格配置（供设置对话框和 AI 提示词使用）
// ============================================================

export const TRANSLATION_STYLES: { value: TranslationSettings['defaultStyle']; labelKey: string; defaultLabel: string; prompt: string }[] = [
  { value: 'general', labelKey: 'translation.styleGeneral', defaultLabel: '通用', prompt: '请以通用风格翻译，语言自然流畅。' },
  { value: 'formal', labelKey: 'translation.styleFormal', defaultLabel: '正式公文', prompt: '请以正式公文风格翻译，用语庄重、规范、严谨。' },
  { value: 'academic', labelKey: 'translation.styleAcademic', defaultLabel: '学术论文', prompt: '请以学术论文风格翻译，使用专业术语，语言精确、客观。' },
  { value: 'literary', labelKey: 'translation.styleLiterary', defaultLabel: '文学作品', prompt: '请以文学翻译风格翻译，注重文采、意境和修辞，追求信达雅。' },
  { value: 'technical', labelKey: 'translation.styleTechnical', defaultLabel: '技术文档', prompt: '请以技术文档风格翻译，术语准确、表述清晰、逻辑严密。' },
  { value: 'casual', labelKey: 'translation.styleCasual', defaultLabel: '日常口语', prompt: '请以日常口语风格翻译，自然流畅、口语化、通俗易懂。' },
  { value: 'legal', labelKey: 'translation.styleLegal', defaultLabel: '法律合同', prompt: '请以法律文书风格翻译，措辞严谨、逻辑缜密、无歧义。' },
];

// ============================================================
// 文档内容
// ============================================================

export interface TranslationDocumentContent {
  version: 3;
  direction: 'zh-en' | 'en-zh';
  source: string;
  target: string;
  settings: TranslationSettings;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyTranslationContent(): TranslationDocumentContent {
  const now = new Date().toISOString();
  return {
    version: 3,
    direction: 'zh-en',
    source: '',
    target: '',
    settings: { ...DEFAULT_TRANSLATION_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 解析翻译文档 content JSON
 * 兼容 v1（segments 数组）、v2（扁平 source+target）、v3（含 settings）
 */
export function parseTranslationContent(content: string): TranslationDocumentContent | null {
  if (!content || !content.trim()) return null;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;

    const version = parsed.version || 1;

    // v1 兼容：segments 格式
    if (version === 1 && Array.isArray(parsed.segments)) {
      const now = new Date().toISOString();
      return {
        version: 3,
        direction: parsed.sourceLanguage === 'en' ? 'en-zh' : 'zh-en',
        source: parsed.segments.map((s: { source: string }) => s.source).join('\n\n'),
        target: parsed.segments.map((s: { target: string }) => s.target).join('\n\n'),
        settings: { ...DEFAULT_TRANSLATION_SETTINGS },
        createdAt: now,
        updatedAt: now,
      };
    }

    // v2 → v3 迁移
    if (version === 2) {
      return {
        version: 3,
        direction: parsed.direction || 'zh-en',
        source: parsed.source || '',
        target: parsed.target || '',
        settings: { ...DEFAULT_TRANSLATION_SETTINGS },
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }

    // v3 直接返回（确保 settings 完整）
    if (version === 3) {
      return {
        ...parsed,
        settings: { ...DEFAULT_TRANSLATION_SETTINGS, ...(parsed.settings || {}) },
      } as TranslationDocumentContent;
    }

    return null;
  } catch {
    return null;
  }
}

export function extractTranslationPlainText(content: string): string {
  const doc = parseTranslationContent(content);
  if (!doc) return content;
  return `${doc.source}\n\n---\n\n${doc.target}`;
}
