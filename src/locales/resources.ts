/**
 * Language catalogue.
 *
 * Translation JSON is deliberately NOT imported here. This module is pulled
 * in by the main process as well (for the `Language` enum alone), and the
 * renderer now loads locale data lazily through `./backend`, so only the
 * active language is ever downloaded and parsed.
 */

export enum Language {
  English = 'en-US',
  Spanish = 'es-419',
  Chinese = 'zh-CN',
  Russian = 'ru-RU',
  Portuguese = 'pt-BR',
  Polish = 'pl-PL',
  Italian = 'it-IT',
}

/**
 * Every namespace the app passes to `useTranslation`. Listed explicitly so
 * i18next preloads exactly these before the first render — otherwise a
 * component can paint a raw translation key while its namespace loads.
 */
export const namespaces = [
  'general',
  'sidebar',
  'history',
  'settings',
  'alerts',
  'zones',
  'stw-operations',
  'account-management',
  'advanced-mode',
  'accounts',
] as const

export const defaultNamespace = 'general'
