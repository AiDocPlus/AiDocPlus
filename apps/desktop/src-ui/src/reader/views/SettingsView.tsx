// ── 阅读设置视图 ──

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useReaderStore, READER_THEME_PRESETS, type ReaderThemeConfig } from '../useReaderStore';
import { colors } from '../styles';
import {
  Type, Minus, Plus, AlignVerticalSpaceAround,
  Palette, Monitor, BarChart3,
} from 'lucide-react';
import { ReadingStatsPanel } from '../components/library/ReadingStatsPanel';

type SettingsTab = 'font' | 'layout' | 'theme' | 'shortcuts' | 'stats';

const SETTINGS_TABS: { id: SettingsTab; icon: React.ElementType; labelKey: string; labelDefault: string }[] = [
  { id: 'font', icon: Type, labelKey: 'reader.font', labelDefault: '字体排版' },
  { id: 'layout', icon: AlignVerticalSpaceAround, labelKey: 'reader.layout', labelDefault: '显示设置' },
  { id: 'theme', icon: Palette, labelKey: 'reader.theme', labelDefault: '主题配色' },
  { id: 'shortcuts', icon: Monitor, labelKey: 'reader.shortcuts', labelDefault: '快捷键' },
  { id: 'stats', icon: BarChart3, labelKey: 'reader.stats', labelDefault: '阅读统计' },
];

const FONT_OPTIONS = [
  { value: 'system', labelKey: 'reader.fontSystem', sample: 'Aa \u7CFB\u7EDF\u9ED8\u8BA4', default: '\u7CFB\u7EDF\u9ED8\u8BA4' },
  { value: 'sans', labelKey: 'reader.fontSans', sample: 'Aa \u9ED1\u4F53', default: '\u9ED1\u4F53' },
  { value: 'serif', labelKey: 'reader.fontSerif', sample: 'Aa \u5B8B\u4F53', default: '\u5B8B\u4F53' },
  { value: 'kai', labelKey: 'reader.fontKai', sample: 'Aa \u6977\u4F53', default: '\u6977\u4F53' },
] as const;

const FONT_STACKS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sans: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  serif: '"Songti SC", "SimSun", "STSong", Georgia, serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", serif',
};

const SHORTCUTS = [
  { keys: ['F'], actionKey: 'reader.fullscreen' },
  { keys: ['\u2318', '='], actionKey: 'reader.increaseFont' },
  { keys: ['\u2318', '-'], actionKey: 'reader.decreaseFont' },
  { keys: ['\u2318', 'B'], actionKey: 'reader.toggleSidebar' },
];

export function SettingsView() {
  const { t } = useTranslation();
  const {
    fontSize, setFontSize, fontFamily, setFontFamily,
    lineHeight, setLineHeight, paragraphSpacing, setParagraphSpacing,
    contentWidth, setContentWidth, theme, setTheme,
  } = useReaderStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('font');
  const [showCustom, setShowCustom] = useState(false);
  const [customTheme, setCustomTheme] = useState<ReaderThemeConfig>(theme);

  // 外部切换主题时同步 customTheme（例如通过 ReadingView 的主题选择器）
  useEffect(() => {
    setCustomTheme(theme);
  }, [theme]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 左侧 Tab 导航 */}
      <div style={{
        width: 160, flexShrink: 0, borderRight: `1px solid ${colors.borderMain}`,
        background: colors.bgAlt, paddingTop: 8,
      }}>
        {SETTINGS_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? colors.primaryText : colors.textMuted,
                borderLeft: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              <Icon size={16} />
              <span style={{ fontSize: 13 }}>{t(tab.labelKey, { defaultValue: tab.labelDefault })}</span>
            </button>
          );
        })}
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'font' && (
          <>
            {/* 字体大小 */}
            <SettingsSection label={t('reader.fontSize', { defaultValue: '字体大小' })}>
              <SliderControl value={fontSize} min={12} max={32} step={1} onChange={v => setFontSize(v)} />
            </SettingsSection>
            {/* 字体选择 */}
            <SettingsSection label={t('reader.fontFamily', { defaultValue: '字体' })}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FONT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFontFamily(opt.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 2, padding: '10px 12px', borderRadius: 6,
                      border: `1px solid ${fontFamily === opt.value ? colors.primary : colors.borderMain}`,
                      background: fontFamily === opt.value ? colors.primaryLight : 'transparent',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1.4, fontFamily: FONT_STACKS[opt.value] }}>{opt.sample}</span>
                    <span style={{ fontSize: 10, color: colors.textMuted }}>{t(opt.labelKey, { defaultValue: opt.default })}</span>
                  </button>
                ))}
              </div>
            </SettingsSection>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <SettingsSection label={t('reader.lineHeight', { defaultValue: '行距' })}>
              <SliderControl value={lineHeight} min={1.2} max={3} step={0.1} onChange={v => setLineHeight(v)} suffix="" />
            </SettingsSection>
            <SettingsSection label={t('reader.paragraphSpacing', { defaultValue: '段间距' })}>
              <SliderControl value={paragraphSpacing} min={0} max={3} step={0.2} onChange={v => setParagraphSpacing(v)} suffix="em" />
            </SettingsSection>
            <SettingsSection label={t('reader.contentWidth', { defaultValue: '内容宽度' })}>
              <SliderControl value={contentWidth} min={500} max={1200} step={50} onChange={v => setContentWidth(v)} />
            </SettingsSection>
          </>
        )}

        {activeTab === 'theme' && (
          <div>
            {/* 预设主题 */}
            <SettingsSection label={t('reader.theme', { defaultValue: '主题' })}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {READER_THEME_PRESETS.map(preset => (
                  <ThemeSwatch key={preset.id} theme={preset} active={theme.id === preset.id && !showCustom}
                    onClick={() => { setTheme(preset); setShowCustom(false); }} />
                ))}
              </div>
              <button
                onClick={() => { setCustomTheme(theme); setShowCustom(!showCustom); }}
                style={{
                  marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '8px', borderRadius: 6,
                  border: `1px solid ${showCustom ? colors.primary : colors.borderMain}`,
                  background: showCustom ? colors.primaryLight : 'transparent',
                  color: showCustom ? colors.primaryText : colors.textMuted,
                  cursor: 'pointer', fontSize: 12, transition: 'all 0.1s',
                }}
              >
                <Palette size={14} />{t('reader.customTheme', { defaultValue: '自定义配色' })}
              </button>
              {/* 自定义面板 */}
              {showCustom && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 6, border: `1px solid ${colors.borderMain}`, background: colors.bgAlt }}>
                  <ColorRow label={t('reader.themeBg', { defaultValue: '背景' })} value={customTheme.bg} onChange={v => setCustomTheme({ ...customTheme, bg: v, mode: isDarkColor(v) ? 'dark' as const : 'light' as const })} />
                  <ColorRow label={t('reader.themeText', { defaultValue: '正文' })} value={customTheme.text} onChange={v => setCustomTheme({ ...customTheme, text: v })} />
                  <ColorRow label={t('reader.themeHeading', { defaultValue: '标题' })} value={customTheme.heading} onChange={v => setCustomTheme({ ...customTheme, heading: v })} />
                  <ColorRow label={t('reader.themeAccent', { defaultValue: '链接' })} value={customTheme.accent} onChange={v => setCustomTheme({ ...customTheme, accent: v })} />
                  <ColorRow label={t('reader.themeCodeBg', { defaultValue: '代码背景' })} value={customTheme.codeBg} onChange={v => setCustomTheme({ ...customTheme, codeBg: v })} />
                  {/* 预览 */}
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 4, background: customTheme.bg, color: customTheme.text }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: customTheme.heading }}>{t('reader.previewTitle', { defaultValue: '标题预览 Heading' })}</p>
                    <p style={{ fontSize: 11, opacity: 0.8 }}>{t('reader.previewBody', { defaultValue: '正文预览段落，包含' })} <span style={{ color: customTheme.accent }}>{t('reader.previewLink', { defaultValue: '链接文字' })}</span> {t('reader.previewAndNormal', { defaultValue: '和普通文字。' })}</p>
                    <p style={{ fontSize: 11, opacity: 0.6 }}>{t('reader.themeMuted', { defaultValue: '辅助文字颜色' })}</p>
                  </div>
                  <button onClick={() => { setTheme(customTheme); setShowCustom(false); }}
                    style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 4, border: 'none', background: colors.primary, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    {t('reader.applyTheme', { defaultValue: '应用' })}
                  </button>
                </div>
              )}
            </SettingsSection>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <SettingsSection label={t('reader.shortcuts', { defaultValue: '快捷键' })}>
            {SHORTCUTS.map(shortcut => (
              <div key={shortcut.actionKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: 13, color: colors.textMuted }}>
                  {t(shortcut.actionKey, { defaultValue: shortcut.actionKey })}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {shortcut.keys.map(key => (
                    <kbd key={key} style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      height: 22, minWidth: 22, padding: '0 6px', borderRadius: 3,
                      fontSize: 10, fontFamily: 'monospace',
                      border: `1px solid ${colors.borderMain}`, background: colors.bgAlt, color: colors.textMuted,
                    }}>
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </SettingsSection>
        )}

        {activeTab === 'stats' && (
          <SettingsSection label={t('reader.readingStats', { defaultValue: '阅读统计' })}>
            <ReadingStatsPanel />
          </SettingsSection>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: colors.textMuted, marginBottom: 10 }}>{label}</h3>
      {children}
    </div>
  );
}

function SliderControl({ value, min, max, step, onChange, suffix }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(value - step)} disabled={value <= min}
        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, cursor: value <= min ? 'default' : 'pointer', background: 'transparent', color: '#64748b' }}>
        <Minus size={14} />
      </button>
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, height: 4, appearance: 'none' as const, background: `linear-gradient(to right, ${colors.primary} ${value / max * 100}%, ${colors.borderLight} ${value / max * 100}%)`, borderRadius: 2, outline: 'none' }}
      />
      <button onClick={() => onChange(value + step)} disabled={value >= max}
        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, cursor: value >= max ? 'default' : 'pointer', background: 'transparent', color: '#64748b' }}>
        <Plus size={14} />
      </button>
      <span style={{ fontSize: 12, color: colors.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>
        {Math.round(value * 100) / 100}{suffix}
      </span>
    </div>
  );
}

function ThemeSwatch({ theme, active, onClick }: { theme: ReaderThemeConfig; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${active ? colors.primary : hovered ? 'rgba(59,130,246,0.3)' : colors.borderMain}`,
        borderRadius: 6, cursor: 'pointer', padding: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ width: '100%', height: 36, borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', background: theme.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 6px', gap: 2 }}>
        <div style={{ height: 4, width: 24, borderRadius: 2, background: theme.heading }} />
        <div style={{ height: 3, width: '100%', borderRadius: 1, opacity: 0.6, background: theme.text }} />
        <div style={{ height: 3, width: '75%', borderRadius: 1, opacity: 0.35, background: theme.text }} />
      </div>
      <span style={{ fontSize: 10, lineHeight: 1.2, color: hovered || active ? colors.textPrimary : colors.textMuted }}>{t(theme.nameKey || '', { defaultValue: theme.name })}</span>
    </button>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: colors.textMuted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 24, height: 24, borderRadius: 3, border: `1px solid ${colors.borderMain}`, cursor: 'pointer', padding: 0, background: 'transparent' }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: colors.textMuted, width: 62, textAlign: 'right' }}>{value}</span>
      </div>
    </div>
  );
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}
