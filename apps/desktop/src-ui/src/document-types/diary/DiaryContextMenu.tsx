/**
 * DiaryContextMenu — 条目右键菜单
 *
 * 移动到日记本 / 标记收藏 / 复制 / 删除 / 快速设心情 / 快速设天气
 */
import { useEffect, useRef } from 'react';
import { Star, StarOff, Copy, Trash2, BookOpen, SmilePlus, Cloud } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { DiaryEntry, DiaryJournal, DiaryMood, DiaryWeatherType } from './types';
import { MOOD_EMOJI, MOOD_LABEL, MOOD_VALUES, WEATHER_EMOJI, WEATHER_LABEL, WEATHER_TYPES } from './types';

interface DiaryContextMenuProps {
  entry: DiaryEntry | null;
  journals: DiaryJournal[];
  position: { x: number; y: number };
  onClose: () => void;
  onToggleStarred: (entryId: string) => void;
  onDuplicate: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onMoveToJournal: (entryId: string, journalId: string) => void;
  onSetMood: (entryId: string, mood: DiaryMood | undefined) => void;
  onSetWeather: (entryId: string, weather: DiaryWeatherType) => void;
}

export default function DiaryContextMenu({
  entry, journals, position, onClose,
  onToggleStarred, onDuplicate, onDelete,
  onMoveToJournal, onSetMood, onSetWeather,
}: DiaryContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [entry, onClose]);

  if (!entry) return null;

  const menuItem = 'diary-ctx-item flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer';
  const subHeader = 'px-3 py-1 text-[10px] text-muted-foreground font-medium border-t mt-0.5';

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-md border shadow-lg py-1 overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 400),
        fontFamily: "'宋体', 'SimSun', serif",
        fontSize: '16px',
        opacity: 1,
        backgroundColor: 'hsl(var(--card))',
        color: 'hsl(var(--card-foreground))',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }}
    >
      {/* 收藏 */}
      <div className={menuItem} onClick={() => { onToggleStarred(entry.id); onClose(); }}>
        {entry.starred ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
        {entry.starred ? t('diary.unstar', { defaultValue: '取消收藏' }) : t('diary.star', { defaultValue: '收藏' })}
      </div>

      {/* 复制 */}
      <div className={menuItem} onClick={() => { onDuplicate(entry.id); onClose(); }}>
        <Copy className="h-3.5 w-3.5" />
        {t('diary.duplicateEntry', { defaultValue: '复制条目' })}
      </div>

      {/* 删除 */}
      <div className={`${menuItem} text-red-600 hover:text-red-600`} onClick={() => { onDelete(entry.id); onClose(); }}>
        <Trash2 className="h-3.5 w-3.5" />
        {t('diary.deleteEntry', { defaultValue: '删除条目' })}
      </div>

      {/* 移动到日记本 */}
      {journals.length > 1 && (
        <>
          <div className={subHeader}>
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{t('diary.moveToJournal', { defaultValue: '移动到日记本' })}</span>
          </div>
          {journals.filter(j => j.id !== entry.journalId).map(j => (
            <div key={j.id} className={menuItem} onClick={() => { onMoveToJournal(entry.id, j.id); onClose(); }}>
              <span className="text-sm">{j.icon}</span>
              {j.name}
            </div>
          ))}
        </>
      )}

      {/* 快速设心情 */}
      <div className={subHeader}>
        <span className="flex items-center gap-1"><SmilePlus className="h-3 w-3" />{t('diary.setMood', { defaultValue: '设置心情' })}</span>
      </div>
      <div className="flex items-center gap-0.5 px-3 py-1">
        {MOOD_VALUES.map(mood => (
          <button
            key={mood}
            className={`h-6 w-6 rounded text-sm flex items-center justify-center transition-all ${entry.mood === mood ? 'bg-primary/15 ring-1 ring-primary scale-110' : 'hover:bg-accent opacity-70 hover:opacity-100'}`}
            onClick={() => { onSetMood(entry.id, entry.mood === mood ? undefined : mood); onClose(); }}
            title={MOOD_LABEL[mood]}
          >
            {MOOD_EMOJI[mood]}
          </button>
        ))}
      </div>

      {/* 快速设天气 */}
      <div className={subHeader}>
        <span className="flex items-center gap-1"><Cloud className="h-3 w-3" />{t('diary.setWeather', { defaultValue: '设置天气' })}</span>
      </div>
      <div className="flex items-center gap-0.5 px-3 py-1 flex-wrap">
        {WEATHER_TYPES.map(wt => (
          <button
            key={wt}
            className={`h-6 px-1 rounded text-xs flex items-center gap-0.5 transition-all ${entry.weather?.type === wt ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent opacity-70 hover:opacity-100'}`}
            onClick={() => { onSetWeather(entry.id, wt); onClose(); }}
            title={WEATHER_LABEL[wt]}
          >
            {WEATHER_EMOJI[wt]}
          </button>
        ))}
      </div>
    </div>
  );
}
