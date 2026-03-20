/**
 * GotoLineDialog — 跳转到行号对话框
 *
 * 通过 window 事件 'editor-goto-line-open' 触发打开
 * 输入行号后跳转到对应行并高亮
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

const DIALOG_STYLE: React.CSSProperties = {
  fontFamily: "'宋体', 'SimSun', serif",
  fontSize: '16px',
};

interface GotoLineDialogProps {
  cmViewRef: React.RefObject<EditorView | null>;
}

export default function GotoLineDialog({ cmViewRef }: GotoLineDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [totalLines, setTotalLines] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === 'goto_line') {
        const view = cmViewRef.current;
        if (view) {
          setTotalLines(view.state.doc.lines);
          const currentLine = view.state.doc.lineAt(view.state.selection.main.from).number;
          setValue(String(currentLine));
          setOpen(true);
          setTimeout(() => inputRef.current?.select(), 50);
        }
      }
    };
    window.addEventListener('editor-menu-action', handler);
    return () => window.removeEventListener('editor-menu-action', handler);
  }, [cmViewRef]);

  const handleGoto = useCallback(() => {
    const view = cmViewRef.current;
    if (!view) return;
    const lineNum = parseInt(value, 10);
    if (isNaN(lineNum) || lineNum < 1) return;
    const targetLine = Math.min(lineNum, view.state.doc.lines);
    const line = view.state.doc.line(targetLine);
    view.dispatch({
      selection: { anchor: line.from },
      effects: (view.constructor as typeof EditorView).scrollIntoView(line.from, { y: 'center' }),
    });
    view.focus();
    setOpen(false);
  }, [cmViewRef, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGoto();
    } else if (e.key === 'Escape') {
      setOpen(false);
      cmViewRef.current?.focus();
    }
  }, [handleGoto, cmViewRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20%]"
      onClick={() => { setOpen(false); cmViewRef.current?.focus(); }}
    >
      <div
        className="border rounded-lg shadow-xl p-4 w-80"
        style={{ ...DIALOG_STYLE, backgroundColor: 'hsl(var(--card))', opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium mb-3">跳转到行 (1 ~ {totalLines})</div>
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={totalLines}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="输入行号..."
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            className="h-7 px-3 text-xs rounded-md border hover:bg-accent"
            onClick={() => { setOpen(false); cmViewRef.current?.focus(); }}
          >
            取消
          </button>
          <button
            type="button"
            className="h-7 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleGoto}
          >
            跳转
          </button>
        </div>
      </div>
    </div>
  );
}
