/**
 * EssayPreview.tsx — 散文阅读预览组件
 *
 * Phase 2: 专业排版预览
 * - 杂志/期刊风格排版
 * - 修辞手法高亮标注（彩色下划线 + tooltip）
 * - 意象关键词着色（按感官类型）
 * - 段落角色色带（左侧竖线）
 * - 元数据信息区
 * - 打印友好样式
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { EssayDocumentContent, RhetoricType } from './types';
import {
  ESSAY_SUBTYPE_LABEL,
  PARAGRAPH_ROLE_OPTIONS,
  ESSAY_MOOD_OPTIONS,
} from './constants';

// ── 修辞颜色映射 ──
const RHETORIC_COLORS: Record<RhetoricType, { bg: string; text: string; label: string }> = {
  metaphor:          { bg: 'bg-blue-100 dark:bg-blue-900/40',   text: 'text-blue-700 dark:text-blue-300',   label: '比喻' },
  personification:   { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: '拟人' },
  parallelism:       { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: '排比' },
  synesthesia:       { bg: 'bg-pink-100 dark:bg-pink-900/40',   text: 'text-pink-700 dark:text-pink-300',   label: '通感' },
  hyperbole:         { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', label: '夸张' },
  'rhetorical-question': { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', label: '设问' },
  contrast:          { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: '对偶' },
  allusion:          { bg: 'bg-rose-100 dark:bg-rose-900/40',   text: 'text-rose-700 dark:text-rose-300',   label: '用典' },
  repetition:        { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', label: '反复' },
  symbolism:         { bg: 'bg-teal-100 dark:bg-teal-900/40',   text: 'text-teal-700 dark:text-teal-300',   label: '象征' },
  other:             { bg: 'bg-gray-100 dark:bg-gray-800',       text: 'text-gray-600 dark:text-gray-400',   label: '修辞' },
};

// ── 段落角色色带 ──
const ROLE_BORDER: Record<string, string> = {
  open:  'border-l-4 border-blue-400 pl-3',
  carry: 'border-l-4 border-green-400 pl-3',
  turn:  'border-l-4 border-orange-400 pl-3',
  close: 'border-l-4 border-purple-400 pl-3',
  none:  '',
};

interface EssayPreviewProps {
  essay: EssayDocumentContent;
  content: string;
  className?: string;
}

export default function EssayPreview({ essay, content, className }: EssayPreviewProps) {
  // 将 content 按段落拆分并与段落信息关联
  const paragraphsWithRoles = useMemo(() => {
    const lines = content.split(/\n\n+/).filter(l => l.trim());
    return lines.map((text, idx) => {
      const matched = essay.paragraphs.find(p => p.index === idx);
      return {
        idx,
        text: text.trim(),
        role: matched?.role ?? 'none',
        roleManual: matched?.roleManual ?? false,
      };
    });
  }, [content, essay.paragraphs]);

  // 为段落文本添加修辞高亮
  const renderParagraphWithRhetoric = (text: string, _paraIdx: number) => {
    // 收集此段落内的修辞标注（简化：按文字匹配）
    const annotations = essay.rhetorics.filter(r =>
      text.includes(r.text) && r.text.length > 1,
    );

    if (annotations.length === 0) {
      return <span>{text}</span>;
    }

    // 对文本中的修辞片段进行标注
    // 按文本长度降序排列，优先匹配长的
    const sorted = [...annotations].sort((a, b) => b.text.length - a.text.length);
    const processed = new Set<string>();

    for (const ann of sorted) {
      if (processed.has(ann.text)) continue;
      processed.add(ann.text);
    }

    // 简单线性扫描替换
    const fragments: { text: string; rhetoric?: typeof annotations[0] }[] = [];
    let cursor = 0;
    const sortedUniq = [...new Map(sorted.map(a => [a.text, a])).values()];

    // 构建标注位置列表
    const positions: { start: number; end: number; ann: typeof annotations[0] }[] = [];
    for (const ann of sortedUniq) {
      let searchFrom = 0;
      while (true) {
        const pos = text.indexOf(ann.text, searchFrom);
        if (pos === -1) break;
        // 检查是否与已有位置重叠
        const overlaps = positions.some(p => pos < p.end && pos + ann.text.length > p.start);
        if (!overlaps) {
          positions.push({ start: pos, end: pos + ann.text.length, ann });
        }
        searchFrom = pos + 1;
      }
    }
    positions.sort((a, b) => a.start - b.start);

    for (const pos of positions) {
      if (cursor < pos.start) {
        fragments.push({ text: text.slice(cursor, pos.start) });
      }
      fragments.push({ text: pos.ann.text, rhetoric: pos.ann });
      cursor = pos.end;
    }
    if (cursor < text.length) {
      fragments.push({ text: text.slice(cursor) });
    }

    return (
      <>
        {fragments.map((frag, i) => {
          if (!frag.rhetoric) {
            return <span key={i}>{frag.text}</span>;
          }
          const colors = RHETORIC_COLORS[frag.rhetoric.type] ?? RHETORIC_COLORS.other;
          return (
            <span
              key={i}
              className={cn(
                'relative inline cursor-help rounded-sm px-0.5',
                colors.bg, colors.text,
                'underline decoration-dotted',
              )}
              title={`${colors.label}：${frag.rhetoric.type}`}
            >
              {frag.text}
              <span className={cn(
                'absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] px-1 py-0.5 rounded whitespace-nowrap z-10',
                'bg-foreground text-background opacity-0 hover:opacity-100 transition-opacity pointer-events-none',
              )}>
                {colors.label}
              </span>
            </span>
          );
        })}
      </>
    );
  };

  const subtypeLabel = ESSAY_SUBTYPE_LABEL[essay.settings.subtype] ?? '散文';
  const moodOpt = ESSAY_MOOD_OPTIONS.find(m => m.value === essay.settings.mood);

  // 字数统计
  const charCount = content.replace(/\s/g, '').length;

  return (
    <div
      className={cn(
        'h-full overflow-y-auto bg-background essay-preview-wrapper',
        className,
      )}
    >
      {/* 打印样式 */}
      <style>{`
        @media print {
          .essay-preview-wrapper { padding: 20mm; }
          .essay-preview-no-print { display: none !important; }
          .essay-preview-wrapper * { color: #000 !important; background: #fff !important; }
        }
        .essay-preview-wrapper {
          font-family: 'Songti SC', '宋体', 'SimSun', serif;
        }
      `}</style>

      <div className="max-w-2xl mx-auto py-10 px-8">

        {/* ── 标题区 ── */}
        <header className="text-center mb-8 pb-6 border-b border-muted">
          <h1 className="text-2xl font-bold tracking-widest mb-2" style={{ fontFamily: "'Songti SC', '宋体', SimSun, serif" }}>
            {essay.title || '无题'}
          </h1>
          {essay.settings.theme && (
            <p className="text-sm text-muted-foreground mt-1 tracking-wide">
              — {essay.settings.theme} —
            </p>
          )}
          {/* 元数据行 */}
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted">{subtypeLabel}</span>
            {moodOpt && <span>{moodOpt.emoji} {moodOpt.label}</span>}
            <span>{charCount.toLocaleString()} 字</span>
            {essay.settings.keyImagery.length > 0 && (
              <span>意象：{essay.settings.keyImagery.slice(0, 3).join('、')}</span>
            )}
          </div>
        </header>

        {/* ── 正文区 ── */}
        <main className="space-y-5">
          {paragraphsWithRoles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">（暂无内容）</p>
          ) : (
            paragraphsWithRoles.map(({ idx, text, role }) => {
              const roleBorder = ROLE_BORDER[role] ?? '';
              const roleOpt = PARAGRAPH_ROLE_OPTIONS.find(r => r.value === role);

              return (
                <div key={idx} className="relative group">
                  {/* 段落角色标签（hover 显示） */}
                  {role !== 'none' && roleOpt && (
                    <span className={cn(
                      'absolute -left-8 top-1 text-[10px] font-medium opacity-0 group-hover:opacity-60 transition-opacity essay-preview-no-print',
                      roleOpt.color,
                    )}>
                      {roleOpt.label}
                    </span>
                  )}

                  <p
                    className={cn(
                      'text-base leading-[2.0] tracking-wide text-justify',
                      'indent-[2em]',
                      roleBorder,
                    )}
                    style={{ fontFamily: "'Songti SC', '宋体', SimSun, serif", fontSize: '16px' }}
                  >
                    {renderParagraphWithRhetoric(text, idx)}
                  </p>
                </div>
              );
            })
          )}
        </main>

        {/* ── 修辞图例 ── */}
        {essay.rhetorics.length > 0 && (
          <footer className="mt-10 pt-6 border-t border-muted essay-preview-no-print">
            <p className="text-xs text-muted-foreground font-medium mb-2">修辞标注图例</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set(essay.rhetorics.map(r => r.type))].map(type => {
                const colors = RHETORIC_COLORS[type] ?? RHETORIC_COLORS.other;
                return (
                  <span key={type} className={cn('text-[11px] px-2 py-0.5 rounded', colors.bg, colors.text)}>
                    {colors.label}
                  </span>
                );
              })}
            </div>
          </footer>
        )}

        {/* ── 意象标注图例 ── */}
        {essay.settings.keyImagery.length > 0 && (
          <div className="mt-4 essay-preview-no-print">
            <p className="text-xs text-muted-foreground font-medium mb-2">关键意象</p>
            <div className="flex flex-wrap gap-2">
              {essay.settings.keyImagery.map((img, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {img}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
