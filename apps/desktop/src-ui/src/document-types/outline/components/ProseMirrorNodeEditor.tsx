/**
 * 富文本节点编辑器
 *
 * 基于 TipTap (ProseMirror) 实现的富文本编辑器
 * 支持：加粗、斜体、下划线、删除线、颜色高亮、内联标签
 */

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type ForwardedRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';

import type { RichTextContent } from '../types';
import { extractTagsFromContent } from '../types';

import {
  TagMark,
  MentionMark,
  ColorHighlightMark,
  PreventEnter,
} from './ProseMirrorExtensions';

// 重新导出扩展，供外部直接从本文件引用（向后兼容）
export type { TagMark as TagMarkType } from './ProseMirrorExtensions';
export { TagMark, MentionMark, ColorHighlightMark } from './ProseMirrorExtensions';

// ═══════════════════════════════════════════════════════════════════════════════
// 工具函数：TipTap JSON <-> RichTextContent 转换
// ═══════════════════════════════════════════════════════════════════════════════

interface TipTapDoc {
  content?: TipTapNode[];
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
  marks?: TipTapMark[];
}

function tipTapToRichTextContent(doc: TipTapDoc): RichTextContent {
  if (!doc || !doc.content) {
    return { type: 'doc', content: [] };
  }

  const paragraphs = doc.content.map((node) => {
    if (node.type !== 'paragraph') {
      return { type: 'paragraph' as const, content: [] };
    }

    if (!node.content) {
      return { type: 'paragraph' as const, content: [] };
    }

    const content = node.content.map((child) => {
      if (child.type === 'text') {
        const marks = child.marks?.map((mark) => {
          if (mark.type === 'tag') {
            return {
              type: 'tag' as const,
              attrs: { name: (mark.attrs?.name as string) || '', type: 'hash' as const },
            };
          }
          if (mark.type === 'mention') {
            return {
              type: 'tag' as const,
              attrs: { name: (mark.attrs?.name as string) || '', type: 'mention' as const },
            };
          }
          return {
            type: mark.type as 'bold' | 'italic' | 'underline' | 'strike' | 'highlight',
            attrs: mark.attrs?.color ? { color: mark.attrs.color as string } : undefined,
          };
        });

        const textNode: {
          type: 'text';
          text: string;
          marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
        } = {
          type: 'text' as const,
          text: child.text || '',
        };
        if (marks && marks.length > 0) {
          const nonTagMarks = marks.filter((m) => m.type !== 'tag');
          if (nonTagMarks.length > 0) {
            textNode.marks = nonTagMarks;
          }
        }

        return textNode;
      }

      return null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return { type: 'paragraph' as const, content };
  });

  return { type: 'doc', content: paragraphs };
}

function richTextContentToTipTap(content: RichTextContent): TipTapDoc {
  if (!content.content || content.content.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const paragraphs = content.content.map((p) => {
    if (!p.content || p.content.length === 0) {
      return { type: 'paragraph' };
    }

    const contentNodes = p.content.map((node) => {
      if (node.type === 'text') {
        return {
          type: 'text',
          text: node.text,
          marks: node.marks?.map((mark) => ({
            type: mark.type,
            attrs: mark.attrs,
          })),
        };
      }
      if (node.type === 'tag') {
        return {
          type: 'text',
          text: node.attrs.type === 'hash' ? `#${node.attrs.name}` : `@${node.attrs.name}`,
          marks: [{
            type: node.attrs.type === 'hash' ? 'tag' : 'mention',
            attrs: { name: node.attrs.name },
          }],
        };
      }
      return null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return { type: 'paragraph', content: contentNodes };
  });

  return { type: 'doc', content: paragraphs };
}

function extractPlainTextFromTipTap(doc: TipTapDoc): string {
  if (!doc || !doc.content) return '';

  return doc.content
    .map((node) => {
      if (node.type !== 'paragraph' || !node.content) return '';
      return node.content
        .map((child) => {
          if (child.type === 'text') return child.text || '';
          return '';
        })
        .join('');
    })
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 编辑器属性接口
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProseMirrorNodeEditorRef {
  getEditor: () => ReturnType<typeof useEditor>;
  focus: () => void;
  blur: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  setHighlight: (color: string | null) => void;
  clearFormat: () => void;
}

interface ProseMirrorNodeEditorProps {
  content: RichTextContent;
  placeholder?: string;
  isActive: boolean;
  completed?: boolean;
  onChange: (content: RichTextContent, plainText: string, tags: string[], mentions: string[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent) => boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════════════════

export const ProseMirrorNodeEditor = forwardRef(function ProseMirrorNodeEditor(
  {
    content,
    placeholder,
    isActive,
    completed = false,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    className,
  }: ProseMirrorNodeEditorProps,
  ref: ForwardedRef<ProseMirrorNodeEditorRef>
) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const isInternalChange = useRef(false);
    const lastAppliedContentJsonRef = useRef<string | null>(null);
    /** IME 组字中：勿把中间态 onChange 到父级，避免反复 setState 与乱码 */
    const composingRef = useRef(false);

    // 创建编辑器
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          dropcursor: false,
          gapcursor: false,
          /** StarterKit 默认包含 Underline，需关闭后再单独注册，否则会重复 */
          underline: false,
        }),
        Underline,
        ColorHighlightMark,
        TagMark,
        MentionMark,
        Placeholder.configure({
          placeholder: placeholder || t('outline.nodePlaceholder', { defaultValue: '输入内容...' }),
        }),
        PreventEnter,
      ],
      content: richTextContentToTipTap(content),
      editorProps: {
        attributes: {
          class: cn(
            'prose-mirror-node-editor outline-none w-full',
            completed && 'line-through text-muted-foreground',
            className
          ),
          spellcheck: 'false',
        },
        handleDOMEvents: {
          compositionstart: () => {
            composingRef.current = true;
            return false;
          },
          compositionend: () => {
            composingRef.current = false;
            return false;
          },
        },
        handleKeyDown: (view, event) => {
          if (view.composing || event.isComposing || event.keyCode === 229) {
            return false;
          }
          if (onKeyDown) {
            const handled = onKeyDown(event);
            if (handled) {
              event.stopPropagation();
              event.stopImmediatePropagation();
            }
            return handled;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (isInternalChange.current) return;
        if (ed.view.composing || composingRef.current) return;

        const doc = ed.getJSON() as TipTapDoc;
        const newContent = tipTapToRichTextContent(doc);
        const plainText = extractPlainTextFromTipTap(doc);
        const { tags, mentions } = extractTagsFromContent(newContent);

        onChange(newContent, plainText, tags, mentions);
      },
      onFocus: () => {
        onFocus?.();
      },
      onBlur: () => {
        onBlur?.();
      },
    });

    // 外部内容变更时同步
    useEffect(() => {
      if (editor && !isActive) {
        if (editor.view.composing || composingRef.current) return;

        // content 往往是新对象引用；这里按 JSON 做内容级去重，避免 setContent 引发 transaction 循环
        const nextJson = JSON.stringify(richTextContentToTipTap(content));
        if (lastAppliedContentJsonRef.current === nextJson) return;
        lastAppliedContentJsonRef.current = nextJson;

        isInternalChange.current = true;
        editor.commands.setContent(JSON.parse(nextJson) as TipTapDoc);
        isInternalChange.current = false;
      }
    }, [content, isActive, editor]);

    // 暴露方法
    useImperativeHandle(ref, () => ({
      getEditor: () => editor,
      focus: () => editor?.commands.focus(),
      blur: () => editor?.commands.blur(),
      toggleBold: () => editor?.chain().focus().toggleBold().run(),
      toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
      toggleUnderline: () => editor?.chain().focus().toggleUnderline().run(),
      toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
      setHighlight: (color: string | null) => {
        if (color) {
          editor?.chain().focus().setMark('colorHighlight', { color }).run();
        } else {
          editor?.chain().focus().unsetMark('colorHighlight').run();
        }
      },
      clearFormat: () => {
        editor?.chain()
          .focus()
          .unsetAllMarks()
          .clearNodes()
          .run();
      },
    }), [editor]);

    // 自动聚焦
    useEffect(() => {
      if (isActive && editor) {
        editor.commands.focus();
      }
    }, [isActive, editor]);

    return (
      <div ref={containerRef} className="w-full min-w-0">
        <EditorContent editor={editor} />
      </div>
    );
  }
);

export default ProseMirrorNodeEditor;
