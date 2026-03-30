/**
 * PresentationMode — 大纲演示模式
 *
 * 将大纲层级转为幻灯片式展示：
 * - 第一页为标题页（居中大标题 + 副标题）
 * - 后续页为内容页（标题 + 子节点列表）
 * - 方向键 / 点击翻页，ESC 退出
 * - F 键切换全屏
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
} from 'lucide-react';
import type { OutlineNode } from '../types';
import { nodeContentToMarkdown } from '../converters/markdownConverter';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';

interface Slide {
  /** 是否为标题页 */
  isTitle: boolean;
  title: string;
  content: string;
  nodeId: string;
}

interface PresentationModeProps {
  nodes: OutlineNode[];
  outlineTitle: string;
  onClose: () => void;
}

/** 将大纲节点转为幻灯片数组 */
function buildSlides(nodes: OutlineNode[], outlineTitle: string): Slide[] {
  const slides: Slide[] = [];

  // 标题页
  if (outlineTitle) {
    slides.push({ isTitle: true, title: outlineTitle, content: '', nodeId: '__title__' });
  }

  function walk(node: OutlineNode) {
    const richText = nodeContentToMarkdown(node.content);
    const title = richText || node.plainText || '';

    // 子节点内容
    const childContent = node.children.length > 0
      ? node.children.map(child => {
          const ct = nodeContentToMarkdown(child.content) || child.plainText || '';
          const subItems = child.children.length > 0
            ? '\n' + child.children.map(sub =>
                `  - ${nodeContentToMarkdown(sub.content) || sub.plainText || ''}`
              ).join('\n')
            : '';
          return `- ${ct}${subItems}`;
        }).join('\n')
      : '';

    // 备注作为补充内容
    const noteContent = node.notePlainText ? `\n\n> ${node.notePlainText}` : '';

    // 完成标记
    const completedTag = node.completed ? ' ✓' : '';

    slides.push({
      isTitle: false,
      title: title + completedTag,
      content: childContent + noteContent,
      nodeId: node.id,
    });

    // 深层节点也单独成页
    for (const child of node.children) {
      if (child.children.length > 0) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  return slides;
}

export function PresentationMode({
  nodes,
  outlineTitle,
  onClose,
}: PresentationModeProps) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slides = useMemo(
    () => buildSlides(nodes, outlineTitle),
    [nodes, outlineTitle],
  );

  const goNext = useCallback(() => {
    setCurrentSlide(i => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentSlide(i => Math.max(i - 1, 0));
  }, []);

  // 全屏切换
  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {
        // Tauri WebView 可能不支持，静默失败
      });
    } else {
      void document.exitFullscreen();
    }
  }, []);

  // 监听 fullscreenchange 同步状态
  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // 键盘控制
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose, handleFullscreen]);

  if (slides.length === 0) return null;

  const slide = slides[currentSlide];

  // 页码显示：超过 8 页时用文本格式，否则用圆点
  const showDots = slides.length <= 8;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">
          {t('outline.presentation.slideOf', {
            defaultValue: '第 {{current}} 页 / 共 {{total}} 页',
            current: currentSlide + 1,
            total: slides.length,
          })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleFullscreen}
            title={isFullscreen
              ? t('outline.presentation.exitFullscreen', { defaultValue: '退出全屏' })
              : t('outline.presentation.fullscreen', { defaultValue: '全屏' })}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClose}
            title={t('outline.presentation.exit', { defaultValue: '退出演示' })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 幻灯片内容 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-6">
        <div
          key={currentSlide}
          className="w-full max-w-3xl transition-opacity duration-200"
        >
          {slide.isTitle ? (
            /* 标题页：居中大标题 + 渐变背景 */
            <div className="flex flex-col items-center justify-center py-20 px-12 rounded-xl bg-gradient-to-b from-primary/5 via-background to-background">
              <h1 className="text-4xl font-bold text-center leading-tight">
                {slide.title}
              </h1>
              <div className="mt-4 text-sm text-muted-foreground">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          ) : (
            /* 内容页：标题 + 内容卡片 */
            <div className="rounded-xl bg-card shadow-sm border p-8">
              <h2 className="text-2xl font-bold mb-6 pb-4 border-b">
                {slide.title}
              </h2>
              {slide.content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownPreview content={slide.content} />
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('outline.presentation.emptySlide', { defaultValue: '（无子内容）' })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 border-t bg-muted/20 shrink-0">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={currentSlide === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('outline.presentation.prev', { defaultValue: '上一页' })}
        </Button>

        {/* 页码指示 */}
        {showDots ? (
          <div className="flex gap-1 max-w-xs overflow-hidden">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`h-1.5 rounded-full transition-all ${
                  i === currentSlide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
                onClick={() => setCurrentSlide(i)}
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums min-w-[60px] text-center">
            {currentSlide + 1} / {slides.length}
          </span>
        )}

        <Button variant="outline" size="sm" onClick={goNext} disabled={currentSlide === slides.length - 1}>
          {t('outline.presentation.next', { defaultValue: '下一页' })}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export default PresentationMode;
