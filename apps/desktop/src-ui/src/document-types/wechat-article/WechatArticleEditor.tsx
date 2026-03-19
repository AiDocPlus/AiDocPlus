/**
 * WechatArticleEditor — 公众号文章专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 字数限制指示器（建议 800-2000 字）
 * - 阅读时长估算
 * - 段落数统计
 */
import { useState, useMemo } from 'react';
import { Newspaper } from 'lucide-react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';
import { cn } from '@/lib/utils';

export default function WechatArticleEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const stats = useMemo(() => {
    const wordCount = currentContent.replace(/\s/g, '').length;
    const paragraphs = currentContent.split(/\n\s*\n/).filter(p => p.trim()).length;
    const readMinutes = Math.max(1, Math.round(wordCount / 500));
    const inRange = wordCount >= 800 && wordCount <= 2000;
    return { wordCount, paragraphs, readMinutes, inRange };
  }, [currentContent]);

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('wechat.placeholder', { defaultValue: '开始撰写公众号文章...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <Newspaper className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <span className={cn('text-xs px-2 py-0.5 rounded-full', stats.inRange ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
            {stats.wordCount} {t('wechat.chars', { defaultValue: '字' })}
            {!stats.inRange && ` (${t('wechat.recommended', { defaultValue: '建议 800-2000' })})`}
          </span>
          <span className="text-xs text-muted-foreground">
            ≈ {stats.readMinutes} {t('wechat.minRead', { defaultValue: '分钟' })}
          </span>
        </div>
      }
      statusBarRight={
        <span className="flex items-center gap-2">
          <span>{stats.paragraphs} {t('wechat.paragraphs', { defaultValue: '段' })}</span>
          <span>{t('docType.wechatArticle', { defaultValue: '公众号文章' })}</span>
        </span>
      }
    />
  );
}
