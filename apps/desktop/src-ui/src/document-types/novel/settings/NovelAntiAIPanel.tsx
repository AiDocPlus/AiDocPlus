/**
 * NovelAntiAIPanel — 去 AI 味面板
 *
 * P2.4: AI 味检测和修订界面
 * - 检测当前章节/全书的 AI 味
 * - 显示问题详情
 * - 一键修订（本地规则 + AI 辅助）
 */
import { useState, useMemo, useCallback } from 'react';
import {
  Sparkles, AlertTriangle, RefreshCw, ChevronDown, ChevronRight,
  FileText, BookOpen, Wand2, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent } from '../types';
import { getEffectiveContent } from '../types';
import {
  detectAIFlavor,
  analyzeNovelAIFlavor,
  buildAntiAIFlavorPrompt,
  quickAntiAIFlavor,
  type AIFlavorDetectionResult,
} from '../antiAIflavor';

interface NovelAntiAIPanelProps {
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  onNovelChange: (novel: NovelDocumentContent) => void;
  host: DocTypeHostAPI;
}

export default function NovelAntiAIPanel({
  novel,
  activeChapterId,
  onNovelChange,
  host,
}: NovelAntiAIPanelProps) {
  const [mode, setMode] = useState<'chapter' | 'novel'>('chapter');
  const [analyzing, setAnalyzing] = useState(false);
  const [revising, setRevising] = useState(false);
  const [detection, setDetection] = useState<AIFlavorDetectionResult | null>(null);
  const [novelAnalysis, setNovelAnalysis] = useState<ReturnType<typeof analyzeNovelAIFlavor> | null>(null);
  const [revisedText, setRevisedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['vocabulary', 'sentence']));

  // 获取当前章节内容
  const currentChapter = useMemo(() => {
    if (!activeChapterId) return null;
    for (const vol of novel.volumes) {
      for (const ch of vol.chapters) {
        if (ch.id === activeChapterId) return ch;
      }
    }
    return null;
  }, [novel, activeChapterId]);

  const currentContent = useMemo(() => {
    return currentChapter ? getEffectiveContent(currentChapter) : '';
  }, [currentChapter]);

  // 分析当前章节
  const analyzeChapter = useCallback(() => {
    if (!currentContent || currentContent.length < 200) {
      setError('章节内容不足，无法分析');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setRevisedText(null);

    try {
      const result = detectAIFlavor(currentContent);
      setDetection(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  }, [currentContent]);

  // 分析全书
  const analyzeFullNovel = useCallback(() => {
    setAnalyzing(true);
    setError(null);
    setDetection(null);

    try {
      const result = analyzeNovelAIFlavor(novel);
      setNovelAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  }, [novel]);

  // 本地快速修订
  const handleQuickRevise = useCallback(() => {
    if (!currentContent) return;

    setRevising(true);
    setError(null);

    try {
      const revised = quickAntiAIFlavor(currentContent);
      setRevisedText(revised);
    } catch (e) {
      setError(e instanceof Error ? e.message : '修订失败');
    } finally {
      setRevising(false);
    }
  }, [currentContent]);

  // AI 辅助修订
  const handleAIRevise = useCallback(async () => {
    if (!detection || !currentContent) return;

    setRevising(true);
    setError(null);

    try {
      const prompt = buildAntiAIFlavorPrompt(currentContent, detection);
      const result = await host.ai.chat([
        { role: 'user', content: prompt }
      ], { temperature: 0.7 });

      setRevisedText(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 修订失败');
    } finally {
      setRevising(false);
    }
  }, [detection, currentContent, host.ai]);

  // 应用修订
  const applyRevision = useCallback(() => {
    if (!revisedText || !activeChapterId) return;

    const updatedNovel = {
      ...novel,
      volumes: novel.volumes.map(vol => ({
        ...vol,
        chapters: vol.chapters.map(ch => {
          if (ch.id === activeChapterId) {
            if (ch.scenes && ch.scenes.length > 0) {
              // 场景模式：更新第一个场景
              return {
                ...ch,
                scenes: ch.scenes.map((sc, idx) => idx === 0 ? { ...sc, content: revisedText } : sc),
              };
            }
            return { ...ch, content: revisedText };
          }
          return ch;
        }),
      })),
    };

    onNovelChange(updatedNovel);
    setRevisedText(null);
    setDetection(null);
  }, [revisedText, activeChapterId, novel, onNovelChange]);

  // 切换折叠状态
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-green-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <Wand2 className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium">去 AI 味</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs">
          <button
            className={cn(
              'px-2 py-0.5 rounded',
              mode === 'chapter' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
            )}
            onClick={() => setMode('chapter')}
          >
            当前章节
          </button>
          <button
            className={cn(
              'px-2 py-0.5 rounded',
              mode === 'novel' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
            )}
            onClick={() => setMode('novel')}
          >
            全书
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-destructive/10 text-destructive text-xs rounded flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button className="ml-auto hover:text-destructive/80" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* 模式：当前章节 */}
        {mode === 'chapter' && (
          <>
            {/* 分析按钮 */}
            {!detection && (
              <div className="text-center py-6">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground mb-3">
                  {currentChapter ? `当前：${currentChapter.title}` : '未选择章节'}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={analyzeChapter}
                  disabled={analyzing || !currentContent || currentContent.length < 200}
                >
                  {analyzing ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 分析中...</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> 检测 AI 味</>
                  )}
                </Button>
              </div>
            )}

            {/* 检测结果 */}
            {detection && (
              <>
                {/* 总分 */}
                <div className="rounded border p-3 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">AI 味评分</span>
                    <span className={cn('text-2xl font-bold', getScoreColor(detection.score))}>
                      {detection.score}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getScoreBg(detection.score))}
                      style={{ width: `${100 - detection.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {detection.score >= 70 ? 'AI 痕迹明显，建议修订' :
                     detection.score >= 40 ? '存在部分 AI 味，可选择性优化' :
                     '文字自然，无明显 AI 痕迹'}
                  </p>
                </div>

                {/* 分项评分 */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'vocabulary', label: '词汇疲劳', score: detection.scores.vocabulary },
                    { key: 'sentence', label: '句式模式', score: detection.scores.sentence },
                    { key: 'paragraph', label: '段落均匀', score: detection.scores.paragraph },
                    { key: 'transition', label: '转折密度', score: detection.scores.transition },
                  ].map(item => (
                    <div key={item.key} className="rounded border p-2 text-center">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className={cn('text-lg font-bold mt-0.5', getScoreColor(item.score))}>
                        {item.score}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 问题详情 */}
                {detection.issues.length > 0 && (
                  <div className="space-y-2">
                    {(['vocabulary', 'sentence', 'paragraph', 'transition'] as const).map(type => {
                      const typeIssues = detection.issues.filter(i => i.type === type);
                      if (typeIssues.length === 0) return null;

                      const typeLabels = {
                        vocabulary: '词汇疲劳',
                        sentence: '句式模式',
                        paragraph: '段落问题',
                        transition: '转折词',
                      };

                      const isExpanded = expandedSections.has(type);

                      return (
                        <div key={type} className="rounded border">
                          <button
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/30"
                            onClick={() => toggleSection(type)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium">{typeLabels[type]}</span>
                            <span className="text-xs text-muted-foreground">({typeIssues.length})</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t px-2 py-1.5 space-y-1">
                              {typeIssues.slice(0, 5).map((issue, idx) => (
                                <div key={idx} className="text-xs">
                                  {issue.word && (
                                    <span className="font-medium">"{issue.word}" </span>
                                  )}
                                  <span className="text-muted-foreground">{issue.suggestion}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 建议 */}
                {detection.suggestions.length > 0 && (
                  <div className="rounded border p-2 bg-blue-500/5 border-blue-500/20">
                    <div className="text-xs font-medium text-blue-600 mb-1">改进建议</div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {detection.suggestions.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={handleQuickRevise}
                    disabled={revising}
                  >
                    <RefreshCw className="h-3 w-3" />
                    本地修订
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={handleAIRevise}
                    disabled={revising || !host.ai.isAvailable()}
                  >
                    {revising ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> 修订中...</>
                    ) : (
                      <><Sparkles className="h-3 w-3" /> AI 修订</>
                    )}
                  </Button>
                </div>

                {/* 修订结果 */}
                {revisedText && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">修订结果</div>
                    <Textarea
                      value={revisedText}
                      onChange={e => setRevisedText(e.target.value)}
                      className="min-h-[150px] text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setRevisedText(null)}
                      >
                        取消
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={applyRevision}
                      >
                        应用到章节
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 模式：全书 */}
        {mode === 'novel' && (
          <>
            {/* 分析按钮 */}
            {!novelAnalysis && (
              <div className="text-center py-6">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground mb-3">
                  分析全书 AI 味分布
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={analyzeFullNovel}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 分析中...</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> 分析全书</>
                  )}
                </Button>
              </div>
            )}

            {/* 全书分析结果 */}
            {novelAnalysis && (
              <>
                {/* 总分 */}
                <div className="rounded border p-3 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">全书平均 AI 味</span>
                    <span className={cn('text-2xl font-bold', getScoreColor(novelAnalysis.globalScore))}>
                      {novelAnalysis.globalScore}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getScoreBg(novelAnalysis.globalScore))}
                      style={{ width: `${100 - novelAnalysis.globalScore}%` }}
                    />
                  </div>
                </div>

                {/* AI 味热点章节 */}
                {novelAnalysis.hotspots.length > 0 && (
                  <div className="rounded border p-2">
                    <div className="text-xs font-medium text-amber-600 mb-1">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      重点章节
                    </div>
                    <ul className="text-xs space-y-0.5">
                      {novelAnalysis.hotspots.map((spot, i) => (
                        <li key={i} className="text-muted-foreground">{spot}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 章节分布 */}
                <div className="rounded border">
                  <div className="px-2 py-1.5 border-b text-xs font-medium">
                    章节分布
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    {novelAnalysis.chapterScores.map(ch => (
                      <div
                        key={ch.chapterId}
                        className="flex items-center gap-2 px-2 py-1 border-b last:border-0"
                      >
                        <span className="text-xs flex-1 truncate">{ch.chapterTitle}</span>
                        <div className={cn('w-12 h-1.5 rounded', getScoreBg(ch.score))} />
                        <span className={cn('text-xs w-6 text-right', getScoreColor(ch.score))}>
                          {ch.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 底部说明 */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex-shrink-0">
        AI 味评分基于词汇疲劳、句式模式、段落均匀度、转折词密度综合计算。
      </div>
    </div>
  );
}
