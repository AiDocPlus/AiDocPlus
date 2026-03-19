/**
 * NovelSelectionToolbar — 选中文本 AI 浮动工具栏
 *
 * 选中文本后弹出在选区上方，提供续写/改写/扩写/精简/润色操作。
 * AI 回复后显示预览区，可「替换选中」「插入在后」「取消」。
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { Sparkles, RefreshCw, Maximize2, Minimize2, PenLine, Loader2, X, Check, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getActiveService } from '@aidocplus/shared-types';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent } from './types';
import { buildSmartSystemPrompt, buildContextForMode } from './novelContext';

interface NovelSelectionToolbarProps {
  editorRef: React.RefObject<EditorView | null>;
  host: DocTypeHostAPI;
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  visible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onClose: () => void;
  onReplace: (text: string) => void;
  onInsertAfter: (text: string) => void;
}

type AIAction = 'continue' | 'rewrite' | 'expand' | 'simplify' | 'polish';

const ACTION_PROMPTS: Record<AIAction, string> = {
  continue: '请续写以下文本，保持文风和节奏一致：\n\n',
  rewrite: '请改写以下文本，保持原意但用不同的表达方式：\n\n',
  expand: '请对以下文本进行扩写，增加细节描写和环境渲染：\n\n',
  simplify: '请精简以下文本，去除冗余描写，保留核心信息：\n\n',
  polish: '请对以下文本进行语言润色，提升文学性和表现力：\n\n',
};

export default function NovelSelectionToolbar({
  host, novel, activeChapterId,
  visible, position, selectedText,
  onClose, onReplace, onInsertAfter,
}: NovelSelectionToolbarProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const settingsStore = useSettingsStore();
  const activeService = getActiveService(settingsStore.ai);
  const aiParams = getAIInvokeParamsForService(activeService?.id);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);

  // 关闭时重置
  useEffect(() => {
    if (!visible) {
      setResult('');
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const handleAction = useCallback(async (action: AIAction) => {
    if (!aiAvailable || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    const systemPrompt = buildSmartSystemPrompt(novel, activeChapterId);
    const contextStr = buildContextForMode(novel, activeChapterId, 'chapter');
    const fullSystem = systemPrompt + contextStr;
    const userPrompt = ACTION_PROMPTS[action] + selectedText;

    const messages = [
      { role: 'system' as const, content: fullSystem },
      { role: 'user' as const, content: userPrompt },
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      let fullContent = '';
      await host.ai.chatStream(messages, (chunk: string) => {
        fullContent += chunk;
        setResult(fullContent);
      }, { signal: abortController.signal });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(formatBackendError(err));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [aiAvailable, loading, novel, activeChapterId, selectedText, host.ai]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!visible || !selectedText) return null;

  const ACTIONS: { key: AIAction; icon: typeof Sparkles; label: string }[] = [
    { key: 'continue', icon: Sparkles, label: t('novel.selContinue', { defaultValue: '续写' }) },
    { key: 'rewrite', icon: RefreshCw, label: t('novel.selRewrite', { defaultValue: '改写' }) },
    { key: 'expand', icon: Maximize2, label: t('novel.selExpand', { defaultValue: '扩写' }) },
    { key: 'simplify', icon: Minimize2, label: t('novel.selSimplify', { defaultValue: '精简' }) },
    { key: 'polish', icon: PenLine, label: t('novel.selPolish', { defaultValue: '润色' }) },
  ];

  return (
    <div
      className="fixed z-[9999] border rounded-lg shadow-xl"
      style={{
        left: Math.max(8, Math.min(position.x - 140, window.innerWidth - 300)),
        top: Math.max(8, position.y - 44),
        fontFamily: "'宋体', 'SimSun', serif",
        fontSize: '14px',
        opacity: 1,
        backgroundColor: 'hsl(var(--card))',
      }}
    >
      {/* 操作按钮栏 */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b">
        {ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <Button key={a.key} variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5"
              disabled={loading || !aiAvailable}
              onClick={() => handleAction(a.key)}>
              <Icon className="h-3 w-3" />{a.label}
            </Button>
          );
        })}
        {loading && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={handleStop}>
            <X className="h-3 w-3" />
          </Button>
        )}
        {!loading && !result && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-1" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* AI 回复预览区 */}
      {(loading || result || error) && (
        <div className="max-w-[400px] max-h-[250px] overflow-y-auto">
          {loading && !result && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('novel.selGenerating', { defaultValue: '生成中...' })}
            </div>
          )}
          {result && (
            <div className="px-3 py-2">
              <MarkdownPreview content={result} className="text-sm" />
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮（有结果时显示） */}
      {result && !loading && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-t">
          <Button variant="default" size="sm" className="h-6 text-xs gap-1" onClick={() => { onReplace(result); onClose(); }}>
            <Check className="h-3 w-3" />{t('novel.selReplace', { defaultValue: '替换选中' })}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => { onInsertAfter(result); onClose(); }}>
            <ArrowDownToLine className="h-3 w-3" />{t('novel.selInsertAfter', { defaultValue: '插入在后' })}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>
            {t('novel.selCancel', { defaultValue: '取消' })}
          </Button>
        </div>
      )}
    </div>
  );
}
