// ── 电子书阅读器统一样式常量（主题感知） ──

import type { ReaderThemeConfig } from './useReaderStore';

export type ReaderView = 'library' | 'reading' | 'settings';

// ── 主题感知颜色 ──
function buildColors(mode: 'light' | 'dark' | string) {
  const dark = mode === 'dark';
  return {
    primary: '#3b82f6',
    primaryLight: dark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
    primaryText: '#2563eb',
    danger: '#dc2626',
    dangerBg: dark ? 'rgba(220,38,38,0.15)' : '#fee2e2',
    success: '#16a34a',
    successBg: dark ? 'rgba(22,163,74,0.15)' : '#dcfce7',
    warning: '#f59e0b',
    warningBg: dark ? 'rgba(245,158,11,0.15)' : '#fef3c7',

    navBg: dark ? '#0f172a' : '#1e293b',
    navActive: dark ? '#1e293b' : '#334155',
    navHover: dark ? '#1e293b' : '#2a3a50',
    navIcon: '#60a5fa',
    navMuted: '#94a3b8',

    bg: dark ? '#0f172a' : '#f8f9fa',
    bgAlt: dark ? '#1e293b' : '#fafafa',
    bgCard: dark ? '#1e293b' : '#ffffff',
    textPrimary: dark ? '#e2e8f0' : '#1e293b',
    textSecondary: dark ? '#cbd5e1' : '#334155',
    textMuted: dark ? '#94a3b8' : '#64748b',
    textPlaceholder: '#94a3b8',
    borderMain: dark ? '#334155' : '#e2e8f0',
    borderLight: dark ? '#1e293b' : '#f1f5f9',

    btnBg: dark ? '#334155' : '#ffffff',
    ctxMenuBg: dark ? '#1e293b' : '#ffffff',
    dialogBg: dark ? '#1e293b' : '#ffffff',
    scrollbarThumb: dark ? '#475569' : '#cbd5e1',
    hoverBg: dark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
  } as const;
}

export type ReaderColors = ReturnType<typeof buildColors>;

// ── 模块级可变引用：ReaderApp 切换主题时调用 applyTheme() 更新 ──

let _colors = buildColors('light');
let _S = buildS(_colors);

/** 应用主题，更新模块级的 colors 和 S（供 ReaderApp 调用） */
export function applyTheme(theme: ReaderThemeConfig) {
  _colors = buildColors(theme.mode);
  _S = buildS(_colors);
}

/** 获取当前主题感知颜色 */
export function getThemeColors(): ReaderColors {
  return _colors;
}

/** 获取当前主题感知样式 */
export function getThemeS(): ReturnType<typeof buildS> {
  return _S;
}

// ── 样式工厂 ──
function buildS(c: ReaderColors) {
  const { textPrimary, textSecondary, textMuted, borderMain, bgAlt } = c;

  return {
    nav: {
      width: 60,
      minWidth: 60,
      backgroundColor: c.navBg,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      paddingTop: 8,
      gap: 2,
    },
    navButton: (active: boolean): React.CSSProperties => ({
      width: 48,
      height: 48,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      backgroundColor: active ? c.navActive : 'transparent',
      color: active ? c.navIcon : c.navMuted,
      transition: 'all 0.15s',
    }),

    statusBar: {
      height: 28,
      minHeight: 28,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      backgroundColor: c.navBg,
      color: c.navMuted,
      fontSize: 12,
      gap: 16,
    },

    btn: (opts?: { primary?: boolean; danger?: boolean; small?: boolean; active?: boolean }): React.CSSProperties => {
      const { primary, danger, small, active } = opts ?? {};
      return {
        padding: small ? '3px 10px' : '5px 14px',
        borderRadius: 4,
        border: primary ? 'none' : danger ? '1px solid #fca5a5' : active ? `1px solid ${c.primary}` : `1px solid ${borderMain}`,
        cursor: 'pointer',
        fontSize: small ? 12 : 13,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: danger ? c.dangerBg : primary ? c.primary : active ? c.primaryLight : c.btnBg,
        color: danger ? c.danger : primary ? '#fff' : active ? c.primaryText : textSecondary,
        transition: 'all 0.1s',
      };
    },
    iconBtn: (active?: boolean): React.CSSProperties => ({
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      background: active ? c.primaryLight : 'transparent',
      color: active ? c.primaryText : c.textMuted,
      transition: 'all 0.1s',
    }),

    input: {
      width: '100%',
      padding: '6px 10px',
      border: `1px solid ${borderMain}`,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      outline: 'none',
      color: textSecondary,
      backgroundColor: c.btnBg,
      boxSizing: 'border-box' as const,
    },

    header: {
      padding: '10px 14px',
      borderBottom: `1px solid ${borderMain}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: bgAlt,
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: 600,
      color: textPrimary,
      flex: 1,
    },
    headerSubtitle: {
      fontSize: 13,
      color: textMuted,
    },

    ctxMenu: {
      minWidth: '10rem',
      borderRadius: 6,
      border: `1px solid ${borderMain}`,
      padding: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      background: c.ctxMenuBg,
      position: 'fixed' as const,
      zIndex: 9999,
    },
    ctxMenuItem: (danger?: boolean): React.CSSProperties => ({
      display: 'flex',
      width: '100%',
      alignItems: 'center',
      gap: 8,
      borderRadius: 4,
      padding: '6px 10px',
      fontSize: 13,
      cursor: 'pointer',
      color: danger ? c.danger : textSecondary,
      border: 'none',
      background: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }),
    ctxMenuSep: {
      height: 1,
      background: borderMain,
      margin: '4px 8px',
    },

    titleText: { fontSize: 15, fontWeight: 600 as const, color: textPrimary },

    divider: { borderTop: `1px solid ${borderMain}`, margin: '12px 0' },
    vdivider: { borderLeft: `1px solid ${borderMain}` },

    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    },
    dialog: {
      background: c.dialogBg,
      borderRadius: 8,
      border: `1px solid ${borderMain}`,
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      minWidth: 400,
      maxWidth: 600,
    },
    dialogHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${borderMain}`,
    },
    dialogBody: {
      padding: '16px',
    },

    scrollContainer: {
      overflowY: 'auto' as const,
      scrollbarWidth: 'thin' as const,
      scrollbarColor: `${c.scrollbarThumb} transparent`,
    },

    colors: c,
  };
}

/** 向后兼容：S 和 colors 是可变对象的属性，始终指向最新主题值 */
export const S: typeof _S = new Proxy({} as typeof _S, {
  get(_, prop) {
    return (_S as any)[prop];
  },
  set() { return true; },
  has(_, prop) {
    return prop in _S;
  },
  ownKeys() {
    return Object.keys(_S);
  },
  getOwnPropertyDescriptor(_, prop) {
    return Object.getOwnPropertyDescriptor(_S, prop);
  },
});

export const colors: ReaderColors = new Proxy({} as ReaderColors, {
  get(_, prop) {
    return (_colors as any)[prop];
  },
  set() { return true; },
  has(_, prop) {
    return prop in _colors;
  },
  ownKeys() {
    return Object.keys(_colors);
  },
  getOwnPropertyDescriptor(_, prop) {
    return Object.getOwnPropertyDescriptor(_colors, prop);
  },
});
