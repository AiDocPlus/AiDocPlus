/**
 * 原文面板 — 支持 MD / HTML / DOCX-Viewer / PDF-Viewer 四种模式
 * 标题/作者/年代支持内联编辑；文件按钮在标题栏中
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Pencil, Check, Paperclip, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { RichTextEditor } from '../_shared/RichTextEditor';
import { EditorModeSwitcher } from '../_shared/EditorModeSwitcher';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '../_shared/formatConvert';
import { SourceOfficeViewer } from './SourceOfficeViewer';
import type { EditorMode, OfficeFileInfo } from './types';
import type { SourceViewMode } from './constants';

interface SourcePanelProps {
  text: string;
  onTextChange: (text: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode, converted?: string) => void;
  viewMode: SourceViewMode;
  onViewModeChange: (mode: SourceViewMode) => void;
  officeFile?: OfficeFileInfo;
  onOfficeFileChange: (file: OfficeFileInfo) => void;
  title?: string;
  author?: string;
  era?: string;
  onTitleChange?: (v: string) => void;
  onAuthorChange?: (v: string) => void;
  onEraChange?: (v: string) => void;
}

export function SourcePanel({
  text,
  onTextChange,
  editorMode,
  onEditorModeChange,
  viewMode,
  onViewModeChange,
  officeFile,
  onOfficeFileChange,
  title,
  author,
  era,
  onTitleChange,
  onAuthorChange,
  onEraChange,
}: SourcePanelProps) {
  const { t } = useTranslation();
  const [metaEditing, setMetaEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title || '');
  const [draftAuthor, setDraftAuthor] = useState(author || '');
  const [draftEra, setDraftEra] = useState(era || '');

  const handleModeSwitch = useCallback((newMode: EditorMode, converted?: string) => {
    onEditorModeChange(newMode, converted);
    if (converted !== undefined) onTextChange(converted);
    onViewModeChange(newMode);
  }, [onEditorModeChange, onTextChange, onViewModeChange]);

  const handleFileLoad = useCallback((path: string, name: string, type: 'docx' | 'pdf') => {
    onOfficeFileChange({ path, name, type });
    onViewModeChange(type === 'docx' ? 'docx-viewer' : 'pdf-viewer');
  }, [onOfficeFileChange, onViewModeChange]);

  // 直接在标题栏触发文件选择，无需进入 OfficeViewer 空状态后再点
  const handleOpenFileDialog = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Office 文档', extensions: ['docx', 'pdf'] }],
    });
    if (!selected) return;
    const path = typeof selected === 'string' ? selected : (selected as string[])[0];
    const namePart = path.split('/').pop() || path.split('\\').pop() || 'file';
    const ext = namePart.split('.').pop()?.toLowerCase() as 'docx' | 'pdf' | undefined;
    if (ext !== 'docx' && ext !== 'pdf') return;
    handleFileLoad(path, namePart, ext);
  }, [handleFileLoad]);

  // 文件按钮点击：有文件直接恢复视图，无文件直接弹对话框
  const handleFileButtonClick = useCallback(() => {
    if (officeFile?.path && officeFile?.type) {
      onViewModeChange(officeFile.type === 'docx' ? 'docx-viewer' : 'pdf-viewer');
    } else {
      handleOpenFileDialog();
    }
  }, [officeFile, onViewModeChange, handleOpenFileDialog]);

  const handleExtractText = useCallback((extracted: string) => {
    onTextChange(extracted);
    onViewModeChange(editorMode);
  }, [onTextChange, onViewModeChange, editorMode]);

  const handleMetaEdit = () => {
    setDraftTitle(title || '');
    setDraftAuthor(author || '');
    setDraftEra(era || '');
    setMetaEditing(true);
  };

  const handleMetaSave = () => {
    onTitleChange?.(draftTitle.trim());
    onAuthorChange?.(draftAuthor.trim());
    onEraChange?.(draftEra.trim());
    setMetaEditing(false);
  };

  const isOfficeMode = viewMode === 'docx-viewer' || viewMode === 'pdf-viewer';
  const editable = !!(onTitleChange || onAuthorChange);

  return (
    <div className="flex flex-col h-full overflow-hidden border-r">
      {/* ── 面板标题栏 ── */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 flex-shrink-0 min-h-[28px]">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

        {metaEditing ? (
          /* 元数据编辑状态 */
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              placeholder={t('imitativeWriting.source.titlePlaceholder', { defaultValue: '原文标题' })}
              title={t('imitativeWriting.source.titlePlaceholder', { defaultValue: '原文标题' })}
              aria-label={t('imitativeWriting.source.titlePlaceholder', { defaultValue: '原文标题' })}
              className="text-xs bg-background border rounded px-1.5 h-5 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleMetaSave(); if (e.key === 'Escape') setMetaEditing(false); }}
            />
            <input
              value={draftAuthor}
              onChange={e => setDraftAuthor(e.target.value)}
              placeholder={t('imitativeWriting.source.authorPlaceholder', { defaultValue: '作者' })}
              title={t('imitativeWriting.source.authorPlaceholder', { defaultValue: '作者' })}
              aria-label={t('imitativeWriting.source.authorPlaceholder', { defaultValue: '作者' })}
              className="text-xs bg-background border rounded px-1.5 h-5 w-16 flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-primary/50"
              onKeyDown={e => { if (e.key === 'Enter') handleMetaSave(); if (e.key === 'Escape') setMetaEditing(false); }}
            />
            <input
              value={draftEra}
              onChange={e => setDraftEra(e.target.value)}
              placeholder={t('imitativeWriting.source.eraPlaceholder', { defaultValue: '年代' })}
              title={t('imitativeWriting.source.eraPlaceholder', { defaultValue: '年代' })}
              aria-label={t('imitativeWriting.source.eraPlaceholder', { defaultValue: '年代' })}
              className="text-xs bg-background border rounded px-1.5 h-5 w-12 flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-primary/50"
              onKeyDown={e => { if (e.key === 'Enter') handleMetaSave(); if (e.key === 'Escape') setMetaEditing(false); }}
            />
            <button
              onClick={handleMetaSave}
              title={t('common.save', { defaultValue: '保存' })}
              className="flex-shrink-0 text-green-600 hover:text-green-700"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          /* 标题显示状态 */
          <>
            <span className="text-xs font-medium text-muted-foreground truncate flex-1 min-w-0">
              {title
                ? `${title}${author ? `  —  ${author}` : ''}${era ? `（${era}）` : ''}`
                : t('imitativeWriting.source.title', { defaultValue: '原文' })}
            </span>
            {editable && (
              <button
                onClick={handleMetaEdit}
                title={t('imitativeWriting.source.editMeta', { defaultValue: '编辑原文信息' })}
                className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}

        {!metaEditing && (
          <>
            <Separator orientation="vertical" className="h-4 flex-shrink-0" />

            {/* 文件按钮：在标题栏中，不再悬浮在内容区 */}
            {isOfficeMode ? (
              /* Office 预览模式 → 返回文本编辑 */
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-0.5 flex-shrink-0"
                onClick={() => onViewModeChange(editorMode)}
                title={t('imitativeWriting.source.backToEditor', { defaultValue: '返回文本编辑器' })}
              >
                <ArrowLeft className="h-3 w-3" />
                {t('imitativeWriting.source.backToEditor', { defaultValue: '返回编辑' })}
              </Button>
            ) : (
              /* 文本模式 → 有文件则恢复视图，无文件则弹对话框 */
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-0.5 flex-shrink-0"
                onClick={handleFileButtonClick}
                title={officeFile?.path
                  ? t('imitativeWriting.source.openFile', { defaultValue: '查看已加载文件' })
                  : t('imitativeWriting.source.openFile', { defaultValue: '打开 DOCX/PDF 文件' })}
              >
                <Paperclip className="h-3 w-3" />
                {officeFile?.path
                  ? officeFile.name || t('imitativeWriting.source.fileBtn', { defaultValue: '文件' })
                  : t('imitativeWriting.source.fileBtn', { defaultValue: '文件' })}
              </Button>
            )}

            {/* MD/HTML 模式切换（非 office 模式下显示） */}
            {!isOfficeMode && (
              <>
                <Separator orientation="vertical" className="h-4 flex-shrink-0" />
                <EditorModeSwitcher
                  mode={editorMode}
                  onModeChange={handleModeSwitch}
                  currentContent={text}
                  convertToHtml={convertMarkdownToHtml}
                  convertToMarkdown={convertHtmlToMarkdown}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 min-h-0 relative">
        {viewMode === 'markdown' && editorMode === 'markdown' && (
          <MarkdownEditor
            value={text}
            onChange={onTextChange}
            placeholder={t('imitativeWriting.source.placeholder', { defaultValue: '粘贴或输入原文...' })}
            showToolbar
            showViewModeSwitch
          />
        )}
        {viewMode === 'html' && editorMode === 'html' && (
          <RichTextEditor
            value={text}
            onChange={onTextChange}
            placeholder={t('imitativeWriting.source.placeholder', { defaultValue: '粘贴或输入原文...' })}
          />
        )}
        {isOfficeMode && (
          <SourceOfficeViewer
            filePath={officeFile?.path}
            fileName={officeFile?.name}
            fileType={officeFile?.type}
            viewMode={viewMode}
            onFileLoad={handleFileLoad}
            onExtractText={handleExtractText}
          />
        )}
      </div>
    </div>
  );
}
