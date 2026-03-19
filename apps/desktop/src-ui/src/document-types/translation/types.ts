/**
 * 翻译文档类型 — 内部数据结构
 * 简化为 source + target 双文本模型
 */

export interface TranslationDocumentContent {
  version: 2;
  direction: 'zh-en' | 'en-zh';
  source: string;
  target: string;
}

export function createEmptyTranslationContent(): TranslationDocumentContent {
  return {
    version: 2,
    direction: 'zh-en',
    source: '',
    target: '',
  };
}

export function parseTranslationContent(content: string): TranslationDocumentContent | null {
  if (!content || !content.trim()) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && (parsed.version === 2 || parsed.version === 1)) {
      // v1 兼容：如果是旧的 segments 格式，转换为 v2
      if (parsed.version === 1 && Array.isArray(parsed.segments)) {
        return {
          version: 2,
          direction: parsed.sourceLanguage === 'en' ? 'en-zh' : 'zh-en',
          source: parsed.segments.map((s: { source: string }) => s.source).join('\n\n'),
          target: parsed.segments.map((s: { target: string }) => s.target).join('\n\n'),
        };
      }
      return parsed as TranslationDocumentContent;
    }
    return null;
  } catch { return null; }
}

export function extractTranslationPlainText(content: string): string {
  const doc = parseTranslationContent(content);
  if (!doc) return content;
  return `${doc.source}\n\n---\n\n${doc.target}`;
}
