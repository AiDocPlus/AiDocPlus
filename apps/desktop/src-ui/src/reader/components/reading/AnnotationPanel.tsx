// ── 批注面板（嵌入 ReadingSidebar 的第三个标签页）──

import { useMemo, useState } from 'react';
import { Highlighter, MessageSquare, Trash2, Edit3, Check, X } from 'lucide-react';
import { useReaderStore } from '../../useReaderStore';
import { HIGHLIGHT_COLORS, type Annotation, type HighlightColor } from '../../types/annotations';
import { useTranslation } from '@/i18n';

interface AnnotationPanelProps {
  filename: string;
  onJumpToAnnotation?: (annotation: Annotation) => void;
}

export function AnnotationPanel({ filename, onJumpToAnnotation }: AnnotationPanelProps) {
  const { t } = useTranslation();
  const { annotations, removeAnnotation, updateAnnotation } = useReaderStore();

  const list = useMemo(() => {
    const items = annotations[filename] ?? [];
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [annotations, filename]);

  if (!list.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground opacity-60 px-4">
        <Highlighter className="h-6 w-6 opacity-30" />
        <p className="text-center">{t('reader.noAnnotations', { defaultValue: '暂无批注' })}</p>
        <p className="text-center text-[10px] opacity-70">
          {t('reader.annotationHint', { defaultValue: '选中文字后右键可添加批注' })}
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {list.map(ann => (
        <AnnotationItem
          key={ann.id}
          annotation={ann}
          onJump={() => onJumpToAnnotation?.(ann)}
          onDelete={() => removeAnnotation(ann.id, filename)}
          onUpdateNote={(note) => updateAnnotation(ann.id, filename, { note })}
          onUpdateColor={(color) => updateAnnotation(ann.id, filename, { color })}
        />
      ))}
    </div>
  );
}

function AnnotationItem({
  annotation,
  onJump,
  onDelete,
  onUpdateNote,
  onUpdateColor,
}: {
  annotation: Annotation;
  onJump: () => void;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
  onUpdateColor: (color: HighlightColor) => void;
}) {
  const { t } = useTranslation();
  const colorDef = HIGHLIGHT_COLORS.find(c => c.id === annotation.color);

  return (
    <div
      className="group flex items-start gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer transition-colors"
      onClick={onJump}
    >
      {/* 类型图标 */}
      <div className="shrink-0 mt-0.5">
        {annotation.type === 'highlight' && (
          <div
            className="h-3 w-3 rounded-sm"
            style={{ background: colorDef?.bg ?? 'rgba(255, 235, 59, 0.3)', border: `1px solid ${colorDef?.border ?? '#fbc02d'}` }}
          />
        )}
        {annotation.type === 'note' && (
          <MessageSquare className="h-3 w-3 text-primary/70" />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {annotation.textSnapshot?.text && (
          <p className="text-xs truncate" style={{ color: 'var(--foreground)' }}>
            "{annotation.textSnapshot.text.slice(0, 60)}{annotation.textSnapshot.text.length > 60 ? '...' : ''}"
          </p>
        )}
        {annotation.note && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{annotation.note}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(annotation.createdAt).toLocaleString()}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {annotation.type === 'highlight' && (
          <ColorPicker currentColor={annotation.color} onSelect={onUpdateColor} t={t} />
        )}
        {annotation.type === 'note' && (
          <NoteEditor note={annotation.note ?? ''} onSave={onUpdateNote} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ currentColor, onSelect, t }: { currentColor?: HighlightColor; onSelect: (c: HighlightColor) => void; t: (key: string, opts?: { defaultValue: string }) => string }) {
  return (
    <div className="flex items-center gap-0.5">
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c.id}
          onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
          className="h-4 w-4 rounded-full border transition-transform hover:scale-110"
          style={{
            background: c.bg,
            borderColor: currentColor === c.id ? c.border : 'transparent',
            borderWidth: currentColor === c.id ? 2 : 1,
            outline: currentColor === c.id ? `1px solid ${c.border}` : 'none',
          }}
          title={t(c.labelKey, { defaultValue: c.id })}
        />
      ))}
    </div>
  );
}

function NoteEditor({ note, onSave }: { note: string; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note);

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
      >
        <Edit3 className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()} className="flex items-center gap-0.5">
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(text); setEditing(false); }
          if (e.key === 'Escape') { setEditing(false); }
        }}
        className="h-5 px-1 text-[10px] bg-muted border border-border rounded outline-none w-20"
      />
      <button onClick={() => { onSave(text); setEditing(false); }} className="h-4 w-4 flex items-center justify-center rounded hover:bg-green-100 text-green-600">
        <Check size={10} />
      </button>
      <button onClick={() => setEditing(false)} className="h-4 w-4 flex items-center justify-center rounded hover:bg-red-100 text-red-400">
        <X size={10} />
      </button>
    </div>
  );
}
