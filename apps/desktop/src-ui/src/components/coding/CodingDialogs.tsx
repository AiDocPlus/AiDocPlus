import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Copy, Pencil } from 'lucide-react';

// ── 跳转到行对话框 ──

interface GotoLineDialogProps {
  open: boolean;
  onClose: () => void;
  onGoto: (line: number) => void;
  maxLines?: number;
}

export function GotoLineDialog({ open, onClose, onGoto, maxLines }: GotoLineDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  useEffect(() => { if (open) setValue(''); }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed z-50 top-1/4 left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-xl p-4 w-72">
        <p className="text-sm font-medium mb-2">{t('coding.gotoLine', { defaultValue: '跳转到行' })}</p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={`1 - ${maxLines || '?'}`}
            className="h-8 text-base flex-1"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const n = parseInt(value, 10);
                if (n > 0) onGoto(n);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <Button size="sm" className="h-8" onClick={() => {
            const n = parseInt(value, 10);
            if (n > 0) onGoto(n);
          }}>{t('coding.go', { defaultValue: '跳转' })}</Button>
        </div>
      </div>
    </>
  );
}

// ── 命令面板 ──

export interface CmdPaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CmdPaletteCommand[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) { setQuery(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toLowerCase()))
    : commands;

  const execute = useCallback((i: number) => {
    const item = filtered[i];
    if (item) { onClose(); item.action(); }
  }, [filtered, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed z-50 top-[15%] left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-xl w-[380px] max-h-[60vh] flex flex-col overflow-hidden">
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setIdx(0); }}
            placeholder={t('coding.cmdPalettePlaceholder', { defaultValue: '输入命令...' })}
            className="h-8 text-base"
            onKeyDown={e => {
              if (e.key === 'Escape') { onClose(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); execute(idx); }
            }}
          />
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('coding.noResults', { defaultValue: '无匹配命令' })}</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                i === idx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
              }`}
              onClick={() => execute(i)}
              onMouseEnter={() => setIdx(i)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{cmd.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── 快捷键参考对话框 ──

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover border rounded-lg shadow-xl p-5 w-[420px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold">{t('coding.keyboardShortcuts', { defaultValue: '快捷键参考' })}</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" title={t('coding.close', { defaultValue: '关闭' })}><X className="h-4 w-4" /></button>
        </div>
        {[
          { section: t('coding.shortcutsEditor', { defaultValue: '编辑器' }), keys: [
            ['⌘ ⇧ P', t('coding.cmdPalette', { defaultValue: '命令面板' })],
            ['⌘ F', t('coding.searchReplace', { defaultValue: '搜索 / 替换' })],
            ['⌘ G', t('coding.gotoLine', { defaultValue: '跳转到行' })],
            ['⌘ Z', t('coding.undo', { defaultValue: '撤销' })],
            ['⌘ ⇧ Z', t('coding.redo', { defaultValue: '重做' })],
            ['⌘ D', t('coding.selectNext', { defaultValue: '选择下一个匹配' })],
            ['⌘ /  ', t('coding.toggleComment', { defaultValue: '切换注释' })],
            ['Tab / ⇧ Tab', t('coding.indentDedent', { defaultValue: '缩进 / 反缩进' })],
          ]},
          { section: t('coding.shortcutsRun', { defaultValue: '运行' }), keys: [
            ['⌘ Enter', t('coding.run', { defaultValue: '运行' })],
            ['⌘ ⇧ Enter', t('coding.runAndScroll', { defaultValue: '运行并滚动到输出' })],
            ['⌘ S', t('coding.save', { defaultValue: '保存' })],
          ]},
        ].map(group => (
          <div key={group.section} className="mb-3">
            <p className="text-sm font-medium text-muted-foreground mb-1.5">{group.section}</p>
            {group.keys.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1 text-sm">
                <span>{desc}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── 标签页右键菜单 ──

interface TabContextMenuProps {
  menu: { x: number; y: number; tabId: string } | null;
  onClose: () => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (keepTabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCopyPath: (tabId: string) => void;
  onRename: (tabId: string) => void;
}

export function TabContextMenu({
  menu, onClose, onCloseTab, onCloseOtherTabs, onCloseTabsToRight, onCopyPath, onRename,
}: TabContextMenuProps) {
  const { t } = useTranslation();
  if (!menu) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px] text-sm"
        style={{ left: menu.x, top: menu.y }}>
        <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
          onClick={() => { onCloseTab(menu.tabId); onClose(); }}>
          {t('coding.closeTab', { defaultValue: '关闭' })}
        </button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
          onClick={() => onCloseOtherTabs(menu.tabId)}>
          {t('coding.closeOtherTabs', { defaultValue: '关闭其他' })}
        </button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
          onClick={() => onCloseTabsToRight(menu.tabId)}>
          {t('coding.closeTabsToRight', { defaultValue: '关闭右侧' })}
        </button>
        <div className="my-1 border-t" />
        <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
          onClick={() => onCopyPath(menu.tabId)}>
          <Copy className="h-3 w-3" />{t('coding.copyPath', { defaultValue: '复制路径' })}
        </button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
          onClick={() => onRename(menu.tabId)}>
          <Pencil className="h-3 w-3" />{t('coding.renameScript', { defaultValue: '重命名' })}
        </button>
      </div>
    </>
  );
}
