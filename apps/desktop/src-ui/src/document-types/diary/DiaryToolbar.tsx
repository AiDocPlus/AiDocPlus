/**
 * DiaryToolbar — 中栏两行工具栏
 *
 * 第一行：左栏开关、日期导航、新建/关闭/全关、保存/全保、版本/仪表盘/导出/设置
 * 第二行：心情5按钮、天气下拉、标签下拉、模板下拉、收藏、专注、AI开关
 */
import { useState } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  ChevronLeft, ChevronRight, CalendarDays, FilePlus, X, XCircle,
  Save, SaveAll, History, BarChart3, FileDown, FileUp, Settings,
  Maximize2, Star, StarOff, Cloud, Tag, FileText, BookOpen, Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryEntry, DiaryMood, DiaryWeatherType } from './types';
import {
  MOOD_EMOJI, MOOD_LABEL, MOOD_VALUES,
  WEATHER_EMOJI, WEATHER_LABEL, WEATHER_TYPES,
  formatDateDisplay,
} from './types';
import { BUILTIN_TEMPLATES } from './diaryTemplates';
import ColorLabelPicker from './ColorLabelPicker';

interface DiaryToolbarProps {
  diary: DiaryDocumentContent;
  activeEntry: DiaryEntry | null;
  selectedDate: string;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  focusMode: boolean;
  isSaving: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onNewEntry: () => void;
  onCloseTab: () => void;
  onCloseAllTabs: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onOpenVersionHistory: () => void;
  onOpenDashboard: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onMoodChange: (mood: DiaryMood | undefined) => void;
  onWeatherChange: (type: DiaryWeatherType) => void;
  onTemperatureChange: (temp: number | undefined) => void;
  onTagToggle: (tag: string) => void;
  onTemplateApply: (templateId: string) => void;
  onToggleStarred: () => void;
  onJournalChange: (journalId: string) => void;
  onColorLabelChange: (color: string | undefined) => void;
  editorAppearanceSlot?: React.ReactNode;
  allTags?: string[];
}

export default function DiaryToolbar({
  diary, activeEntry, selectedDate,
  leftCollapsed, rightCollapsed, focusMode, isSaving,
  onToggleLeft, onToggleRight, onToggleFocus,
  onPrevDay, onNextDay, onToday,
  onNewEntry, onCloseTab, onCloseAllTabs,
  onSave, onSaveAll,
  onOpenVersionHistory, onOpenDashboard, onOpenExport, onOpenImport, onOpenSettings,
  onMoodChange, onWeatherChange, onTemperatureChange,
  onTagToggle, onTemplateApply, onToggleStarred,
  onJournalChange, onColorLabelChange,
  editorAppearanceSlot,
  allTags: allTagsProp,
}: DiaryToolbarProps) {
  const { t } = useTranslation();
  const allTags = allTagsProp || [];
  const [tempInput, setTempInput] = useState('');

  return (
    <div className="flex flex-col border-b flex-shrink-0 bg-card min-w-0">
      {/* 第一行：导航与文件操作 */}
      <div className="flex items-center gap-1 px-2 py-1 text-xs overflow-x-auto min-w-0">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onToggleLeft}
          title={leftCollapsed ? t('diary.showLeft', { defaultValue: '显示左栏' }) : t('diary.hideLeft', { defaultValue: '隐藏左栏' })}>
          {leftCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </Button>
        {/* 日期导航 */}
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onPrevDay} title={t('diary.prevDay', { defaultValue: '上一天 (⌘[)' })}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium truncate max-w-[180px]">{formatDateDisplay(selectedDate)}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onNextDay} title={t('diary.nextDay', { defaultValue: '下一天 (⌘])' })}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onToday} title={t('diary.today', { defaultValue: '今天 (⌘T)' })}>
          <CalendarDays className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onNewEntry} title={t('diary.newEntry', { defaultValue: '新建条目 (⌘N)' })}>
          <FilePlus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onCloseTab} title={t('tabs.closeTab', { defaultValue: '关闭' })}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onCloseAllTabs} title={t('tabs.closeAllTabs', { defaultValue: '全关' })}>
          <XCircle className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button variant={isSaving ? 'secondary' : 'outline'} size="icon" className="h-5 w-5" onClick={onSave} disabled={isSaving}
          title={t('editor.saveCurrent', { defaultValue: '保存 (⌘S)' })}>
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onSaveAll} disabled={isSaving}
          title={t('editor.saveAll', { defaultValue: '全部保存 (⌘⇧S)' })}>
          <SaveAll className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onOpenVersionHistory}
          title={t('diary.versionHistory', { defaultValue: '版本历史' })} disabled={!activeEntry}>
          <History className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onOpenDashboard}
          title={t('diary.dashboard', { defaultValue: '仪表盘' })}>
          <BarChart3 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onOpenImport}
          title={t('diary.importDiary', { defaultValue: '导入日记' })}>
          <FileUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onOpenExport}
          title={t('diary.exportDiary', { defaultValue: '导出日记' })}>
          <FileDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-5 w-5" onClick={onOpenSettings}
          title={t('diary.settings', { defaultValue: '设置' })}>
          <Settings className="h-3.5 w-3.5" />
        </Button>
        {editorAppearanceSlot && <><div className="w-px h-4 bg-border mx-0.5" />{editorAppearanceSlot}</>}
        <div className="flex-1" />
        <Button variant={rightCollapsed ? 'outline' : 'default'} size="icon" className="h-5 w-5" onClick={onToggleRight}
          title={rightCollapsed ? t('diary.showAI', { defaultValue: '打开 AI' }) : t('diary.hideAI', { defaultValue: '关闭 AI' })}>
          {rightCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* 第二行：条目元数据 */}
      {activeEntry && !focusMode && (
        <div className="flex items-center gap-1 px-2 py-0.5 border-t text-xs overflow-x-auto min-w-0">
          {/* 所属日记本 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
                <BookOpen className="h-3 w-3" />
                <span>{diary.journals.find(j => j.id === activeEntry.journalId)?.icon} {diary.journals.find(j => j.id === activeEntry.journalId)?.name || t('diary.unknownJournal', { defaultValue: '未知' })}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card">
              {diary.journals.map(j => (
                <DropdownMenuItem key={j.id} className="text-xs gap-1.5" onClick={() => onJournalChange(j.id)}>
                  <span>{j.icon}</span>
                  <span>{j.name}</span>
                  {j.id === activeEntry.journalId && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 心情下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
                {activeEntry.mood
                  ? <span>{MOOD_EMOJI[activeEntry.mood]} {MOOD_LABEL[activeEntry.mood]}</span>
                  : <><Smile className="h-3 w-3" /><span className="text-muted-foreground">{t('diary.mood', { defaultValue: '心情' })}</span></>
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card">
              {MOOD_VALUES.map(mood => (
                <DropdownMenuItem key={mood} className="text-xs gap-1.5" onClick={() => onMoodChange(activeEntry.mood === mood ? undefined : mood)}>
                  <span className="text-sm">{MOOD_EMOJI[mood]}</span>
                  <span>{MOOD_LABEL[mood]}</span>
                  {activeEntry.mood === mood && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 天气下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
                <Cloud className="h-3 w-3" />
                {activeEntry.weather ? (
                  <span>{WEATHER_EMOJI[activeEntry.weather.type]}{activeEntry.weather.temperature !== undefined ? ` ${activeEntry.weather.temperature}°` : ''}</span>
                ) : (
                  <span className="text-muted-foreground">{t('diary.weather', { defaultValue: '天气' })}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card">
              {WEATHER_TYPES.map(wt => (
                <DropdownMenuItem key={wt} className="text-xs" onClick={() => onWeatherChange(wt)}>
                  {WEATHER_EMOJI[wt]} {WEATHER_LABEL[wt]}
                  {activeEntry.weather?.type === wt && <span className="ml-auto text-primary">◀</span>}
                </DropdownMenuItem>
              ))}
              {activeEntry.weather && (
                <>
                  <div className="px-2 py-1 border-t">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">温度:</span>
                      <input
                        type="number"
                        className="w-12 px-1 py-0.5 text-xs border rounded bg-background"
                        value={tempInput || (activeEntry.weather.temperature ?? '')}
                        onChange={e => {
                          setTempInput(e.target.value);
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          onTemperatureChange(val);
                        }}
                        placeholder="°C"
                      />
                      <span className="text-muted-foreground">°C</span>
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 标签下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
                <Tag className="h-3 w-3" />
                {activeEntry.tags.length > 0 ? (
                  <span>{activeEntry.tags.slice(0, 2).join(', ')}{activeEntry.tags.length > 2 ? '...' : ''}</span>
                ) : (
                  <span className="text-muted-foreground">{t('diary.tags', { defaultValue: '标签' })}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-48 overflow-auto bg-card">
              {allTags.map(tag => (
                <DropdownMenuItem key={tag} className="text-xs" onClick={() => onTagToggle(tag)}>
                  {activeEntry.tags.includes(tag) ? '✓ ' : '　'}{tag}
                </DropdownMenuItem>
              ))}
              {allTags.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">{t('diary.noTags', { defaultValue: '暂无标签' })}</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 模板下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 text-xs gap-0.5">
                <FileText className="h-3 w-3" />
                <span className="text-muted-foreground">{t('diary.template', { defaultValue: '模板' })}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card">
              {BUILTIN_TEMPLATES.map(tpl => (
                <DropdownMenuItem key={tpl.id} className="text-xs" onClick={() => onTemplateApply(tpl.id)}>
                  {tpl.icon} {tpl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 颜色标签 */}
          <ColorLabelPicker
            selectedColor={activeEntry.colorLabel}
            onSelect={onColorLabelChange}
          />
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 收藏 */}
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onToggleStarred}
            title={activeEntry.starred ? t('diary.unstar', { defaultValue: '取消收藏' }) : t('diary.star', { defaultValue: '收藏' })}>
            {activeEntry.starred
              ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </Button>
          <div className="flex-1" />
          {/* 专注模式 */}
          <Button variant={focusMode ? 'default' : 'outline'} size="icon" className="h-5 w-5" onClick={onToggleFocus}
            title={t('diary.focusMode', { defaultValue: '专注模式 (⌘E)' })}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
