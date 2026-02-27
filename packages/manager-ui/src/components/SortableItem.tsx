import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from './ui/cn';
import type { ReactNode } from 'react';

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  showHandle?: boolean;
  children: ReactNode;
}

export function SortableItem({ id, disabled, showHandle, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={cn(isDragging && 'z-10')}>
      <div className="flex items-center">
        {showHandle && (
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing px-0.5 flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
