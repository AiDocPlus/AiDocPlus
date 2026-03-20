/**
 * DiaryEntryInfo — 编辑器下方可折叠条目信息面板
 *
 * 5 Tab：便笺 / 位置 / 标签 / 日记本 / 历史
 */
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry, DiaryJournal } from './types';

export type InfoTab = 'note' | 'location' | 'history';

interface DiaryEntryInfoProps {
  entry: DiaryEntry | null;
  journals: DiaryJournal[];
  allTags: string[];
  onUpdatePrivateNote: (note: string) => void;
  onUpdateLocation: (location: string) => void;
  onTagToggle: (tag: string) => void;
  onTagAdd: (tag: string) => void;
  onMoveToJournal: (journalId: string) => void;
  onRestoreSnapshot?: (snapshotId: string) => void;
  forceTab?: InfoTab | null;
  onForceTabHandled?: () => void;
}

export default function DiaryEntryInfo({
  entry, journals,
  onUpdatePrivateNote, onUpdateLocation,
  onRestoreSnapshot,
  forceTab, onForceTabHandled,
}: DiaryEntryInfoProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('note');

  // 响应父组件强制打开某个 tab
  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
      setExpanded(true);
      onForceTabHandled?.();
    }
  }, [forceTab, onForceTabHandled]);

  if (!entry) return null;

  const tabClass = (tab: InfoTab) => cn(
    'px-2 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap',
    activeTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
  );

  const journal = journals.find(j => j.id === entry.journalId);
  const createdDate = new Date(entry.createdAt);
  const updatedDate = new Date(entry.updatedAt);
  const formatTime = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="border-t flex-shrink-0 bg-card">
      {/* 标题栏 */}
      <div
        className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-muted/30 transition-colors overflow-x-auto"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">{t('diary.entryInfo', { defaultValue: '条目信息' })}</span>
        {/* 时间信息（始终显示） */}
        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 flex-shrink-0 ml-1">
          <Clock className="h-2.5 w-2.5" />
          {formatTime(createdDate)}
          {journal && <span className="ml-1">{journal.icon}</span>}
        </span>
        <div className="flex-1" />
        <button className={tabClass('note')} onClick={(e) => { e.stopPropagation(); setActiveTab('note'); setExpanded(true); }}>
          {t('diary.privateNote', { defaultValue: '便笺' })}
        </button>
        <button className={tabClass('location')} onClick={(e) => { e.stopPropagation(); setActiveTab('location'); setExpanded(true); }}>
          {t('diary.location', { defaultValue: '位置' })}
        </button>
        <button className={tabClass('history')} onClick={(e) => { e.stopPropagation(); setActiveTab('history'); setExpanded(true); }}>
          {t('diary.historyTab', { defaultValue: '历史' })} ({entry.snapshots?.length || 0})
        </button>
      </div>

      {/* 面板内容 */}
      {expanded && (
        <div className="px-3 py-2 border-t max-h-[140px] overflow-auto">
          {/* 便笺 */}
          {activeTab === 'note' && (
            <textarea
              className="w-full h-[100px] text-xs px-2 py-1.5 border rounded bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={entry.privateNote || ''}
              onChange={e => onUpdatePrivateNote(e.target.value)}
              placeholder={t('diary.privateNotePlaceholder', { defaultValue: '私人便笺（不会导出，仅自己可见）...' })}
            />
          )}

          {/* 位置 */}
          {activeTab === 'location' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  className="flex-1 text-sm px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={entry.location || ''}
                  onChange={e => onUpdateLocation(e.target.value)}
                  placeholder={t('diary.locationPlaceholder', { defaultValue: '输入位置...' })}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('diary.createdAt', { defaultValue: '创建: {{time}}', time: formatTime(createdDate) })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('diary.updatedAt', { defaultValue: '修改: {{time}}', time: formatTime(updatedDate) })}
                </span>
              </div>
            </div>
          )}

          {/* 版本历史 */}
          {activeTab === 'history' && (
            <div className="space-y-1">
              {entry.snapshots && entry.snapshots.length > 0 ? (
                [...entry.snapshots].reverse().map(snap => {
                  const d = new Date(snap.timestamp);
                  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                  const excerpt = snap.content.replace(/\n/g, ' ').slice(0, 40);
                  return (
                    <div key={snap.id} className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-accent transition-colors">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground tabular-nums flex-shrink-0">{dateStr} {timeStr}</span>
                      <span className="flex-1 truncate text-muted-foreground/70">{snap.title || excerpt}</span>
                      {onRestoreSnapshot && (
                        <button
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 flex-shrink-0"
                          onClick={() => onRestoreSnapshot(snap.id)}
                          title={t('diary.restoreSnapshot', { defaultValue: '恢复此版本' })}
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          {t('diary.restore', { defaultValue: '恢复' })}
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">
                  {t('diary.noSnapshots', { defaultValue: '暂无版本历史（编辑后自动记录）' })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
