/**
 * NovelSummaryDialog — 章节摘要管理弹窗
 *
 * P1.3: 批量摘要管理 UI
 * - 显示所有章节摘要状态
 * - 批量生成/更新摘要
 * - 手动编辑摘要
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Sparkles, RefreshCw, Check, AlertCircle, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent, NovelChapter, NovelVolume } from '../types';
import { getChapterWordCount, getEffectiveContent } from '../types';
import { buildChapterSummaryPrompt, parseChapterSummaryResult } from '../novelMemory';
import { DIALOG_STYLE } from '../constants';

interface NovelSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
  host: DocTypeHostAPI;
}

interface ChapterSummaryStatus {
  volumeId: string;
  volumeTitle: string;
  chapterId: string;
  chapterTitle: string;
  wordCount: number;
  hasSummary: boolean;
  summarySource: 'auto' | 'manual' | 'none';
  summary?: string;
  keyEvents?: string[];
  isGenerating: boolean;
}

export default function NovelSummaryDialog({
  open, onOpenChange, novel, onNovelChange, host,
}: NovelSummaryDialogProps) {
  const { t } = useTranslation();
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 构建章节状态列表
  const chapterStatuses = useMemo<ChapterSummaryStatus[]>(() => {
    const statuses: ChapterSummaryStatus[] = [];
    for (const vol of novel.volumes) {
      for (const ch of vol.chapters) {
        const wc = getChapterWordCount(ch);
        statuses.push({
          volumeId: vol.id,
          volumeTitle: vol.title,
          chapterId: ch.id,
          chapterTitle: ch.title,
          wordCount: wc,
          hasSummary: !!(ch.autoSummary || ch.summary),
          summarySource: ch.autoSummary ? 'auto' : ch.summary ? 'manual' : 'none',
          summary: ch.autoSummary || ch.summary,
          keyEvents: ch.keyEvents,
          isGenerating: generatingIds.has(ch.id),
        });
      }
    }
    return statuses;
  }, [novel, generatingIds]);

  // 统计
  const stats = useMemo(() => {
    const total = chapterStatuses.length;
    const withSummary = chapterStatuses.filter(s => s.hasSummary).length;
    const needSummary = chapterStatuses.filter(s => !s.hasSummary && s.wordCount >= 500).length;
    return { total, withSummary, needSummary };
  }, [chapterStatuses]);

  // 切换卷展开状态
  const toggleVolume = (volumeId: string) => {
    setExpandedVolumes(prev => {
      const next = new Set(prev);
      if (next.has(volumeId)) {
        next.delete(volumeId);
      } else {
        next.add(volumeId);
      }
      return next;
    });
  };

  // 生成单个章节摘要
  const generateSummary = async (chapterId: string) => {
    setError(null);
    setGeneratingIds(prev => new Set(prev).add(chapterId));

    try {
      const chapter = novel.volumes
        .flatMap(v => v.chapters)
        .find(c => c.id === chapterId);

      if (!chapter) {
        throw new Error('章节未找到');
      }

      const prompt = buildChapterSummaryPrompt(chapter);
      if (!prompt) {
        throw new Error('章节内容不足，无法生成摘要');
      }

      const result = await host.ai.chat([
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      const parsed = parseChapterSummaryResult(result);
      if (!parsed) {
        throw new Error('AI 返回格式解析失败');
      }

      // 更新 novel
      const updatedNovel = {
        ...novel,
        volumes: novel.volumes.map(vol => ({
          ...vol,
          chapters: vol.chapters.map(ch => {
            if (ch.id === chapterId) {
              return {
                ...ch,
                autoSummary: parsed.summary,
                keyEvents: parsed.keyEvents,
                summaryGeneratedAt: Date.now(),
                // 如果没有手动摘要，也同步到 summary 字段
                summary: ch.summary || parsed.summary,
              };
            }
            return ch;
          }),
        })),
      };

      onNovelChange(updatedNovel);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
    }
  };

  // 批量生成所有缺失摘要
  const generateAllMissing = async () => {
    const needGenerate = chapterStatuses.filter(s => !s.hasSummary && s.wordCount >= 500);
    if (needGenerate.length === 0) return;

    for (const status of needGenerate) {
      await generateSummary(status.chapterId);
      // 间隔 1 秒避免 API 限流
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // 开始编辑摘要
  const startEdit = (chapterId: string) => {
    const status = chapterStatuses.find(s => s.chapterId === chapterId);
    if (status) {
      setEditingId(chapterId);
      setEditText(status.summary || '');
    }
  };

  // 保存编辑
  const saveEdit = () => {
    if (!editingId) return;

    const updatedNovel = {
      ...novel,
      volumes: novel.volumes.map(vol => ({
        ...vol,
        chapters: vol.chapters.map(ch => {
          if (ch.id === editingId) {
            return {
              ...ch,
              summary: editText,
              // 如果没有自动摘要，保持；否则只更新手动摘要
            };
          }
          return ch;
        }),
      })),
    };

    onNovelChange(updatedNovel);
    setEditingId(null);
    setEditText('');
  };

  // 按卷分组
  const volumesGrouped = useMemo(() => {
    const groups = new Map<string, ChapterSummaryStatus[]>();
    for (const status of chapterStatuses) {
      const existing = groups.get(status.volumeId) || [];
      existing.push(status);
      groups.set(status.volumeId, existing);
    }
    return groups;
  }, [chapterStatuses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[5vh] !translate-y-0 w-[80vw] h-[80vh] max-w-[1000px] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">章节摘要管理</DialogTitle>

        {/* 工具栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-base font-medium">章节摘要管理</span>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {stats.withSummary}/{stats.total} 已生成
          </span>
          {stats.needSummary > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={generateAllMissing}
              disabled={generatingIds.size > 0}
            >
              {generatingIds.size > 0 ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> 生成中...</>
              ) : (
                <><Sparkles className="h-3 w-3" /> 批量生成 ({stats.needSummary})</>
              )}
            </Button>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button className="ml-auto hover:text-destructive/80" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* 章节列表 */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {Array.from(volumesGrouped.entries()).map(([volumeId, chapters]) => {
            const isExpanded = expandedVolumes.has(volumeId);
            const volStats = {
              total: chapters.length,
              withSummary: chapters.filter(c => c.hasSummary).length,
            };

            return (
              <div key={volumeId} className="border rounded">
                {/* 卷标题 */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 text-left"
                  onClick={() => toggleVolume(volumeId)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{chapters[0]?.volumeTitle || '未命名卷'}</span>
                  <span className="text-xs text-muted-foreground">
                    {volStats.withSummary}/{volStats.total} 已生成
                  </span>
                </button>

                {/* 章节列表 */}
                {isExpanded && (
                  <div className="border-t divide-y">
                    {chapters.map(status => (
                      <div key={status.chapterId} className="p-3 space-y-2">
                        {/* 章节标题行 */}
                        <div className="flex items-center gap-2">
                          {status.hasSummary ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : status.wordCount < 500 ? (
                            <span className="text-xs text-muted-foreground">字数不足</span>
                          ) : null}
                          <span className="font-medium text-sm">{status.chapterTitle}</span>
                          <span className="text-xs text-muted-foreground">{status.wordCount} 字</span>
                          {status.summarySource === 'auto' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">自动</span>
                          )}
                          {status.summarySource === 'manual' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded">手动</span>
                          )}
                          <div className="flex-1" />
                          {status.wordCount >= 500 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1"
                              onClick={() => generateSummary(status.chapterId)}
                              disabled={status.isGenerating}
                            >
                              {status.isGenerating ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> 生成中</>
                              ) : (
                                <><RefreshCw className="h-3 w-3" /> {status.hasSummary ? '重新生成' : '生成'}</>
                              )}
                            </Button>
                          )}
                          {status.hasSummary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => startEdit(status.chapterId)}
                            >
                              编辑
                            </Button>
                          )}
                        </div>

                        {/* 摘要预览 */}
                        {status.summary && editingId !== status.chapterId && (
                          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 line-clamp-3">
                            {status.summary}
                          </div>
                        )}

                        {/* 关键事件 */}
                        {status.keyEvents && status.keyEvents.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">关键事件：</span>
                            {status.keyEvents.slice(0, 3).join('、')}
                          </div>
                        )}

                        {/* 编辑模式 */}
                        {editingId === status.chapterId && (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              className="min-h-[100px] text-sm"
                              placeholder="输入摘要..."
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={saveEdit}
                              >
                                保存
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {chapterStatuses.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无章节
            </div>
          )}
        </div>

        {/* 底部说明 */}
        <div className="px-4 py-2 border-t text-xs text-muted-foreground flex-shrink-0">
          摘要用于 AI 上下文注入，帮助 AI 理解前文情节。建议每章保持 200-300 字摘要。
        </div>
      </DialogContent>
    </Dialog>
  );
}
