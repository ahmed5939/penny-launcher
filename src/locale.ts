import i18n, { use } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { defaultAppLanguage } from './config/constants/settings'

import { lazyResourcesBackend } from './locales/backend'
import {
  Language,
  defaultNamespace,
  namespaces,
} from './locales/resources'

/**
 * Resolves once the starting language is in memory. `app.tsx` waits on this
 * before the first render, so nothing ever paints a raw translation key.
 *
 * Switching language later goes through the same backend: i18next fetches the
 * new chunks and only then emits `languageChanged`, so the UI swaps in one go
 * rather than flashing untranslated strings.
 */
export const localeReady = use(lazyResourcesBackend)
  .use(initReactI18next)
  .init({
    lng: defaultAppLanguage,
    fallbackLng: Language.English,
    ns: [...namespaces],
    defaultNS: defaultNamespace,
    react: {
      useSuspense: false,
    },
  })

export { i18n }
