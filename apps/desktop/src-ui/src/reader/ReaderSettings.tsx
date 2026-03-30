import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useReaderStore, READER_THEME_PRESETS, type ReaderThemeConfig } from './useReaderStore';
import { X, Type, Minus, Plus, AlignVerticalSpaceAround, RectangleHorizontal, CaseSensitive, Palette } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface ReaderSettingsProps {
  onClose: () => void;
}

const FONT_OPTIONS = [
  { value: 'system', labelKey: 'reader.fontSystem', sample: 'Aa 系统默认' },
  { value: 'sans', labelKey: 'reader.fontSans', sample: 'Aa 黑体' },
  { value: 'serif', labelKey: 'reader.fontSerif', sample: 'Aa 宋体' },
  { value: 'kai', labelKey: 'reader.fontKai', sample: 'Aa 楷体' },
] as const;

const SHORTCUTS = [
  { keys: ['F'], actionKey: 'reader.fullscreen' },
  { keys: ['⌘', '='], actionKey: 'reader.increaseFont' },
  { keys: ['⌘', '-'], actionKey: 'reader.decreaseFont' },
  { keys: ['⌘', 'B'], actionKey: 'reader.toggleSidebar' },
];

const FONT_STACKS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sans: '"PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "SimSun", Georgia, serif',
  kai: '"Kaiti SC", "STKaiti", serif',
};

function ThemeSwatch({ theme, active, onClick }: { theme: ReaderThemeConfig; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border transition-all duration-150 ${
        active ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border hover:border-primary/30'
      }`}
      title={theme.name}
    >
      {/* 预览卡片 */}
      <div
        className="w-full h-9 rounded-md overflow-hidden shadow-sm flex flex-col justify-center px-1.5 py-1 gap-px"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="h-1 w-6 rounded-sm" style={{ backgroundColor: theme.heading }} />
        <div className="h-0.5 w-full rounded-sm opacity-60" style={{ backgroundColor: theme.text }} />
        <div className="h-0.5 w-3/4 rounded-sm opacity-40" style={{ backgroundColor: theme.text }} />
      </div>
      <span className={`text-[10px] leading-tight ${hovered || active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {theme.name}
      </span>
    </button>
  );
}

export function ReaderSettings({ onClose }: ReaderSettingsProps) {
  const { t } = useTranslation();
  const {
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    lineHeight, setLineHeight,
    paragraphSpacing, setParagraphSpacing,
    contentWidth, setContentWidth,
    theme, setTheme,
  } = useReaderStore();
  const [showCustom, setShowCustom] = useState(false);
  const [customTheme, setCustomTheme] = useState<ReaderThemeConfig>(theme);

  const handleCustomApply = () => {
    setTheme(customTheme);
    setShowCustom(false);
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">{t('reader.settings', { defaultValue: '阅读设置' })}</span>
        <button onClick={onClose} className="reader-renderer-btn">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 reader-scroll">
        {/* 字体大小 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3 text-muted-foreground">
            <Type className="h-3.5 w-3.5" />
            {t('reader.fontSize', { defaultValue: '字体大小' })}
          </label>
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setFontSize(fontSize - 2)} disabled={fontSize <= 12} className="reader-renderer-btn">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={12} max={32} step={1} className="flex-1" />
            <button onClick={() => setFontSize(fontSize + 2)} disabled={fontSize >= 32} className="reader-renderer-btn">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 font-mono tabular-nums">{fontSize}px</p>
        </section>

        {/* 字体选择 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3 text-muted-foreground">
            <CaseSensitive className="h-3.5 w-3.5" />
            {t('reader.fontFamily', { defaultValue: '字体' })}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFontFamily(opt.value)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left ${
                  fontFamily === opt.value
                    ? 'border-primary ring-2 ring-primary/30 shadow-sm'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <span className="text-base leading-snug" style={{ fontFamily: FONT_STACKS[opt.value] }}>{opt.sample}</span>
                <span className="text-[10px] text-muted-foreground">{t(opt.labelKey, { defaultValue: opt.sample })}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 行距 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3 text-muted-foreground">
            <AlignVerticalSpaceAround className="h-3.5 w-3.5" />
            {t('reader.lineHeight', { defaultValue: '行距' })}
          </label>
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setLineHeight(lineHeight - 0.1)} disabled={lineHeight <= 1.2} className="reader-renderer-btn">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Slider value={[lineHeight]} onValueChange={([v]) => setLineHeight(v)} min={1.2} max={3} step={0.1} className="flex-1" />
            <button onClick={() => setLineHeight(lineHeight + 0.1)} disabled={lineHeight >= 3} className="reader-renderer-btn">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 font-mono tabular-nums">{lineHeight.toFixed(1)}</p>
        </section>

        {/* 段间距 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3 text-muted-foreground">
            <AlignVerticalSpaceAround className="h-3.5 w-3.5" />
            {t('reader.paragraphSpacing', { defaultValue: '段间距' })}
          </label>
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setParagraphSpacing(paragraphSpacing - 0.2)} disabled={paragraphSpacing <= 0} className="reader-renderer-btn">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Slider value={[paragraphSpacing]} onValueChange={([v]) => setParagraphSpacing(v)} min={0} max={3} step={0.2} className="flex-1" />
            <button onClick={() => setParagraphSpacing(paragraphSpacing + 0.2)} disabled={paragraphSpacing >= 3} className="reader-renderer-btn">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 font-mono tabular-nums">{paragraphSpacing.toFixed(1)}em</p>
        </section>

        {/* 内容宽度 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-3 text-muted-foreground">
            <RectangleHorizontal className="h-3.5 w-3.5" />
            {t('reader.contentWidth', { defaultValue: '内容宽度' })}
          </label>
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setContentWidth(contentWidth - 50)} disabled={contentWidth <= 500} className="reader-renderer-btn">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Slider value={[contentWidth]} onValueChange={([v]) => setContentWidth(v)} min={500} max={1200} step={50} className="flex-1" />
            <button onClick={() => setContentWidth(contentWidth + 50)} disabled={contentWidth >= 1200} className="reader-renderer-btn">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2 font-mono tabular-nums">{contentWidth}px</p>
        </section>

        {/* 主题选择 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider mb-3 block text-muted-foreground">
            {t('reader.theme', { defaultValue: '主题' })}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {READER_THEME_PRESETS.map((preset) => (
              <ThemeSwatch
                key={preset.id}
                theme={preset}
                active={theme.id === preset.id && !showCustom}
                onClick={() => { setTheme(preset); setShowCustom(false); }}
              />
            ))}
          </div>

          {/* 自定义主题 */}
          <button
            onClick={() => {
              setCustomTheme(theme);
              setShowCustom(!showCustom);
            }}
            className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all duration-150 ${
              showCustom ? 'border-primary ring-2 ring-primary/30 text-primary' : 'border-border hover:border-primary/30 text-muted-foreground'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            {t('reader.customTheme', { defaultValue: '自定义配色' })}
          </button>

          {showCustom && (
            <div className="mt-3 space-y-3 p-3 rounded-lg border border-border bg-muted/30">
              <ColorRow label={t('reader.themeBg', { defaultValue: '背景' })} value={customTheme.bg} onChange={v => setCustomTheme({ ...customTheme, bg: v, mode: isDarkColor(v) ? 'dark' : 'light' })} />
              <ColorRow label={t('reader.themeText', { defaultValue: '正文' })} value={customTheme.text} onChange={v => setCustomTheme({ ...customTheme, text: v })} />
              <ColorRow label={t('reader.themeHeading', { defaultValue: '标题' })} value={customTheme.heading} onChange={v => setCustomTheme({ ...customTheme, heading: v })} />
              <ColorRow label={t('reader.themeAccent', { defaultValue: '链接' })} value={customTheme.accent} onChange={v => setCustomTheme({ ...customTheme, accent: v })} />
              <ColorRow label={t('reader.themeCodeBg', { defaultValue: '代码背景' })} value={customTheme.codeBg} onChange={v => setCustomTheme({ ...customTheme, codeBg: v })} />
              {/* 预览 */}
              <div
                className="rounded-md px-3 py-2 space-y-1"
                style={{ backgroundColor: customTheme.bg, color: customTheme.text }}
              >
                <p className="text-xs font-bold" style={{ color: customTheme.heading }}>标题预览 Heading</p>
                <p className="text-[10px] opacity-80">正文预览段落，包含 <span style={{ color: customTheme.accent }}>链接文字</span> 和普通文字。</p>
                <p className="text-[10px] opacity-60">{t('reader.themeMuted', { defaultValue: '辅助文字颜色' })}</p>
              </div>
              <button onClick={handleCustomApply} className="w-full text-xs font-medium py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                {t('reader.applyTheme', { defaultValue: '应用' })}
              </button>
            </div>
          )}
        </section>

        {/* 快捷键 */}
        <section>
          <label className="text-xs font-medium uppercase tracking-wider mb-3 block text-muted-foreground">
            {t('reader.shortcuts', { defaultValue: '快捷键' })}
          </label>
          <div className="space-y-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.actionKey} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t(shortcut.actionKey, { defaultValue: shortcut.actionKey })}
                </span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd key={key} className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-mono rounded border border-border bg-muted text-muted-foreground">
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* 颜色选择行 */
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-border cursor-pointer p-0 bg-transparent"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-[62px] text-right">{value}</span>
      </div>
    </div>
  );
}

/** 判断颜色是否为深色（用于自动切换 mode） */
function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}
