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

interface MarkdownPreviewProps {
  content: string;
  theme?: 'light' | 'dark';
  className?: string;
  fontSize?: number;
  fontFamily?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  theme = 'light',
  className = '',
  fontSize = 14,
  fontFamily,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 初始化 Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
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
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch (e) {
        console.warn('[MarkdownPreview] Mermaid render failed:', e);
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
      invoke('plugin:shell|open', { path: href }).catch(console.error);
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
        remarkPlugins={[
          remarkGfm,
          remarkMath,
        ]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeKatex, { throwOnError: false, strict: false }],
          [rehypeHighlight, { detect: true, subset: false }],
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
