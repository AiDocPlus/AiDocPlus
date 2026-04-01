/**
 * EssayStatusBar.tsx — 散文专用状态栏
 *
 * Phase 1: 从 EssayDocWorkspace 抽取并增强
 * - 字数统计（当前/目标，进度条）
 * - 段落数 / 修辞数
 * - 阅读时间
 * - 写作阶段指示器
 * - 写作速度（字/分钟）
 * - 光标位置
 * - 保存状态
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { detectEssayPhase, getPhaseLabel, getPhaseColor } from './essayContext';
import type { EssayDocumentContent } from './types';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface EssayStatusBarProps {
  essay: EssayDocumentContent;
  wordCount: number;
  paragraphCount: number;
  rhetoricCount: number;
  readingTime: number;
  saveStatus: SaveStatus;
  cursorLine?: number;
  cursorCol?: number;
}

export default function EssayStatusBar({
  essay,
  wordCount,
  paragraphCount,
  rhetoricCount,
  readingTime,
  saveStatus,
  cursorLine,
  cursorCol,
}: EssayStatusBarProps) {
  const targetWords = essay.settings.targetWordCount;
  const progress = targetWords > 0 ? Math.min(100, Math.round((wordCount / targetWords) * 100)) : 0;
  const phase = detectEssayPhase(essay);
  const phaseLabel = getPhaseLabel(phase);
  const phaseColor = getPhaseColor(phase);

  // ── 写作速度（字/分钟）──
  const wordCountRef = useRef(wordCount);
  const [writingSpeed, setWritingSpeed] = useState(0);
  const speedHistoryRef = useRef<{ time: number; count: number }[]>([]);

  useEffect(() => {
    const now = Date.now();
    speedHistoryRef.current.push({ time: now, count: wordCount });
    // 保留最近5分钟的记录
    const fiveMinAgo = now - 5 * 60 * 1000;
    speedHistoryRef.current = speedHistoryRef.current.filter(r => r.time > fiveMinAgo);

    if (speedHistoryRef.current.length >= 2) {
      const oldest = speedHistoryRef.current[0];
      const newest = speedHistoryRef.current[speedHistoryRef.current.length - 1];
      const elapsed = (newest.time - oldest.time) / 60000; // 分钟
      const diff = newest.count - oldest.count;
      if (elapsed > 0 && diff > 0) {
        setWritingSpeed(Math.round(diff / elapsed));
      } else if (diff <= 0) {
        setWritingSpeed(0);
      }
    }
    wordCountRef.current = wordCount;
  }, [wordCount]);

  // ── 保存状态显示 ──
  const saveLabel = saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存';
  const saveColor =
    saveStatus === 'saved' ? 'text-green-600 dark:text-green-400' :
    saveStatus === 'saving' ? 'text-amber-500' :
    'text-red-500';

  return (
    <div className="flex items-center gap-0 px-2 py-0.5 border-t text-[11px] text-muted-foreground flex-shrink-0 bg-card select-none overflow-x-auto scrollbar-hide">

      {/* ── 写作阶段 ── */}
      <span className={cn('font-medium px-2 py-0.5 rounded-sm mr-1', phaseColor)}>
        {phaseLabel}
      </span>

      <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />

      {/* ── 字数 ── */}
      <span className="flex-shrink-0 px-1">
        <span className="font-medium text-foreground">{wordCount.toLocaleString()}</span>
        {targetWords > 0 && (
          <span className="text-muted-foreground">/{targetWords.toLocaleString()} 字</span>
        )}
        {targetWords === 0 && <span className="text-muted-foreground"> 字</span>}
      </span>

      {/* ── 目标进度条 ── */}
      {targetWords > 0 && (
        <div className="flex items-center gap-1 px-1 flex-shrink-0">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress >= 100 ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className={cn(progress >= 100 && 'text-green-600 font-medium')}>{progress}%</span>
        </div>
      )}

      <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />

      {/* ── 段落/修辞 ── */}
      <span className="flex-shrink-0 px-1">{paragraphCount} 段</span>
      {rhetoricCount > 0 && (
        <>
          <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />
          <span className="flex-shrink-0 px-1 text-amber-500">{rhetoricCount} 处修辞</span>
        </>
      )}

      <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />

      {/* ── 阅读时间 ── */}
      <span className="flex-shrink-0 px-1">约 {readingTime} 分钟</span>

      {/* ── 写作速度 ── */}
      {writingSpeed > 0 && (
        <>
          <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />
          <span className="flex-shrink-0 px-1 text-blue-500">{writingSpeed} 字/分钟</span>
        </>
      )}

      {/* ── 右侧：光标位置 + 保存状态 ── */}
      <div className="flex-1" />

      {cursorLine !== undefined && cursorCol !== undefined && (
        <>
          <span className="flex-shrink-0 px-1">第 {cursorLine} 行, 第 {cursorCol} 列</span>
          <div className="w-px h-3 bg-border mx-1 flex-shrink-0" />
        </>
      )}

      <span className={cn('flex-shrink-0 px-1 font-medium', saveColor)}>
        {saveLabel}
      </span>
    </div>
  );
}
