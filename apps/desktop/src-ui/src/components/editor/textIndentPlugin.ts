/**
 * 首行缩进插件 - CodeMirror 6
 *
 * 使用 ViewPlugin + Widget Decoration 在每个逻辑行开头插入不可见的 inline-block 空白元素，
 * 替代 CSS text-indent，彻底消除软换行时的闪烁问题。
 *
 * 原理：
 * - CodeMirror 内部 HeightOracle 用 Math.min(0, textIndent) 忽略正的 text-indent
 * - 导致行高估算与实际不匹配 → 输入时 DOM 重建 → 闪烁
 * - Widget Decoration 被 CodeMirror 完全感知，行高计算正确
 * - Widget 只出现在逻辑行首，软换行续行无 widget → 真正的首行缩进
 *
 * 使用 ViewPlugin 而非 StateField，避免 StateField.provide + EditorView.decorations
 * 在 reconfigure/文档变化时内部 map 旧 RangeSet 导致 RangeError。
 */
import { EditorView, Decoration, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, Facet } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";

/**
 * 首行缩进 Widget：渲染一个指定宽度的 inline-block 空白元素
 */
class IndentWidget extends WidgetType {
  indent: string;
  constructor(indent: string) {
    super();
    this.indent = indent;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.width = this.indent;
    span.style.pointerEvents = "none";
    span.style.userSelect = "none";
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  eq(other: IndentWidget): boolean {
    return this.indent === other.indent;
  }

  get estimatedHeight(): number {
    return -1;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// Facet 用于存储当前缩进值
const textIndentFacet = Facet.define<string, string>({
  combine: values => values[values.length - 1] || "0"
});

// 从 EditorView 构建 decorations
function buildDecorations(view: EditorView): DecorationSet {
  const indent = view.state.facet(textIndentFacet);
  if (!indent || indent === "0" || indent === "0em") {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const widget = new IndentWidget(indent);
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    builder.add(line.from, line.from, Decoration.widget({ widget, side: -1 }));
  }

  return builder.finish();
}

// ViewPlugin：完全控制 decoration 生命周期，不经过 map 路径
const textIndentViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // 文档变化或 facet 配置变化时重建
      if (update.docChanged || update.startState.facet(textIndentFacet) !== update.state.facet(textIndentFacet)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

/**
 * 首行缩进插件
 * @param indent 缩进值，如 "2em"、"32px"，默认为 "0"
 * @returns CodeMirror 扩展数组
 */
export function textIndentPlugin(indent: string = "0") {
  return [
    textIndentFacet.of(indent),
    textIndentViewPlugin,
  ];
}
