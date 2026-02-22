import { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface TagEditorProps {
  projectId: string;
  documentId: string;
  className?: string;
}

export function TagEditor({ projectId, documentId, className }: TagEditorProps) {
  const { t } = useTranslation();
  const { documents, allTags, updateDocumentTags } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const doc = documents.find(d => d.id === documentId);
  const tags = (doc?.metadata?.tags || []).filter((tag: string) => !tag.startsWith('_'));

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAddTag = async () => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setNewTag('');
      setIsAdding(false);
      return;
    }
    const allDocTags = doc?.metadata?.tags || [];
    await updateDocumentTags(projectId, documentId, [...allDocTags, trimmed]);
    setNewTag('');
    setIsAdding(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const allDocTags = doc?.metadata?.tags || [];
    await updateDocumentTags(projectId, documentId, allDocTags.filter((t: string) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setNewTag('');
      setIsAdding(false);
    }
  };

  // 过滤建议标签（排除已有的和内部标签）
  const suggestions = allTags.filter(t => !tags.includes(t) && !t.startsWith('_') && t.toLowerCase().includes(newTag.toLowerCase()));

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      {tags.map((tag: string) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-md bg-secondary text-secondary-foreground"
        >
          {tag}
          <button
            onClick={() => handleRemoveTag(tag)}
            className="hover:text-destructive ml-0.5"
            title={t('fileTree.removeTag', { defaultValue: '移除标签' })}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {isAdding ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!newTag.trim()) setIsAdding(false); }}
            placeholder={t('fileTree.tagPlaceholder', { defaultValue: '输入标签...' })}
            className="w-24 px-1.5 py-0.5 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          {newTag && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-0.5 w-32 bg-popover border rounded-md shadow-md z-50 max-h-32 overflow-y-auto">
              {suggestions.slice(0, 8).map(s => (
                <button
                  key={s}
                  className="w-full text-left px-2 py-1 text-xs hover:bg-accent truncate"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setNewTag(s);
                    setTimeout(() => handleAddTag(), 0);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent"
          title={t('fileTree.addTag', { defaultValue: '添加标签' })}
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
