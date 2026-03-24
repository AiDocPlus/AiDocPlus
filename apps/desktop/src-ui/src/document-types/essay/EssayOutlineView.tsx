/**
 * EssayOutlineView.tsx — 散文大纲视图
 *
 * Phase 2: 结构化段落大纲
 * - 段落树状结构（起承转合色块标识）
 * - 每段预览+字数统计
 * - 段落角色快速修改
 * - 与编辑器联动滚动
 * - 结构完整度检查
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, CheckCircle2, AlertCircle } from 'lucide-react';
import type { EssayParagraph, ParagraphRole } from './types';
import { PARAGRAPH_ROLE_OPTIONS, PARAGRAPH_ROLE_LABEL } from './constants';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EssayOutlineViewProps {
  paragraphs: EssayParagraph[];
  wordCount: number;
  onRoleChange: (paragraphId: string, role: ParagraphRole) => void;
  onScrollToP?: (index: number) => void;
  className?: string;
}

// ── 角色完整度要求：理想情况下每种角色至少有1段 ──
const REQUIRED_ROLES: ParagraphRole[] = ['open', 'carry', 'turn', 'close'];

// ── 角色颜色方案 ──
const ROLE_STYLE: Record<ParagraphRole | 'none', { bg: string; border: string; dot: string; label: string; desc: string }> = {
  open:  { bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-l-4 border-blue-400',   dot: 'bg-blue-400',   label: '起', desc: '开篇·引入' },
  carry: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-l-4 border-green-400', dot: 'bg-green-400', label: '承', desc: '承接·展开' },
  turn:  { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-l-4 border-orange-400', dot: 'bg-orange-400', label: '转', desc: '转折·深化' },
  close: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-l-4 border-purple-400', dot: 'bg-purple-400', label: '合', desc: '收束·升华' },
  none:  { bg: '',                                    border: 'border-l-4 border-transparent', dot: 'bg-muted',    label: '—', desc: '未标记' },
};

export default function EssayOutlineView({
  paragraphs,
  wordCount,
  onRoleChange,
  onScrollToP,
  className,
}: EssayOutlineViewProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // ── 结构完整度检查 ──
  const rolePresent = useCallback((role: ParagraphRole) =>
    paragraphs.some(p => p.role === role), [paragraphs]);

  const structureScore = REQUIRED_ROLES.filter(rolePresent).length;
  const structureComplete = structureScore === 4;

  // ── 统计各角色段落数 ──
  const roleCounts = REQUIRED_ROLES.reduce<Record<string, number>>((acc, role) => {
    acc[role] = paragraphs.filter(p => p.role === role).length;
    return acc;
  }, {});

  return (
    <div className={cn('h-full flex flex-col bg-background overflow-hidden', className)}>

      {/* ── 顶部统计栏 ── */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">文章结构</span>
          <div className="flex items-center gap-1 text-[11px]">
            {structureComplete
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
            <span className={structureComplete ? 'text-green-600' : 'text-amber-600'}>
              {structureScore}/4 完整
            </span>
          </div>
        </div>

        {/* 起承转合分布条 */}
        <div className="flex gap-1">
          {REQUIRED_ROLES.map(role => {
            const style = ROLE_STYLE[role];
            const count = roleCounts[role] ?? 0;
            const present = count > 0;
            return (
              <div key={role} className="flex-1 text-center">
                <div className={cn(
                  'h-1.5 rounded-full mb-1',
                  present ? style.dot : 'bg-muted',
                )} />
                <span className={cn(
                  'text-[10px] font-medium',
                  present ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {style.label}
                  {count > 0 && <span className="ml-0.5 opacity-70">×{count}</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* 缺失角色提示 */}
        {!structureComplete && (
          <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            缺少：{REQUIRED_ROLES.filter(r => !rolePresent(r)).map(r => ROLE_STYLE[r].desc).join('、')}
          </div>
        )}
      </div>

      {/* ── 段落列表 ── */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {paragraphs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-8 gap-2">
            <span className="text-2xl opacity-30">📝</span>
            <p>开始写作后段落将在此显示</p>
            <p className="text-xs">为每段标记角色可分析文章结构</p>
          </div>
        ) : (
          (() => {
            const totalWords = paragraphs.reduce((s, p) => s + p.wordCount, 0);
            return paragraphs.map((para, listIdx) => {
            const style = ROLE_STYLE[para.role];
            const isHovered = hoveredIdx === listIdx;
            const widthPct = totalWords > 0 ? (para.wordCount / totalWords) * 100 : 0;

            return (
              <div
                key={para.id}
                className={cn(
                  'group mx-2 my-1 rounded-md border transition-all duration-150 cursor-pointer',
                  style.bg,
                  style.border,
                  isHovered && 'shadow-sm',
                )}
                onMouseEnter={() => setHoveredIdx(listIdx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onScrollToP?.(para.index)}
              >
                <div className="flex items-start gap-1.5 px-2 py-1.5">
                  {/* 拖拽手柄（占位，Phase 5 实现拖拽功能） */}
                  <GripVertical className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-40" />

                  {/* 序号 */}
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground w-4 mt-0.5 text-right">
                    {listIdx + 1}
                  </span>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                      {para.preview || '（空段落）'}
                    </p>
                    {/* 字数进度条 */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', style.dot)}
                          style={{ width: `${Math.max(widthPct, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {para.wordCount}字
                      </span>
                    </div>
                  </div>

                  {/* 角色标签 — 点击修改 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'flex-shrink-0 text-[11px] font-bold w-6 h-6 rounded flex items-center justify-center mt-0.5',
                          'transition-colors hover:opacity-80',
                          style.dot.replace('bg-', 'bg-') + ' text-white',
                        )}
                        title={`当前: ${PARAGRAPH_ROLE_LABEL[para.role]} — 点击修改角色`}
                        onClick={e => e.stopPropagation()}
                      >
                        {style.label}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card min-w-[120px]">
                      {PARAGRAPH_ROLE_OPTIONS.map(opt => {
                        const optStyle = ROLE_STYLE[opt.value];
                        return (
                          <DropdownMenuItem
                            key={opt.value}
                            className="text-xs gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRoleChange(para.id, opt.value);
                            }}
                          >
                            <span className={cn('w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0', optStyle.dot)}>
                              {optStyle.label}
                            </span>
                            <span>{optStyle.desc}</span>
                            {para.role === opt.value && <span className="ml-auto text-primary">✓</span>}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          });
          })()
        )}
      </div>

      {/* ── 底部统计 ── */}
      {paragraphs.length > 0 && (
        <div className="flex-shrink-0 border-t bg-card px-3 py-1.5 text-[11px] text-muted-foreground flex items-center gap-3">
          <span>{paragraphs.length} 段</span>
          <span>{wordCount.toLocaleString()} 字</span>
          <span className="ml-auto">
            均 {paragraphs.length > 0 ? Math.round(wordCount / paragraphs.length) : 0} 字/段
          </span>
        </div>
      )}
    </div>
  );
}
