import { EditorView, ViewPlugin, Decoration, WidgetType } from '@codemirror/view';
import i18n from '@/i18n';
import type { ViewUpdate, DecorationSet } from '@codemirror/view';

/**
 * 任务列表复选框 Widget：在编辑模式中将 `- [ ]` / `- [x]` 渲染为可点击的复选框
 */
class CheckboxWidget extends WidgetType {
  checked: boolean;
  constructor(checked: boolean) { super(); this.checked = checked; }

  eq(other: CheckboxWidget) { return this.checked === other.checked; }

  toDOM(view: EditorView) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-task-checkbox';
    input.setAttribute('aria-label', this.checked ? i18n.t('editor.taskCompleted', { defaultValue: '已完成' }) : i18n.t('editor.taskIncomplete', { defaultValue: '未完成' }));
    input.style.cssText = 'cursor:pointer;vertical-align:middle;margin:0 2px 0 0;pointer-events:auto;';
    input.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 阻止编辑器获得焦点变化
      // 找到此 widget 对应的文档位置并切换
      const pos = view.posAtDOM(input);
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const bracketIdx = text.indexOf(this.checked ? '[x]' : '[ ]');
      if (bracketIdx === -1) return;
      const from = line.from + bracketIdx;
      const to = from + 3;
      const replacement = this.checked ? '[ ]' : '[x]';
      view.dispatch({ changes: { from, to, insert: replacement } });
    });
    return input;
  }

  ignoreEvent() { return false; }
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: { from: number; widget: ReturnType<typeof Decoration.widget> }[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    // 匹配 `- [ ] ` 或 `- [x] `（支持行首空格缩进）
    const regex = /^(\s*[-*+]\s)\[( |x)\]\s/gm;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const checked = match[2] === 'x';
      const bracketStart = from + match.index + match[1].length;
      ranges.push({
        from: bracketStart,
        widget: Decoration.widget({
          widget: new CheckboxWidget(checked),
          side: -1,
        }),
      });
    }
  }

  // 按位置排序
  ranges.sort((a, b) => a.from - b.from);
  return Decoration.set(ranges.map(r => r.widget.range(r.from)));
}

export const checkboxWidgetExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
