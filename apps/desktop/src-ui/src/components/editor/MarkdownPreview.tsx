import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';

// 大文档预览截断阈值（字符数），超过此值只渲染前半部分
const PREVIEW_TRUNCATE_THRESHOLD = 80_000;
// Mermaid SVG 缓存：避免每次 content 变化时重新渲染未变更的图表
const mermaidCache = new Map<string, string>();

// 简单哈希函数，用于 Mermaid 缓存键
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash.toString(36);
}

// 模块级常量：避免每次渲染创建新数组引用
const REMARK_PLUGINS = [remarkGfm, remarkMath] as const;

/**
 * 预处理 Markdown：将普通段落间的单换行转为双换行，
 * 使每行文本生成独立的 <p> 标签（首行缩进正常生效）。
 * 保留代码块、列表、标题、引用、表格、空行等特殊结构不被干扰。
 */
function preprocessMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // 代码块围栏切换
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    // 代码块内部：原样保留
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    result.push(line);

    // 判断是否需要在当前行后插入空行
    // 条件：当前行是普通文本行（非空、非特殊标记），下一行也是普通文本行
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine.trimStart();
      const isCurrentEmpty = trimmed === '';
      const isNextEmpty = nextTrimmed === '';
      const isSpecial = (l: string) =>
        l === '' ||
        /^#{1,6}\s/.test(l) ||      // 标题
        /^[-*+]\s/.test(l) ||        // 无序列表
        /^\d+\.\s/.test(l) ||       // 有序列表
        /^>/.test(l) ||              // 引用
        /^\|/.test(l) ||             // 表格
        /^---/.test(l) ||            // 分隔线
        /^```/.test(l) ||            // 代码块
        /^\s{4,}/.test(l);           // 缩进代码

      // 两行都是普通文本（非空、非特殊），且中间没有空行 → 插入空行
      if (!isCurrentEmpty && !isNextEmpty && !isSpecial(trimmed) && !isSpecial(nextTrimmed)) {
        result.push('');
      }
    }
  }

  return result.join('\n');
}
const REHYPE_PLUGINS = [
  rehypeRaw,
  [rehypeKatex, { throwOnError: false, strict: false }],
  [rehypeHighlight, { detect: true, subset: false }],
] as const;

interface MarkdownPreviewProps {
  content: string;
  theme?: 'light' | 'dark';
  className?: string;
  fontSize?: number;
  fontFamily?: string;
  /** 禁用截断，阅读器场景下显示完整内容 */
  disableTruncation?: boolean;
  /** 不设置内联 lineHeight，让外部 CSS 控制（阅读器场景） */
  noInlineLineHeight?: boolean;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({
  content,
  theme = 'light',
  className = '',
  fontSize = 14,
  fontFamily,
  disableTruncation = false,
  noInlineLineHeight = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // 初始化 Mermaid
  useEffect(() => {
    // 清理 mermaid 之前渲染失败时残留在 body 中的临时 DOM
    // mermaid 会在 body 下创建 div#d{id} > svg#{id}，失败时不清理导致残留
    // 注意：只按 ID 精确匹配，不能用 querySelector 深度搜索，否则可能误删 #root
    document.querySelectorAll('body > div[id^="dmermaid-"], body > div[id^="dmsg-mermaid-"]').forEach(el => el.remove());
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      suppressErrorRendering: true,
    });
  }, [theme]);

  // 渲染 Mermaid 图表（带缓存）
  const renderMermaid = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const mermaidBlocks = el.querySelectorAll('pre > code.language-mermaid');
    for (const block of mermaidBlocks) {
      const pre = block.parentElement;
      if (!pre || pre.getAttribute('data-mermaid-rendered') === 'true') continue;
      const code = block.textContent || '';
      const cacheKey = simpleHash(code);

      // 优先使用缓存
      const cached = mermaidCache.get(cacheKey);
      if (cached) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = cached;
        pre.replaceWith(wrapper);
        continue;
      }

      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, code);
        mermaidCache.set(cacheKey, svg);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch (e) {
        console.warn('[MarkdownPreview] Mermaid render failed:', e);
        // 兆底清理 mermaid 可能残留在 body 中的临时渲染元素
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
        pre.setAttribute('data-mermaid-rendered', 'true');
      }
    }
  }, []);

  useEffect(() => {
    // 延迟执行，确保 DOM 已更新
    const timer = setTimeout(renderMermaid, 100);
    return () => clearTimeout(timer);
  }, [content, renderMermaid]);

  // 拦截链接点击，用系统浏览器打开外部链接
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !(/^https?:\/\//.test(href))) return;
      e.preventDefault();
      invoke('open_file_with_app', { path: href, appName: null }).catch(console.error);
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, []);

  const customStyle = useMemo(() => ({
    fontSize: `${fontSize}px`,
    ...(noInlineLineHeight ? {} : { lineHeight: 1.6 }),
    ...(fontFamily ? { fontFamily } : {}),
  }), [fontSize, fontFamily, noInlineLineHeight]);

  return (
    <div
      ref={containerRef}
      className={cn(
        // 颜色跟随 documentElement 主题（--foreground / --background），勿在根上再套 .dark，
        // 否则浅色应用下会出现浅色字 + 浅色底导致预览「看不见」。
        'markdown-preview max-w-none min-h-0 text-foreground bg-background',
        className,
      )}
      style={customStyle}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS as any}
        rehypePlugins={REHYPE_PLUGINS as any}
      >
        {preprocessMarkdown(
          !disableTruncation && content.length > PREVIEW_TRUNCATE_THRESHOLD
            ? content.slice(0, PREVIEW_TRUNCATE_THRESHOLD)
            : content
        )}
      </ReactMarkdown>
      {!disableTruncation && content.length > PREVIEW_TRUNCATE_THRESHOLD && (
        <div className="text-center py-4 text-muted-foreground text-sm border-t mt-4">
          {t('editor.previewTruncated', { defaultValue: '文档较长（{{size}}K 字符），预览已截断以保证性能', size: Math.round(content.length / 1000) })}
        </div>
      )}
    </div>
  );
});
