/**
 * DiarySettingsDialog — 日记本设置弹窗
 *
 * Tab: 日记本管理 / 偏好设置 / 自定义模板
 */
import { useState, useCallback } from 'react';
import {
  BookOpen, Settings, Plus, Trash2, Pencil, FileText, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryJournal, DiaryTemplate, DiaryHabit } from './types';
import { genId, addHabit, updateHabit, deleteHabit } from './types';
import { DIALOG_STYLE } from '../_shared/styles';

const EMOJI_PRESETS = ['📖', '💼', '🌱', '✈️', '🎯', '💡', '🎨', '🏋️', '🍳', '📚', '🎵', '❤️'];
const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];
const HABIT_EMOJI_PRESETS = ['💪', '📚', '🏃', '🧘', '💧', '✍️', '🎵', '💤', '🥗', '💊', '🧹', '📈'];

type SettingsTab = 'journals' | 'preferences' | 'templates' | 'habits';

interface DiarySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
  onDiaryChange: (updated: DiaryDocumentContent) => void;
}

export default function DiarySettingsDialog({
  open, onOpenChange, diary, onDiaryChange,
}: DiarySettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('journals');

  // 日记本编辑
  const [editingJournal, setEditingJournal] = useState<DiaryJournal | null>(null);
  const [newJournalName, setNewJournalName] = useState('');
  const [newJournalIcon, setNewJournalIcon] = useState('📖');
  const [newJournalColor, setNewJournalColor] = useState('#3b82f6');

  // 自定义模板编辑
  const [tplName, setTplName] = useState('');
  const [tplIcon, setTplIcon] = useState('📝');
  const [tplContent, setTplContent] = useState('');

  // 习惯编辑
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('💪');
  const [newHabitColor, setNewHabitColor] = useState('#22c55e');
  const [newHabitType, setNewHabitType] = useState<'boolean' | 'number'>('boolean');
  const [newHabitStep, setNewHabitStep] = useState(1);
  const [newHabitTarget, setNewHabitTarget] = useState(0);
  const [newHabitUnit, setNewHabitUnit] = useState('');

  const TABS: { key: SettingsTab; icon: typeof BookOpen; label: string }[] = [
    { key: 'journals', icon: BookOpen, label: t('diary.settingsJournals', { defaultValue: '日记本' }) },
    { key: 'habits', icon: Target, label: t('diary.settingsHabits', { defaultValue: '习惯' }) },
    { key: 'preferences', icon: Settings, label: t('diary.settingsPreferences', { defaultValue: '偏好' }) },
    { key: 'templates', icon: FileText, label: t('diary.settingsTemplates', { defaultValue: '自定义模板' }) },
  ];

  // ── 日记本 CRUD ──
  const handleAddJournal = useCallback(() => {
    if (!newJournalName.trim()) return;
    const journal: DiaryJournal = {
      id: genId('dj'),
      name: newJournalName.trim(),
      icon: newJournalIcon,
      color: newJournalColor,
      sortOrder: diary.journals.length,
    };
    onDiaryChange({ ...diary, journals: [...diary.journals, journal] });
    setNewJournalName('');
  }, [diary, onDiaryChange, newJournalName, newJournalIcon, newJournalColor]);

  const handleDeleteJournal = useCallback((id: string) => {
    if (id === diary.settings.defaultJournalId) return;
    const journal = diary.journals.find(j => j.id === id);
    if (!journal) return;
    const name = journal.name;
    if (!window.confirm(t('diary.confirmDeleteJournal', { defaultValue: `确定要删除日记本「${name}」吗？该日记本下的所有条目将移至默认日记本。` }))) return;
    const defaultId = diary.settings.defaultJournalId;
    onDiaryChange({
      ...diary,
      journals: diary.journals.filter(j => j.id !== id),
      entries: diary.entries.map(e => e.journalId === id ? { ...e, journalId: defaultId } : e),
    });
  }, [diary, onDiaryChange]);

  const handleUpdateJournal = useCallback((id: string, patch: Partial<DiaryJournal>) => {
    onDiaryChange({
      ...diary,
      journals: diary.journals.map(j => j.id === id ? { ...j, ...patch } : j),
    });
  }, [diary, onDiaryChange]);

  // ── 偏好设置 ──
  const handleSettingsChange = useCallback((patch: Partial<DiaryDocumentContent['settings']>) => {
    onDiaryChange({ ...diary, settings: { ...diary.settings, ...patch } });
  }, [diary, onDiaryChange]);

  // ── 自定义模板 CRUD ──
  const handleAddTemplate = useCallback(() => {
    if (!tplName.trim()) return;
    const template: DiaryTemplate = {
      id: genId('dtpl'),
      name: tplName.trim(),
      icon: tplIcon,
      content: tplContent,
    };
    onDiaryChange({
      ...diary,
      metadata: { ...diary.metadata, customTemplates: [...diary.metadata.customTemplates, template] },
    });
    setTplName('');
    setTplIcon('📝');
    setTplContent('');
  }, [diary, onDiaryChange, tplName, tplIcon, tplContent]);

  const handleDeleteTemplate = useCallback((id: string) => {
    const tpl = diary.metadata.customTemplates.find(x => x.id === id);
    if (!tpl) return;
    if (!window.confirm(t('diary.confirmDeleteTemplate', { defaultValue: `确定要删除模板「${tpl.name}」吗？` }))) return;
    onDiaryChange({
      ...diary,
      metadata: { ...diary.metadata, customTemplates: diary.metadata.customTemplates.filter(x => x.id !== id) },
    });
  }, [diary, onDiaryChange]);

  // ── 习惯 CRUD ──
  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim()) return;
    const habit: DiaryHabit = {
      id: genId('dh'),
      name: newHabitName.trim(),
      icon: newHabitIcon,
      color: newHabitColor,
      type: newHabitType,
      sortOrder: (diary.metadata.habits || []).length,
      step: newHabitType === 'number' ? newHabitStep : undefined,
      target: newHabitType === 'number' && newHabitTarget > 0 ? newHabitTarget : undefined,
      unit: newHabitType === 'number' && newHabitUnit ? newHabitUnit : undefined,
    };
    onDiaryChange(addHabit(diary, habit));
    setNewHabitName('');
    setNewHabitIcon('💪');
    setNewHabitColor('#22c55e');
    setNewHabitType('boolean');
    setNewHabitStep(1);
    setNewHabitTarget(0);
    setNewHabitUnit('');
  }, [diary, onDiaryChange, newHabitName, newHabitIcon, newHabitColor, newHabitType, newHabitStep, newHabitTarget, newHabitUnit]);

  const handleDeleteHabit = useCallback((id: string) => {
    if (!window.confirm(t('diary.confirmDeleteHabit', { defaultValue: '确定要删除此习惯吗？已记录的数据将保留但不再显示。' }))) return;
    onDiaryChange(deleteHabit(diary, id));
  }, [diary, onDiaryChange]);

  const handleArchiveHabit = useCallback((id: string) => {
    onDiaryChange(updateHabit(diary, id, { archived: true }));
  }, [diary, onDiaryChange]);

  const handleUnarchiveHabit = useCallback((id: string) => {
    onDiaryChange(updateHabit(diary, id, { archived: undefined }));
  }, [diary, onDiaryChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[8vh] !translate-y-0 w-[70vw] h-[70vh] max-w-[900px] max-h-[70vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.settings', { defaultValue: '设置' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <Settings className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{t('diary.settings', { defaultValue: '日记本设置' })}</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧 Tab */}
          <div className="w-[140px] flex-shrink-0 border-r p-2 space-y-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.key}
                  className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left transition-colors',
                    activeTab === tab.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'
                  )}
                  onClick={() => setActiveTab(tab.key)}>
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 p-4 overflow-auto space-y-4">
            {/* ═══ 日记本管理 ═══ */}
            {activeTab === 'journals' && (
              <>
                <div className="space-y-2">
                  {diary.journals.map(j => (
                    <div key={j.id} className="flex items-center gap-2 px-3 py-2 border rounded">
                      <span className="text-lg">{j.icon}</span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: j.color }} />
                      {editingJournal?.id === j.id ? (
                        <input className="flex-1 text-sm px-2 py-0.5 border rounded bg-background" autoFocus
                          value={editingJournal.name}
                          onChange={e => setEditingJournal({ ...editingJournal, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { handleUpdateJournal(j.id, { name: editingJournal.name }); setEditingJournal(null); }
                            if (e.key === 'Escape') setEditingJournal(null);
                          }}
                          onBlur={() => { handleUpdateJournal(j.id, { name: editingJournal.name }); setEditingJournal(null); }}
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium">{j.name}</span>
                      )}
                      {j.id === diary.settings.defaultJournalId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t('diary.defaultJournal', { defaultValue: '默认' })}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{diary.entries.filter(e => e.journalId === j.id && !e.deletedAt).length}{t('diary.entryCountUnit', { defaultValue: '条' })}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingJournal(j)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {j.id !== diary.settings.defaultJournalId && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteJournal(j.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      {j.id !== diary.settings.defaultJournalId && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5"
                          onClick={() => handleSettingsChange({ defaultJournalId: j.id })}>
                          {t('diary.setAsDefault', { defaultValue: '设为默认' })}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {/* 新建日记本 */}
                <div className="flex items-center gap-2 px-3 py-2 border rounded border-dashed">
                  <div className="flex gap-1">
                    {EMOJI_PRESETS.slice(0, 6).map(emoji => (
                      <button key={emoji}
                        className={cn('h-6 w-6 rounded text-sm flex items-center justify-center', newJournalIcon === emoji ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent')}
                        onClick={() => setNewJournalIcon(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {COLOR_PRESETS.slice(0, 4).map(color => (
                      <button key={color}
                        className={cn('h-4 w-4 rounded-full', newJournalColor === color ? 'ring-2 ring-offset-1 ring-primary' : '')}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewJournalColor(color)} />
                    ))}
                  </div>
                  <input className="flex-1 text-sm px-2 py-1 border rounded bg-background"
                    value={newJournalName}
                    onChange={e => setNewJournalName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddJournal(); }}
                    placeholder={t('diary.newJournalName', { defaultValue: '新日记本名称...' })} />
                  <Button variant="outline" size="sm" className="h-7 gap-1" onClick={handleAddJournal} disabled={!newJournalName.trim()}>
                    <Plus className="h-3 w-3" />{t('diary.addJournal', { defaultValue: '添加' })}
                  </Button>
                </div>
              </>
            )}

            {/* ═══ 习惯管理 ═══ */}
            {activeTab === 'habits' && (
              <>
                <div className="space-y-2">
                  {(diary.metadata.habits || []).filter(h => !h.archived).map(h => (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-2 border rounded">
                      <span className="text-lg">{h.icon}</span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
                      <span className="flex-1 text-sm font-medium">{h.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                        {h.type === 'boolean' ? t('diary.habitTypeBoolean', { defaultValue: '打勾' }) : t('diary.habitTypeNumber', { defaultValue: '数值' })}
                        {h.type === 'number' && h.target ? ` (${h.target}${h.unit || ''})` : ''}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleArchiveHabit(h.id)}
                        title={t('diary.archiveHabit', { defaultValue: '归档' })}>
                        <span className="text-xs text-muted-foreground">...</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteHabit(h.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(diary.metadata.habits || []).filter(h => !h.archived).length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      {t('diary.noHabits', { defaultValue: '尚未设置习惯' })}
                    </div>
                  )}
                </div>
                {/* 已归档 */}
                {(diary.metadata.habits || []).filter(h => h.archived).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">{t('diary.archivedHabits', { defaultValue: '已归档' })}</div>
                    {(diary.metadata.habits || []).filter(h => h.archived).map(h => (
                      <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 border rounded opacity-50">
                        <span>{h.icon}</span>
                        <span className="flex-1 text-sm">{h.name}</span>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => handleUnarchiveHabit(h.id)}>
                          {t('diary.unarchive', { defaultValue: '恢复' })}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 新建习惯 */}
                <div className="space-y-2 border rounded p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-wrap">
                      {HABIT_EMOJI_PRESETS.map(emoji => (
                        <button key={emoji}
                          className={cn('h-6 w-6 rounded text-sm flex items-center justify-center', newHabitIcon === emoji ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent')}
                          onClick={() => setNewHabitIcon(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-0.5">
                      {COLOR_PRESETS.slice(0, 6).map(color => (
                        <button key={color}
                          className={cn('h-4 w-4 rounded-full', newHabitColor === color ? 'ring-2 ring-offset-1 ring-primary' : '')}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewHabitColor(color)} />
                      ))}
                    </div>
                    <select className="text-xs px-1 py-0.5 border rounded bg-background"
                      value={newHabitType}
                      onChange={e => setNewHabitType(e.target.value as 'boolean' | 'number')}>
                      <option value="boolean">{t('diary.habitTypeBoolean', { defaultValue: '打勾' })}</option>
                      <option value="number">{t('diary.habitTypeNumber', { defaultValue: '数值' })}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className="flex-1 text-sm px-2 py-1 border rounded bg-background"
                      value={newHabitName}
                      onChange={e => setNewHabitName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddHabit(); }}
                      placeholder={t('diary.newHabitName', { defaultValue: '新习惯名称...' })} />
                    <Button variant="outline" size="sm" className="h-7 gap-1" onClick={handleAddHabit} disabled={!newHabitName.trim()}>
                      <Plus className="h-3 w-3" />{t('diary.addHabit', { defaultValue: '添加' })}
                    </Button>
                  </div>
                  {newHabitType === 'number' && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{t('diary.habitStep', { defaultValue: '步长' })}</span>
                      <input type="number" className="w-16 px-1 py-0.5 border rounded bg-background text-right"
                        value={newHabitStep} min={1} onChange={e => setNewHabitStep(Math.max(1, parseInt(e.target.value) || 1))} />
                      <span className="text-muted-foreground">{t('diary.habitTarget', { defaultValue: '目标' })}</span>
                      <input type="number" className="w-16 px-1 py-0.5 border rounded bg-background text-right"
                        value={newHabitTarget} min={0} onChange={e => setNewHabitTarget(Math.max(0, parseInt(e.target.value) || 0))} />
                      <span className="text-muted-foreground">{t('diary.habitUnit', { defaultValue: '单位' })}</span>
                      <input className="w-12 px-1 py-0.5 border rounded bg-background text-center"
                        value={newHabitUnit} onChange={e => setNewHabitUnit(e.target.value)}
                        placeholder={t('diary.habitUnitPlaceholder', { defaultValue: '如:分' })} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══ 偏好设置 ═══ */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm">{t('diary.weekStartsOn', { defaultValue: '周起始日' })}</label>
                  <select className="text-sm px-2 py-1 border rounded bg-background"
                    value={diary.settings.weekStartsOn}
                    onChange={e => handleSettingsChange({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
                    <option value={1}>{t('diary.monday', { defaultValue: '周一' })}</option>
                    <option value={0}>{t('diary.sunday', { defaultValue: '周日' })}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">{t('diary.dailyWordGoal', { defaultValue: '每日字数目标' })}</label>
                  <input type="number" className="w-24 text-sm px-2 py-1 border rounded bg-background text-right"
                    value={diary.metadata.dailyWordGoal || ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                      onDiaryChange({ ...diary, metadata: { ...diary.metadata, dailyWordGoal: val } });
                    }}
                    placeholder="0" />
                </div>
                {[
                  { key: 'showMood' as const, label: t('diary.showMoodSetting', { defaultValue: '显示心情选择' }) },
                  { key: 'showWeather' as const, label: t('diary.showWeatherSetting', { defaultValue: '显示天气选择' }) },
                  { key: 'showLocation' as const, label: t('diary.showLocationSetting', { defaultValue: '显示位置输入' }) },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <label className="text-sm">{item.label}</label>
                    <button
                      className={cn('w-10 h-5 rounded-full transition-colors relative',
                        diary.settings[item.key] ? 'bg-primary' : 'bg-muted'
                      )}
                      onClick={() => handleSettingsChange({ [item.key]: !diary.settings[item.key] })}
                    >
                      <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                        diary.settings[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ 自定义模板 ═══ */}
            {activeTab === 'templates' && (
              <>
                <div className="space-y-2">
                  {diary.metadata.customTemplates.map(tpl => (
                    <div key={tpl.id} className="flex items-center gap-2 px-3 py-2 border rounded">
                      <span className="text-lg">{tpl.icon}</span>
                      <span className="flex-1 text-sm font-medium">{tpl.name}</span>
                      <span className="text-[10px] text-muted-foreground">{tpl.content.length}{t('diary.charUnit', { defaultValue: '字' })}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {diary.metadata.customTemplates.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-4">
                      {t('diary.noCustomTemplates', { defaultValue: '暂无自定义模板' })}
                    </div>
                  )}
                </div>
                {/* 新建模板 */}
                <div className="space-y-2 border rounded p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {['📝', '📋', '💭', '🎯', '📊', '🗓️'].map(emoji => (
                        <button key={emoji}
                          className={cn('h-6 w-6 rounded text-sm flex items-center justify-center', tplIcon === emoji ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent')}
                          onClick={() => setTplIcon(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <input className="flex-1 text-sm px-2 py-1 border rounded bg-background"
                      value={tplName}
                      onChange={e => setTplName(e.target.value)}
                      placeholder={t('diary.templateName', { defaultValue: '模板名称...' })} />
                  </div>
                  <textarea className="w-full h-24 text-xs px-2 py-1.5 border rounded bg-background resize-none font-mono"
                    value={tplContent}
                    onChange={e => setTplContent(e.target.value)}
                    placeholder={t('diary.templateContent', { defaultValue: '模板内容（Markdown）...' })} />
                  <Button variant="outline" size="sm" className="h-7 gap-1" onClick={handleAddTemplate} disabled={!tplName.trim()}>
                    <Plus className="h-3 w-3" />{t('diary.addTemplate', { defaultValue: '添加模板' })}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
