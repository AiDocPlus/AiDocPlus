import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';

// 模块级常量：避免每次渲染创建新数组引用
const REMARK_PLUGINS = [remarkGfm, remarkMath] as const;
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
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({
  content,
  theme = 'light',
  className = '',
  fontSize = 14,
  fontFamily,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 渲染 Mermaid 图表
  const renderMermaid = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const mermaidBlocks = el.querySelectorAll('pre > code.language-mermaid');
    for (const block of mermaidBlocks) {
      const pre = block.parentElement;
      if (!pre || pre.getAttribute('data-mermaid-rendered') === 'true') continue;
      const code = block.textContent || '';
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch (e) {
        console.warn('[MarkdownPreview] Mermaid render failed:', e);
        // 兜底清理 mermaid 可能残留在 body 中的临时渲染元素
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
    lineHeight: 1.6,
    ...(fontFamily ? { fontFamily } : {}),
  }), [fontSize, fontFamily]);

  return (
    <div
      ref={containerRef}
      className={`markdown-preview max-w-none ${theme === 'dark' ? 'dark' : ''} ${className}`}
      style={customStyle}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS as any}
        rehypePlugins={REHYPE_PLUGINS as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
