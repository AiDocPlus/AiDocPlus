import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizableHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizableHandle({ direction, onResize, className }: ResizableHandleProps) {
  const startPosRef = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;

    // 直接操作 DOM 显示拖拽状态，避免 React re-render
    if (containerRef.current) containerRef.current.style.zIndex = '50';
    if (indicatorRef.current) {
      indicatorRef.current.style.backgroundColor = 'var(--color-primary)';
      indicatorRef.current.style.opacity = '0.6';
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';

    const handleMouseMove = (ev: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResizeRef.current(delta);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (containerRef.current) containerRef.current.style.zIndex = '10';
      if (indicatorRef.current) {
        indicatorRef.current.style.backgroundColor = '';
        indicatorRef.current.style.opacity = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-shrink-0 relative group border-0',
        direction === 'horizontal'
          ? 'w-[6px] -mx-[2.5px] cursor-col-resize'
          : 'h-[6px] -my-[2.5px] cursor-row-resize',
        className
      )}
      style={{ zIndex: 10 }}
      onMouseDown={handleMouseDown}
    >
      {/* 中心指示条 */}
      <div
        ref={indicatorRef}
        className={cn(
          'absolute rounded-full z-10',
          direction === 'horizontal'
            ? 'w-[3px] h-6 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
            : 'h-[3px] w-6 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-gray-300 dark:bg-gray-600 group-hover:bg-primary/50'
        )}
      />
    </div>
  );
}
