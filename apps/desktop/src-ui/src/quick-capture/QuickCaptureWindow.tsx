/**
 * 速记窗口 — 多条目记录、复制/清空/合并复制、Toast 动态提示
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { Pin, Copy, Trash2, Plus, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'aidocplus-quick-capture-draft';
const SAVE_DEBOUNCE_MS = 400;

interface NoteItem {
  id: string;
  text: string;
}

function createEmptyItem(): NoteItem {
  return { id: crypto.randomUUID(), text: '' };
}

function createDefaultItems(): NoteItem[] {
  return [createEmptyItem(), createEmptyItem(), createEmptyItem()];
}

function loadItems(): NoteItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved == null) return createDefaultItems();
    // 兼容旧格式（纯字符串）
    if (saved.startsWith('[')) {
      const parsed = JSON.parse(saved) as NoteItem[];
      return parsed.length > 0 ? parsed : createDefaultItems();
    }
    return [{ id: crypto.randomUUID(), text: saved }];
  } catch {
    return createDefaultItems();
  }
}

function saveItems(items: NoteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function QuickCaptureWindow() {
  const { t } = useTranslation();
  const [items, setItems] = useState<NoteItem[]>(loadItems);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastKeyRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // --- init: alwaysOnTop ---
  useEffect(() => {
    (async () => {
      try {
        const on = await getCurrentWindow().isAlwaysOnTop();
        setAlwaysOnTop(on);
      } catch { /* ignore */ }
    })();
  }, []);

  // --- init: theme ---
  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<unknown>('load_settings');
        if (raw) {
          const settings: { state?: { ui?: { theme?: string } } } =
            typeof raw === 'string' ? JSON.parse(raw as string) : (raw as object);
          const theme = settings?.state?.ui?.theme;
          if (theme === 'dark') {
            setDark(true);
            document.documentElement.classList.add('dark');
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // --- persist items (debounced) ---
  const persistItems = useCallback((newItems: NoteItem[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveItems(newItems), SAVE_DEBOUNCE_MS);
  }, []);

  // --- Toast ---
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastKeyRef.current += 1;
    setToast({ message, key: toastKeyRef.current });
    toastTimerRef.current = setTimeout(() => setToast(null), 1500);
  }, []);

  // --- handlers ---
  const handleTogglePin = async (checked: boolean) => {
    setAlwaysOnTop(checked);
    try { await getCurrentWindow().setAlwaysOnTop(checked); } catch { /* ignore */ }
  };

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  const updateItemText = (id: string, text: string) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, text } : it));
      persistItems(next);
      return next;
    });
  };

  const handleCopyItem = async (item: NoteItem) => {
    if (!item.text.trim()) return;
    try {
      await navigator.clipboard.writeText(item.text);
      showToast(t('quickCapture.copiedToast', { defaultValue: '已复制到剪贴板' }));
    } catch { /* ignore */ }
  };

  const handleClearItem = (id: string) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, text: '' } : it));
      persistItems(next);
      return next;
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((it) => it.id !== id);
      persistItems(next);
      return next;
    });
  };

  const handleAddItem = () => {
    const newItem = createEmptyItem();
    setItems((prev) => {
      const next = [...prev, newItem];
      persistItems(next);
      // 聚焦新条目
      requestAnimationFrame(() => textareaRefs.current.get(newItem.id)?.focus());
      return next;
    });
  };

  const handleMergeCopy = async () => {
    const nonEmpty = items.filter((it) => it.text.trim());
    if (nonEmpty.length === 0) return;
    const merged = nonEmpty.map((it) => it.text.trimEnd()).join('\n');
    try {
      await navigator.clipboard.writeText(merged);
      showToast(t('quickCapture.mergeCopiedToast', { defaultValue: '已合并复制到剪贴板' }));
    } catch { /* ignore */ }
  };

  const handleClearAll = async () => {
    const hasContent = items.some((it) => it.text.trim());
    if (!hasContent) return;
    const ok = await confirm(
      t('quickCapture.clearAllConfirm', { defaultValue: '确定清空所有速记内容？' }),
      {
        title: t('quickCapture.clearAllTitle', { defaultValue: '全部清空' }),
        kind: 'warning',
        okLabel: t('quickCapture.clearAllOk', { defaultValue: '全部清空' }),
        cancelLabel: t('common.cancel', { defaultValue: '取消' }),
      },
    );
    if (!ok) return;
    const next = createDefaultItems();
    setItems(next);
    saveItems(next);
  };

  return (
    <div className="relative flex h-screen w-screen flex-col bg-background text-foreground border border-border/80">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-border px-3 py-2 bg-card/80">
        <div className="flex items-center gap-2 min-w-0">
          <Pin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Label htmlFor="qc-pin" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            {t('quickCapture.alwaysOnTop', { defaultValue: '置顶' })}
          </Label>
          <Switch id="qc-pin" checked={alwaysOnTop} onCheckedChange={handleTogglePin} />
        </div>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleDark}>
          {dark ? t('quickCapture.themeLight', { defaultValue: '浅色' }) : t('quickCapture.themeDark', { defaultValue: '深色' })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleAddItem}
          title={t('quickCapture.addItem', { defaultValue: '新建条目' })}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </header>

      {/* Items area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border bg-card p-2">
            {/* Item header */}
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[11px] text-muted-foreground font-medium select-none px-1">
                {t('quickCapture.itemLabel', { defaultValue: '条目 {{index}}', index: index + 1 })}
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => void handleCopyItem(item)}
                title={t('quickCapture.copy', { defaultValue: '复制' })}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleClearItem(item.id)}
                title={t('quickCapture.clear', { defaultValue: '清空' })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleDeleteItem(item.id)}
                  title={t('quickCapture.deleteItem', { defaultValue: '删除' })}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {/* Textarea */}
            <textarea
              ref={(el) => {
                if (el) textareaRefs.current.set(item.id, el);
                else textareaRefs.current.delete(item.id);
              }}
              className={cn(
                'w-full min-h-[60px] max-h-[200px] resize-y rounded-md border-0 bg-transparent',
                'p-1.5 text-sm leading-relaxed outline-none focus-visible:ring-0 font-sans',
                'placeholder:text-muted-foreground/60',
              )}
              placeholder={t('quickCapture.placeholder', { defaultValue: '随手记录…' })}
              value={item.text}
              onChange={(e) => updateItemText(item.id, e.target.value)}
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const direction = e.shiftKey ? -1 : 1;
                  const targetIdx = index + direction;
                  if (targetIdx >= 0 && targetIdx < items.length) {
                    textareaRefs.current.get(items[targetIdx].id)?.focus();
                  }
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="flex flex-shrink-0 items-center gap-2 border-t border-border px-3 py-1.5 bg-muted/20">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => void handleMergeCopy()}
        >
          <Layers className="h-3 w-3" />
          {t('quickCapture.mergeCopy', { defaultValue: '合并复制' })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
          onClick={() => void handleClearAll()}
        >
          <Trash2 className="h-3 w-3" />
          {t('quickCapture.clearAll', { defaultValue: '全部清空' })}
        </Button>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">
          {t('quickCapture.footerHint', { defaultValue: '关闭窗口后内容仍保留；可通过菜单「工具 → 速记窗口」再次打开。' })}
        </span>
      </footer>

      {/* Toast */}
      {toast && (
        <div
          key={toast.key}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium shadow-lg select-none">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
