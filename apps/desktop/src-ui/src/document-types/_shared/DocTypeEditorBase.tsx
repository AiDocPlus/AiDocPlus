/**
 * DocTypeEditorBase — 文档类型统一编辑器基础组件
 *
 * 封装 MarkdownEditor，提供：
 * - 内容同步到 store（debounced 300ms）
 * - 自动保存（5秒无操作）
 * - AI 插入事件监听（doctype-insert-text）
 * - 统一状态栏样式（字数统计 + 自定义右侧内容）
 *
 * 各文档类型的编辑器组件通过包装此组件来复用通用逻辑。
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { useTranslation } from '@/i18n';
import { STATUS_BAR_CLASS } from './styles';

interface DocTypeEditorBaseProps {
  host: DocTypeEditorProps['host'];
  document: DocTypeEditorProps['document'];
  /** 编辑器占位符 */
  placeholder?: string;
  /** 是否显示工具栏（默认 true） */
  showToolbar?: boolean;
  /** 是否显示视图模式切换（默认 true） */
  showViewModeSwitch?: boolean;
  /** 是否显示状态栏（默认 true） */
  showStatusBar?: boolean;
  /** 状态栏右侧自定义内容（如文档类型标签） */
  statusBarRight?: ReactNode;
  /** 工具栏上方自定义内容 */
  toolbarAbove?: ReactNode;
  /** 编辑器上方自定义内容（工具栏和编辑器之间） */
  editorAbove?: ReactNode;
  /** 内容变化回调（传出当前内容） */
  onContentChange?: (content: string) => void;
}

export default function DocTypeEditorBase({
  host,
  document: doc,
  placeholder,
  showToolbar = true,
  showViewModeSwitch = true,
  showStatusBar = true,
  statusBarRight,
  toolbarAbove,
  editorAbove,
  onContentChange,
}: DocTypeEditorBaseProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState(doc.content || '');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 文档切换时重新加载内容
  useEffect(() => {
    const d = host.doc.getDocument();
    setContent(d.content || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // 内容同步到 store（debounced 300ms）
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      host.doc.updateInMemory({ content });
      host.doc.markDirty();
      syncTimerRef.current = null;
    }, 300);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [content, host.doc]);

  // 自动保存（5秒无操作）
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      host.doc.save();
      autoSaveTimerRef.current = null;
    }, 5000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [content, host.doc]);

  // 监听 AI 插入事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId === doc.id && detail?.text) {
        setContent(prev => prev + '\n\n' + detail.text);
      }
    };
    window.addEventListener('doctype-insert-text', handler);
    return () => window.removeEventListener('doctype-insert-text', handler);
  }, [doc.id]);

  const handleChange = useCallback((val: string) => {
    setContent(val);
    onContentChange?.(val);
  }, [onContentChange]);

  const wordCount = content.replace(/\s/g, '').length;

  return (
    <div className="h-full flex flex-col">
      {toolbarAbove}
      {editorAbove}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MarkdownEditor
          value={content}
          onChange={handleChange}
          placeholder={placeholder || t('docTypeChat.editorPlaceholder', { defaultValue: '开始撰写...' })}
          showToolbar={showToolbar}
          showViewModeSwitch={showViewModeSwitch}
          showStatusBar={false}
          editorId={`doctype-${doc.id}`}
        />
      </div>
      {showStatusBar && (
        <div className={STATUS_BAR_CLASS}>
          <span>{t('novelWorkspace.wordCount', { defaultValue: '{{count}} 字', count: wordCount })}</span>
          <div className="flex-1" />
          {statusBarRight}
        </div>
      )}
    </div>
  );
}
