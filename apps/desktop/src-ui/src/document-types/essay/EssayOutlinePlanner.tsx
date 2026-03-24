/**
 * EssayOutlinePlanner.tsx — 散文大纲规划工具
 *
 * Phase 5: 结构化写作规划
 * - 起承转合四段式结构模板（可增删段落节点）
 * - 每个节点：主题/要点、目标字数、关键意象、情感方向
 * - AI 辅助大纲生成（输入主题 → 生成完整大纲）
 * - 大纲完成度追踪（已写/目标字数进度条）
 * - 与正文段落自动关联
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, Sparkles, ChevronDown, ChevronUp,
  Target, Lightbulb, Heart, FileText, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EssayParagraph, ParagraphRole, EssayDocumentContent } from './types';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';

// ═══ 大纲节点数据结构 ═══

export interface OutlineItem {
  id: string;
  role: ParagraphRole;
  title: string;        // 段落标题/要点
  note: string;         // 写作方向提示
  keyImagery: string;   // 关键意象（逗号分隔）
  emotionDir: string;   // 情感方向
  targetWords: number;  // 目标字数
}

// 起承转合角色样式
const ROLE_CONFIG: Record<ParagraphRole, {
  label: string; desc: string;
  bg: string; border: string; dot: string; textColor: string;
}> = {
  open:  { label: '起', desc: '开篇·引入',  bg: 'bg-blue-50 dark:bg-blue-950/20',   border: 'border-blue-300 dark:border-blue-700',   dot: 'bg-blue-500',   textColor: 'text-blue-700 dark:text-blue-300' },
  carry: { label: '承', desc: '承接·展开',  bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-300 dark:border-green-700', dot: 'bg-green-500', textColor: 'text-green-700 dark:text-green-300' },
  turn:  { label: '转', desc: '转折·深化',  bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-300 dark:border-orange-700', dot: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-300' },
  close: { label: '合', desc: '收束·升华',  bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-300' },
  none:  { label: '—', desc: '自由段落',    bg: '',                                    border: 'border-muted',                           dot: 'bg-muted-foreground', textColor: 'text-muted-foreground' },
};

// 默认四段式大纲模板
function createDefaultOutline(): OutlineItem[] {
  return [
    { id: `ol_${Date.now()}_1`, role: 'open',  title: '', note: '引入场景或触发回忆的细节，点明写作对象', keyImagery: '', emotionDir: '', targetWords: 300 },
    { id: `ol_${Date.now()}_2`, role: 'carry', title: '', note: '展开叙述，铺陈细节，丰富情感层次',       keyImagery: '', emotionDir: '', targetWords: 600 },
    { id: `ol_${Date.now()}_3`, role: 'turn',  title: '', note: '转折深化，引入对比或新的认知视角',       keyImagery: '', emotionDir: '', targetWords: 400 },
    { id: `ol_${Date.now()}_4`, role: 'close', title: '', note: '收束升华，呼应开篇，点明主旨情感',       keyImagery: '', emotionDir: '', targetWords: 300 },
  ];
}

function genId(): string {
  return `ol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ═══ 单个大纲节点编辑 ═══

interface OutlineItemEditorProps {
  item: OutlineItem;
  index: number;
  total: number;
  writtenWords: number;  // 已写字数（来自段落统计）
  onChange: (id: string, updates: Partial<OutlineItem>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

function OutlineItemEditor({
  item, index, total, writtenWords,
  onChange, onDelete, onMoveUp, onMoveDown,
}: OutlineItemEditorProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const cfg = ROLE_CONFIG[item.role];
  const progress = item.targetWords > 0 ? Math.min(writtenWords / item.targetWords, 1) : 0;

  return (
    <div className={cn('rounded-lg border mb-2 overflow-hidden transition-all', cfg.bg, cfg.border)}>
      {/* 标题行 */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* 角色徽章 */}
        <span className={cn(
          'flex-shrink-0 w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center text-white',
          cfg.dot,
        )}>
          {cfg.label}
        </span>

        {/* 标题输入 */}
        <input
          className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground/50 min-w-0"
          placeholder={cfg.desc}
          value={item.title}
          onChange={e => { e.stopPropagation(); onChange(item.id, { title: e.target.value }); }}
          onClick={e => e.stopPropagation()}
        />

        {/* 进度 */}
        <span className="flex-shrink-0 text-[10px] text-muted-foreground">
          {writtenWords}/{item.targetWords}字
        </span>

        {/* 移动/展开按钮 */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            className="p-0.5 hover:text-primary disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMoveUp(item.id)}
            title="上移"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 hover:text-primary disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMoveDown(item.id)}
            title="下移"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            className="p-0.5 hover:text-destructive opacity-40 hover:opacity-100"
            onClick={() => onDelete(item.id)}
            title="删除此节点"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
      </div>

      {/* 进度条 */}
      <div className="h-0.5 bg-muted mx-2.5 mb-1 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', cfg.dot)}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* 写作方向提示 */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <FileText className="h-3 w-3" />写作方向
            </label>
            <textarea
              className="w-full text-xs bg-background/60 border border-border/50 rounded px-2 py-1 resize-none outline-none focus:ring-1 focus:ring-primary/50 min-h-[52px]"
              placeholder="这段想表达什么？记录关键思路..."
              value={item.note}
              onChange={e => onChange(item.id, { note: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 关键意象 */}
            <div>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Lightbulb className="h-3 w-3" />关键意象
              </label>
              <input
                className="w-full text-xs bg-background/60 border border-border/50 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="月光、老屋..."
                value={item.keyImagery}
                onChange={e => onChange(item.id, { keyImagery: e.target.value })}
              />
            </div>

            {/* 情感方向 */}
            <div>
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Heart className="h-3 w-3" />情感方向
              </label>
              <input
                className="w-full text-xs bg-background/60 border border-border/50 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="温暖、忧伤..."
                value={item.emotionDir}
                onChange={e => onChange(item.id, { emotionDir: e.target.value })}
              />
            </div>
          </div>

          {/* 目标字数 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
              <Target className="h-3 w-3" />目标字数
            </label>
            <input
              type="number"
              aria-label="目标字数"
              title="目标字数"
              className="w-20 text-xs bg-background/60 border border-border/50 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
              min={50}
              max={5000}
              step={50}
              value={item.targetWords}
              onChange={e => onChange(item.id, { targetWords: Math.max(50, Number(e.target.value)) })}
            />
            <span className="text-[10px] text-muted-foreground">字</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ 主组件 ═══

interface EssayOutlinePlannerProps {
  essay: EssayDocumentContent;
  paragraphs: EssayParagraph[];
  host?: DocTypeHostAPI;
  onOutlineChange?: (items: OutlineItem[]) => void;
  className?: string;
}

export default function EssayOutlinePlanner({
  essay,
  paragraphs,
  host,
  onOutlineChange,
  className,
}: EssayOutlinePlannerProps) {
  const [items, setItems] = useState<OutlineItem[]>(() => {
    // 优先使用文档中保存的大纲
    if (essay.outline && essay.outline.length > 0) {
      return essay.outline.map(o => ({
        id: o.id,
        role: o.role,
        title: o.title,
        note: o.note,
        keyImagery: o.keyImagery,
        emotionDir: o.emotionDir,
        targetWords: o.targetWords,
      }));
    }
    return createDefaultOutline();
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [theme, setTheme] = useState(essay.settings.theme || '');
  const abortRef = useRef<AbortController | null>(null);

  // ── 计算各大纲节点已写字数（useMemo 避免每次重新计算）──
  const wordsMap = useMemo((): Record<string, number> => {
    if (paragraphs.length === 0 || items.length === 0) return {};
    const totalParas = paragraphs.length;
    const perSlot = Math.ceil(totalParas / items.length);
    const map: Record<string, number> = {};
    items.forEach((item, idx) => {
      const start = idx * perSlot;
      const end = Math.min(start + perSlot, totalParas);
      map[item.id] = paragraphs.slice(start, end).reduce((s, p) => s + p.wordCount, 0);
    });
    return map;
  }, [paragraphs, items]);

  // ── 更新节点 ──
  const handleChange = useCallback((id: string, updates: Partial<OutlineItem>) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, ...updates } : it);
      onOutlineChange?.(next);
      return next;
    });
  }, [onOutlineChange]);

  // ── 删除节点 ──
  const handleDelete = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(it => it.id !== id);
      onOutlineChange?.(next);
      return next;
    });
  }, [onOutlineChange]);

  // ── 移动节点 ──
  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    setItems(prev => {
      const idx = prev.findIndex(it => it.id === id);
      if (idx < 0) return prev;
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      onOutlineChange?.(next);
      return next;
    });
  }, [onOutlineChange]);

  // ── 新增节点 ──
  const handleAddItem = useCallback(() => {
    setItems(prev => {
      const next = [...prev, {
        id: genId(), role: 'none' as ParagraphRole,
        title: '', note: '', keyImagery: '', emotionDir: '', targetWords: 300,
      }];
      onOutlineChange?.(next);
      return next;
    });
  }, [onOutlineChange]);

  // ── 重置为默认四段式 ──
  const handleReset = useCallback(() => {
    const def = createDefaultOutline();
    setItems(def);
    onOutlineChange?.(def);
  }, [onOutlineChange]);

  // ── AI 辅助生成大纲（直接调用 chatStream，解析 JSON 回填）──
  const handleAIGenerate = useCallback(async () => {
    if (!host || !theme.trim()) return;
    setAiLoading(true);
    setAiError(null);
    abortRef.current = new AbortController();

    const { subtype, mood, targetStyle, targetWordCount } = essay.settings;
    const prompt = `请为一篇散文生成起承转合的四段大纲，严格按 JSON 格式输出，不要任何额外文字：

主题：${theme}
散文类型：${subtype}，情感基调：${mood}，目标风格：${targetStyle}，目标字数：${targetWordCount}字

输出格式（只输出这个 JSON 数组）：
[
  {"role":"open","title":"标题","note":"写作方向","keyImagery":"意象1,意象2","emotionDir":"情感方向","targetWords":300},
  {"role":"carry","title":"标题","note":"写作方向","keyImagery":"意象1,意象2","emotionDir":"情感方向","targetWords":600},
  {"role":"turn","title":"标题","note":"写作方向","keyImagery":"意象1,意象2","emotionDir":"情感方向","targetWords":400},
  {"role":"close","title":"标题","note":"写作方向","keyImagery":"意象1,意象2","emotionDir":"情感方向","targetWords":300}
]`;

    try {
      const full = await host.ai.chatStream(
        [{ role: 'user', content: prompt }],
        () => {},
        { signal: abortRef.current.signal },
      );

      // 从响应中提取 JSON 数组（容忍 markdown 代码块包裹）
      const jsonMatch = full.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) throw new Error('未找到 JSON 数组');

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        role: ParagraphRole; title: string; note: string;
        keyImagery: string; emotionDir: string; targetWords: number;
      }>;

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('解析结果为空');

      const newItems: OutlineItem[] = parsed.map((o, i) => ({
        id: genId(),
        role: (['open','carry','turn','close','none'] as ParagraphRole[]).includes(o.role)
          ? o.role : ['open','carry','turn','close'][i % 4] as ParagraphRole,
        title: String(o.title || ''),
        note: String(o.note || ''),
        keyImagery: String(o.keyImagery || ''),
        emotionDir: String(o.emotionDir || ''),
        targetWords: Math.max(50, Number(o.targetWords) || 300),
      }));

      setItems(newItems);
      onOutlineChange?.(newItems);
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setAiError((err as Error)?.message || 'AI 生成失败');
      }
    } finally {
      setAiLoading(false);
      abortRef.current = null;
    }
  }, [host, theme, essay.settings, onOutlineChange]);

  // ── 总体进度 ──
  const totalTarget = items.reduce((s, it) => s + it.targetWords, 0);
  const totalWritten = paragraphs.reduce((s, p) => s + p.wordCount, 0);
  const overallPct = totalTarget > 0 ? Math.min(totalWritten / totalTarget, 1) : 0;

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* ── 顶部：主题输入 + AI 生成 ── */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            className="flex-1 text-xs bg-muted rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 min-w-0"
            placeholder="输入主题，如：乡愁与时光…"
            value={theme}
            onChange={e => setTheme(e.target.value)}
          />
          <Button
            size="sm"
            variant="default"
            className="h-6 text-[11px] px-2 flex-shrink-0"
            disabled={aiLoading || !theme.trim() || !host}
            onClick={() => { void handleAIGenerate(); }}
            title={host ? 'AI 辅助生成大纲' : '需要 AI 服务'}
          >
            {aiLoading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Sparkles className="h-3 w-3" />}
            <span className="ml-1">{aiLoading ? '生成中…' : 'AI 生成'}</span>
          </Button>
          {aiError && (
            <p className="text-[10px] text-destructive">{aiError}</p>
          )}
        </div>

        {/* 总进度条 */}
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>整体进度</span>
            <span>{totalWritten.toLocaleString()} / {totalTarget.toLocaleString()} 字</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallPct * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 大纲节点列表 ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
        {items.map((item, idx) => (
          <OutlineItemEditor
            key={item.id}
            item={item}
            index={idx}
            total={items.length}
            writtenWords={wordsMap[item.id] ?? 0}
            onChange={handleChange}
            onDelete={handleDelete}
            onMoveUp={id => handleMove(id, 'up')}
            onMoveDown={id => handleMove(id, 'down')}
          />
        ))}
      </div>

      {/* ── 底部操作 ── */}
      <div className="flex-shrink-0 border-t bg-card px-3 py-2 flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-6 text-[11px]"
          onClick={handleAddItem}
        >
          <Plus className="h-3 w-3 mr-1" />添加段落
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px] text-muted-foreground"
          onClick={handleReset}
          title="重置为默认四段式大纲"
        >
          重置
        </Button>
      </div>
    </div>
  );
}
