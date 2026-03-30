/**
 * CalculatorResizer — 可拖拽分割条组件
 * 用于调整公式列与结果列之间的宽度
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalculatorResizerProps {
  /** 结果列当前宽度（像素） */
  resultWidth: number;
  /** 宽度变化回调 */
  onResultWidthChange: (width: number) => void;
  /** 最小结果列宽度 */
  minWidth?: number;
  /** 最大结果列宽度 */
  maxWidth?: number;
  /** 是否显示拖拽提示 */
  showTooltip?: boolean;
}

const DEFAULT_MIN_WIDTH = 120;
const DEFAULT_MAX_WIDTH = 400;
const DEFAULT_RESULT_WIDTH = 160;

export function CalculatorResizer({
  resultWidth,
  onResultWidthChange,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  showTooltip = true,
}: CalculatorResizerProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = resultWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [resultWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX));
    onResultWidthChange(newWidth);
  }, [isDragging, minWidth, maxWidth, onResultWidthChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleDoubleClick = useCallback(() => {
    // 双击重置为默认宽度
    onResultWidthChange(DEFAULT_RESULT_WIDTH);
  }, [onResultWidthChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative flex-shrink-0 w-1.5 cursor-col-resize transition-colors',
        isDragging ? 'bg-primary/50' : 'hover:bg-primary/30 bg-border/50'
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('calculator.resizeResultColumn', { defaultValue: '调整结果列宽度' })}
    >
      {/* 拖拽手柄指示器 */}
      <div className={cn(
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        isDragging && 'opacity-100'
      )}>
        <GripVertical className="h-4 w-3 text-muted-foreground" />
      </div>

      {/* 拖拽时显示当前宽度 */}
      {isDragging && showTooltip && (
        <div className="absolute top-1/2 left-full ml-2 -translate-y-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
          {resultWidth}px
        </div>
      )}

      {/* 悬浮提示 */}
      {!isDragging && showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
            {t('calculator.doubleClickReset', { defaultValue: '双击重置' })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CalculatorResizer;

// ============================================================
// Hook: 持久化宽度设置
// ============================================================

interface UseResizableResultColumnOptions {
  /** 存储键名 */
  storageKey?: string;
  /** 默认宽度 */
  defaultWidth?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度 */
  maxWidth?: number;
}

export function useResizableResultColumn(options: UseResizableResultColumnOptions = {}) {
  const {
    storageKey = 'calculator-result-width',
    defaultWidth = DEFAULT_RESULT_WIDTH,
    minWidth = DEFAULT_MIN_WIDTH,
    maxWidth = DEFAULT_MAX_WIDTH,
  } = options;

  const [resultWidth, setResultWidth] = useState(() => {
    // 尝试从 localStorage 恢复
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return defaultWidth;
  });

  // 保存到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(resultWidth));
    }
  }, [resultWidth, storageKey]);

  const handleResultWidthChange = useCallback((width: number) => {
    setResultWidth(width);
  }, []);

  return {
    resultWidth,
    setResultWidth: handleResultWidthChange,
    minWidth,
    maxWidth,
  };
}
