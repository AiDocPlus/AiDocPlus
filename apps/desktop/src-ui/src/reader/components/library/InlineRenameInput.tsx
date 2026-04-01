// ── 内联重命名输入框 ──

import { useRef, useEffect, useState, useCallback } from 'react';

export function InlineRenameInput({ value, onSave, onCancel }: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(value);
  const cancelledRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // 用 ref 存储 editValue 和 callbacks，避免 commit 因依赖变化频繁重建
  const editValueRef = useRef(editValue);
  editValueRef.current = editValue;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const commit = useCallback(() => {
    if (cancelledRef.current) return;
    const trimmed = editValueRef.current.trim();
    if (trimmed && trimmed !== value) onSaveRef.current(trimmed);
    else onCancelRef.current();
  }, [value]);

  const handleBlur = useCallback(() => {
    commit();
  }, [commit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelledRef.current = true;
      onCancelRef.current();
    }
  }, [commit]);

  return (
    <input
      ref={ref}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: 1, padding: '1px 4px', fontSize: 13,
        border: '1px solid #3b82f6', borderRadius: 3,
        outline: 'none',
      }}
    />
  );
}
