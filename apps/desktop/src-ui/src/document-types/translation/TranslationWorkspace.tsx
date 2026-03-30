/**
 * TranslationWorkspace — 中英文翻译工作区（full 布局）
 *
 * 三栏布局：左主栏（工具栏 + 双栏编辑器 + 状态栏）+ ResizableHandle + 右栏 AI 侧栏
 *
 * 功能：
 * - 丰富工具栏（保存/导出/设置/方向切换/交换/一键翻译+停止/清空/AI 面板折叠）
 * - 错误边界（渲染异常时友好提示 + 重试）
 * - 快捷键 Cmd+S / Cmd+Shift+S
 * - 停止 AI 生成（AbortController + stop_ai_stream）
 * - 版本历史
 * - 导出 / 设置对话框
 * - 工具栏 overflow-x-auto 溢出保护
 */
import {
  useState, useCallback, useRef, useEffect, Component,
  type ErrorInfo, type ReactNode, lazy, Suspense,
} from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {
  Languages, Sparkles, ArrowLeftRight, Trash2,
  Save, SaveAll, Download, Settings, History,
  PanelRightClose, PanelRightOpen, Square, FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { TOOLBAR_CLASS, STATUS_BAR_CLASS } from '../_shared/styles';
import { TranslationExportDialog } from './TranslationExportDialog';
import { TranslationSettingsDialog } from './TranslationSettingsDialog';
import {
  parseTranslationContent, createEmptyTranslationContent,
  type TranslationDocumentContent, type TranslationSettings,
  TRANSLATION_STYLES,
} from './types';
import { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';


const TranslationAISidebar = lazy(() =>
  import('./TranslationAISidebar').then(m => ({ default: m.default })),
);

const VersionHistoryPanel = lazy(() =>
  import('@/components/version/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
);

// ============================================================
// 错误边界
// ============================================================

class TranslationWorkspaceErrorBoundary extends Component<
  { children: ReactNode; docId: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; docId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[TranslationWorkspace]', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: { docId: string }): void {
    if (prevProps.docId !== this.props.docId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground bg-card"
          data-translation-error-boundary="true"
        >
          <p className="text-sm max-w-md">
            {i18n.t('translation.workspaceErrorBoundary', {
              defaultValue: '翻译工作区出现异常。可尝试重试；若仍失败请切换文档后重新打开或检查文档内容。',
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            {i18n.t('translation.workspaceErrorRetry', { defaultValue: '重试' })}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// 主组件
// ============================================================

function TranslationWorkspaceMain({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const mod = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl+';

  const [trans, setTrans] = useState<TranslationDocumentContent>(() =>
    parseTranslationContent(doc.content || '') || createEmptyTranslationContent()
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceLine, setSourceLine] = useState(0);

  // AI 侧栏状态
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(320);

  // 对话框状态
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transRef = useRef(trans);
  transRef.current = trans;
  const isTranslatingRef = useRef(false);
  isTranslatingRef.current = isTranslating;

  // 文档切换时重新加载
  useEffect(() => {
    const d = host.doc.getDocument();
    setTrans(parseTranslationContent(d.content || '') || createEmptyTranslationContent());
    setRightCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // ── 保存 ──

  const flushPendingTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const saveTrans = useCallback((updated: TranslationDocumentContent) => {
    const now = new Date().toISOString();
    const withTimestamp = { ...updated, updatedAt: now };
    setTrans(withTimestamp);
    transRef.current = withTimestamp;
    host.doc.updateInMemory({ content: JSON.stringify(withTimestamp, null, 2) });
    host.doc.markDirty();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { host.doc.save(); }, 3000);
  }, [host.doc]);

  const handleExplicitSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingTimer();
      const cur = transRef.current;
      const withTimestamp = { ...cur, updatedAt: new Date().toISOString() };
      host.doc.updateInMemory({ content: JSON.stringify(withTimestamp, null, 2) });
      await host.doc.save();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingTimer]);

  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingTimer();
      const cur = transRef.current;
      const withTimestamp = { ...cur, updatedAt: new Date().toISOString() };
      host.doc.updateInMemory({ content: JSON.stringify(withTimestamp, null, 2) });
      await host.doc.save();
      await host.doc.saveAllDirtyTabs();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingTimer]);

  // 保存 refs（供快捷键使用）
  const handleExplicitSaveRef = useRef(handleExplicitSave);
  const handleSaveAllRef = useRef(handleSaveAll);
  handleExplicitSaveRef.current = handleExplicitSave;
  handleSaveAllRef.current = handleSaveAll;

  // 快捷键 Cmd+S / Cmd+Shift+S
  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('[data-translation-workspace="true"]')) return;
      e.preventDefault();
      if (e.shiftKey) {
        void handleSaveAllRef.current();
      } else {
        void handleExplicitSaveRef.current();
      }
    };
    window.addEventListener('keydown', onDocKeyDown);
    return () => window.removeEventListener('keydown', onDocKeyDown);
  }, []);

  // ── 编辑器操作 ──

  const handleSourceChange = useCallback((val: string) => {
    saveTrans({ ...transRef.current, source: val });
  }, [saveTrans]);

  const handleTargetChange = useCallback((val: string) => {
    saveTrans({ ...transRef.current, target: val });
  }, [saveTrans]);

  const handleToggleDirection = useCallback(() => {
    const cur = transRef.current;
    saveTrans({ ...cur, direction: cur.direction === 'zh-en' ? 'en-zh' : 'zh-en' });
  }, [saveTrans]);

  const handleSwap = useCallback(() => {
    const cur = transRef.current;
    saveTrans({
      ...cur,
      source: cur.target,
      target: cur.source,
      direction: cur.direction === 'zh-en' ? 'en-zh' : 'zh-en',
    });
  }, [saveTrans]);

  const handleClearTarget = useCallback(() => {
    saveTrans({ ...transRef.current, target: '' });
  }, [saveTrans]);

  // ── 设置变更 ──

  const handleSettingsChange = useCallback((settings: TranslationSettings) => {
    saveTrans({ ...transRef.current, settings });
  }, [saveTrans]);

  // ── AI 一键翻译（事件驱动，通过侧栏流式处理） ──

  // 监听侧栏 AI 完成事件：只同步 isTranslating 状态
  // 翻译结果由 TranslationAISidebar.onAIResponse 回调负责写入（单一路径，避免双路径竞争）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId !== doc.id) return;
      setIsTranslating(false);
      if (!detail.success) {
        const errMsg = detail.error instanceof Error ? detail.error.message : String(detail.error || '');
        setTranslationError(errMsg || t('translation.aiError', { defaultValue: 'AI 翻译失败' }));
      }
    };
    window.addEventListener('doctype-ai-done', handler);
    return () => window.removeEventListener('doctype-ai-done', handler);
  }, [doc.id, t]);

  // 监听侧栏翻译结果事件，同步 trans state 到编辑器界面
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId !== doc.id) return;
      // 从 store 重新读取最新 content（侧栏已通过 updateInMemory 写入）
      const d = host.doc.getDocument();
      const parsed = parseTranslationContent(d.content || '');
      if (parsed) {
        setTrans(parsed);
        transRef.current = parsed;
      }
    };
    window.addEventListener('translation-target-updated', handler);
    return () => window.removeEventListener('translation-target-updated', handler);
  }, [doc.id, host.doc]);

  // 流式翻译：实时更新译文编辑区（由 TranslationAISidebar.onAssistantStreamUpdate 驱动）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId !== doc.id) return;
      if (!isTranslatingRef.current) return; // 仅翻译操作期间接收
      const target = detail.target as string;
      if (typeof target !== 'string') return;
      const updated = { ...transRef.current, target };
      setTrans(updated);
      transRef.current = updated;
    };
    window.addEventListener('translation-stream-update', handler);
    return () => window.removeEventListener('translation-stream-update', handler);
  }, [doc.id]);

  const handleStopTranslating = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-ai-stop', { detail: { documentId: doc.id } }));
    setIsTranslating(false);
  }, [doc.id]);

  const handleAITranslate = useCallback(() => {
    if (isTranslating || !trans.source.trim()) return;
    setIsTranslating(true);
    setTranslationError(null);

    // 清空译文，表示正在翻译
    saveTrans({ ...trans, target: '' });

    // 确保侧栏打开
    setRightCollapsed(false);

    // 根据 settings.defaultStyle 构建系统提示词
    const styleConfig = TRANSLATION_STYLES.find(s => s.value === trans.settings.defaultStyle);
    const stylePrompt = styleConfig ? styleConfig.prompt : '';
    const systemPrompt = trans.settings.preserveFormatting
      ? `你是专业的中英文翻译助手。翻译时注重信、达、雅。只输出译文，不要添加任何说明。${stylePrompt}`
      : `你是专业的中英文翻译助手。翻译时注重信、达、雅。只输出译文，不要添加任何说明。`;

    const srcLang = trans.direction === 'zh-en' ? '中文' : '英文';
    const tgtLang = trans.direction === 'zh-en' ? '英文' : '中文';

    const userMessage = `请将以下${srcLang}翻译为${tgtLang}，只输出译文：\n\n${trans.source}`;

    // 通过侧栏统一流式处理（思考内容自动折叠显示）
    // message 是必填字段（doctype-ai-send 事件处理器校验 detail?.message）
    // 延迟一帧确保侧栏已挂载并渲染，再发送事件
    requestAnimationFrame(() => {
      sendDocTypeAIMessage({
        documentId: doc.id,
        message: userMessage,
        label: `一键翻译 ${srcLang}→${tgtLang}`,
        prompt: userMessage,
        systemPrompt,
      });
    });
  }, [isTranslating, trans, saveTrans, doc.id]);

  // ── 计算统计 ──

  const sourceWordCount = trans.source.replace(/\s/g, '').length;
  const targetWordCount = trans.target.replace(/\s/g, '').length;
  const dirLabel = trans.direction === 'zh-en' ? '中→英' : '英→中';

  return (
    <div className="h-full flex" data-translation-workspace="true">
      {/* ═══ 左主栏 ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 翻译工具栏 */}
        <div className={`${TOOLBAR_CLASS} overflow-x-auto min-w-0`}>
          <Languages className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />

          {/* 保存 */}
          <Button
            variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0"
            onClick={() => void handleExplicitSave()}
            disabled={isSaving}
            title={`${mod}S`}
          >
            <Save className="h-3 w-3" />
          </Button>

          {/* 全部保存 */}
          <Button
            variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0"
            onClick={() => void handleSaveAll()}
            disabled={isSaving}
            title={`${mod}⇧S`}
          >
            <SaveAll className="h-3 w-3" />
          </Button>

          {/* 版本历史 */}
          <Button
            variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0"
            onClick={() => setVersionHistoryOpen(true)}
            title={t('translation.versionHistory', { defaultValue: '版本历史' })}
          >
            <History className="h-3 w-3" />
          </Button>

          <div className="w-px h-4 bg-border shrink-0" />

          {/* 方向切换 */}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleToggleDirection}>
            <ArrowLeftRight className="h-3 w-3" />{dirLabel}
          </Button>

          {/* 交换 */}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleSwap}
            title={t('translation.swap', { defaultValue: '交换原文和译文' })}>
            <ArrowLeftRight className="h-3 w-3" />
          </Button>

          {/* 一键翻译 / 停止 */}
          {isTranslating ? (
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleStopTranslating}>
              <Square className="h-3 w-3" />
              {t('translation.stop', { defaultValue: '停止' })}
            </Button>
          ) : (
            <Button variant="default" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleAITranslate}
              disabled={!host.ai.isAvailable() || !trans.source.trim()}>
              <Sparkles className="h-3 w-3" />
              {t('translation.aiTranslateAll', { defaultValue: '一键翻译' })}
            </Button>
          )}

          {/* 清空译文 */}
          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={handleClearTarget} disabled={!trans.target.trim()}
            title={t('translation.clearTarget', { defaultValue: '清空译文' })}>
            <Trash2 className="h-3 w-3" />
          </Button>

          <div className="w-px h-4 bg-border shrink-0" />

          {/* 导出下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                <Download className="h-3 w-3" />
                {t('translation.export', { defaultValue: '导出' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                <FileCode2 className="h-3.5 w-3.5 mr-2" />
                {t('translation.exportDialog', { defaultValue: '选择格式导出…' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 设置 */}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => setShowSettingsDialog(true)}
            title={t('translation.settings', { defaultValue: '翻译设置' })}>
            <Settings className="h-3 w-3" />
          </Button>

          {/* AI 面板折叠 */}
          <Button
            variant={rightCollapsed ? 'outline' : 'default'}
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={() => setRightCollapsed(!rightCollapsed)}
          >
            {rightCollapsed
              ? <PanelRightOpen className="h-3 w-3" />
              : <PanelRightClose className="h-3 w-3" />}
          </Button>
        </div>

        {/* 双栏编辑器 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 左栏：原文 */}
          <div className="flex-1 flex flex-col border-r min-w-0">
            <div className="px-3 py-1 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
              {trans.direction === 'zh-en'
                ? t('translation.sourceZh', { defaultValue: '原文（中文）' })
                : t('translation.sourceEn', { defaultValue: '原文（英文）' })}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MarkdownEditor
                key={`trans-source-${doc.id}`}
                value={trans.source}
                onChange={handleSourceChange}
                placeholder={trans.direction === 'zh-en'
                  ? t('translation.sourcePlaceholderZh', { defaultValue: '在此输入或粘贴中文原文...' })
                  : t('translation.sourcePlaceholderEn', { defaultValue: '在此输入或粘贴英文原文...' })}
                showToolbar={true}
                showViewModeSwitch={true}
                showStatusBar={true}
                editorId={`trans-source-${doc.id}`}
                theme="light"
                onCursorLineChange={setSourceLine}
              />
            </div>
          </div>

          {/* 右栏：译文 */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 py-1 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
              {trans.direction === 'zh-en'
                ? t('translation.targetEn', { defaultValue: '译文（英文）' })
                : t('translation.targetZh', { defaultValue: '译文（中文）' })}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MarkdownEditor
                key={`trans-target-${doc.id}`}
                value={trans.target}
                onChange={handleTargetChange}
                placeholder={isTranslating
                  ? t('translation.translating', { defaultValue: '翻译中...' })
                  : t('translation.targetPlaceholder', { defaultValue: 'AI 翻译结果将显示在此，也可手动编辑...' })}
                showToolbar={true}
                showViewModeSwitch={true}
                showStatusBar={true}
                editorId={`trans-target-${doc.id}`}
                theme="light"
                initialLine={sourceLine}
              />
            </div>
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className={STATUS_BAR_CLASS}>
          <span>{t('translation.sourceCount', { defaultValue: '原文 {{count}} 字', count: sourceWordCount })}</span>
          <span>{t('translation.targetCount', { defaultValue: '译文 {{count}} 字', count: targetWordCount })}</span>
          {isTranslating && <span className="text-primary animate-pulse">{t('translation.translating', { defaultValue: '翻译中...' })}</span>}
          <div className="flex-1" />
          {translationError && (
            <span className="text-destructive text-[10px] truncate max-w-[200px]" title={translationError}>
              {translationError}
            </span>
          )}
          <span className="text-[10px]">
            {t('translation.styleLabel', { defaultValue: '风格' })}：
            {t(TRANSLATION_STYLES.find(s => s.value === trans.settings.defaultStyle)?.labelKey || '', {
              defaultValue: TRANSLATION_STYLES.find(s => s.value === trans.settings.defaultStyle)?.defaultLabel || '通用',
            })}
          </span>
        </div>
      </div>

      {/* ═══ 右栏：AI 侧栏 ═══ */}
      {!rightCollapsed && (
        <>
          <ResizableHandle
            direction="horizontal"
            onResize={(d) => setRightWidth((w) => Math.min(500, Math.max(220, w - d)))}
          />
          <div
            className="flex-shrink-0 h-full overflow-hidden border-l bg-card"
            style={{ width: rightWidth }}
          >
            <Suspense fallback={
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                {t('common.loading', { defaultValue: '加载中...' })}
              </div>
            }>
              <TranslationAISidebar
                key={doc.id}
                document={doc}
                host={host}
                onClose={() => setRightCollapsed(true)}
              />
            </Suspense>
          </div>
        </>
      )}

      {/* ═══ 对话框 ═══ */}
      <TranslationExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        transDoc={trans}
        defaultTitle={doc.title || 'translation'}
      />

      <TranslationSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={trans.settings}
        onSettingsChange={handleSettingsChange}
      />

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

export default function TranslationWorkspace(props: DocTypeEditorProps) {
  return (
    <TranslationWorkspaceErrorBoundary docId={props.document.id}>
      <TranslationWorkspaceMain {...props} />
    </TranslationWorkspaceErrorBoundary>
  );
}
