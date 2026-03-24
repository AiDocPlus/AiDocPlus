/**
 * NovelInlineAI — 内联 AI 命令面板 + 虚影预览
 *
 * Phase 2.2: 编辑器中输入 // 后弹出命令面板
 * Phase 2.3: AI 生成内容以虚影形式出现，Tab 接受 / Esc 拒绝
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { Sparkles, MessageSquare, Mountain, PenLine, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getActiveService } from '@aidocplus/shared-types';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent } from './types';
import { buildSmartSystemPrompt, buildContextForMode } from './novelContext';

interface NovelInlineAIProps {
  editorRef: React.RefObject<EditorView | null>;
  host: DocTypeHostAPI;
  novel: NovelDocumentContent;
  activeChapterId: string | null;
}

interface InlineCommand {
  key: string;
  label: string;
  icon: typeof Sparkles;
  prompt: string;
}

const INLINE_COMMANDS: InlineCommand[] = [
  { key: 'continue', label: '续写', icon: Sparkles, prompt: '请续写以下小说正文，保持文风和节奏一致：' },
  { key: 'dialogue', label: '对话', icon: MessageSquare, prompt: '请在此处插入一段自然的角色对话：' },
  { key: 'scene', label: '场景', icon: Mountain, prompt: '请在此处补充一段生动的场景描写（环境、氛围、感官细节）：' },
  { key: 'describe', label: '描写', icon: PenLine, prompt: '请在此处补充细节描写（人物外貌、心理活动、环境渲染）：' },
  { key: 'transition', label: '过渡', icon: ArrowRight, prompt: '请写一段自然的过渡段，衔接上下文：' },
];

export default function NovelInlineAI({ editorRef, host, novel, activeChapterId }: NovelInlineAIProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [triggerPos, setTriggerPos] = useState(0); // 编辑器中 // 的起始位置
  const [ghostText, setGhostText] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const settingsStore = useSettingsStore();
  const activeService = getActiveService(settingsStore.ai);
  const aiParams = getAIInvokeParamsForService(activeService?.id);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);

  // 监听编辑器输入 // 触发命令面板
  useEffect(() => {
    const view = editorRef.current;
    if (!view) return;

    const checkSlashCommand = () => {
      try {
        const { head } = view.state.selection.main;
        if (head < 2) return;
        const twoChars = view.state.sliceDoc(head - 2, head);
        if (twoChars === '//') {
          const coords = view.coordsAtPos(head);
          if (coords) {
            setVisible(true);
            setPosition({ x: coords.left, y: coords.bottom + 4 });
            setTriggerPos(head - 2);
          }
        }
      } catch { /* view destroyed */ }
    };

    // 使用 MutationObserver 或轮询方式检测
    // 500ms轮询（面板已打开时不轮询）
    const interval = setInterval(() => { if (!visible && !loading) checkSlashCommand(); }, 500);
    return () => clearInterval(interval);
  }, [editorRef]);

  // Tab 接受虚影 / Esc 拒绝
  useEffect(() => {
    if (!ghostText) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && ghostText) {
        e.preventDefault();
        // 接受虚影：将虚影文本插入到编辑器
        const view = editorRef.current;
        if (view) {
          const pos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: pos, to: pos, insert: ghostText },
            selection: { anchor: pos + ghostText.length },
          });
          view.focus();
        }
        setGhostText('');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setGhostText('');
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [ghostText, editorRef]);

  const handleCommand = useCallback(async (cmd: InlineCommand) => {
    setVisible(false);
    if (!aiAvailable || loading) return;

    const view = editorRef.current;
    if (!view) return;

    // 删除编辑器中的 //
    view.dispatch({
      changes: { from: triggerPos, to: triggerPos + 2, insert: '' },
    });

    setLoading(true);
    setGhostText('');

    const systemPrompt = buildSmartSystemPrompt(novel, activeChapterId);
    const contextStr = buildContextForMode(novel, activeChapterId, 'chapter');
    const cursorPos = view.state.selection.main.head;
    const before = view.state.sliceDoc(Math.max(0, cursorPos - 1000), cursorPos);
    const userPrompt = cmd.prompt + '\n\n' + before;

    const messages = [
      { role: 'system' as const, content: systemPrompt + contextStr },
      { role: 'user' as const, content: userPrompt },
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await host.ai.chatStream(messages, (cumulative: string) => {
        setGhostText(cumulative);
      }, { signal: abortController.signal });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('InlineAI error:', formatBackendError(err));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [aiAvailable, loading, editorRef, triggerPos, novel, activeChapterId, host.ai]);

  if (!visible && !ghostText) return null;

  return (
    <>
      {/* 命令面板 */}
      {visible && (
        <div className="fixed z-[9999] bg-card border rounded-lg shadow-xl p-1 min-w-[160px]"
          style={{ left: Math.max(8, position.x), top: Math.max(8, position.y), fontFamily: "'宋体', 'SimSun', serif", fontSize: '14px' }}>
          {INLINE_COMMANDS.map(cmd => {
            const Icon = cmd.icon;
            return (
              <button key={cmd.key} className="flex items-center gap-2 px-2.5 py-1.5 w-full text-left text-sm rounded hover:bg-accent transition-colors"
                onClick={() => handleCommand(cmd)}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {cmd.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 虚影预览提示 */}
      {ghostText && (
        <div className="fixed bottom-16 right-8 z-[9998] bg-card border rounded-lg shadow-lg px-3 py-2 max-w-[300px]"
          style={{ fontFamily: "'宋体', 'SimSun', serif", fontSize: '13px' }}>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-amber-500" />}
            {loading ? t('novel.inlineGenerating', { defaultValue: 'AI 生成中...' }) : t('novel.inlineAcceptHint', { defaultValue: 'Tab 接受 · Esc 拒绝' })}
          </div>
          <div className="text-sm text-foreground/60 italic max-h-[100px] overflow-y-auto whitespace-pre-wrap">
            {ghostText.slice(0, 300)}{ghostText.length > 300 ? '...' : ''}
          </div>
        </div>
      )}
    </>
  );
}
