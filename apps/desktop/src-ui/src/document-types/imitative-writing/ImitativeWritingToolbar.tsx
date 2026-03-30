/**
 * 仿写文档工具栏
 */
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronDown, LayoutTemplate, Download, Save, SaveAll, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GENRE_OPTIONS, GENRE_GROUP_LABELS, LAYOUT_MODES,
  type LayoutMode,
} from './constants';
import type { WritingGenre, ImitativeWritingContent } from './types';
import { exportDocument, type ExportFormat } from './imitativeExport';

interface ImitativeWritingToolbarProps {
  genre: WritingGenre;
  onGenreChange: (genre: WritingGenre) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  docContent: ImitativeWritingContent;
  docTitle: string;
  saved?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onSaveAll?: () => void;
  onVersionHistory?: () => void;
}

export function ImitativeWritingToolbar({
  genre,
  onGenreChange,
  layoutMode,
  onLayoutModeChange,
  docContent,
  docTitle,
  saved = true,
  isSaving = false,
  onSave,
  onSaveAll,
  onVersionHistory,
}: ImitativeWritingToolbarProps) {
  const { t } = useTranslation();

  const currentGenreOption = GENRE_OPTIONS.find(g => g.value === genre);

  const genreGroups = GENRE_OPTIONS.reduce<Record<string, typeof GENRE_OPTIONS>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  const currentLayoutOption = LAYOUT_MODES.find(l => l.value === layoutMode);

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const mod = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="flex items-center gap-1 px-2 h-10 border-b bg-background flex-shrink-0">
      <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium text-foreground mr-1">
        {t('imitativeWriting.toolbar.title', { defaultValue: '仿写文档' })}
      </span>
      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* ── 保存组 ── */}
      {onSave && (
        <Button
          variant={isSaving ? 'secondary' : 'outline'}
          size="icon"
          className="h-6 w-6"
          disabled={isSaving}
          onClick={onSave}
          title={`${t('editor.saveCurrent', { defaultValue: '保存当前文档' })} (${mod}S)`}
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
      )}
      {onSaveAll && (
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          disabled={isSaving}
          onClick={onSaveAll}
          title={`${t('editor.saveAll', { defaultValue: '保存全部文档' })} (${mod}⇧S)`}
        >
          <SaveAll className="h-3.5 w-3.5" />
        </Button>
      )}
      {onVersionHistory && (
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={onVersionHistory}
          title={t('editor.versionHistory', { defaultValue: '历史版本' })}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* 未保存指示点 */}
      {!saved && !isSaving && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" title={t('editor.unsaved', { defaultValue: '有未保存的更改' })} />
      )}

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* 体裁选择 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            <span>{t(currentGenreOption?.labelKey || '', { defaultValue: '散文·抒情' })}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {Object.entries(genreGroups).map(([group, options], idx) => (
            <div key={group}>
              {idx > 0 && <DropdownMenuSeparator />}
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {t(GENRE_GROUP_LABELS[group] || '', { defaultValue: group })}
              </div>
              {options.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onGenreChange(opt.value)}
                  className={genre === opt.value ? 'font-semibold text-primary' : ''}
                >
                  {t(opt.labelKey, { defaultValue: opt.value })}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* 布局模式切换 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span>{t(currentLayoutOption?.labelKey || '', { defaultValue: '四栏' })}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {LAYOUT_MODES.map(mode => (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => onLayoutModeChange(mode.value)}
              className={layoutMode === mode.value ? 'font-semibold text-primary' : ''}
            >
              {t(mode.labelKey, { defaultValue: mode.value })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <span className="text-[10px] text-muted-foreground">
        {t('imitativeWriting.toolbar.hint', { defaultValue: '读·析·仿·评·记' })}
      </span>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* 导出 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
            title={t('imitativeWriting.toolbar.export', { defaultValue: '导出文档' })}>
            <Download className="h-3.5 w-3.5" />
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {(['md', 'txt', 'html'] as ExportFormat[]).map(fmt => (
            <DropdownMenuItem key={fmt}
              onClick={() => void exportDocument(docContent, docTitle, fmt)}>
              {t(`imitativeWriting.toolbar.exportAs_${fmt}`, { defaultValue: `导出为 ${fmt.toUpperCase()}` })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
