/**
 * novelEditorExtensions.ts — 小说编辑器 CodeMirror 扩展
 *
 * - 对话聚焦（Linguistic Focus）：高亮「」""内的对话，其余文本半透明
 * - 叙述聚焦：反向，高亮叙述，对话半透明
 */

import { ViewPlugin, Decoration, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export type LinguisticFocus = 'off' | 'dialogue' | 'narration';

const dimClass = Decoration.mark({ class: 'novel-linguistic-dim' });

// 匹配对话文本：「...」 "..." "..."
const DIALOGUE_REGEX = /[「「]([^」」]*)[」」]|[""]([^""]*)[""]/g;

function buildDecorations(view: EditorView, mode: LinguisticFocus): DecorationSet {
  if (mode === 'off') return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const text = doc.toString();

  if (mode === 'dialogue') {
    // 对话聚焦：非对话部分 dim
    let lastEnd = 0;
    const regex = new RegExp(DIALOGUE_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // dim 对话之前的非对话文本
      if (match.index > lastEnd) {
        builder.add(lastEnd, match.index, dimClass);
      }
      lastEnd = match.index + match[0].length;
    }
    // dim 最后一段对话之后的文本
    if (lastEnd < text.length) {
      builder.add(lastEnd, text.length, dimClass);
    }
  } else if (mode === 'narration') {
    // 叙述聚焦：对话部分 dim
    const regex = new RegExp(DIALOGUE_REGEX.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      builder.add(match.index, match.index + match[0].length, dimClass);
    }
  }

  return builder.finish();
}

/**
 * 创建对话/叙述聚焦扩展
 * 使用方式：将此扩展添加到 CodeMirror 的 extensions 数组中
 * CSS 需要定义 .novel-linguistic-dim { opacity: 0.25; }
 */
export function linguisticFocusPlugin(getMode: () => LinguisticFocus) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getMode());
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, getMode());
        }
      }
    },
    { decorations: v => v.decorations }
  );
}
