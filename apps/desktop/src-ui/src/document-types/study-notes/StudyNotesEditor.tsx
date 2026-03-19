/**
 * StudyNotesEditor — 学习体会编辑器
 * 使用平台标准 MarkdownEditor，layoutMode='standard' 由 DocumentWorkspace 处理右侧面板
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { useTranslation } from '@/i18n';

export default function StudyNotesEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState(doc.content || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 文档切换时重新加载
  useEffect(() => {
    const d = host.doc.getDocument();
    setContent(d.content || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // 内容同步到 store（debounced）
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      host.doc.updateInMemory({ content });
      host.doc.markDirty();
      timerRef.current = null;
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content, host.doc]);

  // 自动保存（5秒无操作）
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      host.doc.save();
      autoSaveRef.current = null;
    }, 5000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
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

  const handleChange = useCallback((val: string) => setContent(val), []);

  const wordCount = content.replace(/\s/g, '').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <MarkdownEditor
          value={content}
          onChange={handleChange}
          placeholder={t('studyNotes.placeholder', { defaultValue: '开始撰写学习体会...' })}
        />
      </div>
      <div className="flex items-center justify-between px-3 py-1 border-t text-xs text-muted-foreground flex-shrink-0 bg-card">
        <span>{t('novelWorkspace.wordCount', { defaultValue: '{{count}} 字', count: wordCount })}</span>
        <span>{t('docType.studyNotes', { defaultValue: '学习体会' })}</span>
      </div>
    </div>
  );
}
