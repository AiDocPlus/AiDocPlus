/**
 * EditorSelectionToolbar — 通用选中文本 AI 浮动工具栏
 *
 * 选中文本后弹出，提供可配置的AI操作（改写/扩写/精简/润色/翻译/续写等）。
 * AI 回复后显示预览区，可「替换选中」「插入在后」「取消」。
 * 操作项从全局设置 editor.selectionToolbar.actions 读取。
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  RefreshCw, Maximize2, Minimize2, PenLine, Sparkles, Languages,
  Loader2, X, Check, ArrowDownToLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { type SelectionToolbarAction } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { formatBackendError } from '@/lib/backendError';
import { useShallow } from 'zustand/react/shallow';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  RefreshCw, Maximize2, Minimize2, PenLine, Sparkles, Languages,
};

const SYSTEM_PROMPT = '你是一位专业的写作助手。根据用户指令处理选中的文本。直接输出处理后的文本，不要添加额外说明。用中文回答。';

interface EditorSelectionToolbarProps {
  visible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onClose: () => void;
  onReplace: (text: string) => void;
  onInsertAfter: (text: string) => void;
}

export default function EditorSelectionToolbar({
  visible, position, selectedText,
  onClose, onReplace, onInsertAfter,
}: EditorSelectionToolbarProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const streamingRef = useRef('');
  const unlistenRef = useRef<(() => void) | null>(null);

  const { toolbarSettings, aiServices, activeServiceId } = useSettingsStore(useShallow(s => ({
    toolbarSettings: s.editor.selectionToolbar,
    aiServices: s.ai.services,
    activeServiceId: s.ai.activeServiceId,
  })));
  const activeService = useMemo(() => {
    const svc = activeServiceId ? aiServices.find(s => s.id === activeServiceId && s.enabled) : null;
    return svc || aiServices.find(s => s.enabled) || null;
  }, [aiServices, activeServiceId]);
  const aiParams = getAIInvokeParamsForService(activeService?.id);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);

  const actions = useMemo(() =>
    (toolbarSettings?.actions || [])
      .filter(a => a.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  [toolbarSettings?.actions]);

  useEffect(() => {
    if (!visible) { setResult(''); setError(''); setLoading(false); }
  }, [visible]);

  const handleAction = useCallback(async (action: SelectionToolbarAction) => {
    if (!aiAvailable || loading) return;
    setLoading(true);
    setResult('');
    setError('');
    streamingRef.current = '';

    const userPrompt = action.prompt + selectedText;
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    const requestId = `sel_${Date.now()}`;
    let rawAccumulated = '';

    try {
      const unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
        if (event.payload.request_id !== requestId) return;
        rawAccumulated += event.payload.content;
        const parsed = parseThinkTags(rawAccumulated);
        streamingRef.current = parsed.content;
        setResult(parsed.content);
      });
      unlistenRef.current = unlisten;

      await invoke<string>('chat_stream', {
        messages,
        ...aiParams,
        requestId,
        maxTokens: useSettingsStore.getState().ai.maxTokens ?? 4096,
      });

      unlisten();
      unlistenRef.current = null;
      const finalParsed = parseThinkTags(rawAccumulated);
      setResult(finalParsed.content);
    } catch (err) {
      if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null; }
      if (streamingRef.current) {
        setResult(streamingRef.current);
      } else {
        setError(formatBackendError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [aiAvailable, loading, selectedText, aiParams]);

  const handleStop = useCallback(() => {
    invoke('stop_ai_stream', { requestId: '' }).catch(() => {});
    if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null; }
    setLoading(false);
  }, []);

  if (!visible || !selectedText) return null;

  const posStyle = toolbarSettings?.position === 'below'
    ? { left: Math.max(8, Math.min(position.x - 140, window.innerWidth - 300)), top: Math.max(8, position.y + 8) }
    : { left: Math.max(8, Math.min(position.x - 140, window.innerWidth - 300)), top: Math.max(8, position.y - 44) };

  return (
    <div
      className="fixed z-[9999] border rounded-lg shadow-xl"
      style={{
        ...posStyle,
        fontFamily: "'宋体', 'SimSun', serif",
        fontSize: '14px',
        opacity: 1,
        backgroundColor: 'hsl(var(--card))',
      }}
    >
      {/* 操作按钮栏 */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b flex-wrap">
        {actions.map(a => {
          const Icon = ICON_MAP[a.icon || ''] || Sparkles;
          return (
            <Button key={a.id} variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5"
              disabled={loading || !aiAvailable}
              onClick={() => handleAction(a)}>
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
              {t('editor.selGenerating', { defaultValue: '生成中...' })}
            </div>
          )}
          {result && (
            <div className="px-3 py-2">
              <MarkdownPreview content={result} className="text-sm" />
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-sm text-destructive">{error}</div>
          )}
        </div>
      )}

      {/* 操作按钮（有结果时显示） */}
      {result && !loading && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-t">
          <Button variant="default" size="sm" className="h-6 text-xs gap-1" onClick={() => { onReplace(result); onClose(); }}>
            <Check className="h-3 w-3" />{t('editor.selReplace', { defaultValue: '替换选中' })}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => { onInsertAfter(result); onClose(); }}>
            <ArrowDownToLine className="h-3 w-3" />{t('editor.selInsertAfter', { defaultValue: '插入在后' })}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>
            {t('editor.selCancel', { defaultValue: '取消' })}
          </Button>
        </div>
      )}
    </div>
  );
}
