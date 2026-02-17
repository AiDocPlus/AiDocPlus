import { useState, useCallback } from 'react';
import { Paperclip, Plus, X, ChevronDown, ChevronUp, Eye, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { Attachment } from '@aidocplus/shared-types';

interface AttachmentPanelProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export function AttachmentPanel({ attachments, onAttachmentsChange }: AttachmentPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(attachments.length === 0);
  const [adding, setAdding] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleAdd = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: t('editor.attachDocFiles', { defaultValue: '文档文件' }),
            extensions: ['txt', 'md', 'markdown', 'docx', 'csv', 'html', 'htm', 'json', 'xml', 'yaml', 'yml', 'toml', 'rst', 'tex', 'log'],
          },
          { name: t('editor.attachWordDoc', { defaultValue: 'Word 文档' }), extensions: ['docx'] },
          { name: t('editor.attachTextFiles', { defaultValue: '文本文件' }), extensions: ['txt', 'md', 'markdown'] },
          { name: t('editor.attachAllFiles', { defaultValue: '所有文件' }), extensions: ['*'] },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      const newAttachments: Attachment[] = [];

      for (const item of paths) {
        const filePath = typeof item === 'string' ? item : (item as any)?.path ?? String(item);
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

        // 检查是否已添加
        if (attachments.some(a => a.filePath === filePath)) continue;

        newAttachments.push({
          id: crypto.randomUUID(),
          fileName,
          filePath,
          fileSize: 0, // 前端无法直接获取，后端转换时会处理
          fileType: ext,
          addedAt: Math.floor(Date.now() / 1000),
        });
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
        setCollapsed(false);
      }
    } catch (error) {
      console.error('[AttachmentPanel] 添加附件失败:', error);
    } finally {
      setAdding(false);
    }
  }, [adding, attachments, onAttachmentsChange]);

  const handleRemove = useCallback((id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
    if (previewId === id) {
      setPreviewId(null);
      setPreviewContent('');
    }
  }, [attachments, onAttachmentsChange, previewId]);

  const handlePreview = useCallback(async (att: Attachment) => {
    if (previewId === att.id) {
      setPreviewId(null);
      setPreviewContent('');
      return;
    }
    setPreviewId(att.id);
    setPreviewLoading(true);
    try {
      const content = await invoke<string>('import_file', { path: att.filePath });
      setPreviewContent(content);
    } catch (error) {
      const errMsg = typeof error === 'string' ? error : String(error);
      setPreviewContent(`⚠️ ${t('editor.previewFailed', { defaultValue: '无法预览：{{error}}', error: errMsg })}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewId]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const fileIcon = (ext: string) => {
    switch (ext) {
      case 'docx': return '📄';
      case 'csv': return '📊';
      case 'html': case 'htm': return '🌐';
      case 'json': return '{}';
      case 'xml': return '📋';
      default: return '📝';
    }
  };

  return (
    <div className="border-t bg-background flex-shrink-0">
      {/* 标题栏 */}
      <div className="w-full px-4 py-1.5 flex items-center justify-between hover:bg-accent/50 transition-colors">
        <span
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none flex-1"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {attachments.length > 0 ? t('editor.attachment.titleCount', { defaultValue: '附件 ({{count}})', count: attachments.length }) : t('editor.attachment.title', { defaultValue: '附件' })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            <span className="ml-1">{t('editor.attachment.add', { defaultValue: '添加' })}</span>
          </Button>
          <span className="cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
          </span>
        </div>
      </div>

      {/* 附件列表 */}
      {!collapsed && (
        <div className="px-4 pb-2 space-y-1 max-h-[200px] overflow-y-auto">
          {attachments.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">
              {t('editor.attachment.noAttachments', { defaultValue: '暂无附件，点击“添加”选择文件' })}
            </div>
          ) : (
            attachments.map((att) => (
              <div key={att.id}>
                <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 group text-xs">
                  <span>{fileIcon(att.fileType)}</span>
                  <span className="flex-1 truncate font-medium" title={att.filePath}>
                    {att.fileName}
                  </span>
                  {att.fileSize > 0 && (
                    <span className="text-muted-foreground">{formatSize(att.fileSize)}</span>
                  )}
                  <span className="text-muted-foreground uppercase">{att.fileType}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => handlePreview(att)}
                    title={t('editor.attachment.previewContent', { defaultValue: '预览内容' })}
                  >
                    <Eye className={cn('h-3 w-3', previewId === att.id && 'text-primary')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={() => handleRemove(att.id)}
                    title={t('editor.attachment.removeAttachment', { defaultValue: '移除附件' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {/* 预览区域 */}
                {previewId === att.id && (
                  <div className="ml-6 mt-1 mb-2 p-2 rounded bg-muted/50 border text-xs max-h-[150px] overflow-y-auto">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('editor.attachment.converting', { defaultValue: '正在转换...' })}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                        {previewContent.length > 2000
                          ? previewContent.slice(0, 2000) + t('editor.attachment.contentTruncated', { defaultValue: '\n\n... (内容过长，仅显示前 2000 字符)' })
                          : previewContent}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
