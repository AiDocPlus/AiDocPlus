/**
 * DiarySettingsDialog — 日记本设置弹窗
 *
 * Tab: 日记本管理 / 偏好设置 / 自定义模板
 */
import { useState, useCallback } from 'react';
import {
  BookOpen, Settings, Plus, Trash2, Pencil, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryJournal, DiaryTemplate } from './types';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

const EMOJI_PRESETS = ['📖', '💼', '🌱', '✈️', '🎯', '💡', '🎨', '🏋️', '🍳', '📚', '🎵', '❤️'];
const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];

type SettingsTab = 'journals' | 'preferences' | 'templates';

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

  const TABS: { key: SettingsTab; icon: typeof BookOpen; label: string }[] = [
    { key: 'journals', icon: BookOpen, label: t('diary.settingsJournals', { defaultValue: '日记本' }) },
    { key: 'preferences', icon: Settings, label: t('diary.settingsPreferences', { defaultValue: '偏好' }) },
    { key: 'templates', icon: FileText, label: t('diary.settingsTemplates', { defaultValue: '自定义模板' }) },
  ];

  // ── 日记本 CRUD ──
  const handleAddJournal = useCallback(() => {
    if (!newJournalName.trim()) return;
    const journal: DiaryJournal = {
      id: `dj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
      id: `dtpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
    onDiaryChange({
      ...diary,
      metadata: { ...diary.metadata, customTemplates: diary.metadata.customTemplates.filter(t => t.id !== id) },
    });
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
                      <span className="text-[10px] text-muted-foreground">{diary.entries.filter(e => e.journalId === j.id).length}{t('diary.entryCountUnit', { defaultValue: '条' })}</span>
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
