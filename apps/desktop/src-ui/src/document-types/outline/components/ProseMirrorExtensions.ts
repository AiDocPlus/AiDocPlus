/**
 * ProseMirror / TipTap 自定义扩展
 *
 * 独立文件：TagMark、MentionMark、ColorHighlightMark、PreventEnter
 * 与组件文件分离，符合 react-refresh/only-export-components 规则。
 */

import { Mark, mergeAttributes, InputRule, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
// EditorView 类型仅用于 handleKeyDown 参数，不需要显式引用变量

// ═══════════════════════════════════════════════════════════════════════════════
// 自定义扩展：标签（#标签）
// ═══════════════════════════════════════════════════════════════════════════════

export const TagMark = Mark.create({
  name: 'tag',

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-name'),
        renderHTML: (attributes) => {
          if (!attributes.name) return {};
          return {
            'data-tag-name': attributes.name,
            class: 'outline-tag hash',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-tag-name]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes),
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /#([^\s#@$%^&*(){}[\]\\;:'",.<>/?!`~|+=]+)$/,
        handler: ({ range, match, chain }) => {
          const tagName = match[1];
          if (tagName.length > 0) {
            chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: 'text',
                text: `#${tagName}`,
                marks: [{ type: 'tag', attrs: { name: tagName } }],
              })
              .run();
          }
        },
      }),
    ];
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 自定义扩展：提及（@提及）
// ═══════════════════════════════════════════════════════════════════════════════

export const MentionMark = Mark.create({
  name: 'mention',

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mention-name'),
        renderHTML: (attributes) => {
          if (!attributes.name) return {};
          return {
            'data-mention-name': attributes.name,
            class: 'outline-tag mention',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-name]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes),
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /@([^\s#@$%^&*(){}[\]\\;:'",.<>/?!`~|+=]+)$/,
        handler: ({ range, match, chain }) => {
          const mentionName = match[1];
          if (mentionName.length > 0) {
            chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: 'text',
                text: `@${mentionName}`,
                marks: [{ type: 'mention', attrs: { name: mentionName } }],
              })
              .run();
          }
        },
      }),
    ];
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 自定义扩展：颜色高亮（支持多种颜色）
// ═══════════════════════════════════════════════════════════════════════════════

export const ColorHighlightMark = Mark.create({
  name: 'colorHighlight',

  addAttributes() {
    return {
      color: {
        default: '#fef3c7',
        parseHTML: (element) => element.getAttribute('data-highlight-color'),
        renderHTML: (attributes) => {
          return {
            'data-highlight-color': attributes.color,
            style: `background-color: ${attributes.color}`,
            class: 'outline-highlight',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-highlight-color]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes),
      0,
    ];
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 阻止换行的扩展（Enter 键由父组件处理）
// ═══════════════════════════════════════════════════════════════════════════════

export const PreventEnter = Extension.create({
  name: 'preventEnter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('preventEnter'),
        handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
          // 中文等 IME 组字/选词期间勿拦截 Enter、Tab，否则选词确认失败并出现 yyo… 类乱码
          if (event.isComposing || event.keyCode === 229) return false;
          if (event.key === 'Enter') {
            return true;
          }
          if (event.key === 'Tab') {
            return true;
          }
          return false;
        },
      }),
    ];
  },
});
