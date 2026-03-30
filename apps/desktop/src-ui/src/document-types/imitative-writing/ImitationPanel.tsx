/**
 * 仿写面板 — 支持 MD / HTML 双编辑器 + 草稿管理 + 仿写设置
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PenTool, History, Settings2, Check, ChevronDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { RichTextEditor } from '../_shared/RichTextEditor';
import { EditorModeSwitcher } from '../_shared/EditorModeSwitcher';
import { convertMarkdownToHtml, convertHtmlToMarkdown } from '../_shared/formatConvert';
import type { EditorMode, ImitationDraft, ImitationSettings } from './types';
import { IMITATION_MODES } from './constants';

interface ImitationPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode, converted?: string) => void;
  drafts?: ImitationDraft[];
  onSaveDraft?: (draft: ImitationDraft) => void;
  onRestoreDraft?: (text: string, mode: EditorMode) => void;
  settings?: ImitationSettings;
  onSettingsChange?: (settings: ImitationSettings) => void;
}

function genDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ImitationPanel({
  text,
  onTextChange,
  editorMode,
  onEditorModeChange,
  drafts = [],
  onSaveDraft,
  onRestoreDraft,
  settings,
  onSettingsChange,
}: ImitationPanelProps) {
  const { t } = useTranslation();
  const [draftSaved, setDraftSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [targetInput, setTargetInput] = useState(
    () => String(settings?.targetWordCount || 500)
  );

  const handleModeSwitch = useCallback((newMode: EditorMode, converted?: string) => {
    onEditorModeChange(newMode, converted);
    if (converted !== undefined) onTextChange(converted);
  }, [onEditorModeChange, onTextChange]);

  const handleSaveDraft = useCallback(() => {
    if (!onSaveDraft || !text.trim()) return;
    const now = new Date();
    const label = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    onSaveDraft({
      id: genDraftId(),
      text,
      editorMode,
      createdAt: now.toISOString(),
      label,
    });
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 1800);
  }, [onSaveDraft, text, editorMode]);

  const handleRestoreDraft = useCallback((draft: ImitationDraft) => {
    onRestoreDraft?.(draft.text, draft.editorMode);
  }, [onRestoreDraft]);

  const handleImitationModeChange = useCallback((mode: ImitationSettings['imitationMode']) => {
    if (!settings || !onSettingsChange) return;
    onSettingsChange({ ...settings, imitationMode: mode });
  }, [settings, onSettingsChange]);

  const handleTargetWordCountBlur = useCallback(() => {
    if (!settings || !onSettingsChange) return;
    const n = parseInt(targetInput, 10);
    if (!isNaN(n) && n > 0) {
      onSettingsChange({ ...settings, targetWordCount: n });
    } else {
      setTargetInput(String(settings.targetWordCount));
    }
  }, [settings, onSettingsChange, targetInput]);

  const currentModeLabel = settings
    ? t(IMITATION_MODES.find(m => m.value === settings.imitationMode)?.labelKey || '', { defaultValue: '全文仿写' })
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden border-r">
      {/* 面板标题栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 flex-shrink-0">
        <PenTool className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {t('imitativeWriting.imitation.title', { defaultValue: '仿写' })}
          {settings && (
            <span className="ml-1 text-[10px] text-muted-foreground/60">[{currentModeLabel}]</span>
          )}
        </span>

        {/* 草稿管理 */}
        {onSaveDraft && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] gap-0.5 flex-shrink-0"
              onClick={handleSaveDraft}
              disabled={!text.trim()}
              title={t('imitativeWriting.imitation.saveDraft', { defaultValue: '保存草稿' })}
            >
              {draftSaved
                ? <Check className="h-3 w-3 text-green-500" />
                : <History className="h-3 w-3" />
              }
            </Button>

            {drafts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-[10px] gap-0.5 flex-shrink-0"
                    title={t('imitativeWriting.imitation.draftHistory', { defaultValue: '草稿历史' })}
                  >
                    <ChevronDown className="h-2.5 w-2.5" />
                    <span className="text-[9px] text-muted-foreground/60">{drafts.length}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[10px]">
                    {t('imitativeWriting.imitation.draftHistory', { defaultValue: '草稿历史（点击恢复）' })}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {drafts.slice(0, 10).map(draft => (
                    <DropdownMenuItem
                      key={draft.id}
                      onClick={() => handleRestoreDraft(draft)}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1 truncate">{draft.label}</span>
                      <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">
                        {draft.text.length}字
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}

        {/* 仿写设置 */}
        {settings && onSettingsChange && (
          <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 flex-shrink-0"
                title={t('imitativeWriting.imitation.settings', { defaultValue: '仿写设置' })}
              >
                <Settings2 className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2" onCloseAutoFocus={e => e.preventDefault()}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                {t('imitativeWriting.imitation.imitationMode', { defaultValue: '仿写模式' })}
              </p>
              <div className="flex flex-col gap-0.5 mb-2">
                {IMITATION_MODES.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => handleImitationModeChange(mode.value)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors ${
                      settings.imitationMode === mode.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/50'
                    }`}
                    title={t(mode.labelKey, { defaultValue: mode.value })}
                  >
                    {settings.imitationMode === mode.value && (
                      <Check className="h-2.5 w-2.5 flex-shrink-0" />
                    )}
                    {settings.imitationMode !== mode.value && (
                      <span className="h-2.5 w-2.5 flex-shrink-0" />
                    )}
                    {t(mode.labelKey, { defaultValue: mode.value })}
                  </button>
                ))}
              </div>
              <div className="border-t pt-1.5">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                  {t('imitativeWriting.imitation.targetWords', { defaultValue: '目标字数' })}
                </p>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    onBlur={handleTargetWordCountBlur}
                    title={t('imitativeWriting.imitation.targetWords', { defaultValue: '目标字数' })}
                    aria-label={t('imitativeWriting.imitation.targetWords', { defaultValue: '目标字数' })}
                    placeholder="500"
                    min={50}
                    max={50000}
                    className="w-20 text-xs border rounded px-1.5 h-6 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    onKeyDown={e => { if (e.key === 'Enter') handleTargetWordCountBlur(); }}
                  />
                  <span className="text-[10px] text-muted-foreground">字</span>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Separator orientation="vertical" className="h-4" />
        <EditorModeSwitcher
          mode={editorMode}
          onModeChange={handleModeSwitch}
          currentContent={text}
          convertToHtml={convertMarkdownToHtml}
          convertToMarkdown={convertHtmlToMarkdown}
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0">
        {editorMode === 'markdown' ? (
          <MarkdownEditor
            value={text}
            onChange={onTextChange}
            placeholder={t('imitativeWriting.imitation.placeholder', { defaultValue: '在此仿写...' })}
            showToolbar
            showViewModeSwitch
          />
        ) : (
          <RichTextEditor
            value={text}
            onChange={onTextChange}
            placeholder={t('imitativeWriting.imitation.placeholder', { defaultValue: '在此仿写...' })}
          />
        )}
      </div>
    </div>
  );
}
