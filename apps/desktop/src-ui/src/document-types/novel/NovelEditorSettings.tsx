/**
 * NovelEditorSettings — 编辑器外观设置弹窗
 *
 * Popover：字号/行距/编辑区宽度/字体/背景预设
 * 持久化到 host.storage
 */
import { useState, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/i18n';

const STORAGE_KEY = '_novel_editor_appearance';

export interface EditorAppearance {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  textIndent: boolean;
  fontFamily: 'songti' | 'kaiti' | 'fangsong';
  bgPreset: 'default' | 'sepia' | 'dark' | 'green' | 'blue';
}

export const DEFAULT_APPEARANCE: EditorAppearance = {
  fontSize: 16, lineHeight: 1.8, maxWidth: 100, textIndent: true,
  fontFamily: 'songti', bgPreset: 'default',
};

const FONT_OPTIONS = [
  { value: 'songti' as const, label: '宋体', css: "'宋体', 'SimSun', serif" },
  { value: 'kaiti' as const, label: '楷体', css: "'楷体', 'KaiTi', serif" },
  { value: 'fangsong' as const, label: '仿宋', css: "'仿宋', 'FangSong', serif" },
];

const BG_PRESETS = [
  { value: 'default' as const, label: '默认', bg: 'transparent', text: '' },
  { value: 'sepia' as const, label: '羊皮纸', bg: '#fdf6e3', text: '#5c4b37' },
  { value: 'dark' as const, label: '暗黑', bg: '#1a1a2e', text: '#e0e0e0' },
  { value: 'green' as const, label: '护眼', bg: '#c8edcc', text: '#2d3e2d' },
  { value: 'blue' as const, label: '夜蓝', bg: '#1e293b', text: '#cbd5e1' },
];

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

export function loadAppearance(storage: StorageLike): EditorAppearance {
  return storage.get<EditorAppearance>(STORAGE_KEY) || DEFAULT_APPEARANCE;
}

export function saveAppearance(storage: StorageLike, appearance: EditorAppearance) {
  storage.set(STORAGE_KEY, appearance);
}

/**
 * 外层容器样式（字体、颜色、背景等）
 * 注意：maxWidth 不在这里应用，由 getEditorInnerStyle 控制
 */
export function getAppearanceStyle(appearance: EditorAppearance): React.CSSProperties {
  const font = FONT_OPTIONS.find(f => f.value === appearance.fontFamily);
  const bg = BG_PRESETS.find(b => b.value === appearance.bgPreset);
  const fontCss = font?.css || FONT_OPTIONS[0].css;
  const hasBg = bg && bg.bg !== 'transparent';
  return {
    '--novel-font-family': fontCss,
    '--novel-font-size': `${appearance.fontSize}px`,
    '--novel-line-height': String(appearance.lineHeight),
    '--novel-text-indent': appearance.textIndent ? '2em' : '0',
    // CodeMirror CSS 变量（穿透到编辑器内部）
    '--cm-font-size': `${appearance.fontSize}px`,
    '--cm-font-family': fontCss,
    '--cm-line-height': String(appearance.lineHeight),
    '--cm-text-indent': appearance.textIndent ? '2em' : '0',
    ...(hasBg ? { '--cm-bg-color': bg.bg, '--cm-text-color': bg.text } : {}),
    fontSize: `${appearance.fontSize}px`,
    lineHeight: appearance.lineHeight,
    fontFamily: fontCss,
    // textIndent 由 CodeMirror textIndentPlugin (Widget Decoration) 控制，不再使用 CSS text-indent
    ...(hasBg ? { backgroundColor: bg.bg, color: bg.text } : {}),
  } as React.CSSProperties;
}

/**
 * 编辑器内层包裹 div 样式（控制编辑区宽度）
 * maxWidth 百分比相对于父容器（中栏全宽）
 */
export function getEditorInnerStyle(appearance: EditorAppearance): React.CSSProperties {
  const mw = appearance.maxWidth ?? 100;
  if (mw >= 100) return { width: '100%', height: '100%' };
  return { maxWidth: `${mw}%`, margin: '0 auto', width: '100%', height: '100%' };
}

interface NovelEditorSettingsProps {
  storage: StorageLike;
  appearance: EditorAppearance;
  onAppearanceChange: (appearance: EditorAppearance) => void;
}

export default function NovelEditorSettings({ storage, appearance, onAppearanceChange }: NovelEditorSettingsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const update = useCallback((patch: Partial<EditorAppearance>) => {
    const updated = { ...appearance, ...patch };
    onAppearanceChange(updated);
    saveAppearance(storage, updated);
  }, [appearance, onAppearanceChange, storage]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-5 w-5"
          title={t('novel.editorSettings', { defaultValue: '编辑器外观' })}>
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3 space-y-3" align="end" style={{ fontFamily: "'宋体', 'SimSun', serif", fontSize: '14px' }}>
        <p className="text-xs font-medium text-muted-foreground">{t('novel.editorAppearance', { defaultValue: '编辑器外观' })}</p>

        {/* 字号 */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">{t('novel.fontSize', { defaultValue: '字号' })} {appearance.fontSize}px</label>
          <input type="range" min={14} max={24} step={1} value={appearance.fontSize}
            onChange={e => update({ fontSize: parseInt(e.target.value) })}
            className="w-full h-1 accent-primary" />
        </div>

        {/* 行距 */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">{t('novel.lineHeight', { defaultValue: '行距' })} {appearance.lineHeight}</label>
          <input type="range" min={1.2} max={2.5} step={0.1} value={appearance.lineHeight}
            onChange={e => update({ lineHeight: parseFloat(e.target.value) })}
            className="w-full h-1 accent-primary" />
        </div>

        {/* 编辑区宽度 */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">{t('novel.editorWidth', { defaultValue: '编辑区宽度' })} {appearance.maxWidth ?? 100}%</label>
          <input type="range" min={60} max={100} step={5} value={appearance.maxWidth ?? 100}
            onChange={e => update({ maxWidth: parseInt(e.target.value) })}
            className="w-full h-1 accent-primary" />
        </div>

        {/* 首行缩进 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={appearance.textIndent ?? true}
            onChange={e => update({ textIndent: e.target.checked })}
            className="rounded border-border" />
          <span className="text-[11px] text-muted-foreground">{t('novel.textIndent', { defaultValue: '首行缩进两个汉字' })}</span>
        </label>

        {/* 字体 */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">{t('novel.fontFamily', { defaultValue: '字体' })}</label>
          <div className="flex gap-1">
            {FONT_OPTIONS.map(f => (
              <button key={f.value}
                className={`flex-1 text-xs px-2 py-1 rounded border transition-colors ${appearance.fontFamily === f.value ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-accent'}`}
                style={{ fontFamily: f.css }}
                onClick={() => update({ fontFamily: f.value })}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 背景色 */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">{t('novel.bgPreset', { defaultValue: '背景' })}</label>
          <div className="flex gap-1">
            {BG_PRESETS.map(b => (
              <button key={b.value}
                className={`flex-1 text-[10px] px-1 py-1 rounded border transition-colors ${appearance.bgPreset === b.value ? 'ring-1 ring-primary' : ''}`}
                style={{ backgroundColor: b.bg === 'transparent' ? undefined : b.bg, color: b.text || undefined }}
                onClick={() => update({ bgPreset: b.value })}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
