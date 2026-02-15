import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import zhTranslation from './locales/zh/translation.json';
import enTranslation from './locales/en/translation.json';
import jaTranslation from './locales/ja/translation.json';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = {
  zh: { name: '中文', flag: '🇨🇳' },
  en: { name: 'English', flag: '🇺🇸' },
  ja: { name: '日本語', flag: '🇯🇵' }
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh';

// Resources
const resources = {
  zh: { translation: zhTranslation },
  en: { translation: enTranslation },
  ja: { translation: jaTranslation }
};

/**
 * 从 zustand settings store (localStorage) 读取用户选择的语言
 * settings store 持久化在 localStorage['aidocplus-settings'] 中
 */
function detectLanguageFromSettings(): SupportedLanguage {
  try {
    const raw = localStorage.getItem('aidocplus-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const lang = parsed?.state?.ui?.language;
      if (lang && lang in SUPPORTED_LANGUAGES) {
        return lang as SupportedLanguage;
      }
    }
  } catch { /* ignore parse errors */ }
  // fallback: check legacy key
  const legacy = localStorage.getItem('aidocplus-language');
  if (legacy && legacy in SUPPORTED_LANGUAGES) {
    return legacy as SupportedLanguage;
  }
  return DEFAULT_LANGUAGE;
}

const detectedLng = detectLanguageFromSettings();

// Initialize i18next
i18n
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    lng: detectedLng,

    interpolation: {
      escapeValue: false // React already escapes values
    },

    react: {
      // Use Suspense to handle loading state
      useSuspense: false
    }
  });

// 同步 aidocplus-language 供直接读 localStorage 的组件使用
localStorage.setItem('aidocplus-language', detectedLng);

/**
 * 切换语言并同步所有存储
 * - 调用 i18n.changeLanguage 实现即时切换
 * - 同步 aidocplus-language localStorage key
 */
export async function changeAppLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  localStorage.setItem('aidocplus-language', lang);
}

export default i18n;
