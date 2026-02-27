import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
}

export function ResizeHandle({ onResize, direction = 'horizontal' }: ResizeHandleProps) {
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = direction === 'horizontal' ? e.clientX : e.clientY;
      isDragging.current = true;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = current - startX.current;
        startX.current = current;
        onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [onResize, direction]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={
        direction === 'horizontal'
          ? 'relative w-[9px] shrink-0 cursor-col-resize group'
          : 'relative h-[9px] shrink-0 cursor-row-resize group'
      }
    >
      {/* 可见的细线 */}
      <div
        className={
          direction === 'horizontal'
            ? 'absolute left-[4px] top-0 bottom-0 w-px bg-border group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors'
            : 'absolute top-[4px] left-0 right-0 h-px bg-border group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors'
        }
      />
    </div>
  );
}
