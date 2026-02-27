import { useState, useEffect, useCallback } from 'react';
import type { SlidesDeck } from '@aidocplus/shared-types';
import { SlidePreview } from './SlidePreview';

interface SlideShowProps {
  deck: SlidesDeck;
  startIndex?: number;
  onExit: () => void;
}

/**
 * 全屏幻灯片播放组件
 * - 左键/右箭头/空格/回车：下一张
 * - 右键/左箭头/退格：上一张
 * - ESC：退出全屏
 * - 底部显示页码指示器
 */
export function SlideShow({ deck, startIndex = 0, onExit }: SlideShowProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const total = deck.slides.length;

  const goNext = useCallback(() => {
    setCurrentIndex(i => Math.min(i + 1, total - 1));
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => Math.max(i - 1, 0));
  }, []);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onExit();
          break;
        case 'ArrowRight':
        case ' ':
        case 'Enter':
        case 'PageDown':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'Backspace':
        case 'PageUp':
          e.preventDefault();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentIndex(total - 1);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, goNext, goPrev, total]);

  // 鼠标点击翻页
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 右半区域下一张，左半区域上一张
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width / 2) {
      goNext();
    } else {
      goPrev();
    }
  }, [goNext, goPrev]);

  const slide = deck.slides[currentIndex];
  if (!slide) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-none"
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); goPrev(); }}
    >
      {/* 幻灯片内容 */}
      <div className="w-full h-full flex items-center justify-center">
        <SlidePreview
          slide={slide}
          theme={deck.theme}
          className="!border-0 !rounded-none !ring-0 !shadow-none max-h-full"
        />
      </div>

      {/* 底部页码指示器 */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 text-white/80 text-sm opacity-0 hover:opacity-100 transition-opacity cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <span>{currentIndex + 1} / {total}</span>
        <span className="text-xs text-white/50 ml-2">ESC 退出</span>
      </div>

      {/* 退出按钮（右上角，悬停显示） */}
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer text-lg"
        onClick={(e) => { e.stopPropagation(); onExit(); }}
        title="退出全屏 (ESC)"
      >
        ✕
      </button>
    </div>
  );
}
