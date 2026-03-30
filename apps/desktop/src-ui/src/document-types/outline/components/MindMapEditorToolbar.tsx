import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  ScanSearch,
  LocateFixed,
  ChevronsDown,
  ChevronsUp,
  Workflow,
  Fish,
} from 'lucide-react';
import type { MindMapLayout } from '@/plugins/mindmap/SimpleMindMapRenderer';

const TB_ICON = 'h-7 w-7 shrink-0 p-0';

interface MindMapEditorToolbarProps {
  visible: boolean;
  layout: MindMapLayout;
  onSetLayout: (layout: MindMapLayout) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetScale: () => void;
  onFitContent: () => void;
  onCenterRoot: () => void;
  onExpandAll: () => void;
  onCollapseToLevel: (level: number) => void;
}

export function MindMapEditorToolbar({
  visible,
  layout,
  onSetLayout,
  onZoomIn,
  onZoomOut,
  onResetScale,
  onFitContent,
  onCenterRoot,
  onExpandAll,
  onCollapseToLevel,
}: MindMapEditorToolbarProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border/60 bg-muted/20 px-2 py-1.5 flex-shrink-0"
      role="toolbar"
      aria-label={t('outline.mindmapToolbar.aria', { defaultValue: '导图编辑工具栏' })}
    >
      <Button
        type="button"
        variant={layout === 'logicalStructure' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onSetLayout('logicalStructure')}
      >
        <Workflow className="h-3.5 w-3.5" />
        {t('outline.mindmapToolbar.logical', { defaultValue: '逻辑图' })}
      </Button>
      <Button
        type="button"
        variant={layout === 'mindMap' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => onSetLayout('mindMap')}
      >
        <Fish className="h-3.5 w-3.5" />
        {t('outline.mindmapToolbar.mindmap', { defaultValue: '脑图' })}
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-4" />

      <Button type="button" variant="ghost" size="icon" className={TB_ICON} onClick={onZoomOut}>
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={TB_ICON} onClick={onZoomIn}>
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={TB_ICON} onClick={onResetScale}>
        <LocateFixed className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={TB_ICON} onClick={onFitContent}>
        <ScanSearch className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCenterRoot}>
        {t('outline.mindmapToolbar.centerRoot', { defaultValue: '根节点居中' })}
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-4" />

      <Button type="button" variant="ghost" size="icon" className={TB_ICON} onClick={onExpandAll}>
        <ChevronsDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        onClick={() => onCollapseToLevel(2)}
      >
        <ChevronsUp className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default MindMapEditorToolbar;
