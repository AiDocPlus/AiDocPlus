import { useState, useEffect, useCallback } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { BarChart3, RefreshCw } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

/** 文档统计数据 */
interface AnalyticsData {
  charCount: number;
  charCountNoSpace: number;
  wordCount: number;
  paragraphCount: number;
  sentenceCount: number;
  lineCount: number;
  headingCount: number;
  readingTimeMin: number;
  avgSentenceLen: number;
  topKeywords: { word: string; count: number }[];
}

/** 分析文档内容 */
function analyzeContent(text: string): AnalyticsData {
  if (!text.trim()) {
    return {
      charCount: 0, charCountNoSpace: 0, wordCount: 0, paragraphCount: 0,
      sentenceCount: 0, lineCount: 0, headingCount: 0, readingTimeMin: 0,
      avgSentenceLen: 0, topKeywords: [],
    };
  }

  const charCount = text.length;
  const charCountNoSpace = text.replace(/\s/g, '').length;

  // 中文字数 + 英文单词数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
  const wordCount = chineseChars + englishWords;

  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const paragraphCount = paragraphs.length;

  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const sentenceCount = sentences.length;

  const lineCount = text.split('\n').length;

  const headings = text.match(/^#{1,6}\s+.+/gm) || [];
  const headingCount = headings.length;

  // 阅读时间（中文 400字/分钟，英文 200词/分钟）
  const readingTimeMin = Math.max(1, Math.round((chineseChars / 400 + englishWords / 200)));

  const avgSentenceLen = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  // 关键词频率（简单分词）
  const wordFreq: Record<string, number> = {};
  // 中文：按2-4字切分
  const chineseSegments = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  for (const w of chineseSegments) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  // 英文：按单词
  const engWords = text.replace(/[\u4e00-\u9fff]/g, ' ').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2);
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that', 'with', 'from', 'they', 'will', 'would', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'some', 'them', 'than', 'then', 'look', 'only', 'come', 'its']);
  for (const w of engWords) {
    if (!stopWords.has(w)) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }

  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return {
    charCount, charCountNoSpace, wordCount, paragraphCount,
    sentenceCount, lineCount, headingCount, readingTimeMin,
    avgSentenceLen, topKeywords,
  };
}

/**
 * 文档统计插件面板 — 使用 PluginPanelLayout（非 AI 插件，隐藏生成区）
 */
export function AnalyticsPluginPanel({ document, content, pluginData: _, onPluginDataChange }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const sourceContent = content || document.aiGeneratedContent || document.content || '';
  const [stats, setStats] = useState<AnalyticsData | null>(null);

  const doAnalyze = useCallback(() => {
    setStats(analyzeContent(sourceContent));
    onPluginDataChange({ analyzed: true, timestamp: Date.now() });
  }, [sourceContent, onPluginDataChange]);

  useEffect(() => {
    doAnalyze();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats) return null;

  const statItems = [
    { label: t('charCount'), value: stats.charCount.toLocaleString() },
    { label: t('charCountNoSpace', { defaultValue: '字符数(不含空格)' }), value: stats.charCountNoSpace.toLocaleString() },
    { label: t('wordCount'), value: stats.wordCount.toLocaleString() },
    { label: t('paragraphCount'), value: stats.paragraphCount.toLocaleString() },
    { label: t('sentenceCount'), value: stats.sentenceCount.toLocaleString() },
    { label: t('lineCount', { defaultValue: '行数' }), value: stats.lineCount.toLocaleString() },
    { label: t('headingCount', { defaultValue: '标题数' }), value: stats.headingCount.toLocaleString() },
    { label: t('readingTime'), value: `${stats.readingTimeMin} ${t('minutes')}` },
    { label: t('avgSentenceLen', { defaultValue: '平均句长' }), value: `${stats.avgSentenceLen}` },
  ];

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <span className="text-sm font-medium">{t('title')}</span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={doAnalyze} className="gap-1 h-7 text-xs">
        <RefreshCw className="h-3 w-3" />
        {t('reanalyze')}
      </Button>
    </>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<BarChart3 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('noContent', { defaultValue: '暂无文档内容' })}
      prompt=""
      onPromptChange={() => {}}
      generating={false}
      onGenerate={() => {}}
      generationZoneVisible={false}
      toolbar={toolbarContent}
      hasContent={!!stats}
    >
      {/* ③ 内容区 */}
      <div className="p-4 space-y-6">
        {/* 基础统计 */}
        <div>
          <h3 className="text-sm font-semibold mb-3">{t('basicStats', { defaultValue: '基础统计' })}</h3>
          <div className="grid grid-cols-3 gap-3">
            {statItems.map(item => (
              <div key={item.label} className="p-3 rounded-lg border bg-card">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-lg font-semibold mt-1">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 关键词 */}
        {stats.topKeywords.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('topKeywords', { defaultValue: '高频词汇 (Top 20)' })}</h3>
            <div className="flex flex-wrap gap-2">
              {stats.topKeywords.map((kw, i) => {
                const maxCount = stats.topKeywords[0].count;
                const opacity = 0.4 + (kw.count / maxCount) * 0.6;
                const fontSize = 12 + (kw.count / maxCount) * 8;
                return (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-md bg-primary text-primary-foreground"
                    style={{ opacity, fontSize: `${fontSize}px` }}
                    title={`${kw.count}`}
                  >
                    {kw.word}
                    <span className="ml-1 text-xs opacity-70">{kw.count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {sourceContent.trim() === '' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-lg font-medium text-muted-foreground">{t('noContent')}</p>
            </div>
          </div>
        )}
      </div>
    </PluginPanelLayout>
  );
}
