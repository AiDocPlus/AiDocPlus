// ── 内联创建分类输入框 ──

import { useRef, useEffect, useState } from 'react';
import { FolderPlus, Check, X } from 'lucide-react';

export function InlineCreateInput({ placeholder, onSave, onCancel }: {
  placeholder: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const canSubmit = value.trim().length > 0;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
      <FolderPlus size={12} style={{ color: '#64748b', flexShrink: 0 }} />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) onSave(value.trim());
          else if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        style={{
          flex: 1, padding: '1px 4px', fontSize: 13,
          border: '1px solid #3b82f6', borderRadius: 3,
          outline: 'none',
        }}
      />
      <button
        onClick={() => canSubmit && onSave(value.trim())}
        disabled={!canSubmit}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: 3, cursor: canSubmit ? 'pointer' : 'default',
          background: 'transparent', color: '#64748b',
        }}
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: 3, cursor: 'pointer', background: 'transparent', color: '#64748b',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
