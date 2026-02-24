import { useState, useCallback, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button } from '../_framework/ui';
import {
  Clock, RefreshCw, Loader2, Eye, Copy, RotateCcw, X,
} from 'lucide-react';
import type { DocumentVersion } from '@aidocplus/shared-types';

export function TimelinePluginPanel({
  document: doc,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  // 加载版本列表
  const loadVersions = useCallback(async () => {
    if (!doc.projectId || !doc.id) {
      showStatus(t('noProjectOpen'), true);
      return;
    }
    setLoading(true);
    try {
      const result = await host.platform.invoke<DocumentVersion[]>('list_versions', {
        projectId: doc.projectId,
        documentId: doc.id,
      });
      // 按时间倒序排列
      const sorted = (result || []).sort((a, b) => b.createdAt - a.createdAt);
      setVersions(sorted);
      if (sorted.length > 0) {
        showStatus(t('versionCount').replace('{count}', String(sorted.length)));
      }
    } catch (err) {
      showStatus(`${t('loadError')}: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setLoading(false);
    }
  }, [doc.projectId, doc.id, host.platform, t, showStatus]);

  // 初始化加载
  useEffect(() => {
    if (doc.projectId && doc.id) {
      loadVersions();
    }
  }, [doc.projectId, doc.id, loadVersions]);

  // 复制版本内容
  const handleCopy = useCallback(async (version: DocumentVersion) => {
    const text = version.content || version.aiGeneratedContent || '';
    if (text) {
      await host.ui.copyToClipboard(text);
      showStatus(t('copied'));
    }
  }, [host.ui, t, showStatus]);

  // 恢复版本（复制内容到剪贴板，提示用户粘贴）
  const handleRestore = useCallback(async (version: DocumentVersion) => {
    const text = [version.content, version.aiGeneratedContent].filter(Boolean).join('\n\n---\n\n');
    if (text) {
      await host.ui.copyToClipboard(text);
      showStatus(`${t('restore')} — ${t('copied')}`);
    }
  }, [host.ui, t, showStatus]);

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `今天 ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `昨天 ${timeStr}`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + timeStr;
  };

  // 计算内容长度
  const contentLength = (version: DocumentVersion): number => {
    return (version.content || '').length + (version.aiGeneratedContent || '').length;
  };

  // 导入内容回调（工具栏）
  const handleImportContent = useCallback((_text: string, _source: string) => {
    // 版本时间线不需要导入功能，但接口要求
  }, []);

  return (
    <ToolPluginLayout
      pluginIcon={<Clock className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      statusExtra={
        versions.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('versionCount').replace('{count}', String(versions.length))}
          </span>
        ) : null
      }
      extraToolbar={
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={loadVersions} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {t('refresh')}
        </Button>
      }
    >
      <div className="flex flex-col h-full">
        {/* 预览面板 */}
        {previewVersion && (
          <div className="border-b bg-muted/20 flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-1.5 border-b">
              <span className="text-xs font-medium">{t('contentPreview')}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPreviewVersion(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div
              className="p-3 max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap break-all"
              style={{ fontFamily: '宋体', fontSize: '16px' }}
            >
              {previewVersion.content || previewVersion.aiGeneratedContent || '(空)'}
            </div>
          </div>
        )}

        {/* 时间线 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t('loading')}</span>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2 px-8">
                <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">{t('noVersions')}</p>
                <p className="text-xs text-muted-foreground/60">{t('noVersionsDesc')}</p>
              </div>
            </div>
          ) : (
            <div className="relative pl-8 pr-3 py-3">
              {/* 时间线竖线 */}
              <div className="absolute left-5 top-3 bottom-3 w-px bg-border" />

              {versions.map((version, index) => {
                const isFirst = index === versions.length - 1;
                const chars = contentLength(version);
                const prevChars = index < versions.length - 1 ? contentLength(versions[index + 1]) : 0;
                const charDiff = chars - prevChars;

                return (
                  <div key={version.id} className="relative mb-4 last:mb-0">
                    {/* 时间线节点 */}
                    <div className={`absolute -left-3 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                      index === 0
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-background border-muted-foreground/40'
                    }`} />

                    {/* 版本卡片 */}
                    <div className="p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">
                              {index === 0 ? t('current') : `${t('versionLabel')} ${versions.length - index}`}
                            </span>
                            {index === 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {t('current')}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/60">
                              {version.createdBy === 'ai' ? '🤖' : '✍️'}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatTime(version.createdAt)}
                          </div>
                          {version.changeDescription && (
                            <div className="text-xs text-muted-foreground/80 mt-1 truncate">
                              {version.changeDescription}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/60">
                            <span>{chars.toLocaleString()} {t('chars')}</span>
                            {!isFirst && charDiff !== 0 && (
                              <span className={charDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {charDiff > 0 ? '+' : ''}{charDiff.toLocaleString()}
                              </span>
                            )}
                            {isFirst && (
                              <span className="text-muted-foreground/40">{t('firstVersion')}</span>
                            )}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={t('preview')}
                            onClick={() => setPreviewVersion(previewVersion?.id === version.id ? null : version)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={t('copyContent')}
                            onClick={() => handleCopy(version)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {index !== 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title={t('restore')}
                              onClick={() => handleRestore(version)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ToolPluginLayout>
  );
}
