/**
 * NovelChapterContextMenu — 卷/章右键菜单
 *
 * 通过 onContextMenu 事件触发，使用绝对定位的菜单面板。
 * 卷和章节使用不同的菜单项。
 */
import { useState, useRef, useEffect } from 'react';
import {
  Pencil, Trash2, ArrowUp, ArrowDown, Plus,
  Circle, PenLine, CheckCircle2, MoveRight,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent, NovelChapter } from './types';

export interface ContextMenuTarget {
  type: 'volume' | 'chapter' | 'scene';
  id: string;
  volumeId?: string;
  chapterId?: string;
}

interface NovelChapterContextMenuProps {
  novel: NovelDocumentContent;
  target: ContextMenuTarget | null;
  position: { x: number; y: number };
  onClose: () => void;
  onRenameVolume: (volId: string) => void;
  onDeleteVolume: (volId: string) => void;
  onMoveVolumeUp: (volId: string) => void;
  onMoveVolumeDown: (volId: string) => void;
  onAddChapterInVolume: (volId: string) => void;
  onRenameChapter: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onMoveChapterUp: (chapterId: string) => void;
  onMoveChapterDown: (chapterId: string) => void;
  onChangeChapterStatus: (chapterId: string, status: NovelChapter['status']) => void;
  onMoveChapterToVolume: (chapterId: string, targetVolId: string) => void;
  onInsertChapterBefore?: (chapterId: string) => void;
  onInsertChapterAfter?: (chapterId: string) => void;
  onDuplicateChapter?: (chapterId: string) => void;
  onSplitChapter?: (chapterId: string) => void;
  onSetColorLabel?: (chapterId: string, color: string | undefined) => void;
  onSetSceneType?: (chapterId: string, sceneType: string | undefined) => void;
  onMergeWithNext?: (chapterId: string) => void;
  onAddScene?: (chapterId: string) => void;
  onRenameScene?: (chapterId: string, sceneId: string) => void;
  onDeleteScene?: (chapterId: string, sceneId: string) => void;
  onMoveSceneUp?: (chapterId: string, sceneId: string) => void;
  onMoveSceneDown?: (chapterId: string, sceneId: string) => void;
  onDuplicateScene?: (chapterId: string, sceneId: string) => void;
  onSplitChapterToScenes?: (chapterId: string) => void;
  onMergeScenesToChapter?: (chapterId: string) => void;
}

const COLOR_PRESETS = [
  { color: '#ef4444', label: '红' }, { color: '#f97316', label: '橙' },
  { color: '#eab308', label: '黄' }, { color: '#22c55e', label: '绿' },
  { color: '#3b82f6', label: '蓝' }, { color: '#8b5cf6', label: '紫' },
  { color: '#ec4899', label: '粉' }, { color: '#6b7280', label: '灰' },
];

const SCENE_TYPES = [
  { value: 'action', label: '动作' }, { value: 'dialogue', label: '对话' },
  { value: 'description', label: '描写' }, { value: 'transition', label: '过渡' },
  { value: 'flashback', label: '闪回' },
];

const MENU_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '14px' };

export default function NovelChapterContextMenu({
  novel,
  target,
  position,
  onClose,
  onRenameVolume,
  onDeleteVolume,
  onMoveVolumeUp,
  onMoveVolumeDown,
  onAddChapterInVolume,
  onRenameChapter,
  onDeleteChapter,
  onMoveChapterUp,
  onMoveChapterDown,
  onChangeChapterStatus,
  onMoveChapterToVolume,
  onInsertChapterBefore,
  onInsertChapterAfter,
  onDuplicateChapter,
  onSplitChapter,
  onSetColorLabel,
  onSetSceneType,
  onMergeWithNext,
  onAddScene, onRenameScene, onDeleteScene, onMoveSceneUp, onMoveSceneDown,
  onDuplicateScene, onSplitChapterToScenes, onMergeScenesToChapter,
}: NovelChapterContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [showColorSubmenu, setShowColorSubmenu] = useState(false);
  const [showSceneSubmenu, setShowSceneSubmenu] = useState(false);

  // 点击菜单外关闭
  useEffect(() => {
    if (!target) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [target, onClose]);

  // Esc 关闭
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [target, onClose]);

  if (!target) return null;

  const exec = (fn: () => void) => {
    fn();
    onClose();
  };

  const menuItemClass = 'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors w-full text-left';
  const dangerClass = 'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-destructive/10 text-destructive rounded-sm transition-colors w-full text-left';
  const submenuItemClass = 'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors w-full text-left';
  const separatorClass = 'h-px bg-border my-1';

  // 卷右键菜单
  if (target.type === 'volume') {
    const volIdx = novel.volumes.sort((a, b) => a.sortOrder - b.sortOrder).findIndex(v => v.id === target.id);
    const isFirst = volIdx === 0;
    const isLast = volIdx === novel.volumes.length - 1;

    return (
      <div
        ref={menuRef}
        className="fixed z-[9999] min-w-[180px] rounded-md border bg-card p-1 shadow-lg"
        style={{ ...MENU_STYLE, left: position.x, top: position.y, opacity: 1, backgroundColor: 'hsl(var(--card))' }}
      >
        <button className={menuItemClass} onClick={() => exec(() => onRenameVolume(target.id))}>
          <Pencil className="h-3.5 w-3.5" />
          {t('novel.ctxRename', { defaultValue: '重命名' })}
        </button>
        <button className={menuItemClass} onClick={() => exec(() => onAddChapterInVolume(target.id))}>
          <Plus className="h-3.5 w-3.5" />
          {t('novel.ctxAddChapter', { defaultValue: '添加章节' })}
        </button>
        <div className={separatorClass} />
        <button className={menuItemClass} onClick={() => exec(() => onMoveVolumeUp(target.id))} disabled={isFirst}
          style={{ opacity: isFirst ? 0.4 : 1 }}>
          <ArrowUp className="h-3.5 w-3.5" />
          {t('novel.ctxMoveUp', { defaultValue: '上移' })}
        </button>
        <button className={menuItemClass} onClick={() => exec(() => onMoveVolumeDown(target.id))} disabled={isLast}
          style={{ opacity: isLast ? 0.4 : 1 }}>
          <ArrowDown className="h-3.5 w-3.5" />
          {t('novel.ctxMoveDown', { defaultValue: '下移' })}
        </button>
        <div className={separatorClass} />
        <button className={dangerClass} onClick={() => exec(() => onDeleteVolume(target.id))}>
          <Trash2 className="h-3.5 w-3.5" />
          {t('novel.ctxDeleteVolume', { defaultValue: '删除卷' })}
        </button>
      </div>
    );
  }

  // 场景右键菜单
  if (target.type === 'scene' && target.chapterId) {
    const chId = target.chapterId;
    const scId = target.id;
    return (
      <div ref={menuRef}
        className="fixed z-[9999] min-w-[160px] rounded-md border bg-card p-1 shadow-lg"
        style={{ ...MENU_STYLE, left: position.x, top: position.y, opacity: 1, backgroundColor: 'hsl(var(--card))' }}>
        {onRenameScene && (
          <button className={menuItemClass} onClick={() => exec(() => onRenameScene(chId, scId))}>
            <Pencil className="h-3.5 w-3.5" />{t('novel.ctxRename', { defaultValue: '重命名' })}
          </button>
        )}
        <div className={separatorClass} />
        {onMoveSceneUp && (
          <button className={menuItemClass} onClick={() => exec(() => onMoveSceneUp(chId, scId))}>
            <ArrowUp className="h-3.5 w-3.5" />{t('novel.ctxMoveUp', { defaultValue: '上移' })}
          </button>
        )}
        {onMoveSceneDown && (
          <button className={menuItemClass} onClick={() => exec(() => onMoveSceneDown(chId, scId))}>
            <ArrowDown className="h-3.5 w-3.5" />{t('novel.ctxMoveDown', { defaultValue: '下移' })}
          </button>
        )}
        {onDuplicateScene && (
          <button className={menuItemClass} onClick={() => exec(() => onDuplicateScene(chId, scId))}>
            <Plus className="h-3.5 w-3.5" />{t('novel.ctxDuplicate', { defaultValue: '复制场景' })}
          </button>
        )}
        <div className={separatorClass} />
        {onDeleteScene && (
          <button className={dangerClass} onClick={() => exec(() => onDeleteScene(chId, scId))}>
            <Trash2 className="h-3.5 w-3.5" />{t('novel.ctxDeleteScene', { defaultValue: '删除场景' })}
          </button>
        )}
      </div>
    );
  }

  // 章节右键菜单
  const currentVol = novel.volumes.find(v => v.chapters.some(c => c.id === target.id));
  const sortedChapters = currentVol ? [...currentVol.chapters].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const chIdx = sortedChapters.findIndex(c => c.id === target.id);
  const isFirstCh = chIdx === 0;
  const isLastCh = chIdx === sortedChapters.length - 1;
  const otherVolumes = novel.volumes.filter(v => v.id !== currentVol?.id);

  const chapter = sortedChapters[chIdx];
  const statusItems: { status: NovelChapter['status']; label: string; icon: typeof Circle }[] = [
    { status: 'draft', label: t('novel.ctxStatusDraft', { defaultValue: '草稿' }), icon: Circle },
    { status: 'revised', label: t('novel.ctxStatusRevised', { defaultValue: '修订' }), icon: PenLine },
    { status: 'done', label: t('novel.ctxStatusDone', { defaultValue: '完成' }), icon: CheckCircle2 },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-md border bg-card p-1 shadow-lg"
      style={{ ...MENU_STYLE, left: position.x, top: position.y, opacity: 1, backgroundColor: 'hsl(var(--card))' }}
    >
      <button className={menuItemClass} onClick={() => exec(() => onRenameChapter(target.id))}>
        <Pencil className="h-3.5 w-3.5" />
        {t('novel.ctxRename', { defaultValue: '重命名' })}
      </button>
      <div className={separatorClass} />
      <button className={menuItemClass} onClick={() => exec(() => onMoveChapterUp(target.id))} disabled={isFirstCh}
        style={{ opacity: isFirstCh ? 0.4 : 1 }}>
        <ArrowUp className="h-3.5 w-3.5" />
        {t('novel.ctxMoveUp', { defaultValue: '上移' })}
      </button>
      <button className={menuItemClass} onClick={() => exec(() => onMoveChapterDown(target.id))} disabled={isLastCh}
        style={{ opacity: isLastCh ? 0.4 : 1 }}>
        <ArrowDown className="h-3.5 w-3.5" />
        {t('novel.ctxMoveDown', { defaultValue: '下移' })}
      </button>
      {/* 状态子菜单 */}
      <div className="relative"
        onMouseEnter={() => setShowStatusSubmenu(true)}
        onMouseLeave={() => setShowStatusSubmenu(false)}>
        <button className={menuItemClass}>
          {chapter?.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            : chapter?.status === 'revised' ? <PenLine className="h-3.5 w-3.5 text-blue-500" />
            : <Circle className="h-3.5 w-3.5 text-yellow-500" />}
          {t('novel.ctxStatus', { defaultValue: '状态' })} ▶
        </button>
        {showStatusSubmenu && (
          <div className="absolute left-full top-0 ml-1 min-w-[120px] rounded-md border bg-card p-1 shadow-lg"
            style={{ opacity: 1, backgroundColor: 'hsl(var(--card))' }}>
            {statusItems.map(si => {
              const Icon = si.icon;
              const isActive = chapter?.status === si.status;
              return (
                <button key={si.status} className={submenuItemClass}
                  onClick={() => exec(() => onChangeChapterStatus(target.id, si.status))}>
                  <Icon className={`h-3.5 w-3.5 ${si.status === 'done' ? 'text-green-500' : si.status === 'revised' ? 'text-blue-500' : 'text-yellow-500'}`} />
                  {si.label}
                  {isActive && <span className="ml-auto text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* 移动到卷子菜单 */}
      {otherVolumes.length > 0 && (
        <div className="relative"
          onMouseEnter={() => setShowMoveSubmenu(true)}
          onMouseLeave={() => setShowMoveSubmenu(false)}>
          <button className={menuItemClass}>
            <MoveRight className="h-3.5 w-3.5" />
            {t('novel.ctxMoveTo', { defaultValue: '移动到' })} ▶
          </button>
          {showMoveSubmenu && (
            <div className="absolute left-full top-0 ml-1 min-w-[140px] rounded-md border bg-card p-1 shadow-lg"
              style={{ opacity: 1, backgroundColor: 'hsl(var(--card))' }}>
              {otherVolumes.sort((a, b) => a.sortOrder - b.sortOrder).map(vol => (
                <button key={vol.id} className={submenuItemClass}
                  onClick={() => exec(() => onMoveChapterToVolume(target.id, vol.id))}>
                  {vol.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={separatorClass} />
      {/* 插入/复制/拆分 */}
      {onInsertChapterBefore && (
        <button className={menuItemClass} onClick={() => exec(() => onInsertChapterBefore(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxInsertBefore', { defaultValue: '在此之前插入' })}
        </button>
      )}
      {onInsertChapterAfter && (
        <button className={menuItemClass} onClick={() => exec(() => onInsertChapterAfter(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxInsertAfter', { defaultValue: '在此之后插入' })}
        </button>
      )}
      {onDuplicateChapter && (
        <button className={menuItemClass} onClick={() => exec(() => onDuplicateChapter(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxDuplicate', { defaultValue: '复制章节' })}
        </button>
      )}
      {onSplitChapter && (
        <button className={menuItemClass} onClick={() => exec(() => onSplitChapter(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxSplit', { defaultValue: '拆分章节' })}
        </button>
      )}
      {onMergeWithNext && !isLastCh && (
        <button className={menuItemClass} onClick={() => exec(() => onMergeWithNext(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxMergeNext', { defaultValue: '合并到下一章' })}
        </button>
      )}
      {/* 颜色标签子菜单 */}
      {onSetColorLabel && (
        <>
          <div className={separatorClass} />
          <div className="relative"
            onMouseEnter={() => setShowColorSubmenu(true)}
            onMouseLeave={() => setShowColorSubmenu(false)}>
            <button className={menuItemClass}>
              {chapter?.colorLabel
                ? <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: chapter.colorLabel }} />
                : <Circle className="h-3.5 w-3.5" />}
              {t('novel.ctxColorLabel', { defaultValue: '颜色标签' })} ▶
            </button>
            {showColorSubmenu && (
              <div className="absolute left-full top-0 ml-1 min-w-[140px] rounded-md border bg-card p-1.5 shadow-lg"
                style={{ opacity: 1, backgroundColor: 'hsl(var(--card))' }}>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {COLOR_PRESETS.map(cp => (
                    <button key={cp.color}
                      className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: cp.color }}
                      title={cp.label}
                      onClick={() => exec(() => onSetColorLabel(target.id, chapter?.colorLabel === cp.color ? undefined : cp.color))}
                    />
                  ))}
                </div>
                {chapter?.colorLabel && (
                  <button className={`${submenuItemClass} mt-1 text-muted-foreground`}
                    onClick={() => exec(() => onSetColorLabel(target.id, undefined))}>清除标签</button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {/* 场景类型子菜单 */}
      {onSetSceneType && (
        <div className="relative"
          onMouseEnter={() => setShowSceneSubmenu(true)}
          onMouseLeave={() => setShowSceneSubmenu(false)}>
          <button className={menuItemClass}>
            <Circle className="h-3.5 w-3.5" />
            {t('novel.ctxSceneType', { defaultValue: '场景类型' })} ▶
          </button>
          {showSceneSubmenu && (
            <div className="absolute left-full top-0 ml-1 min-w-[100px] rounded-md border bg-card p-1 shadow-lg"
              style={{ opacity: 1, backgroundColor: 'hsl(var(--card))' }}>
              {SCENE_TYPES.map(st => (
                <button key={st.value} className={submenuItemClass}
                  onClick={() => exec(() => onSetSceneType(target.id, chapter?.sceneType === st.value ? undefined : st.value))}>
                  {st.label}
                  {chapter?.sceneType === st.value && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
              {chapter?.sceneType && (
                <button className={`${submenuItemClass} text-muted-foreground`}
                  onClick={() => exec(() => onSetSceneType(target.id, undefined))}>清除</button>
              )}
            </div>
          )}
        </div>
      )}
      {/* 场景操作 */}
      {onAddScene && (
        <>
          <div className={separatorClass} />
          <button className={menuItemClass} onClick={() => exec(() => onAddScene(target.id))}>
            <Plus className="h-3.5 w-3.5" />{t('novel.ctxAddScene', { defaultValue: '添加场景' })}
          </button>
        </>
      )}
      {onSplitChapterToScenes && chapter && (!chapter.scenes || chapter.scenes.length === 0) && chapter.content && (
        <button className={menuItemClass} onClick={() => exec(() => onSplitChapterToScenes(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxSplitToScenes', { defaultValue: '拆分为场景' })}
        </button>
      )}
      {onMergeScenesToChapter && chapter?.scenes && chapter.scenes.length > 0 && (
        <button className={menuItemClass} onClick={() => exec(() => onMergeScenesToChapter(target.id))}>
          <Plus className="h-3.5 w-3.5" />{t('novel.ctxMergeScenes', { defaultValue: '合并场景' })}
        </button>
      )}
      <div className={separatorClass} />
      <button className={dangerClass} onClick={() => exec(() => onDeleteChapter(target.id))}>
        <Trash2 className="h-3.5 w-3.5" />
        {t('novel.ctxDeleteChapter', { defaultValue: '删除章节' })}
      </button>
    </div>
  );
}
