/**
 * DiaryEditor — 中栏编辑器包装
 *
 * 基于 MarkdownEditor，提供：
 * - 内容同步到 DiaryDocumentContent
 * - 自动保存由父组件 DiaryDocWorkspace 负责
 * - AI 插入事件监听
 */
import { useEffect, useRef, useCallback } from 'react';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { useTranslation } from '@/i18n';

interface DiaryEditorProps {
  entryId: string;
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  textIndent?: boolean;
}

export default function DiaryEditor({
  entryId, content, onChange, placeholder, textIndent = false,
}: DiaryEditorProps) {
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 监听 AI 插入事件（仅处理当前 entryId 的插入）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text && detail?.targetId === entryId) {
        onChangeRef.current(detail.text);
      }
    };
    window.addEventListener('doctype-insert-text', handler);
    return () => window.removeEventListener('doctype-insert-text', handler);
  }, [entryId]);

  const handleChange = useCallback((val: string) => {
    onChangeRef.current(val);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={content}
          onChange={handleChange}
          placeholder={placeholder || t('diary.editorPlaceholder', { defaultValue: '开始记录今天的故事...' })}
          showToolbar={true}
          showViewModeSwitch={true}
          showStatusBar={false}
          editorId={`diary-${entryId}`}
          textIndent={textIndent}
        />
      </div>
    </div>
  );
}
