/**
 * DiaryEditor — 中栏编辑器包装
 *
 * 基于 MarkdownEditor，提供：
 * - 标题直接编辑（大字体输入框）
 * - 内容同步到 DiaryDocumentContent（debounced 300ms）
 * - 自动保存（5秒无操作）
 * - AI 插入事件监听
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { useTranslation } from '@/i18n';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';

interface DiaryEditorProps {
  entryId: string;
  title: string;
  content: string;
  host: DocTypeHostAPI;
  onChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  placeholder?: string;
}

export default function DiaryEditor({
  entryId, title, content, host: _host, onChange, onTitleChange, placeholder,
}: DiaryEditorProps) {
  const { t } = useTranslation();
  const [localTitle, setLocalTitle] = useState(title);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;

  // 条目切换时重置标题
  useEffect(() => {
    setLocalTitle(title);
  }, [entryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 标题同步（debounced 300ms，用 ref 避免回调引用变化重触发）
  useEffect(() => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onTitleChangeRef.current(localTitle);
      titleTimerRef.current = null;
    }, 300);
    return () => { if (titleTimerRef.current) clearTimeout(titleTimerRef.current); };
  }, [localTitle]);

  // 监听 AI 插入事件（直接通过 onChange 传递，不经过 localContent）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        onChangeRef.current(detail.text);
      }
    };
    window.addEventListener('doctype-insert-text', handler);
    return () => window.removeEventListener('doctype-insert-text', handler);
  }, []);

  // 内容变化直接传递给父组件（不再经过 localContent 中间层）
  const handleChange = useCallback((val: string) => {
    onChangeRef.current(val);
  }, []);

  // 用 useState 初始化捕获 content，后续 content prop 变化不再传播到 MarkdownEditor
  // 条目切换通过 key={activeEntry.id} 在父组件重新挂载 DiaryEditor 实现
  const [initialContent] = useState(content);

  return (
    <div className="flex flex-col h-full">
      {/* 标题输入框 */}
      <input
        className="w-full text-lg font-bold px-4 py-2 bg-transparent border-0 border-b border-border/30 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
        value={localTitle}
        onChange={e => setLocalTitle(e.target.value)}
        placeholder={t('diary.titlePlaceholder', { defaultValue: '条目标题...' })}
      />
      {/* 编辑器 */}
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={initialContent}
          onChange={handleChange}
          placeholder={placeholder || t('diary.editorPlaceholder', { defaultValue: '开始记录今天的故事...' })}
          showToolbar={true}
          showViewModeSwitch={true}
          showStatusBar={false}
          editorId={`diary-${entryId}`}
        />
      </div>
    </div>
  );
}
