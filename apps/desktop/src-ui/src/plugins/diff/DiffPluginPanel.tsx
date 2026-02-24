import { useState, useCallback, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import {
  GitCompareArrows, ArrowLeftRight, Trash2, Copy, Loader2,
} from 'lucide-react';
import { computeDiff, computeStats, formatUnifiedDiff } from './diffUtils';
import type { DiffSegment, DiffMode, DiffStats } from './diffUtils';

type ContentSource = 'ai' | 'original' | 'merged' | 'manual';
type ViewMode = 'sideBySide' | 'unified';

export function DiffPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 左右文本
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [leftSource, setLeftSource] = useState<ContentSource>('original');
  const [rightSource, setRightSource] = useState<ContentSource>('ai');

  // 对比设置
  const [diffMode, setDiffMode] = useState<DiffMode>('line');
  const [viewMode, setViewMode] = useState<ViewMode>('sideBySide');

  // 对比结果
  const [diffResult, setDiffResult] = useState<DiffSegment[] | null>(null);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const [comparing, setComparing] = useState(false);

  // 状态
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 5000);
  }, []);

  // 从来源加载内容
  const loadFromSource = useCallback((source: ContentSource, side: 'left' | 'right') => {
    let text = '';
    switch (source) {
      case 'ai':
        text = content || document.aiGeneratedContent || '';
        break;
      case 'original':
        text = document.content || '';
        break;
      case 'merged':
        text = host.content.getComposedContent() || '';
        break;
      case 'manual':
        return; // 手动输入不自动加载
    }
    if (side === 'left') {
      setLeftText(text);
    } else {
      setRightText(text);
    }
    if (text) {
      showStatus(`${t('importedContent')} (${text.length} ${t('chars')})`);
    }
  }, [content, document, host.content, t, showStatus]);

  // 执行对比
  const handleCompare = useCallback(() => {
    if (!leftText.trim()) {
      showStatus(t('leftEmpty'), true);
      return;
    }
    if (!rightText.trim()) {
      showStatus(t('rightEmpty'), true);
      return;
    }

    setComparing(true);
    // 使用 setTimeout 避免阻塞 UI
    setTimeout(() => {
      const result = computeDiff(leftText, rightText, diffMode);
      const diffStats = computeStats(result);
      setDiffResult(result);
      setStats(diffStats);
      setComparing(false);

      if (diffStats.additions === 0 && diffStats.deletions === 0) {
        showStatus(t('noDiff'));
      } else {
        showStatus(`${t('statsLabel')}: +${diffStats.additions} -${diffStats.deletions}`);
      }
    }, 10);
  }, [leftText, rightText, diffMode, t, showStatus]);

  // 交换左右
  const handleSwap = useCallback(() => {
    setLeftText(rightText);
    setRightText(leftText);
    setLeftSource(rightSource);
    setRightSource(leftSource);
    setDiffResult(null);
    setStats(null);
  }, [leftText, rightText, leftSource, rightSource]);

  // 清空
  const handleClear = useCallback(() => {
    setLeftText('');
    setRightText('');
    setDiffResult(null);
    setStats(null);
  }, []);

  // 复制差异
  const handleCopyDiff = useCallback(async () => {
    if (!diffResult) return;
    const text = formatUnifiedDiff(diffResult);
    await host.ui.copyToClipboard(text);
    showStatus(t('copyDiff') + ' ✓');
  }, [diffResult, host.ui, t, showStatus]);

  // 工具栏导入
  const handleImportContent = useCallback((text: string, source: string) => {
    // 导入到左侧（如果左侧为空）或右侧
    if (!leftText.trim()) {
      setLeftText(text);
      showStatus(`${source} → ${t('leftPanel')} (${text.length} ${t('chars')})`);
    } else {
      setRightText(text);
      showStatus(`${source} → ${t('rightPanel')} (${text.length} ${t('chars')})`);
    }
  }, [leftText, t, showStatus]);

  // 内容来源选择器
  const SourceSelector = useCallback(({ side, value, onChange }: {
    side: 'left' | 'right';
    value: ContentSource;
    onChange: (v: ContentSource) => void;
  }) => (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={(v) => { onChange(v as ContentSource); loadFromSource(v as ContentSource, side); }}>
        <SelectTrigger className="h-7 text-xs flex-1">
          <SelectValue placeholder={t('selectSource')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ai">{t('sourceAiContent')}</SelectItem>
          <SelectItem value="original">{t('sourceOriginal')}</SelectItem>
          <SelectItem value="merged">{t('sourceMerged')}</SelectItem>
          <SelectItem value="manual">{t('sourceClipboard')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ), [t, loadFromSource]);

  // 渲染差异结果
  const renderedDiff = useMemo(() => {
    if (!diffResult) return null;

    if (viewMode === 'unified') {
      return (
        <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all p-3" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {diffResult.map((seg, i) => {
            let className = '';
            switch (seg.type) {
              case 'add':
                className = 'bg-green-500/20 text-green-700 dark:text-green-300';
                break;
              case 'remove':
                className = 'bg-red-500/20 text-red-700 dark:text-red-300 line-through';
                break;
              case 'equal':
                className = 'text-foreground';
                break;
            }
            return <span key={i} className={className}>{seg.value}</span>;
          })}
        </div>
      );
    }

    // 左右对照视图
    const leftParts: DiffSegment[] = [];
    const rightParts: DiffSegment[] = [];
    for (const seg of diffResult) {
      if (seg.type === 'equal') {
        leftParts.push(seg);
        rightParts.push(seg);
      } else if (seg.type === 'remove') {
        leftParts.push(seg);
      } else {
        rightParts.push(seg);
      }
    }

    return (
      <div className="grid grid-cols-2 divide-x divide-border h-full">
        <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all p-3 overflow-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {leftParts.map((seg, i) => {
            const cls = seg.type === 'remove'
              ? 'bg-red-500/20 text-red-700 dark:text-red-300'
              : 'text-foreground';
            return <span key={i} className={cls}>{seg.value}</span>;
          })}
        </div>
        <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all p-3 overflow-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {rightParts.map((seg, i) => {
            const cls = seg.type === 'add'
              ? 'bg-green-500/20 text-green-700 dark:text-green-300'
              : 'text-foreground';
            return <span key={i} className={cls}>{seg.value}</span>;
          })}
        </div>
      </div>
    );
  }, [diffResult, viewMode]);

  const hasContent = leftText.trim().length > 0 || rightText.trim().length > 0 || diffResult !== null;

  return (
    <ToolPluginLayout
      pluginIcon={<GitCompareArrows className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      statusExtra={
        stats ? (
          <span className="text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">+{stats.additions}</span>
            {' / '}
            <span className="text-red-600 dark:text-red-400">-{stats.deletions}</span>
          </span>
        ) : null
      }
      extraToolbar={
        <>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleSwap}>
            <ArrowLeftRight className="h-3 w-3" />
            {t('swapSides')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleClear}>
            <Trash2 className="h-3 w-3" />
            {t('clearAll')}
          </Button>
          {diffResult && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCopyDiff}>
              <Copy className="h-3 w-3" />
              {t('copyDiff')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col h-full">
        {/* 输入区 */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b flex-shrink-0">
          {/* 左侧 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-medium">{t('leftPanel')}</Label>
              <div className="flex-1">
                <SourceSelector side="left" value={leftSource} onChange={setLeftSource} />
              </div>
            </div>
            <textarea
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder={t('pasteHere')}
              rows={6}
              className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              style={{ fontFamily: '宋体', fontSize: '16px' }}
              spellCheck={false}
            />
          </div>
          {/* 右侧 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-medium">{t('rightPanel')}</Label>
              <div className="flex-1">
                <SourceSelector side="right" value={rightSource} onChange={setRightSource} />
              </div>
            </div>
            <textarea
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder={t('pasteHere')}
              rows={6}
              className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              style={{ fontFamily: '宋体', fontSize: '16px' }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* 对比控制栏 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
          <Select value={diffMode} onValueChange={(v) => setDiffMode(v as DiffMode)}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">{t('modeLine')}</SelectItem>
              <SelectItem value="word">{t('modeWord')}</SelectItem>
              <SelectItem value="char">{t('modeChar')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sideBySide">{t('sideBySide')}</SelectItem>
              <SelectItem value="unified">{t('unified')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={handleCompare}
            disabled={comparing || !leftText.trim() || !rightText.trim()}
          >
            {comparing ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompareArrows className="h-3 w-3" />}
            {comparing ? t('comparing') : t('compare')}
          </Button>
        </div>

        {/* 对比结果区 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {diffResult ? (
            renderedDiff
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground/50">{t('diffResult')}</p>
            </div>
          )}
        </div>
      </div>
    </ToolPluginLayout>
  );
}
