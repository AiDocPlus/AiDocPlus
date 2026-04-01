/**
 * Zoom 面包屑导航
 *
 * 在聚焦模式下显示层级路径，支持点击跳转到任意层级
 */

import { useTranslation } from 'react-i18next';
import { ChevronRight, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  nodeId: string;
}

interface ZoomBreadcrumbProps {
  items: BreadcrumbItem[];
  onZoomTo: (index: number) => void;
  onExit: () => void;
}

export function ZoomBreadcrumb({
  items,
  onZoomTo,
  onExit,
}: ZoomBreadcrumbProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/50 text-xs overflow-x-auto scrollbar-hide shrink-0">
      <ZoomIn className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      <span className="text-blue-600 dark:text-blue-400 font-medium shrink-0 mr-1">
        {t('outline.zoom.focusMode', { defaultValue: '聚焦' })}
      </span>

      {/* zoomStack 层级（可点击回退） */}
      {items.slice(0, -1).map((item, i) => (
        <span key={item.nodeId} className="flex items-center shrink-0">
          <button
            type="button"
            className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[120px]"
            onClick={() => onZoomTo(i)}
            title={item.label}
          >
            {item.label}
          </button>
          <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground shrink-0" />
        </span>
      ))}

      {/* 当前聚焦节点（不可点击） */}
      {items.length > 0 && (
        <span className="text-foreground font-medium truncate max-w-[160px]" title={items[items.length - 1].label}>
          {items[items.length - 1].label}
        </span>
      )}

      {items.length > 1 && (
        <span className="text-muted-foreground ml-1 shrink-0">
          ({items.length - 1} {t('outline.zoom.levelsDeep', { defaultValue: '层' })})
        </span>
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700 shrink-0"
        onClick={onExit}
        title={t('outline.zoom.exitAll', { defaultValue: '退出聚焦' })}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default ZoomBreadcrumb;
