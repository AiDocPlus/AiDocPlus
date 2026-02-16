import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useThinkingContent } from './PluginHostAPI';
import { Wand2, Loader2, Settings2, ChevronDown, ChevronUp, Trash2, Code2, Brain } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { EditorView } from '@codemirror/view';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';

const CodeMirror = lazy(() => import('@uiw/react-codemirror'));
const EditorToolbar = lazy(() => import('@/components/editor/EditorToolbar').then(m => ({ default: m.EditorToolbar })));

/** 根据内容启发式检测语言名称 */
function detectLanguageName(code: string): string {
  const trimmed = code.trimStart();
  if (/^[\[{]/.test(trimmed)) {
    try { JSON.parse(code); return 'JSON'; } catch { /* fall through */ }
  }
  if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph|journey|quadrantChart|xychart|sankey|block|architecture)\b/m.test(trimmed)) {
    return 'Mermaid';
  }
  if (/^<[a-zA-Z!]/.test(trimmed) && /<\/[a-zA-Z]+>/.test(code)) {
    return 'HTML';
  }
  if (/^#{1,6}\s/m.test(code) || /^[-*+]\s/m.test(code) || /\[.+\]\(.+\)/.test(code) || /^>\s/m.test(code)) {
    return 'Markdown';
  }
  return '纯文本';
}

/** 通过 @codemirror/language-data 按名称加载语言扩展 */
async function loadLanguageExtension(langName: string) {
  const desc = LanguageDescription.matchLanguageName(languages, langName, true);
  if (desc) return desc.load();
  return null;
}

export interface PluginPanelLayoutProps {
  /** 欢迎界面图标 */
  pluginIcon: React.ReactNode;
  /** 欢迎界面标题 */
  pluginTitle: string;
  /** 欢迎界面描述 */
  pluginDesc: string;

  /** 提示词 */
  prompt: string;
  /** 提示词变更回调 */
  onPromptChange: (val: string) => void;
  /** 提示词占位符 */
  promptPlaceholder?: string;

  /** 是否正在生成 */
  generating: boolean;
  /** 生成内容回调 */
  onGenerate: () => void;
  /** 生成按钮文字，如 "AI 生成摘要"、"AI 生成表格" */
  generateLabel?: string;
  /** 生成中按钮文字 */
  generatingLabel?: string;

  /** 打开提示词构造器弹窗回调 */
  onPromptBuilderOpen?: () => void;
  /** 提示词构造器按钮文字 */
  promptBuilderLabel?: string;
  /** 提示词构造器弹窗（由插件提供，渲染在 Layout 内部） */
  promptBuilderDialog?: React.ReactNode;

  /** 工具栏内容（仅放置与插件内容相关的操作按钮） */
  toolbar?: React.ReactNode;

  /** 是否有内容（控制欢迎界面 vs 内容界面） */
  hasContent: boolean;
  /** 内容区 */
  children: React.ReactNode;

  /** 状态栏消息 */
  statusMsg?: string | null;
  /** 状态栏额外内容 */
  statusExtra?: React.ReactNode;
  /** 状态消息是否为错误 */
  statusIsError?: boolean;

  /** 清空全部内容回调 */
  onClearAll?: () => void;

  /** 生成区是否可见（非 AI 插件可设为 false，默认 true） */
  generationZoneVisible?: boolean;

  /** 内容源码（任意格式：JSON/Markdown/纯文本等） */
  sourceCode?: string;
  /** 保存编辑后的源码回调 */
  onSourceCodeSave?: (code: string) => void;
}

/**
 * 插件面板统一布局模板
 *
 * 四区域：① 生成区 ② 工具栏 ③ 内容区 ④ 状态区
 * 未生成内容时显示欢迎界面。
 */
export function PluginPanelLayout({
  pluginIcon,
  pluginTitle,
  pluginDesc,
  prompt,
  onPromptChange,
  promptPlaceholder,
  generating,
  onGenerate,
  generateLabel,
  generatingLabel,
  onPromptBuilderOpen,
  promptBuilderLabel,
  promptBuilderDialog,
  toolbar,
  hasContent,
  children,
  statusMsg,
  statusExtra,
  statusIsError,
  onClearAll,
  generationZoneVisible = true,
  sourceCode,
  onSourceCodeSave,
}: PluginPanelLayoutProps) {
  const { t } = useTranslation('plugin-framework');
  const [promptOpen, setPromptOpen] = useState(true);
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState('');
  const sourceCmViewRef = useRef<EditorView | null>(null);
  const cursorInfoRef = useRef({ line: 1, col: 1, lines: 0, chars: 0, selected: 0 });
  const [cursorInfo, setCursorInfo] = useState(cursorInfoRef.current);
  const [langExtensions, setLangExtensions] = useState<import('@codemirror/language').LanguageSupport[]>([]);
  const [detectedLangName, setDetectedLangName] = useState('纯文本');

  // ── 状态区：消息历史 + 思考内容 + 收缩/展开 ──
  const thinkingContent = useThinkingContent();
  const [statusExpanded, setStatusExpanded] = useState(false);
  const prevThinkingRef = useRef(thinkingContent);
  const prevStatusMsgRef = useRef(statusMsg);
  const statusScrollRef = useRef<HTMLDivElement>(null);
  const [statusLogs, setStatusLogs] = useState<Array<{ msg: string; isError: boolean }>>([]);

  // statusMsg 变化时追加到历史
  useEffect(() => {
    if (statusMsg && statusMsg !== prevStatusMsgRef.current) {
      setStatusLogs(prev => [...prev, { msg: statusMsg, isError: !!statusIsError }]);
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (statusScrollRef.current) {
          statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
        }
      });
    }
    prevStatusMsgRef.current = statusMsg;
  }, [statusMsg, statusIsError]);

  // 有新的思考内容到来时自动展开并滚动到底部
  useEffect(() => {
    if (thinkingContent && thinkingContent !== prevThinkingRef.current) {
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (statusScrollRef.current) {
          statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
        }
      });
    }
    prevThinkingRef.current = thinkingContent;
  }, [thinkingContent]);

  const handleOpenSourceEditor = useCallback(() => {
    const code = sourceCode || '';
    setEditingCode(code);
    setSourceEditorOpen(true);
    const name = detectLanguageName(code);
    setDetectedLangName(name);
    loadLanguageExtension(name)
      .then(ext => setLangExtensions(ext ? [ext] : []))
      .catch(() => setLangExtensions([]));
  }, [sourceCode]);

  const handleSaveSource = useCallback(() => {
    onSourceCodeSave?.(editingCode);
    setSourceEditorOpen(false);
  }, [editingCode, onSourceCodeSave]);

  // 生成完成后自动收起提示词区域
  const prevGeneratingRef = useRef(generating);
  useEffect(() => {
    if (prevGeneratingRef.current && !generating && hasContent) {
      setPromptOpen(false);
    }
    prevGeneratingRef.current = generating;
  }, [generating, hasContent]);

  const genLabel = generateLabel || t('generateContent');
  const genIngLabel = generatingLabel || t('generating');
  const builderLabel = promptBuilderLabel || t('promptBuilder');
  const placeholder = promptPlaceholder || t('promptPlaceholder');

  // ── 欢迎界面（未生成内容时） ──
  if (!hasContent) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          {pluginIcon}
          <p className="text-lg font-medium text-muted-foreground">{pluginTitle}</p>
          <p className="text-sm text-muted-foreground text-center max-w-md whitespace-pre-line">
            {pluginDesc}
          </p>
          {generationZoneVisible && (
            <div className="w-full max-w-md space-y-3">
              <textarea
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-14 px-3 py-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ fontFamily: '宋体', fontSize: '16px' }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
              <div className="flex gap-2 justify-center flex-wrap">
                {onPromptBuilderOpen && (
                  <Button
                    variant="outline"
                    onClick={onPromptBuilderOpen}
                    className="gap-1.5"
                  >
                    <Settings2 className="h-4 w-4" />
                    {builderLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={onGenerate}
                  disabled={generating}
                  className="gap-1.5"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {generating ? genIngLabel : genLabel}
                </Button>
              </div>
            </div>
          )}
        </div>
        {/* 状态区（统一滚动区域） */}
        <div className="border-t bg-muted/30 flex-shrink-0">
          {statusExpanded && (
            <div
              ref={statusScrollRef}
              className="max-h-[150px] overflow-y-auto px-2 py-1.5 text-xs whitespace-pre-wrap border-b"
              style={{ fontFamily: '宋体', fontSize: '12px' }}
            >
              {statusLogs.map((log, i) => (
                <div key={i} className={log.isError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
                  {log.msg}
                </div>
              ))}
              {thinkingContent && (
                <div className="text-muted-foreground mt-1">{thinkingContent}</div>
              )}
              {statusLogs.length === 0 && !thinkingContent && (
                <div className="text-muted-foreground">暂无状态信息</div>
              )}
            </div>
          )}
          <div className="px-2 py-1 text-xs flex items-center gap-2 min-h-[24px]">
            <div className="flex-1 truncate text-muted-foreground">
              {!statusExpanded && statusMsg && (
                <span className={statusIsError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
                  {statusMsg}
                </span>
              )}
            </div>
            <button
              onClick={() => setStatusExpanded(!statusExpanded)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title={statusExpanded ? '收起' : '展开'}
            >
              <Brain className="h-3 w-3" />
              <span>状态</span>
              {statusExpanded
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronUp className="h-3 w-3" />
              }
            </button>
          </div>
        </div>
        {promptBuilderDialog}
      </div>
    );
  }

  // ── 内容界面 ──
  return (
    <div className="h-full flex flex-col">
      {/* ① 生成区 */}
      {generationZoneVisible && (
        <>
          {promptOpen ? (
            <div className="px-2 py-1 border-b bg-muted/10 flex-shrink-0 space-y-1">
              {/* 收起箭头 */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setPromptOpen(false)}
                  className="p-0 h-5 w-5 flex items-center justify-center hover:bg-muted/50 rounded transition-colors"
                  title={t('collapseGenZone')}
                >
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-14 px-2 py-1.5 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ fontFamily: '宋体', fontSize: '16px' }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
              <div className="flex gap-2 justify-center flex-wrap">
                {onPromptBuilderOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPromptBuilderOpen}
                    className="gap-1 h-7 text-xs"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {builderLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerate}
                  disabled={generating}
                  className="gap-1 h-7 text-xs"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {generating ? genIngLabel : genLabel}
                </Button>
                {onClearAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearAll}
                    disabled={generating}
                    className="gap-1 h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('clearAll')}
                  </Button>
                )}
                {hasContent && sourceCode != null && onSourceCodeSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSourceEditor}
                    disabled={generating}
                    className="gap-1 h-7 text-xs"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    {t('editSource')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* 收起状态：类似编辑器右上角的小指示箭头 */
            <div className="flex items-center border-b bg-muted/10 flex-shrink-0">
              <div className="flex-1 px-3 py-1 flex items-center gap-2 min-w-0">
                <Wand2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {prompt.trim() || placeholder}
                </span>
              </div>
              <button
                onClick={() => setPromptOpen(true)}
                className="px-2 py-1 h-full flex items-center justify-center hover:bg-muted/50 transition-colors"
                title={t('expandGenZone')}
              >
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ② 工具栏（仅放置与插件内容相关的操作按钮） */}
      {toolbar && (
        <div className="flex items-center gap-1 px-2 py-0.5 border-b bg-muted/20 flex-shrink-0 flex-wrap">
          {toolbar}
        </div>
      )}

      {/* ③ 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {children}
      </div>

      {/* ④ 状态区（统一滚动区域） */}
      <div className="border-t bg-muted/30 flex-shrink-0">
        {statusExpanded && (
          <div
            ref={statusScrollRef}
            className="max-h-[150px] overflow-y-auto px-2 py-1.5 text-xs whitespace-pre-wrap border-b"
            style={{ fontFamily: '宋体', fontSize: '12px' }}
          >
            {statusLogs.map((log, i) => (
              <div key={i} className={log.isError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
                {log.msg}
              </div>
            ))}
            {thinkingContent && (
              <div className="text-muted-foreground mt-1">{thinkingContent}</div>
            )}
            {statusLogs.length === 0 && !thinkingContent && (
              <div className="text-muted-foreground">暂无状态信息</div>
            )}
          </div>
        )}
        <div className="px-2 py-1 text-xs flex items-center gap-2 min-h-[24px]">
          {statusExtra}
          <div className="flex-1 truncate text-muted-foreground">
            {!statusExpanded && statusMsg && (
              <span className={statusIsError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
                {statusMsg}
              </span>
            )}
          </div>
          <button
            onClick={() => setStatusExpanded(!statusExpanded)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={statusExpanded ? '收起' : '展开'}
          >
            <Brain className="h-3 w-3" />
            <span>状态</span>
            {statusExpanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronUp className="h-3 w-3" />
            }
          </button>
        </div>
      </div>

      {/* 提示词构造器弹窗（由插件提供） */}
      {promptBuilderDialog}

      {/* 源码编辑弹窗 */}
      <Dialog open={sourceEditorOpen} onOpenChange={(open) => {
        if (!open) sourceCmViewRef.current = null;
        setSourceEditorOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('editSourceTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('editSource')}</DialogDescription>
          </DialogHeader>
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading editor...</div>}>
            <div className="border-b rounded-t-md overflow-x-auto">
              <EditorToolbar cmViewRef={sourceCmViewRef} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden rounded-b-md border border-t-0">
              <CodeMirror
                value={editingCode}
                onChange={setEditingCode}
                height="55vh"
                extensions={langExtensions}
                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
                onCreateEditor={(view) => { sourceCmViewRef.current = view; }}
                onUpdate={(viewUpdate) => {
                  if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
                  const state = viewUpdate.state;
                  const pos = state.selection.main.head;
                  const line = state.doc.lineAt(pos);
                  const sel = state.selection.main;
                  const next = {
                    line: line.number,
                    col: pos - line.from + 1,
                    lines: state.doc.lines,
                    chars: state.doc.length,
                    selected: Math.abs(sel.to - sel.from),
                  };
                  const prev = cursorInfoRef.current;
                  if (prev.line !== next.line || prev.col !== next.col || prev.lines !== next.lines || prev.chars !== next.chars || prev.selected !== next.selected) {
                    cursorInfoRef.current = next;
                    setCursorInfo(next);
                  }
                }}
              />
            </div>
          </Suspense>
          <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30 rounded-b-md">
            <span>行 {cursorInfo.line}，列 {cursorInfo.col}{cursorInfo.selected > 0 ? `（已选 ${cursorInfo.selected} 字符）` : ''}</span>
            <span>{detectedLangName} · 共 {cursorInfo.lines} 行，{cursorInfo.chars} 字符</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceEditorOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" onClick={handleSaveSource}>
              {t('saveSource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
