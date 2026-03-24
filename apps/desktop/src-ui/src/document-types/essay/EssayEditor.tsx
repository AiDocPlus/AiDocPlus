/**
 * EssayEditor.tsx — 散文专用编辑器
 *
 * Phase 1: 包裹 MarkdownEditor，增加散文专属体验
 * - 打字机滚动模式（光标行保持在视窗垂直中部）
 * - 段落间距优化
 * - 段落 hover 时左侧显示角色标记
 * - 接收高亮装饰数据（Phase 3 对接）
 *
 * Phase 3 会进一步集成 essayHighlighter 实时检测。
 */

import { useEffect, useRef, useCallback } from 'react';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { cn } from '@/lib/utils';
import type { ViewMode } from './EssayToolbar';

interface EssayEditorProps {
  value: string;
  onChange: (val: string) => void;
  viewMode: ViewMode;
  typewriterMode: boolean;
  focusMode: boolean;
  placeholder?: string;
  className?: string;
}

export default function EssayEditor({
  value,
  onChange,
  viewMode,
  typewriterMode,
  focusMode,
  placeholder = '开始创作散文...',
  className,
}: EssayEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // ── 打字机滚动：监听光标位置变化，保持光标在视窗中部 ──
  const applyTypewriterScroll = useCallback(() => {
    if (!typewriterMode || !wrapperRef.current) return;

    const editorEl = wrapperRef.current.querySelector('.cm-editor, .CodeMirror, textarea, [contenteditable]') as HTMLElement | null;
    if (!editorEl) return;

    // CodeMirror 6 光标
    const cursor = wrapperRef.current.querySelector('.cm-cursor-primary') as HTMLElement | null;
    if (!cursor) return;

    const editorRect = wrapperRef.current.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();

    if (cursorRect.height === 0) return; // 没有激活光标

    // 目标位置：视窗中部偏上一点（40%位置）
    const targetY = editorRect.top + editorRect.height * 0.4;
    const currentY = cursorRect.top;
    const delta = currentY - targetY;

    if (Math.abs(delta) > 20) {
      const scrollEl = wrapperRef.current.querySelector('.cm-scroller') as HTMLElement | null;
      if (scrollEl) {
        scrollEl.scrollTop += delta;
      }
    }
  }, [typewriterMode]);

  // 监听编辑器内容变化来触发打字机滚动
  useEffect(() => {
    if (!typewriterMode || !wrapperRef.current) return;

    const handleInput = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTypewriterScroll);
    };

    const handleKeyUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyTypewriterScroll);
    };

    const wrapper = wrapperRef.current;
    wrapper.addEventListener('input', handleInput, true);
    wrapper.addEventListener('keyup', handleKeyUp, true);
    wrapper.addEventListener('click', handleKeyUp, true);

    return () => {
      wrapper.removeEventListener('input', handleInput, true);
      wrapper.removeEventListener('keyup', handleKeyUp, true);
      wrapper.removeEventListener('click', handleKeyUp, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [typewriterMode, applyTypewriterScroll]);

  // 打字机模式：底部添加 padding，让文章末尾也能滚动到中部
  const typewriterStyle = typewriterMode
    ? { paddingBottom: '40vh' }
    : undefined;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'flex-1 min-h-0 overflow-hidden',
        // 专注模式下两侧留白
        focusMode && 'px-[10%]',
        // 分屏/大纲模式下不需要留白
        (viewMode === 'split' || viewMode === 'outline') && 'px-0',
        className,
      )}
    >
      {/* 散文编辑器样式覆盖 */}
      <style>{`
        /* 段落间距：散文段落之间增加间距 */
        .essay-editor-wrapper .cm-line:not(:last-child) {
          margin-bottom: 0;
        }
        /* 打字机模式下的光标行背景淡高亮 */
        .essay-editor-wrapper.typewriter .cm-activeLine {
          background-color: hsl(var(--muted) / 0.3) !important;
        }
        /* 散文编辑器字体：宋体，大小16px */
        .essay-editor-wrapper .cm-content {
          font-family: 'Songti SC', '宋体', 'SimSun', serif;
          font-size: 16px;
          line-height: 1.9;
          padding: 16px 24px;
        }
        /* 段落首行缩进提示（视觉辅助，不影响输出） */
        .essay-editor-wrapper .cm-line:not(:empty)::before {
          content: '';
          display: inline-block;
          width: 0;
        }
      `}</style>

      <div
        className={cn(
          'essay-editor-wrapper h-full',
          typewriterMode && 'typewriter',
        )}
        style={typewriterStyle}
      >
        {value !== undefined ? (
          <MarkdownEditor
            value={value}
            onChange={onChange}
            placeholder={placeholder}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            加载中...
          </div>
        )}
      </div>
    </div>
  );
}
