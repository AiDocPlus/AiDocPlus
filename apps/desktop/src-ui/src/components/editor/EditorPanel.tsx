import { useAppStore } from '@/stores/useAppStore';
import { Save, SaveAll, Download, FileText, PenLine, Columns, Rows, History, MessageSquare, FilePlus, Search, X, XCircle, ExternalLink, Square, Copy, Minus, LayoutTemplate, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { PluginMenu } from '@/plugins/PluginMenu';
import { PluginToolArea } from '@/plugins/PluginToolArea';
import { MarkdownEditor } from './MarkdownEditor';
import { ComposerPanel } from './ComposerPanel';
import { VersionHistoryPanel } from '../version/VersionHistoryPanel';
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { message, save } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { ResizableHandle } from '../ui/resizable-handle';
import { AttachmentPanel } from './AttachmentPanel';
import type { Attachment } from '@aidocplus/shared-types';


interface EditorPanelProps {
  tabId?: string;
  documentId?: string;
  authorNotes: string;
  content: string;
  aiContent: string;
  layoutMode: 'vertical' | 'horizontal';
  onContentChange: (value: string) => void;
  onAiContentChange: (value: string) => void;
  onLayoutModeChange: (value: 'vertical' | 'horizontal') => void;
  splitRatio: number;
  onSplitRatioChange: (value: number) => void;
  onVersionHistoryToggle?: (open: boolean) => void;
  onChatToggle?: () => void;
  chatOpen?: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  composedContent: string;
  onComposedContentChange: (value: string) => void;
  onActiveViewChange?: (view: 'editor' | 'plugins' | 'composer') => void;
}

export function EditorPanel({
  tabId,
  documentId,
  authorNotes,
  content,
  aiContent,
  layoutMode,
  onContentChange,
  onAiContentChange,
  onLayoutModeChange,
  splitRatio,
  onSplitRatioChange,
  onVersionHistoryToggle,
  onChatToggle,
  chatOpen,
  attachments,
  onAttachmentsChange,
  composedContent,
  onComposedContentChange,
  onActiveViewChange,
}: EditorPanelProps) {
  const { t } = useTranslation();
  const { documents, tabs, saveDocument, markTabAsDirty, markTabAsClean, createDocument, openTab, closeTab, closeAllTabs, aiStreamingTabId, sidebarOpen, setSidebarOpen } = useAppStore();
  const isAiStreaming = aiStreamingTabId === tabId;
  type ActiveView = 'editor' | 'plugins' | 'composer';
  const [activeView, _setActiveView] = useState<ActiveView>('editor');
  const setActiveView = (v: ActiveView) => { _setActiveView(v); onActiveViewChange?.(v); };
  const pluginAreaOpen = activeView === 'plugins';
  const [pluginMaximized, setPluginMaximized] = useState(false);
  // 正文区两个编辑器的视图状态：normal=正常分栏, ai-max=正文最大化, original-max=素材最大化
  type EditorViewState = 'normal' | 'ai-max' | 'original-max';
  const [editorViewState, setEditorViewState] = useState<EditorViewState>('normal');
  const aiContentCollapsed = editorViewState === 'original-max';
  const originalContentCollapsed = editorViewState === 'ai-max';
  // AI 流式生成开始时，自动最大化正文内容编辑器
  useEffect(() => {
    if (isAiStreaming) setEditorViewState('ai-max');
  }, [isAiStreaming]);

  // 监听系统菜单的视图切换事件
  useEffect(() => {
    const isActive = () => tabId === useAppStore.getState().activeTabId;
    const handler = (e: Event) => {
      if (!isActive()) return;
      const detail = (e as CustomEvent).detail;
      if (detail === 'editor' || detail === 'plugins' || detail === 'composer') {
        setActiveView(detail);
      }
    };
    window.addEventListener('menu-view-switch', handler);
    return () => window.removeEventListener('menu-view-switch', handler);
  }, [tabId]);

  const { ui } = useSettingsStore();
  const mod = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl+';

  // 查找文档
  const document = documents.find(d => d.id === documentId);

  // Determine effective theme (handles 'auto' mode)
  const effectiveTheme = ui.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : ui.theme;

  const [isSaving, setIsSaving] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleEditorResize = useCallback((delta: number) => {
    const container = editorContainerRef.current;
    if (!container) return;
    const totalSize = layoutMode === 'vertical' ? container.clientHeight : container.clientWidth;
    if (totalSize === 0) return;
    const deltaPercent = (delta / totalSize) * 100;
    onSplitRatioChange(Math.min(80, Math.max(20, splitRatio + deltaPercent)));
  }, [layoutMode, splitRatio, onSplitRatioChange]);

  const handleNewDocument = async () => {
    if (!document) return;
    const projectId = document.projectId;
    try {
      const newDoc = await createDocument(projectId, t('editor.untitledDocument', { defaultValue: '未命名文档' }));
      if (newDoc) {
        await openTab(newDoc.id);
      }
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  const handleVersionHistoryToggle = (open: boolean) => {
    setVersionHistoryOpen(open);
    onVersionHistoryToggle?.(open);
  };

  const handleSave = async () => {
    if (!document || isSaving) return;

    setIsSaving(true);
    try {
      await saveDocument({
        ...document,
        content,
        aiGeneratedContent: aiContent,
        composedContent: composedContent || undefined,
      });

      // 保存后更新基准并标记标签为已保存
      baselineRef.current = { authorNotes: document.authorNotes || '', content, aiContent, composedContent };
      if (tabId) {
        markTabAsClean(tabId);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // 先保存当前文档
      if (document) {
        await saveDocument({
          ...document,
          content,
          aiGeneratedContent: aiContent,
          composedContent: composedContent || undefined,
        });
        baselineRef.current = { authorNotes: document.authorNotes || '', content, aiContent, composedContent };
        if (tabId) markTabAsClean(tabId);
      }
      // 保存其他 dirty 标签的文档
      for (const tab of tabs) {
        if (tab.id === tabId || !tab.isDirty) continue;
        const doc = documents.find(d => d.id === tab.documentId);
        if (doc) {
          await saveDocument(doc);
          markTabAsClean(tab.id);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const doExport = async (
    command: string,
    format: string,
    contentOverride?: string,
  ) => {
    if (!document) return;

    try {
      const suffix = contentOverride ? t('editor.composedSuffix', { defaultValue: '_合并' }) : t('editor.aiSuffix', { defaultValue: '_AI' });
      const defaultFileName = `${document.title}${suffix}.${format}`;
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [format]
          }
        ]
      });

      if (!filePath) return;

      const result = await invoke<string>(command, {
        documentId: document.id,
        projectId: document.projectId,
        format,
        outputPath: filePath,
        contentOverride: contentOverride || undefined,
      });

      if (format === 'pdf' && command === 'export_document_native') {
        await message(t('editor.exportPdfHint', { defaultValue: '已在浏览器中打开公文格式文档，请使用浏览器的“打印”功能，选择“另存为 PDF”即可导出。\n\n文件位置: {{path}}', path: result }), {
          title: t('editor.exportPdfTitle', { defaultValue: '导出为 PDF' }),
          kind: 'info'
        });
      } else {
        await message(t('editor.exportSuccessMsg', { defaultValue: '导出成功: {{path}}', path: result }), {
          title: t('editor.exportSuccessTitle', { defaultValue: '导出成功' }),
          kind: 'info'
        });
      }
    } catch (error) {
      console.error('Export error:', error);

      let errorMessage = 'Unknown error';
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as any).message);
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      await message(t('editor.exportFailedMsg', { defaultValue: '导出失败: {{error}}', error: errorMessage }), {
        title: t('editor.exportErrorTitle', { defaultValue: '导出错误' }),
        kind: 'error'
      });
    }
  };

  const handleNativeExport = (format: string) => doExport('export_document_native', format);
  const handleExport = (format: string) => doExport('export_document', format);
  const handleNativeExportComposed = (format: string) => doExport('export_document_native', format, composedContent);

  const handleExportAndOpen = async (format: string, appName?: string) => {
    if (!document) return;
    // 先保存当前文档
    await handleSave();
    try {
      await invoke<string>('export_and_open', {
        documentId: document.id,
        projectId: document.projectId,
        format,
        appName: appName || null,
      });
    } catch (error) {
      console.error('Export and open error:', error);
      let errorMessage = 'Unknown error';
      if (typeof error === 'string') errorMessage = error;
      else if (error instanceof Error) errorMessage = error.message;
      await message(t('editor.exportOpenFailed', { defaultValue: '导出并打开失败: {{error}}', error: errorMessage }), { title: t('editor.exportErrorTitle', { defaultValue: '导出错误' }), kind: 'error' });
    }
  };

  // 自动保存（用 ref 存储频繁变化的值，避免每次按键都重建 interval）
  const { editor: editorSettings } = useSettingsStore();
  const contentRef = useRef(content);
  contentRef.current = content;
  const aiContentRef = useRef(aiContent);
  aiContentRef.current = aiContent;
  const authorNotesRef = useRef(authorNotes);
  authorNotesRef.current = authorNotes;
  const isSavingRef = useRef(isSaving);
  isSavingRef.current = isSaving;
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleSaveAllRef = useRef(handleSaveAll);
  handleSaveAllRef.current = handleSaveAll;

  useEffect(() => {
    if (!editorSettings.autoSave || !document || !tabId) return;
    const intervalMs = (editorSettings.autoSaveInterval || 60) * 1000;
    const timer = setInterval(() => {
      const { activeTabId, tabs: currentTabs } = useAppStore.getState();
      if (tabId === activeTabId && baselineRef.current) {
        const base = baselineRef.current;
        const hasContentChanges = authorNotesRef.current !== base.authorNotes || contentRef.current !== base.content || aiContentRef.current !== base.aiContent;
        const currentTab = currentTabs.find(t => t.id === tabId);
        const tabIsDirty = currentTab?.isDirty ?? false;
        if ((hasContentChanges || tabIsDirty) && !isSavingRef.current) {
          handleSaveRef.current();
        }
      }
    }, intervalMs);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, tabId, editorSettings.autoSave, editorSettings.autoSaveInterval]);

  // 监听快捷键事件（仅活动标签响应，用 ref 避免频繁重注册）
  useEffect(() => {
    const isActive = () => tabId === useAppStore.getState().activeTabId;
    const onSave = () => { if (document && isActive()) handleSaveRef.current(); };
    const onSaveAll = () => { if (document && isActive()) handleSaveAllRef.current(); };
    const onExport = () => { if (document && isActive()) handleExport('md'); };
    const onToggleLayout = () => {
      if (isActive()) onLayoutModeChange(layoutModeRef.current === 'vertical' ? 'horizontal' : 'vertical');
    };
    const onVersionHistory = () => { if (isActive()) handleVersionHistoryToggle(true); };
    const onToggleChat = () => { if (isActive()) onChatToggle?.(); };
    const onNewDocument = () => { if (document && isActive()) handleNewDocument(); };

    window.addEventListener('save-active-tab', onSave);
    window.addEventListener('save-all-tabs', onSaveAll);
    window.addEventListener('editor-export', onExport);
    window.addEventListener('editor-toggle-layout', onToggleLayout);
    window.addEventListener('editor-version-history', onVersionHistory);
    window.addEventListener('editor-toggle-chat', onToggleChat);
    window.addEventListener('editor-new-document', onNewDocument);
    return () => {
      window.removeEventListener('save-active-tab', onSave);
      window.removeEventListener('save-all-tabs', onSaveAll);
      window.removeEventListener('editor-export', onExport);
      window.removeEventListener('editor-toggle-layout', onToggleLayout);
      window.removeEventListener('editor-version-history', onVersionHistory);
      window.removeEventListener('editor-toggle-chat', onToggleChat);
      window.removeEventListener('editor-new-document', onNewDocument);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, tabId]);

  // 基准内容 ref，用于判断是否有真正的用户编辑
  const baselineRef = useRef<{ authorNotes: string; content: string; aiContent: string; composedContent: string } | null>(null);
  const baselineReadyRef = useRef(false);

  // 文档加载/变化时更新基准，并延迟启用 dirty 检测
  // 编辑器可能在加载后规范化 Markdown，导致与原始输入有细微差异（尾部换行等）。
  // 因此先禁用 dirty 检测，等编辑器稳定后再用实际 props 值更新 baseline。
  useEffect(() => {
    if (document) {
      baselineRef.current = {
        authorNotes: document.authorNotes || '',
        content: document.content || '',
        aiContent: document.aiGeneratedContent || '',
        composedContent: document.composedContent || '',
      };
      baselineReadyRef.current = false;
      const timer = setTimeout(() => {
        // 用编辑器规范化后的实际 props 值更新 baseline
        baselineRef.current = { authorNotes, content, aiContent, composedContent };
        baselineReadyRef.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id]);

  // 监听内容变化，只有偏离基准时才标记为未保存
  useEffect(() => {
    if (tabId && baselineRef.current && baselineReadyRef.current) {
      const base = baselineRef.current;
      const hasChanges =
        authorNotes !== base.authorNotes ||
        content !== base.content ||
        aiContent !== base.aiContent ||
        composedContent !== base.composedContent;

      if (hasChanges) {
        markTabAsDirty(tabId);
      }
    }
  }, [authorNotes, content, aiContent, composedContent, tabId, markTabAsDirty]);

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">{t('tabs.noOpenDocuments')}</p>
          <p className="text-sm">{t('tabs.selectDocumentHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar（插件最大化时隐藏） */}
      {!pluginMaximized && (
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-background flex-shrink-0">
        {/* ── 三区切换按钮（正文区/插件区/合并区） ── */}
        <Button
          variant={activeView === 'editor' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('editor')}
          title={t('editor.contentArea', { defaultValue: '正文区' })}
          className={`gap-1 h-7 text-xs ${
            activeView === 'editor'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 animate-editor-breathe'
          }`}
        >
          <PenLine className="h-3.5 w-3.5" />
          {t('editor.contentArea', { defaultValue: '正文区' })}
        </Button>
        <PluginMenu
          pluginAreaOpen={pluginAreaOpen}
          onToggle={() => setActiveView('plugins')}
          document={document}
        />
        <Button
          variant={activeView === 'composer' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('composer')}
          title={t('editor.composerArea', { defaultValue: '合并区' })}
          className={`gap-1 h-7 text-xs ${
            activeView === 'composer'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'border-green-500 text-green-500 hover:bg-green-500/10 animate-composer-breathe'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('editor.composerArea', { defaultValue: '合并区' })}
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── 文档操作组 ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-7 px-1.5 gap-0.5"
              title={`${t('editor.newDocumentInProject', { defaultValue: '新建文档' })} (${mod}N)`}
            >
              <FilePlus className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleNewDocument}>
              <FilePlus className="h-3.5 w-3.5 mr-2" />
              {t('editor.newBlankDocument', { defaultValue: '新建空白文档' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('menu-new-from-template'))}>
              <LayoutTemplate className="h-3.5 w-3.5 mr-2" />
              {t('editor.newFromTemplate', { defaultValue: '从模板新建' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => tabId && closeTab(tabId, false)}
          title={`${t('tabs.closeTab', { defaultValue: '关闭当前文档' })} (${mod}W)`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => closeAllTabs()}
          title={t('tabs.closeAllTabs', { defaultValue: '关闭全部文档' })}
        >
          <XCircle className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── 保存/导出组 ── */}
        <Button
          variant={isSaving ? "secondary" : "outline"}
          size="icon"
          className="h-7 w-7"
          disabled={isSaving}
          onClick={handleSave}
          title={`${t('editor.saveCurrent', { defaultValue: '保存当前文档' })} (${mod}S)`}
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={isSaving}
          onClick={handleSaveAll}
          title={`${t('editor.saveAll', { defaultValue: '保存全部文档' })} (${mod}⇧S)`}
        >
          <SaveAll className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.dispatchEvent(new CustomEvent('menu-save-as-template'))}
          title={t('editor.saveAsTemplate', { defaultValue: '存为模板' })}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              title={`${t('editor.exportContent', { defaultValue: '导出正文' })} (${mod}E)`}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleNativeExport('md')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.exportAsMd', { defaultValue: '导出为 Markdown (.md)' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNativeExport('html')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.exportAsHtml', { defaultValue: '导出为 HTML (.html)' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNativeExport('docx')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.exportAsDocx', { defaultValue: '导出为 Word (.docx)' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNativeExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.exportAsPdf', { defaultValue: '导出为 PDF (.pdf)' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNativeExport('txt')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.exportAsTxt', { defaultValue: '导出为纯文本 (.txt)' })}
            </DropdownMenuItem>
            {composedContent?.trim() && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {t('editor.exportComposed', { defaultValue: '导出合并内容' })}
                </div>
                <DropdownMenuItem onClick={() => handleNativeExportComposed('md')}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('editor.composedMd', { defaultValue: '合并内容 → Markdown' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNativeExportComposed('html')}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('editor.composedHtml', { defaultValue: '合并内容 → HTML' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNativeExportComposed('docx')}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('editor.composedDocx', { defaultValue: '合并内容 → Word' })}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNativeExportComposed('pdf')}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('editor.composedPdf', { defaultValue: '合并内容 → PDF' })}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── 导出并打开 ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              title={t('editor.exportAndOpen', { defaultValue: '导出并用外部程序打开' })}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleExportAndOpen('docx', 'WPS Office')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.wordOpenWps', { defaultValue: 'Word → WPS 打开' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAndOpen('docx', 'Microsoft Word')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.wordOpenWord', { defaultValue: 'Word → Word 打开' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportAndOpen('html', 'Microsoft Edge')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.htmlOpenEdge', { defaultValue: 'HTML → Edge 打开' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAndOpen('html', 'Google Chrome')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.htmlOpenChrome', { defaultValue: 'HTML → Chrome 打开' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAndOpen('html', 'Safari')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.htmlOpenSafari', { defaultValue: 'HTML → Safari 打开' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportAndOpen('md')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.mdOpenDefault', { defaultValue: 'Markdown → 默认程序打开' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAndOpen('docx')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.wordOpenDefault', { defaultValue: 'Word → 默认程序打开' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportAndOpen('html')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.htmlOpenDefault', { defaultValue: 'HTML → 默认浏览器打开' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── 视图/工具组 ── */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onLayoutModeChange(layoutMode === 'vertical' ? 'horizontal' : 'vertical')}
          title={`${layoutMode === 'vertical' ? t('editor.layoutHorizontal', { defaultValue: '切换为左右布局' }) : t('editor.layoutVertical', { defaultValue: '切换为上下布局' })} (${mod}L)`}
          disabled={false}
        >
          {layoutMode === 'vertical' ? (
            <Columns className="h-3.5 w-3.5" />
          ) : (
            <Rows className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleVersionHistoryToggle(true)}
          title={`${t('editor.versionHistory', { defaultValue: '版本历史' })} (${mod}H)`}
        >
          <History className="h-3.5 w-3.5" />
        </Button>

        <div className="flex-1" />

        {/* ── 右侧工具组 ── */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
          title={`${t('shortcuts.search', { defaultValue: '全局搜索' })} (${mod}⇧F)`}
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
        {onChatToggle && (
          <Button
            variant={chatOpen ? 'default' : 'outline'}
            size="icon"
            className="h-7 w-7"
            onClick={onChatToggle}
            title={`${chatOpen ? t('editor.closeAI', { defaultValue: '关闭 AI 助手' }) : t('editor.openAI', { defaultValue: '打开 AI 助手' })} (${mod}J)`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      )}

      {/* Editor Content / Plugin Area / Composer（三态互斥显示） */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeView === 'plugins' && document ? (
          /* 插件区域 */
          <PluginToolArea
            document={document}
            tabId={tabId || ''}
            aiContent={aiContent}
            isMaximized={pluginMaximized}
            onMaximizeToggle={() => setPluginMaximized(prev => !prev)}
            leftSidebarOpen={sidebarOpen}
            onLeftSidebarToggle={(open) => setSidebarOpen(open)}
            rightSidebarOpen={chatOpen}
            onRightSidebarToggle={(open) => {
              if (open && !chatOpen) onChatToggle?.();
              if (!open && chatOpen) onChatToggle?.();
            }}
          />
        ) : activeView === 'composer' && document ? (
          /* 合并内容面板 */
          <ComposerPanel
            document={document}
            composedContent={composedContent}
            onComposedContentChange={onComposedContentChange}
            aiContent={aiContent}
            theme={effectiveTheme}
            isMaximized={pluginMaximized}
            onMaximizeToggle={() => setPluginMaximized(prev => !prev)}
            leftSidebarOpen={sidebarOpen}
            onLeftSidebarToggle={(o) => setSidebarOpen(o)}
            rightSidebarOpen={chatOpen}
            onRightSidebarToggle={(o) => {
              if (o && !chatOpen) onChatToggle?.();
              if (!o && chatOpen) onChatToggle?.();
            }}
          />
        ) : (
          /* 编辑器区域 + 附件 */
          <div className="h-full flex flex-col min-h-0">
          <div
            ref={editorContainerRef}
            className={`flex-1 flex overflow-hidden min-h-0 ${layoutMode === 'vertical' ? 'w-full px-4' : ''}`}
            style={{ flexDirection: layoutMode === 'vertical' ? 'column' : 'row' }}
          >
            {/* AI Generated Content (top in vertical, right in horizontal) */}
            <section
              className={`flex flex-col ${layoutMode === 'vertical' ? 'min-h-0' : 'min-w-0 min-h-0'} ${aiContentCollapsed ? '' : 'overflow-hidden'}`}
              style={aiContentCollapsed ? {} : (
                originalContentCollapsed
                  ? { flex: 1 }
                  : layoutMode === 'vertical'
                    ? { height: `${splitRatio}%` }
                    : { width: `${splitRatio}%` }
              )}
            >
              <label className="block text-sm font-medium mb-1 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span>{t('editor.aiGeneratedContent', { defaultValue: '正文内容' })}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {layoutMode === 'vertical' ? t('editor.positionAbove', { defaultValue: '(上方)' }) : t('editor.positionRight', { defaultValue: '(右侧)' })}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" title={t('editor.maximize', { defaultValue: '最大化' })}
                    onClick={() => setEditorViewState('ai-max')}
                    className="h-6 w-6 p-0">
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title={t('editor.restore', { defaultValue: '恢复' })}
                    onClick={() => setEditorViewState('normal')}
                    className="h-6 w-6 p-0">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title={t('editor.minimize', { defaultValue: '最小化' })}
                    onClick={() => setEditorViewState('original-max')}
                    className="h-6 w-6 p-0">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </label>
              {!aiContentCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <MarkdownEditor
                    key={`ai-content-${document.id}`}
                    value={aiContent}
                    onChange={onAiContentChange}
                    placeholder={t('editor.aiContentPlaceholder', { defaultValue: '正文内容将出现在这里...' })}
                    theme={effectiveTheme}
                    editable={!isAiStreaming}
                    editorId={`ai-content-${document.id}`}
                    importSources={{ document }}
                  />
                </div>
              )}
            </section>

            {/* Resizable Handle between editors */}
            {!aiContentCollapsed && !originalContentCollapsed && (
              <ResizableHandle
                direction={layoutMode === 'vertical' ? 'vertical' : 'horizontal'}
                onResize={handleEditorResize}
              />
            )}

            {/* Original Content (bottom in vertical, left in horizontal) */}
            <section
              className={`flex flex-col ${layoutMode === 'vertical' ? 'min-h-0' : 'min-w-0 min-h-0'} ${originalContentCollapsed ? '' : 'overflow-hidden'}`}
              style={originalContentCollapsed ? {} : (
                aiContentCollapsed
                  ? { flex: 1 }
                  : layoutMode === 'vertical'
                    ? { height: `${100 - splitRatio}%` }
                    : { width: `${100 - splitRatio}%` }
              )}
            >
              <label className="block text-sm font-medium mb-1 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span>{t('editor.originalContent', { defaultValue: '素材内容' })}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {layoutMode === 'vertical' ? t('editor.positionBelow', { defaultValue: '(下方)' }) : t('editor.positionLeft', { defaultValue: '(左侧)' })}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" title={t('editor.maximize', { defaultValue: '最大化' })}
                    onClick={() => setEditorViewState('original-max')}
                    className="h-6 w-6 p-0">
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title={t('editor.restore', { defaultValue: '恢复' })}
                    onClick={() => setEditorViewState('normal')}
                    className="h-6 w-6 p-0">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" title={t('editor.minimize', { defaultValue: '最小化' })}
                    onClick={() => setEditorViewState('ai-max')}
                    className="h-6 w-6 p-0">
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </label>
              {!originalContentCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <MarkdownEditor
                    key={`original-content-${document.id}`}
                    value={content}
                    onChange={onContentChange}
                    placeholder={t('editor.originalContentPlaceholder', { defaultValue: '在此输入素材内容... (支持 Markdown)' })}
                    theme={effectiveTheme}
                    editorId={`original-content-${document.id}`}
                    importSources={{ aiContent, document }}
                  />
                </div>
              )}
            </section>
          </div>

          {/* Attachment Panel（跟随编辑器） */}
          <AttachmentPanel
            attachments={attachments}
            onAttachmentsChange={onAttachmentsChange}
          />
          </div>
        )}
      </div>

      {/* Version History Panel */}
      <VersionHistoryPanel
        open={versionHistoryOpen}
        onClose={() => handleVersionHistoryToggle(false)}
        projectId={document.projectId}
        documentId={document.id}
      />

    </div>
  );
}
