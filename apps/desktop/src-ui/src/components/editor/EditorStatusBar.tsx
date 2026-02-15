interface EditorStatusBarProps {
  lines: number;
  words: number;
  chars: number;
  cursorLine?: number;
  cursorCol?: number;
  selectionChars?: number;
}

export function EditorStatusBar({ lines, words, chars, cursorLine, cursorCol, selectionChars }: EditorStatusBarProps) {
  const readingTime = Math.max(1, Math.ceil(chars / 300));
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t text-xs bg-background text-muted-foreground flex-shrink-0">
      <div>
        {lines} 行 · {words} 词 · {chars} 字符 · 约 {readingTime} 分钟
        {selectionChars ? ` · 选中 ${selectionChars}` : ''}
      </div>
      <div className="flex items-center gap-3">
        {cursorLine !== undefined && cursorCol !== undefined && (
          <span>行 {cursorLine}, 列 {cursorCol}</span>
        )}
        <span>Markdown</span>
      </div>
    </div>
  );
}
