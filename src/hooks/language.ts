import { useLanguageStore } from '../state/settings/language'

export function useLanguage() {
  const language = useLanguageStore((state) => state.language)
  const updateLanguage = useLanguageStore((state) => state.updateLanguage)

  return { language, updateLanguage }
}

export function useGetAppLanguage() {
  return useLanguageStore((state) => state.language)
}
