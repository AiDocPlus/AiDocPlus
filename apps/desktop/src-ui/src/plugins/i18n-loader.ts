import i18n from '@/i18n';

/**
 * 注册插件翻译资源到 i18next 命名空间
 * 每个插件自带翻译文件，通过此函数注册到全局 i18n 实例
 *
 * @param namespace - 命名空间，如 'plugin-summary'
 * @param translations - { zh: {...}, en: {...}, ja: {...} }
 */
export function registerPluginI18n(
  namespace: string,
  translations: Record<string, Record<string, unknown>>
): void {
  for (const [lang, resources] of Object.entries(translations)) {
    i18n.addResourceBundle(lang, namespace, resources, true, true);
  }
}
