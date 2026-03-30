/**
 * 仿写文档状态栏
 */
import { useTranslation } from 'react-i18next';
import { countWords } from './types';
import type { EditorMode } from './types';

interface ImitativeWritingStatusBarProps {
  sourceText: string;
  imitationText: string;
  noteCount: number;
  sourceEditorMode: EditorMode;
  imitationEditorMode: EditorMode;
  saved: boolean;
}

export function ImitativeWritingStatusBar({
  sourceText,
  imitationText,
  noteCount,
  sourceEditorMode,
  imitationEditorMode,
  saved,
}: ImitativeWritingStatusBarProps) {
  const { t } = useTranslation();

  const sourceWords = countWords(sourceText);
  const imitationWords = countWords(imitationText);

  return (
    <div
      className="flex items-center gap-3 px-3 border-t bg-muted/10 text-[11px] text-muted-foreground flex-shrink-0 h-6"
    >
      <span>
        {t('imitativeWriting.status.sourceWords', { defaultValue: '原文' })}: {sourceWords}
        {t('imitativeWriting.status.wordsUnit', { defaultValue: '字' })}
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span>
        {t('imitativeWriting.status.imitationWords', { defaultValue: '仿写' })}: {imitationWords}
        {t('imitativeWriting.status.wordsUnit', { defaultValue: '字' })}
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span>
        {t('imitativeWriting.status.notes', { defaultValue: '笔记' })}: {noteCount}
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span>
        {t('imitativeWriting.status.sourceMode', { defaultValue: '原文' })}: {sourceEditorMode.toUpperCase()}
      </span>
      <span className="text-muted-foreground/40">|</span>
      <span>
        {t('imitativeWriting.status.imitationMode', { defaultValue: '仿写' })}: {imitationEditorMode.toUpperCase()}
      </span>
      <div className="flex-1" />
      <span className={saved ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}>
        {saved
          ? t('imitativeWriting.status.saved', { defaultValue: '已保存' })
          : t('imitativeWriting.status.unsaved', { defaultValue: '未保存' })}
      </span>
    </div>
  );
}
