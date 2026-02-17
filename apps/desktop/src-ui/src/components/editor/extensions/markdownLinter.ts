import { linter } from '@codemirror/lint';
import i18n from '@/i18n';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';

/**
 * Markdown 语法检查器
 * 检查规则：
 * 1. 标题层级跳跃（如 H1 直接跳到 H3）
 * 2. 重复标题（同级别出现完全相同的标题文本）
 * 3. 空链接（[text]() 或 [](url)）
 * 4. 未闭合的代码块（奇数个 ```）
 */
function markdownLintSource(view: EditorView): Diagnostic[] {
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');
  const diagnostics: Diagnostic[] = [];

  let pos = 0;
  let lastHeadingLevel = 0;
  let inCodeBlock = false;
  let codeBlockStart = -1;
  const headingsByLevel = new Map<number, { text: string; from: number }[]>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineFrom = pos;
    const lineTo = pos + line.length;

    // 跟踪代码块状态
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = lineFrom;
      } else {
        inCodeBlock = false;
        codeBlockStart = -1;
      }
      pos = lineTo + 1;
      continue;
    }

    // 代码块内不检查
    if (inCodeBlock) {
      pos = lineTo + 1;
      continue;
    }

    // 检查标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\s*#+\s*$/, '').trim();

      // 规则 1：标题层级跳跃
      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
        diagnostics.push({
          from: lineFrom,
          to: lineTo,
          severity: 'warning',
          message: i18n.t('editor.lint.headingLevelSkip', { defaultValue: '标题层级跳跃：从 H{{from}} 直接跳到 H{{to}}，建议使用 H{{suggest}}', from: lastHeadingLevel, to: level, suggest: lastHeadingLevel + 1 }),
          source: 'markdown-lint',
        });
      }
      lastHeadingLevel = level;

      // 规则 2：重复标题
      if (!headingsByLevel.has(level)) {
        headingsByLevel.set(level, []);
      }
      const siblings = headingsByLevel.get(level)!;
      const duplicate = siblings.find(h => h.text === headingText);
      if (duplicate) {
        diagnostics.push({
          from: lineFrom,
          to: lineTo,
          severity: 'info',
          message: i18n.t('editor.lint.duplicateHeading', { defaultValue: '重复标题：与第 {{line}} 行的同级标题内容相同', line: doc.lineAt(duplicate.from).number }),
          source: 'markdown-lint',
        });
      }
      siblings.push({ text: headingText, from: lineFrom });
    }

    // 规则 3：空链接
    // [text]() — 空 URL
    const emptyUrlRegex = /\[([^\]]+)\]\(\s*\)/g;
    let emptyUrlMatch;
    while ((emptyUrlMatch = emptyUrlRegex.exec(line)) !== null) {
      diagnostics.push({
        from: lineFrom + emptyUrlMatch.index,
        to: lineFrom + emptyUrlMatch.index + emptyUrlMatch[0].length,
        severity: 'warning',
        message: i18n.t('editor.lint.emptyLinkUrl', { defaultValue: '空链接：URL 为空' }),
        source: 'markdown-lint',
      });
    }
    // [](url) — 空文本
    const emptyTextRegex = /\[\s*\]\([^)]+\)/g;
    let emptyTextMatch;
    while ((emptyTextMatch = emptyTextRegex.exec(line)) !== null) {
      // 排除图片语法 ![](url)
      const charBefore = emptyTextMatch.index > 0 ? line[emptyTextMatch.index - 1] : '';
      if (charBefore === '!') continue;
      diagnostics.push({
        from: lineFrom + emptyTextMatch.index,
        to: lineFrom + emptyTextMatch.index + emptyTextMatch[0].length,
        severity: 'warning',
        message: i18n.t('editor.lint.emptyLinkText', { defaultValue: '空链接：链接文本为空' }),
        source: 'markdown-lint',
      });
    }

    pos = lineTo + 1;
  }

  // 规则 4：未闭合的代码块
  if (inCodeBlock && codeBlockStart >= 0) {
    diagnostics.push({
      from: codeBlockStart,
      to: Math.min(codeBlockStart + 3, doc.length),
      severity: 'error',
      message: i18n.t('editor.lint.unclosedCodeBlock', { defaultValue: '未闭合的代码块：缺少结束的 ```' }),
      source: 'markdown-lint',
    });
  }

  return diagnostics;
}

export const markdownLinterExtension = linter(markdownLintSource, {
  delay: 500, // 输入后 500ms 再检查，避免频繁触发
});
