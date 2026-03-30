/**
 * Article View — 大纲展开为连续文章视图
 *
 * 将树形大纲按层级转换为连续的 Markdown 文本，
 * 标题节点用 heading 表示，其余用段落/列表渲染。
 * 节点标题可点击跳转回大纲视图并聚焦该节点。
 */

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Edit3, Copy, Check } from 'lucide-react';
import type { Outline, OutlineNode } from '../types';
import { nodeContentToMarkdown } from '../converters/markdownConverter';

interface ArticleViewProps {
  outline: Outline;
  /** 点击节点标题时聚焦到该节点并切换回大纲视图 */
  onFocusNode?: (nodeId: string) => void;
  /** 切换回大纲编辑视图 */
  onSwitchToOutline?: () => void;
}

interface ArticleSection {
  nodeId: string;
  markdown: string;
}

/** 将大纲树转为可交互的文章段落 */
function buildArticleSections(
  nodes: OutlineNode[],
  showNotes: boolean,
  t: (key: string, defaultValue?: string) => string,
): ArticleSection[] {
  const sections: ArticleSection[] = [];

  function walk(node: OutlineNode, depth: number) {
    const lines: string[] = [];

    // 标题级别
    const headingLevel = node.headingLevel && node.headingLevel > 0
      ? Math.min(node.headingLevel, 6)
      : depth < 3
        ? Math.min(depth + 1, 6)
        : 0;

    const richText = nodeContentToMarkdown(node.content);
    let displayText = richText || node.plainText || '';

    // 完成状态
    if (node.completed) {
      displayText = `~~${displayText}~~ ✓`;
    }

    if (headingLevel > 0) {
      lines.push(`${'#'.repeat(headingLevel)} ${displayText}`);
    } else {
      lines.push(displayText);
    }

    // 备注
    if (showNotes && node.notePlainText) {
      lines.push('');
      lines.push(`> ${node.notePlainText}`);
    }

    lines.push('');
    sections.push({ nodeId: node.id, markdown: lines.join('\n') });

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const node of nodes) {
    walk(node, 0);
  }

  return sections;
}

export function ArticleView({
  outline,
  onFocusNode,
  onSwitchToOutline,
}: ArticleViewProps) {
  const { t } = useTranslation();
  const [showNotes, setShowNotes] = useState(true);
  const [copied, setCopied] = useState(false);

  const sections = useMemo(
    () => buildArticleSections(outline.nodes, showNotes, t),
    [outline.nodes, showNotes, t],
  );

  // 完整 Markdown 文本（用于复制）
  const fullMarkdown = useMemo(
    () => sections.map((s) => s.markdown).join(''),
    [sections],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullMarkdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard API 可能不可用（如非 HTTPS / 部分 WebView），静默失败
    });
  }, [fullMarkdown]);

  const isEmpty = outline.nodes.length === 0 ||
    (outline.nodes.length === 1 && !outline.nodes[0].plainText?.trim());

  return (
    <div className="flex flex-col h-full">
      {/* 工具条 */}
      <div className="flex items-center gap-1 px-3 py-1 border-b bg-card shrink-0">
        <span className="text-xs text-muted-foreground">
          {t('outline.articleView.hint', { defaultValue: '大纲已展开为文章视图' })}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => setShowNotes(v => !v)}
          title={showNotes
            ? t('outline.articleView.hideNotes', { defaultValue: '隐藏备注' })
            : t('outline.articleView.showNotes', { defaultValue: '显示备注' })}
        >
          {showNotes ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showNotes
            ? t('outline.articleView.hideNotes', { defaultValue: '隐藏备注' })
            : t('outline.articleView.showNotes', { defaultValue: '显示备注' })}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleCopy}
          title={t('outline.articleView.exportArticle', { defaultValue: '复制文章' })}
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied
            ? t('common.copied', { defaultValue: '已复制' })
            : t('outline.articleView.exportArticle', { defaultValue: '复制文章' })}
        </Button>
        {onSwitchToOutline && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={onSwitchToOutline}
            title={t('outline.articleView.switchToOutline', { defaultValue: '编辑大纲' })}
          >
            <Edit3 className="h-3 w-3" />
            {t('outline.articleView.switchToOutline', { defaultValue: '编辑大纲' })}
          </Button>
        )}
      </div>

      {/* 文章内容 */}
      <ScrollArea className="flex-1">
        {isEmpty ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            {t('outline.articleView.empty', { defaultValue: '大纲为空，添加节点后可预览文章视图。' })}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none px-6 py-4">
            {sections.map((section) => (
              <div key={section.nodeId} className="group/section relative">
                {/* 节点标题可点击跳转 */}
                {onFocusNode ? (
                  <button
                    type="button"
                    className="absolute right-0 top-0 opacity-0 group-hover/section:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-1 rounded hover:bg-accent"
                    onClick={() => onFocusNode(section.nodeId)}
                    title={t('outline.articleView.jumpToNode', { defaultValue: '跳转到节点' })}
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                ) : null}
                <MarkdownPreview content={section.markdown} />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ArticleView;
