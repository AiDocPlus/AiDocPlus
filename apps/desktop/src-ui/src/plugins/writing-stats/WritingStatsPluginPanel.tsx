import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import {
  BarChart3, RefreshCw, Target, Clock, Type,
  Hash, Heading, Link2, Image, Code2,
} from 'lucide-react';
import { analyzeText } from './statsUtils';
import type { TextStats } from './statsUtils';

type ContentSource = 'ai' | 'original' | 'merged' | 'both';

interface WritingStatsStorage {
  dailyGoal?: number;
  contentSource?: ContentSource;
  todayDate?: string;
  todayWords?: number;
}

export function WritingStatsPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const stored = (host.storage.get('settings') as WritingStatsStorage) || {};
  const [contentSource, setContentSource] = useState<ContentSource>(stored.contentSource || 'both');
  const [dailyGoal, setDailyGoal] = useState(stored.dailyGoal || 1000);
  const [stats, setStats] = useState<TextStats | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  // 会话计时
  const sessionStartRef = useRef(Date.now());
  const [sessionMinutes, setSessionMinutes] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionMinutes(Math.floor((Date.now() - sessionStartRef.current) / 60000));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const saveSettings = useCallback((updates: Partial<WritingStatsStorage>) => {
    const current = (host.storage.get('settings') as WritingStatsStorage) || {};
    host.storage.set('settings', { ...current, ...updates });
  }, [host.storage]);

  // 获取统计文本
  const getTextToAnalyze = useCallback((): string => {
    switch (contentSource) {
      case 'ai':
        return content || document.aiGeneratedContent || '';
      case 'original':
        return document.content || '';
      case 'merged':
        return host.content.getComposedContent() || '';
      case 'both': {
        const parts: string[] = [];
        if (document.content) parts.push(document.content);
        const ai = content || document.aiGeneratedContent;
        if (ai) parts.push(ai);
        return parts.join('\n\n');
      }
      default:
        return content || document.content || '';
    }
  }, [contentSource, content, document, host.content]);

  // 刷新统计
  const refreshStats = useCallback(() => {
    const text = getTextToAnalyze();
    if (!text.trim()) {
      setStats(null);
      showStatus(t('noContent'), true);
      return;
    }
    const result = analyzeText(text);
    setStats(result);
    showStatus(`${t('refresh')} ✓ — ${result.totalWords} ${t('totalWords')}`);
  }, [getTextToAnalyze, t, showStatus]);

  // 初始化时自动统计
  useEffect(() => {
    const text = getTextToAnalyze();
    if (text.trim()) {
      setStats(analyzeText(text));
    }
  }, [getTextToAnalyze]);

  // 导入内容回调
  const handleImportContent = useCallback((text: string, source: string) => {
    const result = analyzeText(text);
    setStats(result);
    showStatus(`${source}: ${result.totalWords} ${t('totalWords')}`);
  }, [t, showStatus]);

  // 目标进度
  const goalProgress = useMemo(() => {
    if (!stats || dailyGoal <= 0) return 0;
    return Math.min(100, Math.round((stats.totalWords / dailyGoal) * 100));
  }, [stats, dailyGoal]);

  // 统计卡片组件
  const StatCard = ({ icon: Icon, label, value, sub }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    sub?: string;
  }) => (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-card">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );

  const hasContent = !!(content || document.content || document.aiGeneratedContent);

  return (
    <ToolPluginLayout
      pluginIcon={<BarChart3 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        <>
          <Select value={contentSource} onValueChange={(v) => { setContentSource(v as ContentSource); saveSettings({ contentSource: v as ContentSource }); }}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">{t('sourceBoth')}</SelectItem>
              <SelectItem value="ai">{t('sourceAi')}</SelectItem>
              <SelectItem value="original">{t('sourceOriginal')}</SelectItem>
              <SelectItem value="merged">{t('sourceMerged')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={refreshStats}>
            <RefreshCw className="h-3 w-3" />
            {t('refresh')}
          </Button>
        </>
      }
    >
      {stats ? (
        <div className="p-3 space-y-4 overflow-auto">
          {/* 目标进度 */}
          <div className="p-3 rounded-lg border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('dailyGoal')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={dailyGoal}
                  onChange={(e) => { const v = parseInt(e.target.value) || 0; setDailyGoal(v); saveSettings({ dailyGoal: v }); }}
                  className="w-20 h-6 px-1.5 text-xs text-right border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  min={0}
                  step={100}
                />
                <span className="text-xs text-muted-foreground">{t('charsPerWord')}</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${goalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.totalWords} / {dailyGoal}</span>
              <span className={goalProgress >= 100 ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                {goalProgress >= 100 ? t('goalReached') : `${goalProgress}%`}
              </span>
            </div>
          </div>

          {/* 会话信息 */}
          <div className="flex gap-2">
            <div className="flex-1 p-2.5 rounded-lg border bg-card text-center">
              <div className="text-lg font-semibold">{sessionMinutes || '<1'}</div>
              <div className="text-xs text-muted-foreground">{t('sessionDuration')} ({t('minutes')})</div>
            </div>
            <div className="flex-1 p-2.5 rounded-lg border bg-card text-center">
              <div className="text-lg font-semibold">
                {sessionMinutes > 0 ? Math.round(stats.totalWords / sessionMinutes) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">{t('wordsPerMinute')}</div>
            </div>
          </div>

          {/* 基础统计 */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('overview')}</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Type} label={t('totalWords')} value={stats.totalWords.toLocaleString()} />
              <StatCard icon={Hash} label={t('totalChars')} value={stats.totalChars.toLocaleString()} />
              <StatCard icon={Clock} label={t('readingTime')} value={`${stats.readingTimeMinutes} ${t('minutes')}`} />
              <StatCard icon={Type} label={t('avgSentenceLen')} value={stats.avgSentenceLen} sub={t('charsPerWord')} />
            </div>
          </div>

          {/* 结构统计 */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('structure')}</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Type} label={t('paragraphs')} value={stats.paragraphs} />
              <StatCard icon={Type} label={t('sentences')} value={stats.sentences} />
              <StatCard icon={Heading} label={t('headings')} value={stats.headings} />
              <StatCard icon={Link2} label={t('links')} value={stats.links} />
              <StatCard icon={Image} label={t('images')} value={stats.images} />
              <StatCard icon={Code2} label={t('codeBlocks')} value={stats.codeBlocks} />
            </div>
          </div>

          {/* 可读性 */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('readability')}</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Type} label={t('uniqueWords')} value={stats.uniqueWords.toLocaleString()} />
              <StatCard icon={BarChart3} label={t('vocabularyRichness')} value={`${stats.vocabularyRichness}%`} />
            </div>
          </div>

          {/* 高频词 */}
          {stats.topWords.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('topWords')}</h4>
              <div className="space-y-1">
                {stats.topWords.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500/30 rounded flex items-center px-1.5"
                        style={{ width: `${Math.max(20, (item.count / stats.topWords[0].count) * 100)}%` }}
                      >
                        <span className="text-xs truncate">{item.word}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground/50">{t('noContent')}</p>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={refreshStats}>
              <RefreshCw className="h-3 w-3" />
              {t('refresh')}
            </Button>
          </div>
        </div>
      )}
    </ToolPluginLayout>
  );
}
