import { useState, useEffect } from 'react';
import { Clock, Eye, RotateCcw, GitBranch, X, GitCompare } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import type { DocumentVersion } from '@aidocplus/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN, enUS, ja } from 'date-fns/locale';
import { DiffViewer } from './DiffViewer';

interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  documentId?: string;
}

export function VersionHistoryPanel({ open, onClose, projectId, documentId }: VersionHistoryPanelProps) {
  const { t } = useTranslation();
  const { currentDocument, documents, loadVersions, createVersion, restoreVersion } = useAppStore();

  // 如果传入了 projectId 和 documentId，使用它们；否则从 currentDocument 获取
  const effectiveDocumentId = documentId || currentDocument?.id;
  const effectiveProjectId = projectId || currentDocument?.projectId;
  const document = documents.find(d => d.id === effectiveDocumentId) || currentDocument;
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{ left?: DocumentVersion; right?: DocumentVersion }>({});

  // Load versions when panel opens or document changes
  useEffect(() => {
    if (open && effectiveDocumentId && effectiveProjectId) {
      loadVersionsData();
    }
  }, [open, effectiveDocumentId, effectiveProjectId]);

  const loadVersionsData = async () => {
    if (!effectiveDocumentId || !effectiveProjectId) return;

    setLoading(true);
    try {
      const versionList = await loadVersions(effectiveProjectId, effectiveDocumentId);
      setVersions(versionList);
    } catch (error) {
      console.error('[VersionHistoryPanel] Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!document) return;

    try {
      await createVersion(
        effectiveProjectId!,
        effectiveDocumentId!,
        document.content,
        document.authorNotes,
        document.aiGeneratedContent,
        'user',
        'Manual version checkpoint',
        document.pluginData,
        document.enabledPlugins
      );
      await loadVersionsData();
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  };

  const handlePreview = (version: DocumentVersion) => {
    setPreviewVersion(version);
    setSelectedVersionId(version.id);
  };

  const handleCompareClick = (version: DocumentVersion) => {
    if (compareVersions.left && !compareVersions.right) {
      setCompareVersions({ ...compareVersions, right: version });
    } else if (compareVersions.left && compareVersions.right) {
      // Reset if both selected
      setCompareVersions({ left: undefined, right: undefined });
    } else {
      setCompareVersions({ ...compareVersions, left: version });
    }
  };

  const handleOpenDiffViewer = () => {
    if (compareVersions.left && compareVersions.right) {
      setShowDiffViewer(true);
    }
  };

  const handleRestoreClick = (version: DocumentVersion) => {
    setVersionToRestore(version);
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    if (!versionToRestore || !effectiveProjectId || !effectiveDocumentId) return;

    try {
      setLoading(true);
      await restoreVersion(
        effectiveProjectId,
        effectiveDocumentId,
        versionToRestore.id,
        createBackup
      );

      // Reload versions after restore
      await loadVersionsData();

      setShowRestoreConfirm(false);
      setVersionToRestore(null);

      // Show success message inline
      setRestoreMessage({ ok: true, msg: t('version.restored', { defaultValue: '版本恢复成功' }) });
      setTimeout(() => setRestoreMessage(null), 3000);
    } catch (error) {
      console.error('Failed to restore version:', error);
      setRestoreMessage({ ok: false, msg: t('errors.restoreFailed', { defaultValue: '版本恢复失败' }) });
      setTimeout(() => setRestoreMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getLocale = () => {
    const language = localStorage.getItem('aidocplus-language') || 'zh';
    switch (language) {
      case 'en': return enUS;
      case 'ja': return ja;
      default: return zhCN;
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      return format(new Date(timestamp * 1000), 'PPpp', { locale: getLocale() });
    } catch {
      return new Date(timestamp * 1000).toLocaleString();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-card shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {t('version.title')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {compareVersions.left && compareVersions.right && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDiffViewer}
                >
                  <GitCompare className="w-4 h-4 mr-2" />
                  {t('version.compare', { defaultValue: 'Compare' })}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateVersion}
                disabled={!currentDocument || loading}
              >
                <Clock className="w-4 h-4 mr-2" />
                {t('version.create', { defaultValue: 'Create Version' })}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                title={t('common.close')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Version List */}
            <div className="w-80 border-r overflow-hidden flex flex-col shrink-0">
              <div className="p-3 border-b bg-background shrink-0">
                <p className="text-sm font-medium">
                  {t('version.versionCount', { count: versions.length, defaultValue: 'versions' })}
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t('version.noVersions')}
                    </div>
                  ) : (
                    // 反转版本数组，让最新的版本显示在最上面
                    [...versions].reverse().map((version, reverseIndex) => {
                      // 使用 currentVersionId 来判断是否是当前版本
                      const isCurrent = version.id === currentDocument?.currentVersionId;
                      const isSelected = selectedVersionId === version.id;

                      return (
                        <button
                          key={version.id}
                          onClick={() => handlePreview(version)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all hover:bg-accent group relative",
                            isSelected && "bg-primary/10 border-primary border-2 shadow-sm",
                            isCurrent && "border-primary/50",
                            (compareVersions.left?.id === version.id || compareVersions.right?.id === version.id) && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          )}
                        >
                          {(compareVersions.left?.id === version.id || compareVersions.right?.id === version.id) && (
                            <span className="absolute top-1 right-1 text-xs bg-blue-500 text-white px-1.5 rounded">
                              {compareVersions.left?.id === version.id ? '1' : '2'}
                            </span>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {isCurrent ? t('version.currentVersion') : `v${versions.length - reverseIndex}`}
                                </span>
                                {isCurrent && (
                                  <span className="text-xs bg-primary/10 text-primary px-1.5 rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDate(version.createdAt)}
                              </div>
                              {version.changeDescription && (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {version.changeDescription}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompareClick(version);
                                }}
                                title={compareVersions.left?.id === version.id
                                  ? t('version.clearSelection', { defaultValue: '清除选择' })
                                  : compareVersions.right?.id === version.id
                                  ? t('version.switchToLeft', { defaultValue: '切换为左侧版本' })
                                  : t('version.selectForCompare', { defaultValue: '选为对比版本' })}
                              >
                                <GitCompare className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestoreClick(version);
                                }}
                                title={t('version.restoreToThis', { defaultValue: '恢复到此版本' })}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Version Preview */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {previewVersion ? (
                <>
                  <div className="p-3 border-b bg-background shrink-0">
                    <div className="flex items-center">
                      <div>
                        <h3 className="font-medium">{t('version.preview')}</h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(previewVersion.createdAt)}
                        </p>
                      </div>
                    </div>
                    {previewVersion.changeDescription && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">{t('version.changeDescription')}:</span>
                        <p className="text-muted-foreground">{previewVersion.changeDescription}</p>
                      </div>
                    )}
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {/* Content Preview */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">{t('editor.originalContent')}</h4>
                        <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                          {previewVersion.content || t('common.noContent', { defaultValue: 'No content' })}
                        </div>
                      </div>

                      <Separator />

                      {/* Author Notes */}
                      {previewVersion.authorNotes && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">{t('chat.authorNotes')}</h4>
                          <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                            {previewVersion.authorNotes}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* AI Generated Content */}
                      {previewVersion.aiGeneratedContent && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">{t('chat.aiGenerateContent', { defaultValue: 'AI 生成内容' })}</h4>
                          <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                            {previewVersion.aiGeneratedContent}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          <span className="font-medium">{t('version.createdBy')}:</span>{' '}
                          {previewVersion.createdBy}
                        </div>
                        <div>
                          <span className="font-medium">{t('version.createdAt')}:</span>{' '}
                          {formatDate(previewVersion.createdAt)}
                        </div>
                        <div>
                          <span className="font-medium">{t('editor.wordCount')}:</span>{' '}
                          {previewVersion.content.split(/\s+/).filter(Boolean).length}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('version.selectToPreview', { defaultValue: 'Select a version to preview' })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Restore Message */}
          {restoreMessage && (
            <div className={`border-t px-4 py-2 text-sm shrink-0 ${restoreMessage.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {restoreMessage.msg}
            </div>
          )}

          {/* Restore Confirmation Dialog */}
          {showRestoreConfirm && versionToRestore && (
            <div className="border-t p-4 bg-background shrink-0">
              <div className="space-y-3">
                <h4 className="font-medium">{t('version.restoreConfirm')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('version.restoreVersion', { version: versionToRestore.id.slice(0, 8) })}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-backup"
                    checked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="create-backup" className="text-sm">
                    {t('version.restoreBackup')}
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowRestoreConfirm(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" onClick={handleRestoreConfirm}>
                    {t('common.confirm')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diff Viewer Dialog */}
      <DiffViewer
        open={showDiffViewer}
        onClose={() => setShowDiffViewer(false)}
        leftVersion={compareVersions.left}
        rightVersion={compareVersions.right}
        leftLabel={compareVersions.left ? t('version.leftVersion', { defaultValue: 'Earlier Version' }) : undefined}
        rightLabel={compareVersions.right ? t('version.rightVersion', { defaultValue: 'Later Version' }) : undefined}
      />
    </>
  );
}

export default VersionHistoryPanel;
