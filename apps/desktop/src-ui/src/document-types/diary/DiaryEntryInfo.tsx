/**
 * DiaryEntryInfo — 编辑器下方可折叠条目信息面板
 *
 * 5 Tab：便笺 / 位置 / 标签 / 日记本 / 历史
 */
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MapPin, Tag, BookOpen, Clock, X, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry, DiaryJournal } from './types';

export type InfoTab = 'note' | 'location' | 'tags' | 'journal' | 'history';

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
  entry, journals, allTags,
  onUpdatePrivateNote, onUpdateLocation,
  onTagToggle, onTagAdd, onMoveToJournal,
  onRestoreSnapshot,
  forceTab, onForceTabHandled,
}: DiaryEntryInfoProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('note');
  const [newTag, setNewTag] = useState('');

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

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag) {
      onTagAdd(tag);
      setNewTag('');
    }
  };

  return (
    <div className="border-t flex-shrink-0 bg-card">
      {/* 标题栏 */}
      <div
        className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-muted/30 transition-colors overflow-x-auto"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">{t('diary.entryInfo', { defaultValue: '条目信息' })}</span>
        <div className="flex-1" />
        <button className={tabClass('note')} onClick={(e) => { e.stopPropagation(); setActiveTab('note'); setExpanded(true); }}>
          {t('diary.privateNote', { defaultValue: '便笺' })}
        </button>
        <button className={tabClass('location')} onClick={(e) => { e.stopPropagation(); setActiveTab('location'); setExpanded(true); }}>
          {t('diary.location', { defaultValue: '位置' })}
        </button>
        <button className={tabClass('tags')} onClick={(e) => { e.stopPropagation(); setActiveTab('tags'); setExpanded(true); }}>
          {t('diary.tagsTab', { defaultValue: '标签' })} ({entry.tags.length})
        </button>
        <button className={tabClass('journal')} onClick={(e) => { e.stopPropagation(); setActiveTab('journal'); setExpanded(true); }}>
          {journal?.icon} {journal?.name || t('diary.unknownJournal', { defaultValue: '未知' })}
        </button>
        <button className={tabClass('history')} onClick={(e) => { e.stopPropagation(); setActiveTab('history'); setExpanded(true); }}>
          {t('diary.historyTab', { defaultValue: '历史' })}
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
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                className="flex-1 text-sm px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={entry.location || ''}
                onChange={e => onUpdateLocation(e.target.value)}
                placeholder={t('diary.locationPlaceholder', { defaultValue: '输入位置...' })}
              />
            </div>
          )}

          {/* 标签 */}
          {activeTab === 'tags' && (
            <div className="space-y-2">
              {/* 当前标签 */}
              <div className="flex flex-wrap gap-1">
                {entry.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                    <button className="hover:text-destructive" onClick={() => onTagToggle(tag)}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {entry.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">{t('diary.noTagsOnEntry', { defaultValue: '暂无标签' })}</span>
                )}
              </div>
              {/* 添加标签 */}
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 text-xs px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                  placeholder={t('diary.addTagPlaceholder', { defaultValue: '输入新标签...' })}
                />
                <button className="h-6 w-6 flex items-center justify-center rounded border hover:bg-accent" onClick={handleAddTag}>
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {/* 已有标签建议 */}
              {allTags.filter(t => !entry.tags.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.filter(t => !entry.tags.includes(t)).slice(0, 10).map(tag => (
                    <button key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      onClick={() => onTagToggle(tag)}>
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 日记本 */}
          {activeTab === 'journal' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('diary.belongsTo', { defaultValue: '所属日记本:' })}</span>
                <select
                  className="text-sm px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={entry.journalId}
                  onChange={e => onMoveToJournal(e.target.value)}
                >
                  {journals.map(j => (
                    <option key={j.id} value={j.id}>{j.icon} {j.name}</option>
                  ))}
                </select>
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
