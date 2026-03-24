/**
 * EssayRhythmAnalyzer.tsx — 散文韵律与节奏分析面板
 *
 * Phase 5: 大纲规划与韵律分析
 * - 句式长度分布可视化（短/中/长句比例）
 * - 段落节奏图（字数变化折线）
 * - 句式多样性指数
 * - 标点密度分析（逗号/句号/感叹号/问号）
 * - 段落首句/末句提取
 * - 整体节奏评分（平稳/跌宕/单调）
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, Minus, TrendingUp } from 'lucide-react';
import type { EssayParagraph } from './types';

// ── 句子长度分类 ──
const SHORT_THRESHOLD = 10;   // ≤10字：短句
const MEDIUM_THRESHOLD = 25;  // ≤25字：中句
// >25字：长句

interface SentenceStats {
  text: string;
  length: number;
  type: 'short' | 'medium' | 'long';
}

interface ParagraphRhythm {
  index: number;
  wordCount: number;
  sentences: SentenceStats[];
  avgSentenceLength: number;
  shortRatio: number;
  mediumRatio: number;
  longRatio: number;
  punctuationDensity: number;
  firstSentence: string;
  lastSentence: string;
  rhythmScore: number;  // 0-100，越高越活跃
}

interface RhythmAnalysis {
  paragraphs: ParagraphRhythm[];
  overall: {
    avgSentenceLength: number;
    shortRatio: number;
    mediumRatio: number;
    longRatio: number;
    sentenceDiversityIndex: number;  // 0-1
    rhythmVariance: number;          // 段落节奏方差
    overallScore: 'flat' | 'varied' | 'active' | 'chaotic';
    scoreLabel: string;
    recommendation: string;
  };
}

function splitSentences(text: string): string[] {
  // 中文分句：只用句尾标点（去掉 \n，不把段内换行当分句符）
  return text.split(/[。！？；]/).map(s => s.trim()).filter(s => s.length > 1);
}

function analyzeParagraph(para: EssayParagraph, content: string): ParagraphRhythm {
  const paraText = content.slice(para.startOffset, para.endOffset);
  const sentences = splitSentences(paraText).map(s => ({
    text: s,
    length: s.length,
    type: s.length <= SHORT_THRESHOLD ? 'short' as const
         : s.length <= MEDIUM_THRESHOLD ? 'medium' as const
         : 'long' as const,
  }));

  const total = sentences.length || 1;
  const shortCount = sentences.filter(s => s.type === 'short').length;
  const mediumCount = sentences.filter(s => s.type === 'medium').length;
  const longCount = sentences.filter(s => s.type === 'long').length;
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  const avgLen = totalChars / total;

  // 标点密度：各类标点数 / 总字数
  const puncts = (paraText.match(/[，。！？；、：""'']/g) || []).length;
  const punctDensity = para.wordCount > 0 ? puncts / para.wordCount : 0;

  // 节奏活跃度：短句占比高则活跃，长句占比高则迟缓，长短混合青尾加分
  const mixBonus = Math.min(shortCount, longCount) > 0
    ? (Math.min(shortCount, longCount) / total) * 30
    : 0;
  const rhythmScore = Math.round(
    Math.min((shortCount / total) * 70, 70) + mixBonus,
  );

  return {
    index: para.index,
    wordCount: para.wordCount,
    sentences,
    avgSentenceLength: avgLen,
    shortRatio: shortCount / total,
    mediumRatio: mediumCount / total,
    longRatio: longCount / total,
    punctuationDensity: punctDensity,
    firstSentence: sentences[0]?.text.slice(0, 30) ?? '',
    lastSentence: sentences[sentences.length - 1]?.text.slice(0, 30) ?? '',
    rhythmScore,
  };
}

function analyzeRhythm(paragraphs: EssayParagraph[], content: string): RhythmAnalysis {
  if (paragraphs.length === 0 || !content.trim()) {
    return {
      paragraphs: [],
      overall: {
        avgSentenceLength: 0, shortRatio: 0, mediumRatio: 0, longRatio: 0,
        sentenceDiversityIndex: 0, rhythmVariance: 0,
        overallScore: 'flat', scoreLabel: '暂无数据', recommendation: '请开始写作',
      },
    };
  }

  const paraRhythms = paragraphs.map(p => analyzeParagraph(p, content));

  const allSentences = paraRhythms.flatMap(p => p.sentences);
  const total = allSentences.length || 1;
  const shortTotal = allSentences.filter(s => s.type === 'short').length;
  const mediumTotal = allSentences.filter(s => s.type === 'medium').length;
  const longTotal = allSentences.filter(s => s.type === 'long').length;
  const totalChars = allSentences.reduce((sum, s) => sum + s.length, 0);
  const avgLen = totalChars / total;

  // 多样性指数：1 - Σ(ratio²)，越接近1越多样
  const shortR = shortTotal / total;
  const medR = mediumTotal / total;
  const longR = longTotal / total;
  const diversity = 1 - (shortR * shortR + medR * medR + longR * longR);

  // 节奏方差：段落 wordCount 的标准差
  const avgWords = paraRhythms.reduce((s, p) => s + p.wordCount, 0) / paraRhythms.length;
  const variance = Math.sqrt(
    paraRhythms.reduce((s, p) => s + Math.pow(p.wordCount - avgWords, 2), 0) / paraRhythms.length,
  );

  let overallScore: RhythmAnalysis['overall']['overallScore'];
  let scoreLabel: string;
  let recommendation: string;

  if (diversity < 0.3) {
    overallScore = 'flat'; scoreLabel = '节奏平板';
    recommendation = '句式过于单一，建议混合使用短句（≤10字）增加节奏感';
  } else if (diversity > 0.6 && variance > avgWords * 0.5) {
    overallScore = 'chaotic'; scoreLabel = '节奏散乱';
    recommendation = '段落字数差异悬殊，建议调整段落长度使其更匀称';
  } else if (diversity > 0.5) {
    overallScore = 'active'; scoreLabel = '节奏活泼';
    recommendation = '句式多样，节奏感好，可在情感高潮处多用短句强化';
  } else {
    overallScore = 'varied'; scoreLabel = '节奏舒缓';
    recommendation = '节奏平稳，适合描述性散文，情感转折处可增加短句';
  }

  return {
    paragraphs: paraRhythms,
    overall: {
      avgSentenceLength: avgLen,
      shortRatio: shortR, mediumRatio: medR, longRatio: longR,
      sentenceDiversityIndex: diversity,
      rhythmVariance: variance,
      overallScore, scoreLabel, recommendation,
    },
  };
}

interface EssayRhythmAnalyzerProps {
  paragraphs: EssayParagraph[];
  content: string;
  className?: string;
}

export default function EssayRhythmAnalyzer({ paragraphs, content, className }: EssayRhythmAnalyzerProps) {
  const analysis = useMemo(
    () => analyzeRhythm(paragraphs, content),
    [paragraphs, content],
  );

  const { overall } = analysis;

  const scoreColors: Record<RhythmAnalysis['overall']['overallScore'], string> = {
    flat:    'text-gray-500 bg-gray-100 dark:bg-gray-800',
    varied:  'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    active:  'text-green-600 bg-green-50 dark:bg-green-950/30',
    chaotic: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
  };

  // 段落节奏图的最大字数（用于归一化）
  const maxWords = Math.max(...analysis.paragraphs.map(p => p.wordCount), 1);

  return (
    <div className={cn('flex flex-col gap-3 p-3 text-xs', className)}>

      {/* ── 综合评分卡 ── */}
      <div className={cn('rounded-lg p-3', scoreColors[overall.overallScore])}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            {overall.scoreLabel}
          </span>
          <span className="text-[11px] opacity-70">
            多样性 {Math.round(overall.sentenceDiversityIndex * 100)}%
          </span>
        </div>
        <p className="text-[11px] leading-relaxed opacity-80">{overall.recommendation}</p>
      </div>

      {/* ── 句式分布 ── */}
      <div className="rounded-lg border p-3">
        <p className="font-medium mb-2 text-muted-foreground">句式分布</p>
        <div className="space-y-1.5">
          {[
            { label: `短句（≤${SHORT_THRESHOLD}字）`, ratio: overall.shortRatio, color: 'bg-green-400' },
            { label: `中句（${SHORT_THRESHOLD+1}-${MEDIUM_THRESHOLD}字）`, ratio: overall.mediumRatio, color: 'bg-blue-400' },
            { label: `长句（>${MEDIUM_THRESHOLD}字）`, ratio: overall.longRatio, color: 'bg-purple-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-28 flex-shrink-0 text-[11px] text-muted-foreground truncate">{item.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', item.color)}
                  style={{ width: `${Math.max(item.ratio * 100, 1)}%` }}
                />
              </div>
              <span className="w-8 text-right text-[11px] text-muted-foreground flex-shrink-0">
                {Math.round(item.ratio * 100)}%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t flex gap-3 text-[11px] text-muted-foreground">
          <span>均句长 {Math.round(overall.avgSentenceLength)} 字</span>
        </div>
      </div>

      {/* ── 段落节奏图 ── */}
      {analysis.paragraphs.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="font-medium mb-2 text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            段落节奏图
          </p>
          <div className="flex items-end gap-0.5 h-16">
            {analysis.paragraphs.map((para, i) => {
              const heightPct = (para.wordCount / maxWords) * 100;
              const color = para.rhythmScore > 60 ? 'bg-green-400'
                          : para.rhythmScore > 30 ? 'bg-blue-400'
                          : 'bg-purple-400';
              return (
                <div
                  key={i}
                  className="flex-1 group relative"
                  title={`第${i+1}段 · ${para.wordCount}字 · 活跃度${para.rhythmScore}`}
                >
                  <div
                    className={cn('w-full rounded-t-sm transition-all', color)}
                    style={{ height: `${Math.max(heightPct, 5)}%` }}
                  />
                  {/* tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap text-[9px] bg-foreground text-background px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                    {para.wordCount}字
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>第1段</span>
            <span>第{analysis.paragraphs.length}段</span>
          </div>
        </div>
      )}

      {/* ── 段落首/末句 ── */}
      {analysis.paragraphs.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="font-medium mb-2 text-muted-foreground">段落首末句</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {analysis.paragraphs.slice(0, 8).map((para, i) => (
              <div key={i} className="text-[11px]">
                <span className="text-muted-foreground font-medium">§{i + 1}</span>
                <div className="mt-0.5 flex items-start gap-1">
                  <Minus className="h-3 w-3 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{para.firstSentence || '…'}</span>
                </div>
                {para.lastSentence && para.lastSentence !== para.firstSentence && (
                  <div className="flex items-start gap-1">
                    <Minus className="h-3 w-3 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{para.lastSentence}</span>
                  </div>
                )}
              </div>
            ))}
            {analysis.paragraphs.length > 8 && (
              <p className="text-[10px] text-muted-foreground text-center">
                共 {analysis.paragraphs.length} 段，仅显示前8段
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
