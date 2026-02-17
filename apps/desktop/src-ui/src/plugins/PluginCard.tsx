import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Plus, X, MoreHorizontal, ArrowUpToLine, ArrowDownToLine, FolderInput } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { Document, PluginManifest } from '@aidocplus/shared-types';
import type { DocumentPlugin } from './types';
import type { MergedCategory } from './constants';

interface PluginCardProps {
  plugin: DocumentPlugin;
  manifest?: PluginManifest;
  document?: Document;
  /** 是否已启用（文档级或全局级） */
  isEnabled: boolean;
  /** 是否显示拖拽手柄 */
  draggable?: boolean;
  /** 拖拽相关 props（由 @dnd-kit/sortable 注入） */
  dragHandleProps?: Record<string, unknown>;
  /** 使用次数 */
  usageCount?: number;
  /** 显示版本号 */
  showVersion?: boolean;
  /** 添加回调 */
  onAdd?: () => void;
  /** 移除回调 */
  onRemove?: () => void;
  /** 全局启用/禁用回调 */
  onToggle?: (enabled: boolean) => void;
  /** 移到顶部 */
  onMoveToTop?: () => void;
  /** 移到底部 */
  onMoveToBottom?: () => void;
  /** 修改分类归属 */
  onCategoryChange?: (majorKey: string, subKey: string) => void;
  /** 可选的分类列表（用于分类选择菜单） */
  categories?: { majors: MergedCategory[]; getSubs: (majorKey: string) => MergedCategory[] };
}

/**
 * 通用插件卡片组件 — 供 PluginManagerPanel 和 PluginSettingsList 复用
 */
export function PluginCard({
  plugin,
  manifest,
  document: doc,
  isEnabled,
  draggable,
  dragHandleProps,
  usageCount,
  showVersion,
  onAdd,
  onRemove,
  onMoveToTop,
  onMoveToBottom,
  onCategoryChange,
  categories,
}: PluginCardProps) {
  const { t } = useTranslation('plugin-framework');
  const Icon = plugin.icon;
  const hasData = doc ? plugin.hasData(doc) : false;

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // 分类选择子菜单
  const [showCategorySub, setShowCategorySub] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isEnabled || (!onMoveToTop && !onMoveToBottom && !onCategoryChange)) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => { setContextMenu(null); setShowCategorySub(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors group ${
          isEnabled
            ? 'bg-card hover:bg-accent/50'
            : 'border-dashed hover:border-primary/50 hover:bg-accent/30'
        }`}
      >
        {/* 拖拽手柄 */}
        {draggable && isEnabled && (
          <div
            {...(dragHandleProps || {})}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* 图标 */}
        <Icon className={`h-5 w-5 flex-shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{plugin.name}</span>
            {hasData && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
            {showVersion && manifest?.version && (
              <span className="text-xs text-muted-foreground">v{manifest.version}</span>
            )}
            {(usageCount || 0) > 0 && !isEnabled && (
              <span className="text-xs text-muted-foreground">
                {t('usedCount', { count: usageCount })}
              </span>
            )}
          </div>
          {plugin.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{plugin.description}</p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 已启用区域的更多操作按钮 */}
          {isEnabled && (onMoveToTop || onMoveToBottom || onCategoryChange) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenu({ x: rect.right, y: rect.bottom });
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t('more', { defaultValue: '更多操作' })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}

          {isEnabled && onRemove ? (
            <button
              onClick={onRemove}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t('remove')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : !isEnabled && onAdd ? (
            <button
              onClick={onAdd}
              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={t('add')}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 右键菜单 / 更多操作菜单 — 通过 Portal 渲染到 body，避免父元素 opacity/overflow 影响 */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[9999] min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-lg text-popover-foreground"
          style={{ left: contextMenu.x, top: contextMenu.y, opacity: 1, backgroundColor: 'hsl(var(--popover))', backdropFilter: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveToTop && (
            <button
              onClick={() => { onMoveToTop(); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
              {t('moveToTop', { defaultValue: '移到顶部' })}
            </button>
          )}
          {onMoveToBottom && (
            <button
              onClick={() => { onMoveToBottom(); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {t('moveToBottom', { defaultValue: '移到底部' })}
            </button>
          )}
          {onCategoryChange && categories && (
            <>
              {(onMoveToTop || onMoveToBottom) && <div className="h-px bg-border my-1" />}
              <div className="relative">
                <button
                  onClick={() => setShowCategorySub(!showCategorySub)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                >
                  <FolderInput className="h-3.5 w-3.5" />
                  {t('moveToCategory', { defaultValue: '移动到分类...' })}
                </button>
                {showCategorySub && (
                  <div className="absolute left-full top-0 ml-1 min-w-[140px] rounded-md border border-border bg-popover text-popover-foreground p-1 shadow-lg" style={{ opacity: 1, backgroundColor: 'hsl(var(--popover))', backdropFilter: 'none' }}>
                    {categories.majors.map(major => (
                      <div key={major.key}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{major.label}</div>
                        {categories.getSubs(major.key).map(sub => (
                          <button
                            key={sub.key}
                            onClick={() => {
                              onCategoryChange(major.key, sub.key);
                              setContextMenu(null);
                            }}
                            className="flex items-center w-full px-4 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
