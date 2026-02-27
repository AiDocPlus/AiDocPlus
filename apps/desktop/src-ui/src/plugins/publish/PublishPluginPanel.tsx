import { useState, useCallback } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import { Share2, Copy, Eye, FileText, Code2 } from 'lucide-react';

interface PlatformDef {
  key: string;
  label: string;
  note: string;
  preferredFormat: 'html' | 'markdown';
}

const PLATFORMS: PlatformDef[] = [
  { key: 'wechat', label: 'platformWechat', note: 'wechatNote', preferredFormat: 'html' },
  { key: 'zhihu', label: 'platformZhihu', note: 'zhihuNote', preferredFormat: 'markdown' },
  { key: 'juejin', label: 'platformJuejin', note: 'juejinNote', preferredFormat: 'markdown' },
  { key: 'csdn', label: 'platformCsdn', note: 'csdnNote', preferredFormat: 'markdown' },
  { key: 'medium', label: 'platformMedium', note: 'mediumNote', preferredFormat: 'html' },
  { key: 'wordpress', label: 'platformWordpress', note: 'wordpressNote', preferredFormat: 'html' },
  { key: 'ghost', label: 'platformGhost', note: 'ghostNote', preferredFormat: 'markdown' },
  { key: 'custom', label: 'platformCustom', note: 'customNote', preferredFormat: 'markdown' },
];

interface PublishStorage {
  platform?: string;
  includeTitle?: boolean;
  includeToc?: boolean;
  imageHandling?: 'keep' | 'remove';
}

/**
 * 简易 Markdown → HTML 转换（用于微信公众号等平台）
 */
function markdownToSimpleHtml(md: string, title?: string, _includeToc?: boolean): string {
  let html = md;

  // 标题
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // 粗体、斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:14px;">$1</code>');

  // 代码块
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>$1</code></pre>');

  // 链接、图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#576b95;">$1</a>');

  // 无序列表
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;">$&</ul>');

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // 引用
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote style="border-left:4px solid #ddd;padding:8px 16px;color:#666;margin:12px 0;">$1</blockquote>');

  // 分割线
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">');

  // 段落
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<(h[1-6]|ul|ol|pre|blockquote|hr)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|ul|ol|pre|blockquote)>\s*<\/p>/g, '</$1>');

  const parts: string[] = [];
  if (title) {
    parts.push(`<h1 style="font-size:24px;font-weight:bold;margin-bottom:16px;">${title}</h1>`);
  }
  parts.push(html);

  return `<div style="font-family:'宋体',serif;font-size:16px;line-height:1.8;color:#333;">${parts.join('')}</div>`;
}

export function PublishPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const stored = (host.storage.get('settings') as PublishStorage) || {};
  const [platform, setPlatform] = useState(stored.platform || 'wechat');
  const [includeTitle, setIncludeTitle] = useState(stored.includeTitle ?? true);
  const _includeTocReserved = stored.includeToc; // 预留，后续扩展
  void _includeTocReserved;
  const [showPreview, setShowPreview] = useState(false);
  const [formattedHtml, setFormattedHtml] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const saveSettings = useCallback((updates: Partial<PublishStorage>) => {
    const current = (host.storage.get('settings') as PublishStorage) || {};
    host.storage.set('settings', { ...current, ...updates });
  }, [host.storage]);

  const getContent = useCallback((): string => {
    return content || document.aiGeneratedContent || document.content || '';
  }, [content, document]);

  const currentPlatform = PLATFORMS.find(p => p.key === platform);

  // 格式化并预览
  const handleFormat = useCallback(() => {
    const md = getContent();
    if (!md.trim()) {
      showStatus(t('noContent'), true);
      return;
    }
    const html = markdownToSimpleHtml(md, includeTitle ? document.title : undefined);
    setFormattedHtml(html);
    setShowPreview(true);
    showStatus(t('formatSuccess'));
  }, [getContent, includeTitle, document.title, t, showStatus]);

  // 复制 HTML
  const handleCopyHtml = useCallback(async () => {
    const md = getContent();
    if (!md.trim()) { showStatus(t('noContent'), true); return; }
    const html = formattedHtml || markdownToSimpleHtml(md, includeTitle ? document.title : undefined);
    await host.ui.copyToClipboard(html);
    showStatus(t('copied'));
  }, [getContent, formattedHtml, includeTitle, document.title, host.ui, t, showStatus]);

  // 复制 Markdown
  const handleCopyMarkdown = useCallback(async () => {
    const md = getContent();
    if (!md.trim()) { showStatus(t('noContent'), true); return; }
    const parts: string[] = [];
    if (includeTitle && document.title) parts.push(`# ${document.title}\n`);
    parts.push(md);
    await host.ui.copyToClipboard(parts.join('\n'));
    showStatus(t('copied'));
  }, [getContent, includeTitle, document.title, host.ui, t, showStatus]);

  const handleImportContent = useCallback((_text: string, _source: string) => {
    // 发布插件不需要导入
  }, []);

  return (
    <ToolPluginLayout
      pluginIcon={<Share2 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        <>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleFormat}>
            <Eye className="h-3 w-3" />
            {t('preview')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCopyHtml}>
            <Code2 className="h-3 w-3" />
            {t('copyHtml')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCopyMarkdown}>
            <FileText className="h-3 w-3" />
            {t('copyMarkdown')}
          </Button>
        </>
      }
    >
      <div className="p-4 space-y-4">
        {/* 平台选择 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('platform')}</Label>
          <Select value={platform} onValueChange={(v) => { setPlatform(v); saveSettings({ platform: v }); }}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectPlatform')} />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => (
                <SelectItem key={p.key} value={p.key}>{t(p.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 平台说明 */}
        {currentPlatform && (
          <div className="p-2.5 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
            <span className="font-medium">{t('platformNotes')}：</span>
            {t(currentPlatform.note)}
          </div>
        )}

        {/* 选项 */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTitle}
              onChange={(e) => { setIncludeTitle(e.target.checked); saveSettings({ includeTitle: e.target.checked }); }}
              className="rounded border-border"
            />
            <span className="text-xs">{t('includeTitle')}</span>
          </label>
        </div>

        {/* 一键复制按钮 */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={currentPlatform?.preferredFormat === 'html' ? handleCopyHtml : handleCopyMarkdown}
        >
          <Copy className="h-4 w-4" />
          {t('copyFormatted')} ({currentPlatform?.preferredFormat === 'html' ? 'HTML' : 'Markdown'})
        </Button>

        {/* 预览 */}
        {showPreview && formattedHtml && (
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-1.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              {t('preview')} — {currentPlatform ? t(currentPlatform.label) : ''}
            </div>
            <div
              className="p-4 prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-96"
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />
          </div>
        )}
      </div>
    </ToolPluginLayout>
  );
}
