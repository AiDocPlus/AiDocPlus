/**
 * 仿写文档工作区 — 四栏布局
 * 笔记栏(可折叠) | 原文栏 | 仿写栏 | AI侧栏(可折叠)
 */
import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';

const VersionHistoryPanel = lazy(() => import('@/components/version/VersionHistoryPanel'));
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import {
  parseImitativeWritingContent,
  type ImitativeWritingContent,
  type EditorMode,
  type WritingGenre,
  type OfficeFileInfo,
  type ImitationDraft,
  type ImitationSettings,
} from './types';
import {
  NOTES_DEFAULT_WIDTH, NOTES_MIN_WIDTH, NOTES_MAX_WIDTH,
  AI_DEFAULT_WIDTH, AI_MIN_WIDTH, AI_MAX_WIDTH,
  type LayoutMode,
} from './constants';
import type { SourceViewMode } from './constants';
import { ImitativeWritingToolbar } from './ImitativeWritingToolbar';
import { ImitativeWritingStatusBar } from './ImitativeWritingStatusBar';
import { SourcePanel } from './SourcePanel';
import { ImitationPanel } from './ImitationPanel';
import { NotesPanel } from './NotesPanel';
import { ImitativeWritingAISidebar } from './ImitativeWritingAISidebar';

const SAVE_DEBOUNCE_MS = 600;

export default function ImitativeWritingWorkspace({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const { saveDocument, updateDocumentInMemory, markTabAsClean } = useAppStore(useShallow(s => ({
    saveDocument: s.saveDocument,
    updateDocumentInMemory: s.updateDocumentInMemory,
    markTabAsClean: s.markTabAsClean,
  })));

  // ── 文档内容状态 ──
  const [docContent, setDocContent] = useState<ImitativeWritingContent>(() =>
    parseImitativeWritingContent(doc.content || '{}')
  );

  // ── 布局状态 ──
  const [notesWidth, setNotesWidth] = useState(NOTES_DEFAULT_WIDTH);
  const [aiWidth, setAiWidth] = useState(AI_DEFAULT_WIDTH);
  const [notesOpen, setNotesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('three-col');

  // ── 中间分栏尺寸（null = flex等分；set = 固定像素） ──
  const [sourceWidthPx, setSourceWidthPx] = useState<number | null>(null);
  const [sourceHeightPx, setSourceHeightPx] = useState<number | null>(null);
  const sourcePanelRef = useRef<HTMLDivElement>(null);

  const handleMiddleHResize = useCallback((d: number) => {
    setSourceWidthPx(prev => {
      const base = prev ?? (sourcePanelRef.current?.offsetWidth ?? 400);
      return Math.max(150, base + d);
    });
  }, []);

  const handleMiddleVResize = useCallback((d: number) => {
    setSourceHeightPx(prev => {
      const base = prev ?? (sourcePanelRef.current?.offsetHeight ?? 300);
      return Math.max(80, base + d);
    });
  }, []);

  // ── 布局模式联动面板可见性 ──
  useEffect(() => {
    if (layoutMode === 'four-col') {
      setNotesOpen(true);
      setAiOpen(true);
    } else if (layoutMode === 'three-col') {
      setNotesOpen(false);
      setAiOpen(true);
    } else if (layoutMode === 'focus-write') {
      setNotesOpen(false);
    } else if (layoutMode === 'focus-read') {
      setNotesOpen(true);
    }
  }, [layoutMode]);

  // ── 原文视图模式 ──
  const [sourceViewMode, setSourceViewMode] = useState<SourceViewMode>('markdown');

  // ── Office 文件状态 ──
  const [officeFile, setOfficeFile] = useState<OfficeFileInfo | undefined>(
    () => docContent.source.officeFile
  );

  // ── 保存状态 ──
  const [saved, setSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const debouncedSave = useCallback((content: ImitativeWritingContent) => {
    const json = JSON.stringify(content);
    setSaved(false);
    pendingContentRef.current = json;
    updateDocumentInMemory(doc.id, { content: json });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const latest = useAppStore.getState().documents.find(d => d.id === doc.id);
      if (latest) saveDocument(latest);
      pendingContentRef.current = null;
      setSaved(true);
    }, SAVE_DEBOUNCE_MS);
  }, [saveDocument, updateDocumentInMemory, doc.id]);

  // ── 立即保存（刷新 debounce） ──
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      const latest = useAppStore.getState().documents.find(d => d.id === doc.id);
      if (latest) await saveDocument(latest);
      pendingContentRef.current = null;
      setSaved(true);
      // 标记 tab 已保存
      const activeTab = useAppStore.getState().tabs.find(t => t.documentId === doc.id);
      if (activeTab) markTabAsClean(activeTab.id);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, saveDocument, doc.id, markTabAsClean]);

  // ── 全部保存 ──
  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await handleSave();
      const { tabs: allTabs, documents: allDocs } = useAppStore.getState();
      for (const tab of allTabs) {
        if (tab.documentId === doc.id || !tab.isDirty) continue;
        const d = allDocs.find(d => d.id === tab.documentId);
        if (d) { await saveDocument(d); markTabAsClean(tab.id); }
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, handleSave, saveDocument, doc.id, markTabAsClean]);

  const handleVersionHistory = useCallback(() => setVersionHistoryOpen(true), []);

  // ── 键盘快捷键 & 全局事件监听 ──
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleSaveAllRef = useRef(handleSaveAll);
  handleSaveAllRef.current = handleSaveAll;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isActive = useAppStore.getState().tabs.find(t => t.documentId === doc.id)?.id
        === useAppStore.getState().activeTabId;
      if (!isActive) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); handleSaveRef.current(); }
      if (mod && e.key === 's' && e.shiftKey) { e.preventDefault(); handleSaveAllRef.current(); }
    };
    const onSave = () => {
      const isActive = useAppStore.getState().tabs.find(t => t.documentId === doc.id)?.id
        === useAppStore.getState().activeTabId;
      if (isActive) handleSaveRef.current();
    };
    const onSaveAll = () => {
      const isActive = useAppStore.getState().tabs.find(t => t.documentId === doc.id)?.id
        === useAppStore.getState().activeTabId;
      if (isActive) handleSaveAllRef.current();
    };
    const onVersionHistory = () => {
      const isActive = useAppStore.getState().tabs.find(t => t.documentId === doc.id)?.id
        === useAppStore.getState().activeTabId;
      if (isActive) setVersionHistoryOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('save-active-tab', onSave);
    window.addEventListener('save-all-tabs', onSaveAll);
    window.addEventListener('editor-version-history', onVersionHistory);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('save-active-tab', onSave);
      window.removeEventListener('save-all-tabs', onSaveAll);
      window.removeEventListener('editor-version-history', onVersionHistory);
    };
  }, [doc.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingContentRef.current) {
        updateDocumentInMemory(doc.id, { content: pendingContentRef.current });
        const latest = useAppStore.getState().documents.find(d => d.id === doc.id);
        if (latest) saveDocument(latest);
      }
    };
  }, [saveDocument, updateDocumentInMemory, doc.id]);

  // ── 内容更新工具函数 ──
  // 用 ref 追踪最新 docContent，避免在 state updater 内执行副作用（debouncedSave），
  // 从而防止 updateDocumentInMemory 在渲染阶段触发 FileTree 重渲染
  const docContentRef = useRef(docContent);
  docContentRef.current = docContent;

  const updateDoc = useCallback((updater: (prev: ImitativeWritingContent) => ImitativeWritingContent) => {
    const next = updater(docContentRef.current);
    setDocContent(next);
    docContentRef.current = next;
    debouncedSave(next);
  }, [debouncedSave]);

  // ── 原文元数据变更 ──
  const handleSourceTitleChange = useCallback((title: string) => {
    updateDoc(prev => ({ ...prev, source: { ...prev.source, title } }));
  }, [updateDoc]);

  const handleSourceAuthorChange = useCallback((author: string) => {
    updateDoc(prev => ({ ...prev, source: { ...prev.source, author } }));
  }, [updateDoc]);

  const handleSourceEraChange = useCallback((era: string) => {
    updateDoc(prev => ({ ...prev, source: { ...prev.source, era } }));
  }, [updateDoc]);

  // ── 原文内容变更 ──
  const handleSourceTextChange = useCallback((text: string) => {
    updateDoc(prev => ({ ...prev, source: { ...prev.source, text } }));
  }, [updateDoc]);

  const handleSourceEditorModeChange = useCallback((mode: EditorMode, converted?: string) => {
    updateDoc(prev => ({
      ...prev,
      source: {
        ...prev.source,
        editorMode: mode,
        text: converted !== undefined ? converted : prev.source.text,
      },
    }));
    setSourceViewMode(mode);
  }, [updateDoc]);

  // ── 仿写内容变更 ──
  const handleImitationTextChange = useCallback((text: string) => {
    updateDoc(prev => ({ ...prev, imitation: { ...prev.imitation, text } }));
  }, [updateDoc]);

  const handleImitationEditorModeChange = useCallback((mode: EditorMode, converted?: string) => {
    updateDoc(prev => ({
      ...prev,
      imitation: {
        ...prev.imitation,
        editorMode: mode,
        text: converted !== undefined ? converted : prev.imitation.text,
      },
    }));
  }, [updateDoc]);

  // ── 草稿保存 ──
  const handleSaveDraft = useCallback((draft: ImitationDraft) => {
    updateDoc(prev => ({
      ...prev,
      imitation: { ...prev.imitation, drafts: [draft, ...(prev.imitation.drafts || [])] },
    }));
  }, [updateDoc]);

  const handleRestoreDraft = useCallback((text: string, editorMode: EditorMode) => {
    updateDoc(prev => ({
      ...prev,
      imitation: { ...prev.imitation, text, editorMode },
    }));
  }, [updateDoc]);

  // ── 仿写设置变更 ──
  const handleSettingsChange = useCallback((settings: ImitationSettings) => {
    updateDoc(prev => ({ ...prev, settings }));
  }, [updateDoc]);

  // ── Office 文件变更 ──
  const handleOfficeFileChange = useCallback((file: OfficeFileInfo) => {
    setOfficeFile(file);
    updateDoc(prev => ({
      ...prev,
      source: { ...prev.source, officeFile: file },
    }));
  }, [updateDoc]);

  // ── 笔记变更 ──
  const handleNotesChange = useCallback((notes: ImitativeWritingContent['notes']) => {
    updateDoc(prev => ({ ...prev, notes }));
  }, [updateDoc]);

  // ── AI 保存笔记 ──
  const handleSaveNote = useCallback((note: ImitativeWritingContent['notes'][number]) => {
    updateDoc(prev => ({ ...prev, notes: [...prev.notes, note] }));
  }, [updateDoc]);

  // ── AI 插入仿写 ──
  const handleInsertToImitation = useCallback((text: string) => {
    updateDoc(prev => ({
      ...prev,
      imitation: {
        ...prev.imitation,
        text: prev.imitation.text ? `${prev.imitation.text}\n\n${text}` : text,
      },
    }));
  }, [updateDoc]);

  // ── 体裁变更 ──
  const handleGenreChange = useCallback((genre: WritingGenre) => {
    updateDoc(prev => ({ ...prev, genre }));
  }, [updateDoc]);

  // ── 布局计算 ──
  const showNotes = notesOpen;
  const showAi = aiOpen;
  const isTopBottom = layoutMode === 'top-bottom';
  const focusWrite = layoutMode === 'focus-write';
  const focusRead = layoutMode === 'focus-read';

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* 工具栏 */}
      <ImitativeWritingToolbar
        genre={docContent.genre}
        onGenreChange={handleGenreChange}
        layoutMode={layoutMode}
        docContent={docContent}
        docTitle={doc.title || '仿写练习'}
        onLayoutModeChange={setLayoutMode}
        saved={saved}
        isSaving={isSaving}
        onSave={handleSave}
        onSaveAll={handleSaveAll}
        onVersionHistory={handleVersionHistory}
      />

      {/* 主内容区 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* 笔记栏折叠按钮（始终可见） */}
        <div className="flex flex-col items-center justify-start pt-2 px-0.5 bg-muted/10 border-r flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setNotesOpen(o => !o)}
            title={notesOpen
              ? t('imitativeWriting.notes.collapse', { defaultValue: '折叠笔记栏' })
              : t('imitativeWriting.notes.expand', { defaultValue: '展开笔记栏' })}
          >
            {notesOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>

        {/* 笔记栏 */}
        {showNotes && (
          <>
            {/* eslint-disable-next-line react/forbid-component-props */}
            <div
              className="flex flex-col h-full overflow-hidden border-r bg-muted/5 flex-shrink-0"
              style={{ width: notesWidth }}
            >
              <NotesPanel
                notes={docContent.notes}
                onNotesChange={handleNotesChange}
              />
            </div>
            <ResizableHandle
              direction="horizontal"
              onResize={(d) => setNotesWidth(w => Math.min(NOTES_MAX_WIDTH, Math.max(NOTES_MIN_WIDTH, w + d)))}
            />
          </>
        )}

        {/* 中间编辑区 */}
        {isTopBottom ? (
          /* 上下布局 */
          <div className="flex flex-col flex-1 min-w-0">
            {/* eslint-disable-next-line react/forbid-component-props */}
            <div
              ref={sourcePanelRef}
              className={sourceHeightPx !== null ? 'flex-shrink-0 overflow-hidden' : 'flex-1 min-h-0'}
              style={sourceHeightPx !== null ? { height: sourceHeightPx } : undefined}
            >
              {!focusWrite && (
                <SourcePanel
                  text={docContent.source.text}
                  onTextChange={handleSourceTextChange}
                  editorMode={docContent.source.editorMode}
                  onEditorModeChange={handleSourceEditorModeChange}
                  viewMode={sourceViewMode}
                  onViewModeChange={setSourceViewMode}
                  officeFile={officeFile}
                  onOfficeFileChange={handleOfficeFileChange}
                  title={docContent.source.title}
                  author={docContent.source.author}
                  era={docContent.source.era}
                  onTitleChange={handleSourceTitleChange}
                  onAuthorChange={handleSourceAuthorChange}
                  onEraChange={handleSourceEraChange}
                />
              )}
            </div>
            <ResizableHandle direction="vertical" onResize={handleMiddleVResize} />
            <div className="flex-1 min-h-0">
              {!focusRead && (
                <ImitationPanel
                  text={docContent.imitation.text}
                  onTextChange={handleImitationTextChange}
                  editorMode={docContent.imitation.editorMode}
                  onEditorModeChange={handleImitationEditorModeChange}
                  drafts={docContent.imitation.drafts}
                  onSaveDraft={handleSaveDraft}
                  onRestoreDraft={handleRestoreDraft}
                  settings={docContent.settings}
                  onSettingsChange={handleSettingsChange}
                />
              )}
            </div>
          </div>
        ) : (
          /* 左右布局 */
          <div className="flex flex-1 min-w-0 overflow-hidden">
            {!focusWrite && (
              /* eslint-disable-next-line react/forbid-component-props */
              <div
                ref={sourcePanelRef}
                className={sourceWidthPx !== null ? 'flex-shrink-0 overflow-hidden' : 'flex-1 min-w-0 overflow-hidden'}
                style={sourceWidthPx !== null ? { width: sourceWidthPx } : undefined}
              >
                <SourcePanel
                  text={docContent.source.text}
                  onTextChange={handleSourceTextChange}
                  editorMode={docContent.source.editorMode}
                  onEditorModeChange={handleSourceEditorModeChange}
                  viewMode={sourceViewMode}
                  onViewModeChange={setSourceViewMode}
                  officeFile={officeFile}
                  onOfficeFileChange={handleOfficeFileChange}
                  title={docContent.source.title}
                  author={docContent.source.author}
                  era={docContent.source.era}
                  onTitleChange={handleSourceTitleChange}
                  onAuthorChange={handleSourceAuthorChange}
                  onEraChange={handleSourceEraChange}
                />
              </div>
            )}
            {!focusWrite && !focusRead && (
              <ResizableHandle direction="horizontal" onResize={handleMiddleHResize} />
            )}
            {!focusRead && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <ImitationPanel
                  text={docContent.imitation.text}
                  onTextChange={handleImitationTextChange}
                  editorMode={docContent.imitation.editorMode}
                  onEditorModeChange={handleImitationEditorModeChange}
                  drafts={docContent.imitation.drafts}
                  onSaveDraft={handleSaveDraft}
                  onRestoreDraft={handleRestoreDraft}
                  settings={docContent.settings}
                  onSettingsChange={handleSettingsChange}
                />
              </div>
            )}
          </div>
        )}

        {/* AI 侧栏 */}
        {showAi && (
          <>
            <ResizableHandle
              direction="horizontal"
              onResize={(d) => setAiWidth(w => Math.min(AI_MAX_WIDTH, Math.max(AI_MIN_WIDTH, w - d)))}
            />
            {/* eslint-disable-next-line react/forbid-component-props */}
            <div
              className="flex flex-col h-full overflow-hidden border-l bg-muted/5 flex-shrink-0"
              style={{ width: aiWidth }}
            >
              <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-muted/20 flex-shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground flex-1">
                  {t('imitativeWriting.ai.panelTitle', { defaultValue: 'AI 写作助手' })}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAiOpen(false)}
                  title={t('imitativeWriting.ai.collapse', { defaultValue: '折叠 AI 助手' })}>
                  <PanelRightClose className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ImitativeWritingAISidebar
                host={host}
                docContent={docContent}
                onInsertToImitation={handleInsertToImitation}
                onSaveNote={handleSaveNote}
                onPatchDoc={updater => updateDoc(updater)}
              />
            </div>
          </>
        )}

        {/* AI 侧栏折叠展开按钮 */}
        {!aiOpen && (
          <div className="flex flex-col items-center justify-start pt-2 px-0.5 bg-muted/10 border-l flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAiOpen(true)}
              title={t('imitativeWriting.ai.expand', { defaultValue: '展开 AI 助手' })}
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <ImitativeWritingStatusBar
        sourceText={docContent.source.text}
        imitationText={docContent.imitation.text}
        noteCount={docContent.notes.length}
        sourceEditorMode={docContent.source.editorMode}
        imitationEditorMode={docContent.imitation.editorMode}
        saved={saved}
      />

      {/* 版本历史面板 */}
      <Suspense fallback={null}>
        <VersionHistoryPanel
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          projectId={doc.projectId}
          documentId={doc.id}
        />
      </Suspense>
    </div>
  );
}
