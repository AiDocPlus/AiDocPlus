import { memo } from 'react';
import { useTranslation } from '@/i18n';

interface BreadcrumbItem {
  text: string;
  from: number;
}

interface EditorStatusBarProps {
  lines: number;
  words: number;
  chars: number;
  cursorLine?: number;
  cursorCol?: number;
  selectionChars?: number;
  isLargeDoc?: boolean;
  breadcrumb?: BreadcrumbItem[];
  onBreadcrumbClick?: (from: number) => void;
}

export const EditorStatusBar = memo(function EditorStatusBar({ lines, words, chars, cursorLine, cursorCol, selectionChars, isLargeDoc, breadcrumb, onBreadcrumbClick }: EditorStatusBarProps) {
  const { t } = useTranslation();
  const readingTime = Math.max(1, Math.ceil(chars / 300));
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t text-xs bg-background text-muted-foreground flex-shrink-0 gap-2">
      <div className="shrink-0">
        {t('editor.statusBar.stats', { defaultValue: '{{lines}} 行 · {{words}} 词 · {{chars}} 字符 · 约 {{readingTime}} 分钟', lines, words, chars, readingTime })}
        {selectionChars ? t('editor.statusBar.selected', { defaultValue: ' · 选中 {{count}}', count: selectionChars }) : ''}
      </div>
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 min-w-0 truncate text-muted-foreground/70">
          {breadcrumb.map((item, i) => (
            <span key={item.from} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-muted-foreground/40">›</span>}
              <button
                type="button"
                className="truncate max-w-[120px] hover:text-foreground transition-colors"
                title={item.text}
                onClick={() => onBreadcrumbClick?.(item.from)}
              >
                {item.text}
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {isLargeDoc && (
          <span className="text-amber-500 dark:text-amber-400">
            {t('editor.statusBar.largeDocMode', { defaultValue: '大文档模式' })}
          </span>
        )}
        {cursorLine !== undefined && cursorCol !== undefined && (
          <span>{t('editor.statusBar.cursor', { defaultValue: '行 {{line}}, 列 {{col}}', line: cursorLine, col: cursorCol })}</span>
        )}
        <span>Markdown</span>
      </div>
    </div>
  );
});
