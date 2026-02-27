import { useTranslation } from '@/i18n';

interface EditorStatusBarProps {
  lines: number;
  words: number;
  chars: number;
  cursorLine?: number;
  cursorCol?: number;
  selectionChars?: number;
}

export function EditorStatusBar({ lines, words, chars, cursorLine, cursorCol, selectionChars }: EditorStatusBarProps) {
  const { t } = useTranslation();
  const readingTime = Math.max(1, Math.ceil(chars / 300));
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t text-xs bg-background text-muted-foreground flex-shrink-0">
      <div>
        {t('editor.statusBar.stats', { defaultValue: '{{lines}} 行 · {{words}} 词 · {{chars}} 字符 · 约 {{readingTime}} 分钟', lines, words, chars, readingTime })}
        {selectionChars ? t('editor.statusBar.selected', { defaultValue: ' · 选中 {{count}}', count: selectionChars }) : ''}
      </div>
      <div className="flex items-center gap-3">
        {cursorLine !== undefined && cursorCol !== undefined && (
          <span>{t('editor.statusBar.cursor', { defaultValue: '行 {{line}}, 列 {{col}}', line: cursorLine, col: cursorCol })}</span>
        )}
        <span>Markdown</span>
      </div>
    </div>
  );
}
