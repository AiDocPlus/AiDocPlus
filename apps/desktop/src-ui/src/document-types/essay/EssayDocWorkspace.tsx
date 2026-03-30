/**
 * EssayDocWorkspace — 散文写作工作区（三栏布局）
 *
 * 左栏：段落导航 / 素材库 / 写作分析 / 导出 / 设置（Tab 切换）
 * 中栏：EssayToolbar + EssayEditor + EssayStatusBar
 * 右栏：AI 助手面板
 *
 * Phase 1: 引入专用工具栏、编辑器、状态栏组件
 *          新增 viewMode（编辑/预览/分屏/大纲）和 typewriterMode
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MapPin, BookOpen, Sparkles, FileDown, Settings2, Lightbulb, BarChart3, LayoutList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import type { EssayDocumentContent, RhetoricType } from './types';
import {
  createEmptyEssayContent, parseEssayContent, updateContent,
  getWordCount, getReadingTime, getParagraphCount, parseParagraphs,
  updateSettings, updateParagraphRole,
  addMaterial, updateMaterial, deleteMaterial,
  createSnapshot, restoreSnapshot, deleteSnapshot, addRhetoric,
} from './types';
import {
  ESSAY_SUBTYPE_OPTIONS,
  PARAGRAPH_ROLE_OPTIONS, PARAGRAPH_ROLE_LABEL,
  MATERIAL_TYPE_OPTIONS, MATERIAL_TYPE_LABEL,
  MASTER_STYLE_OPTIONS,
  ESSAY_MOOD_OPTIONS,
  DIALOG_STYLE,
  CONTENT_SAVE_DEBOUNCE_MS,
  SAVE_STATUS_DISPLAY_MS,
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  LEFT_MIN_WIDTH,
  LEFT_MAX_WIDTH,
  RIGHT_MIN_WIDTH,
  RIGHT_MAX_WIDTH,
} from './constants';
import type { ParagraphRole, MaterialType, EssayMaterial, EssaySubtype } from './types';
import EssayAISidebar, { type EssayAISidebarRef } from './EssayAISidebar';
import EssayAnalysisPanel from './EssayAnalysisPanel';
import EssaySelectionToolbar from './EssaySelectionToolbar';
import EssayExportPanel from './EssayExportPanel';
import { useEssaySelection, type EssaySelectionActions } from './useEssaySelection';
import { exportEssay, getEssayExportSaveDialogParams } from './essayExport';
import { saveBlobWithDialog } from '@/lib/tauriSaveBlobFile';
import EssayToolbar, { type ViewMode, type LeftTab as ToolbarLeftTab } from './EssayToolbar';
import EssayEditor from './EssayEditor';
import EssayStatusBar, { type SaveStatus } from './EssayStatusBar';
import EssayPreview from './EssayPreview';
import EssayOutlineView from './EssayOutlineView';
import EssayTemplateDialog from './EssayTemplateDialog';
import EssayWritingPrompt from './EssayWritingPrompt';
import EssayDashboard from './EssayDashboard';
import EssayOutlinePlanner from './EssayOutlinePlanner';
import EssayContextMenu, { useEssayContextMenu } from './EssayContextMenu';
import type { EssayTemplate } from './essayTemplates';

// ── 左栏 Tab ──
type LeftTab = 'nav' | 'materials' | 'analysis' | 'export' | 'settings' | 'prompt' | 'dashboard' | 'planner';

export default function EssayDocWorkspace({ document: doc, host, tabId }: DocTypeEditorProps) {
  useTranslation();
  const { closeTab, closeAllTabs, saveDocument } = useAppStore(useShallow(s => ({
    closeTab: s.closeTab, closeAllTabs: s.closeAllTabs, saveDocument: s.saveDocument,
  })));

  // ── 布局状态 ──
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('nav');

  // ── 视图模式（Phase 1 新增） ──
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [typewriterMode, setTypewriterMode] = useState(false);

  // ── Phase 4: 模板对话框 ──
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // ── Phase 6: 右键菜单 ──
  const contextMenu = useEssayContextMenu();

  // ── 编辑器状态 ──
  const [editorContent, setEditorContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const essayRef = useRef<EssayDocumentContent>(createEmptyEssayContent());
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiSidebarRef = useRef<EssayAISidebarRef>(null);

  // ── 高亮开关 ──
  const [rhetoricHighlight, setRhetoricHighlight] = useState(false);
  const [imageryHighlight, setImageryHighlight] = useState(false);


  // ── 解析散文内容 ──
  const getEssay = useCallback((): EssayDocumentContent => {
    const d = host.doc.getDocument();
    return parseEssayContent(d.content || '') || createEmptyEssayContent();
  }, [host.doc]);

  const [essay, setEssay] = useState<EssayDocumentContent>(getEssay);
  essayRef.current = essay;

  // 计算派生状态
  const wordCount = getWordCount(essay.content);
  const rhetoricCount = essay.rhetorics.length;
  const paragraphCount = getParagraphCount(essay.content);

  useEffect(() => {
    const e = getEssay();
    setEssay(e);
    setEditorContent(e.content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // ── 选中文本操作 ──
  const selectionActions: EssaySelectionActions = {
    onAnalyzeSelection: (text: string) => {
      setRightCollapsed(false);
      setTimeout(() => {
        aiSidebarRef.current?.sendMessage(`请分析以下选中文本的修辞手法、意象和文学特色：\n\n「${text}」`);
      }, 100);
    },
    onAddMaterial: (text: string, type: MaterialType) => {
      const material: EssayMaterial = {
        id: Date.now().toString(),
        type,
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        content: text,
        tags: [],
        createdAt: new Date().toISOString(),
      };
      const updated = addMaterial(essayRef.current, material);
      saveEssay(updated);
    },
    onAnnotateRhetoric: (range: { start: number; end: number }, type: string) => {
      const text = editorContent.slice(range.start, range.end);
      const updated = addRhetoric(essayRef.current, {
        type: type as RhetoricType,
        startOffset: range.start,
        endOffset: range.end,
        text,
        autoDetected: false,
      });
      saveEssay(updated);
    },
    onMarkParagraphRole: (paragraphId: string, role: ParagraphRole) => {
      const updated = updateParagraphRole(essayRef.current, paragraphId, role);
      saveEssay(updated);
    },
    onFormatText: (range: { start: number; end: number }, format: string) => {
      const before = editorContent.slice(0, range.start);
      const selected = editorContent.slice(range.start, range.end);
      const after = editorContent.slice(range.end);
      let wrapped = selected;
      switch (format) {
        case 'bold': wrapped = `**${selected}**`; break;
        case 'italic': wrapped = `*${selected}*`; break;
        case 'strikethrough': wrapped = `~~${selected}~~`; break;
        case 'highlight': wrapped = `==${selected}==`; break;
        default: wrapped = selected;
      }
      const newContent = before + wrapped + after;
      handleContentChange(newContent);
    },
    onSearchSimilar: (text: string) => {
      setLeftTab('materials');
      setLeftCollapsed(false);
      setRightCollapsed(false);
      setTimeout(() => {
        aiSidebarRef.current?.sendMessage(`请在中国文学中搜索与以下文字风格或主题相似的名篇片段，并给出出处和赏析：\n\n「${text}」`);
      }, 100);
    },
  };

  const essaySelection = useEssaySelection(selectionActions);

  // ── 数据同步 ──
  useEffect(() => {
    setEditorContent(essay.content);
  }, [essay]);

  // ── 保存逻辑 ──
  const saveEssay = useCallback((updated: EssayDocumentContent) => {
    setEssay(updated);
    essayRef.current = updated;
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, CONTENT_SAVE_DEBOUNCE_MS);
  }, [host.doc]);

  const handleSave = useCallback(async () => {
    const updated = updateContent(essayRef.current, editorContent);
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const latest = useAppStore.getState().documents.find(d => d.id === doc.id);
      if (latest) await saveDocument(latest);
      if (tabId) useAppStore.getState().markTabAsClean(tabId);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    } finally { setIsSaving(false); }
  }, [host.doc, saveDocument, doc.id, tabId, editorContent]);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      // 先保存当前文档
      const updated = updateContent(essayRef.current, editorContent);
      host.doc.updateInMemory({ content: JSON.stringify(updated) });
      for (const tab of useAppStore.getState().tabs) {
        if (!tab.isDirty) continue;
        const d = useAppStore.getState().documents.find(dd => dd.id === tab.documentId);
        if (d) await saveDocument(d);
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    } finally { setIsSaving(false); }
  }, [saveDocument, host.doc, editorContent]);

  // ── 编辑器变化 ──
  const handleContentChange = useCallback((val: string) => {
    setEditorContent(val);
    const updated = updateContent(essayRef.current, val);
    setEssay(updated);
    essayRef.current = updated;
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    setSaveStatus('unsaved');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, CONTENT_SAVE_DEBOUNCE_MS);
  }, [host.doc]);

  // ── 专注模式 ──
  const handleFocus = useCallback(() => {
    if (!focusMode) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
    setFocusMode(!focusMode);
  }, [focusMode]);

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); handleSave(); }
      if (mod && e.key === 's' && e.shiftKey) { e.preventDefault(); handleSaveAll(); }
      if (mod && e.key === 'e') { e.preventDefault(); handleFocus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleSaveAll, handleFocus]);

  // ── 统计数据 ──
  const readingTime = useMemo(() => getReadingTime(editorContent), [editorContent]);

  // ── 段落列表 ──
  const paragraphs = useMemo(() => parseParagraphs(editorContent, essay.paragraphs), [editorContent, essay.paragraphs]);

  // ── 子类型切换 ──
  const handleSubtypeChange = useCallback((subtype: EssaySubtype) => {
    const updated = updateSettings(essayRef.current, { subtype });
    saveEssay(updated);
  }, [saveEssay]);

  // ── 插入素材到编辑器 ──
  const handleInsertMaterial = useCallback((text: string) => {
    setEditorContent(prev => {
      const newContent = prev + '\n\n' + text;
      const updated = updateContent(essayRef.current, newContent);
      saveEssay(updated);
      return newContent;
    });
  }, [saveEssay]);

  // ── 清理定时器 ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden" style={DIALOG_STYLE}>
      {/* ═══ 左栏 ═══ */}
      {!leftCollapsed && !focusMode && (
        <>
          <div className="flex flex-col border-r bg-card" style={{ width: leftWidth, minWidth: 180 }}>
            {/* Tab 切换栏 */}
            <div className="flex items-center border-b px-1 py-1 gap-0.5 flex-shrink-0">
              <Button variant={leftTab === 'nav' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('nav')} title="段落导航">
                <MapPin className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'materials' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('materials')} title="素材库">
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'analysis' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('analysis')} title="分析">
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'export' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('export')} title="导出">
                <FileDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'settings' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('settings')} title="设置">
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'prompt' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('prompt')} title="写作灵感">
                <Lightbulb className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'dashboard' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('dashboard')} title="写作仪表盘">
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant={leftTab === 'planner' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                onClick={() => setLeftTab('planner')} title="大纲规划">
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Tab 内容区 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {leftTab === 'nav' && (
                <ParagraphNavigator
                  paragraphs={paragraphs}
                  onRoleChange={(id, role) => {
                    const updated = updateParagraphRole(essayRef.current, id, role);
                    saveEssay(updated);
                  }}
                  wordCount={wordCount}
                  rhetoricCount={rhetoricCount}
                />
              )}
              {leftTab === 'materials' && (
                <MaterialLibrary
                  essay={essay}
                  onAdd={(mat) => {
                    const updated = addMaterial(essayRef.current, mat);
                    saveEssay(updated);
                  }}
                  onUpdate={(id, updates) => {
                    const updated = updateMaterial(essayRef.current, id, updates);
                    saveEssay(updated);
                  }}
                  onDelete={(id) => {
                    const updated = deleteMaterial(essayRef.current, id);
                    saveEssay(updated);
                  }}
                  onInsert={handleInsertMaterial}
                />
              )}
              {leftTab === 'analysis' && (
                <EssayAnalysisPanel essay={essay} />
              )}
              {leftTab === 'export' && (
                <EssayExportPanel
                  essay={essay}
                  onCreateSnapshot={async (title) => {
                    const updated = createSnapshot(essayRef.current, title);
                    saveEssay(updated);
                  }}
                  onRestoreSnapshot={async (snapshotId) => {
                    const updated = restoreSnapshot(essayRef.current, snapshotId);
                    saveEssay(updated);
                    setEditorContent(updated.content);
                  }}
                  onDeleteSnapshot={async (snapshotId) => {
                    const updated = deleteSnapshot(essayRef.current, snapshotId);
                    saveEssay(updated);
                  }}
                  onExportDocument={async (_format, settings) => {
                    const blob = await exportEssay(essay, settings);
                    const { defaultPath, filters } = getEssayExportSaveDialogParams(
                      settings.format,
                      essay.title || '未命名散文',
                    );
                    await saveBlobWithDialog({ defaultPath, filters, blob });
                  }}
                  onShareDocument={async (_options) => {
                    return `${window.location.origin}/share/${Math.random().toString(36).substring(2, 15)}`;
                  }}
                />
              )}
              {leftTab === 'settings' && (
                <EssaySettingsPanel
                  essay={essay}
                  onUpdate={(updates) => {
                    const updated = updateSettings(essayRef.current, updates);
                    saveEssay(updated);
                  }}
                />
              )}
              {leftTab === 'planner' && (
                <EssayOutlinePlanner
                  essay={essay}
                  paragraphs={paragraphs}
                  host={host}
                  onOutlineChange={(items) => {
                    const updated = { ...essayRef.current, outline: items };
                    saveEssay(updated);
                  }}
                />
              )}
              {leftTab === 'dashboard' && (
                <EssayDashboard
                  essay={essay}
                  content={editorContent}
                  onExport={() => setLeftTab('export')}
                  onSnapshot={() => {
                    const snapped = createSnapshot(essayRef.current);
                    saveEssay(snapped);
                  }}
                />
              )}
              {leftTab === 'prompt' && (
                <EssayWritingPrompt
                  essay={essay}
                  aiSidebarRef={aiSidebarRef}
                  onAddMaterial={(content, type) => {
                    const updated = addMaterial(essayRef.current, {
                      type,
                      title: content.slice(0, 20),
                      content,
                      tags: [],
                    });
                    saveEssay(updated);
                  }}
                  onInsertToEditor={(text) => {
                    handleContentChange(editorContent + '\n\n' + text);
                  }}
                />
              )}
            </div>
          </div>
          <ResizableHandle direction="horizontal" onResize={(d) => setLeftWidth(w => Math.min(LEFT_MAX_WIDTH, Math.max(LEFT_MIN_WIDTH, w + d)))} />
        </>
      )}

      {/* ═══ 中栏：编辑器 ═══ */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-0"
        ref={essaySelection.setEditorRef}
        onContextMenu={(e) => {
          const sel = window.getSelection();
          const selectedText = sel && !sel.isCollapsed ? sel.toString() : '';
          // 尝试定位光标所在段落
          const target = e.target as HTMLElement;
          const paraEl = target.closest('[data-para-index]') as HTMLElement | null;
          const paraIndex = paraEl ? parseInt(paraEl.dataset.paraIndex ?? '-1', 10) : -1;
          const paraId = paraIndex >= 0 && paragraphs[paraIndex] ? paragraphs[paraIndex].id : '';
          contextMenu.open(e, { selectedText, paragraphIndex: paraIndex, paragraphId: paraId });
        }}
      >

        {/* 专用工具栏 */}
        <EssayToolbar
          leftCollapsed={leftCollapsed}
          rightCollapsed={rightCollapsed}
          focusMode={focusMode}
          viewMode={viewMode}
          typewriterMode={typewriterMode}
          rhetoricHighlight={rhetoricHighlight}
          imageryHighlight={imageryHighlight}
          subtype={essay.settings.subtype}
          isSaving={isSaving}
          onToggleLeft={() => setLeftCollapsed(c => !c)}
          onToggleRight={() => setRightCollapsed(c => !c)}
          onToggleFocus={handleFocus}
          onViewModeChange={(mode) => setViewMode(mode)}
          onToggleTypewriter={() => setTypewriterMode(m => !m)}
          onToggleRhetoricHighlight={() => setRhetoricHighlight(h => !h)}
          onToggleImageryHighlight={() => setImageryHighlight(h => !h)}
          onSubtypeChange={handleSubtypeChange}
          onNew={() => {
            const empty = createEmptyEssayContent();
            setEssay(empty);
            setEditorContent('');
            saveEssay(empty);
          }}
          onClose={() => tabId && closeTab(tabId, false)}
          onCloseAll={() => closeAllTabs()}
          onSave={() => handleSave()}
          onSaveAll={() => handleSaveAll()}
          onSnapshot={() => {
            const snapped = createSnapshot(essayRef.current);
            saveEssay(snapped);
          }}
          onLeftTabChange={(tab: ToolbarLeftTab) => {
            setLeftTab(tab as LeftTab);
            setLeftCollapsed(false);
          }}
          onOpenTemplate={() => setShowTemplateDialog(true)}
          onFormatInsert={(syntax) => {
            const sel = window.getSelection();
            if (syntax === '---') {
              handleContentChange(editorContent + '\n\n---\n\n');
            } else if (syntax === '>') {
              handleContentChange(editorContent + '\n\n> ');
            } else if (sel && !sel.isCollapsed) {
              const selected = sel.toString();
              const newSel = `${syntax}${selected}${syntax}`;
              document.execCommand('insertText', false, newSel);
            }
          }}
        />

        {/* 编辑区 — 根据 viewMode 渲染不同布局 */}
        {viewMode === 'preview' ? (
          // ── 纯预览模式 ──
          <EssayPreview
            essay={essay}
            content={editorContent}
            className="flex-1"
          />
        ) : viewMode === 'split' ? (
          // ── 分屏：左编辑右预览 ──
          <div className="flex-1 min-h-0 flex">
            <EssayEditor
              value={editorContent}
              onChange={handleContentChange}
              viewMode={viewMode}
              typewriterMode={typewriterMode}
              focusMode={focusMode}
              className="w-1/2 border-r"
            />
            <EssayPreview
              essay={essay}
              content={editorContent}
              className="w-1/2"
            />
          </div>
        ) : viewMode === 'outline' ? (
          // ── 大纲视图 ──
          <div className="flex-1 min-h-0 flex">
            <EssayOutlineView
              paragraphs={paragraphs}
              wordCount={wordCount}
              onRoleChange={(id, role) => {
                const updated = updateParagraphRole(essayRef.current, id, role);
                saveEssay(updated);
              }}
              className="w-56 border-r flex-shrink-0"
            />
            <EssayEditor
              value={editorContent}
              onChange={handleContentChange}
              viewMode={viewMode}
              typewriterMode={typewriterMode}
              focusMode={focusMode}
              className="flex-1"
            />
          </div>
        ) : (
          // ── 默认编辑模式 ──
          <EssayEditor
            value={editorContent}
            onChange={handleContentChange}
            viewMode={viewMode}
            typewriterMode={typewriterMode}
            focusMode={focusMode}
          />
        )}

        {/* 专用状态栏 */}
        <EssayStatusBar
          essay={essay}
          wordCount={wordCount}
          paragraphCount={paragraphCount}
          rhetoricCount={rhetoricCount}
          readingTime={readingTime}
          saveStatus={saveStatus}
        />
      </div>

      {/* ═══ 右栏：AI 助手 ═══ */}
      {!rightCollapsed && !focusMode && (
        <>
          <ResizableHandle direction="horizontal" onResize={(d) => setRightWidth(w => Math.min(RIGHT_MAX_WIDTH, Math.max(RIGHT_MIN_WIDTH, w - d)))} />
          <div className="flex flex-col border-l bg-card" style={{ width: rightWidth, minWidth: RIGHT_MIN_WIDTH }}>
            <EssayAISidebar
              ref={aiSidebarRef}
              host={host}
              essay={essay}
              editorContent={editorContent}
              onInsertToDoc={handleInsertMaterial}
            />
          </div>
        </>
      )}

      {essaySelection.showToolbar && essaySelection.selection && essaySelection.toolbarPosition && (
        <EssaySelectionToolbar
          selection={{
            text: essaySelection.selection.text,
            range: { start: essaySelection.selection.start, end: essaySelection.selection.end },
            paragraphId: essaySelection.selection.paragraphId,
          }}
          position={essaySelection.toolbarPosition}
          onClose={essaySelection.closeToolbar}
          onAnalyzeSelection={essaySelection.handleAnalyzeSelection}
          onAddMaterial={essaySelection.handleAddMaterial}
          onAnnotateRhetoric={essaySelection.handleAnnotateRhetoric}
          onMarkParagraphRole={essaySelection.handleMarkParagraphRole}
          onFormatText={essaySelection.handleFormatText}
          onSearchSimilar={essaySelection.handleSearchSimilar}
        />
      )}

      {/* ── Phase 6: 右键菜单 ── */}
      <EssayContextMenu
        state={contextMenu.state}
        paragraphCount={paragraphs.length}
        onClose={contextMenu.close}
        onSetParagraphRole={(id, role) => {
          const updated = updateParagraphRole(essayRef.current, id, role);
          saveEssay(updated);
        }}
        onInsertParagraphAbove={(idx) => {
          const paras = editorContent.split(/\n\n+/);
          paras.splice(idx, 0, '');
          handleContentChange(paras.join('\n\n'));
        }}
        onInsertParagraphBelow={(idx) => {
          const paras = editorContent.split(/\n\n+/);
          paras.splice(idx + 1, 0, '');
          handleContentChange(paras.join('\n\n'));
        }}
        onMoveParagraphUp={(idx) => {
          if (idx <= 0) return;
          const paras = editorContent.split(/\n\n+/);
          [paras[idx - 1], paras[idx]] = [paras[idx], paras[idx - 1]];
          handleContentChange(paras.join('\n\n'));
        }}
        onMoveParagraphDown={(idx) => {
          const paras = editorContent.split(/\n\n+/);
          if (idx >= paras.length - 1) return;
          [paras[idx], paras[idx + 1]] = [paras[idx + 1], paras[idx]];
          handleContentChange(paras.join('\n\n'));
        }}
        onAIAnalyze={(text) => {
          aiSidebarRef.current?.sendMessage(`请分析以下散文片段的修辞手法和意境：\n\n「${text}」`);
          setRightCollapsed(false);
        }}
        onAIPolish={(text) => {
          aiSidebarRef.current?.sendMessage(`请润色以下散文片段，保持原有风格，提升文学性：\n\n「${text}」`);
          setRightCollapsed(false);
        }}
        onAIContinue={(text) => {
          aiSidebarRef.current?.sendMessage(`请根据以下散文片段，续写 100-200 字，保持一致的风格和意境：\n\n「${text}」`);
          setRightCollapsed(false);
        }}
        onAddToMaterials={(text, type) => {
          const updated = addMaterial(essayRef.current, {
            type,
            title: text.slice(0, 20),
            content: text,
            tags: [],
          });
          saveEssay(updated);
        }}
        onAnnotateRhetoric={(text) => {
          const updated = addRhetoric(essayRef.current, {
            type: 'other',
            startOffset: 0,
            endOffset: text.length,
            text,
            autoDetected: false,
          });
          saveEssay(updated);
        }}
        onCopy={(text) => navigator.clipboard.writeText(text)}
      />

      {/* ── Phase 4: 模板选择对话框 ── */}
      {showTemplateDialog && (
        <EssayTemplateDialog
          onSelect={(tpl: EssayTemplate | null) => {
            if (tpl) {
              const skeleton = tpl.skeleton.map(s => `## ${s.label}\n\n${s.placeholder}\n`).join('\n');
              handleContentChange(skeleton);
              const updated = updateSettings(essayRef.current, {
                subtype: tpl.subtype,
                mood: tpl.mood,
                targetStyle: tpl.targetStyle,
                targetWordCount: tpl.targetWordCount,
                keyImagery: tpl.keyImagery,
                theme: tpl.theme,
              });
              saveEssay(updated);
            }
          }}
          onClose={() => setShowTemplateDialog(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 段落导航面板
// ═══════════════════════════════════════════════════════

function ParagraphNavigator({
  paragraphs, onRoleChange, wordCount, rhetoricCount,
}: {
  paragraphs: import('./types').EssayParagraph[];
  onRoleChange: (id: string, role: ParagraphRole) => void;
  wordCount: number;
  rhetoricCount: number;
}) {
  return (
    <div className="p-2 space-y-2 text-xs">
      <div className="font-medium text-sm flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        段落导航
      </div>
      {paragraphs.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">开始写作后，段落将自动出现在这里</div>
      ) : (
        <div className="space-y-1">
          {paragraphs.map((p) => (
            <div key={p.id} className="flex items-start gap-1 group hover:bg-muted/50 rounded px-1 py-0.5 cursor-pointer">
              {/* 角色标签 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    'text-[10px] font-bold rounded px-1 flex-shrink-0 mt-0.5',
                    PARAGRAPH_ROLE_OPTIONS.find(r => r.value === p.role)?.bg || '',
                    PARAGRAPH_ROLE_OPTIONS.find(r => r.value === p.role)?.color || 'text-muted-foreground',
                  )}>
                    [{PARAGRAPH_ROLE_LABEL[p.role] || '—'}]
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[60px]">
                  {PARAGRAPH_ROLE_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.value} className="text-xs" onClick={() => onRoleChange(p.id, opt.value)}>
                      <span className={opt.color}>{opt.label}</span>
                      {p.role === opt.value && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="truncate text-muted-foreground">{p.preview}</span>
              <span className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground">{p.wordCount}字</span>
            </div>
          ))}
        </div>
      )}
      {/* 统计摘要 */}
      <div className="border-t pt-2 space-y-1 text-[11px] text-muted-foreground">
        <div>总字数: {wordCount}</div>
        <div>段落数: {paragraphs.length}</div>
        <div>修辞标注: {rhetoricCount}处</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 素材库面板
// ═══════════════════════════════════════════════════════

function MaterialLibrary({
  essay, onAdd, onUpdate: _onUpdate, onDelete, onInsert,
}: {
  essay: EssayDocumentContent;
  onAdd: (mat: Omit<EssayMaterial, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<EssayMaterial>) => void;
  onDelete: (id: string) => void;
  onInsert: (text: string) => void;
}) {
  const [adding, setAdding] = useState<MaterialType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');

  const handleAdd = () => {
    if (!adding || !newContent.trim()) return;
    onAdd({
      type: adding,
      title: newTitle.trim() || newContent.trim().slice(0, 20),
      content: newContent.trim(),
      source: newSource.trim() || undefined,
      tags: [],
    });
    setAdding(null);
    setNewTitle('');
    setNewContent('');
    setNewSource('');
  };

  return (
    <div className="p-2 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" />
          素材库
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-5 text-[11px] px-1.5">+ 新建</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MATERIAL_TYPE_OPTIONS.map(opt => (
              <DropdownMenuItem key={opt.value} className="text-xs" onClick={() => setAdding(opt.value)}>
                {opt.icon} {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 新建表单 */}
      {adding && (
        <div className="border rounded p-2 space-y-1.5 bg-muted/30">
          <div className="text-[11px] font-medium">{MATERIAL_TYPE_LABEL[adding]}</div>
          <input className="w-full text-xs px-2 py-1 border rounded bg-background" placeholder="标题（可选）"
            value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <textarea className="w-full text-xs px-2 py-1 border rounded bg-background resize-none" rows={3}
            placeholder="内容..." value={newContent} onChange={e => setNewContent(e.target.value)} />
          {adding === 'quote' && (
            <input className="w-full text-xs px-2 py-1 border rounded bg-background" placeholder="来源/作者"
              value={newSource} onChange={e => setNewSource(e.target.value)} />
          )}
          <div className="flex gap-1">
            <Button size="sm" className="h-5 text-[11px] px-2" onClick={handleAdd}>添加</Button>
            <Button size="sm" variant="ghost" className="h-5 text-[11px] px-2" onClick={() => setAdding(null)}>取消</Button>
          </div>
        </div>
      )}

      {/* 素材列表（按类型分组）*/}
      {MATERIAL_TYPE_OPTIONS.map(typeOpt => {
        const items = essay.materials.filter(m => m.type === typeOpt.value);
        if (items.length === 0) return null;
        return (
          <div key={typeOpt.value}>
            <div className="text-[11px] text-muted-foreground font-medium mb-1">{typeOpt.icon} {typeOpt.label} ({items.length})</div>
            <div className="space-y-1">
              {items.map(item => (
                <div key={item.id} className="group border rounded px-2 py-1 hover:bg-muted/30 cursor-pointer"
                  onDoubleClick={() => onInsert(item.content)}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{item.title}</span>
                    <button className="text-[10px] text-destructive opacity-0 group-hover:opacity-100" onClick={() => onDelete(item.id)}>删除</button>
                  </div>
                  <div className="text-muted-foreground truncate">{item.content.slice(0, 50)}{item.content.length > 50 ? '...' : ''}</div>
                  {item.source && <div className="text-[10px] text-muted-foreground">—— {item.source}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {essay.materials.length === 0 && !adding && (
        <div className="text-center text-muted-foreground py-4">
          <BookOpen className="h-6 w-6 mx-auto opacity-20 mb-1" />
          <p>暂无素材</p>
          <p className="text-[10px]">点击上方"新建"添加灵感、引用或意象</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 写作设置面板
// ═══════════════════════════════════════════════════════

function EssaySettingsPanel({
  essay, onUpdate,
}: {
  essay: EssayDocumentContent;
  onUpdate: (updates: Partial<import('./types').EssaySettings>) => void;
}) {
  const [themeInput, setThemeInput] = useState(essay.settings.theme);
  const [imageryInput, setImageryInput] = useState('');
  const [targetWords, setTargetWords] = useState(String(essay.settings.targetWordCount));

  return (
    <div className="p-2 space-y-3 text-xs">
      <div className="font-medium text-sm flex items-center gap-1">
        <Settings2 className="h-3.5 w-3.5" />
        写作设置
      </div>

      {/* 散文子类型 */}
      <div>
        <label className="text-[11px] text-muted-foreground">散文子类型</label>
        <select title="散文子类型" className="w-full mt-0.5 text-xs px-2 py-1 border rounded bg-background"
          value={essay.settings.subtype} onChange={e => onUpdate({ subtype: e.target.value as EssaySubtype })}>
          {ESSAY_SUBTYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 主题/线索 */}
      <div>
        <label className="text-[11px] text-muted-foreground">主题/线索</label>
        <input className="w-full mt-0.5 text-xs px-2 py-1 border rounded bg-background"
          value={themeInput} onChange={e => setThemeInput(e.target.value)}
          onBlur={() => onUpdate({ theme: themeInput })}
          placeholder="如：乡愁与时光" />
      </div>

      {/* 关键意象 */}
      <div>
        <label className="text-[11px] text-muted-foreground">关键意象</label>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {essay.settings.keyImagery.map((img, i) => (
            <span key={i} className="bg-muted rounded px-1.5 py-0.5 text-[11px] flex items-center gap-0.5">
              {img}
              <button className="text-destructive text-[10px]" onClick={() => {
                onUpdate({ keyImagery: essay.settings.keyImagery.filter((_, j) => j !== i) });
              }}>×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input className="flex-1 text-xs px-2 py-1 border rounded bg-background" placeholder="添加意象..."
            value={imageryInput} onChange={e => setImageryInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && imageryInput.trim()) {
                onUpdate({ keyImagery: [...essay.settings.keyImagery, imageryInput.trim()] });
                setImageryInput('');
              }
            }} />
          <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => {
            if (imageryInput.trim()) {
              onUpdate({ keyImagery: [...essay.settings.keyImagery, imageryInput.trim()] });
              setImageryInput('');
            }
          }}>+</Button>
        </div>
      </div>

      {/* 目标风格 */}
      <div>
        <label className="text-[11px] text-muted-foreground">目标风格</label>
        <select title="目标风格" className="w-full mt-0.5 text-xs px-2 py-1 border rounded bg-background"
          value={essay.settings.targetStyle} onChange={e => onUpdate({ targetStyle: e.target.value as import('./types').MasterStyle })}>
          {MASTER_STYLE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.desc ? ` — ${opt.desc}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 目标字数 */}
      <div>
        <label className="text-[11px] text-muted-foreground">目标字数</label>
        <input type="number" title="目标字数" placeholder="2000" className="w-full mt-0.5 text-xs px-2 py-1 border rounded bg-background"
          value={targetWords} onChange={e => setTargetWords(e.target.value)}
          onBlur={() => onUpdate({ targetWordCount: parseInt(targetWords) || 2000 })} />
      </div>

      {/* 情感基调 */}
      <div>
        <label className="text-[11px] text-muted-foreground">情感基调</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {ESSAY_MOOD_OPTIONS.map(opt => (
            <button key={opt.value}
              className={cn(
                'text-[11px] px-2 py-0.5 rounded border',
                essay.settings.mood === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted',
              )}
              onClick={() => onUpdate({ mood: opt.value })}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 名家风格参考 */}
      <div className="border-t pt-2">
        <div className="text-[11px] text-muted-foreground font-medium mb-1">🎯 名家风格参考</div>
        <div className="space-y-0.5">
          {MASTER_STYLE_OPTIONS.filter(o => o.value !== 'free').map(opt => (
            <div key={opt.value} className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{opt.label}</span> — {opt.desc}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
