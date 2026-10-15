import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

import enHome from './en-US/home.json'
import esHome from './es-419/home.json'
import itHome from './it-IT/home.json'
import plHome from './pl-PL/home.json'
import ptHome from './pt-BR/home.json'
import ruHome from './ru-RU/home.json'
import zhHome from './zh-CN/home.json'

async function alertsTranslator(lng: string, home: object) {
  const i18n = createInstance()

  await i18n.init({
    lng,
    fallbackLng: 'en-US',
    interpolation: { escapeValue: false },
    resources: {
      'en-US': { alerts: enHome },
      [lng]: { alerts: home },
    },
    ns: ['alerts'],
    defaultNS: 'alerts',
  })

  return i18n.getFixedT(lng, 'alerts')
}

const counts = [...Array(26).keys(), 100]

const localeFiles = {
  'es-419': esHome,
  'it-IT': itHome,
  'pl-PL': plHome,
  'pt-BR': ptHome,
  'ru-RU': ruHome,
  'zh-CN': zhHome,
} as const

describe('mission count plurals in the real locale files', () => {
  it('resolves Polish counts to the Polish string, not English', async () => {
    const t = await alertsTranslator('pl-PL', plHome)
    const english = await alertsTranslator('en-US', enHome)

    expect(t('information.missions', { count: 2 })).toBe('2 misji')
    expect(t('information.missions', { count: 5 })).toBe('5 misji')
    expect(english('information.missions', { count: 5 })).toBe('5 missions')
  })

  it('resolves Russian counts to the Russian string, not English', async () => {
    const t = await alertsTranslator('ru-RU', ruHome)
    const english = await alertsTranslator('en-US', enHome)

    expect(t('information.missions', { count: 2 })).toBe('2 миссий')
    expect(t('information.missions', { count: 5 })).toBe('5 миссий')
    expect(english('information.missions', { count: 5 })).toBe('5 missions')
  })

  it.each(Object.entries(localeFiles))(
    'gives every count a %s translation rather than English',
    async (lng, home) => {
      const t = await alertsTranslator(lng, home)
      const english = await alertsTranslator('en-US', enHome)

      for (const count of counts) {
        const translated = t('information.missions', { count })

        expect(translated.startsWith(`${count} `)).toBe(true)
        expect(translated).not.toBe(english('information.missions', { count }))
      }
    }
  )
})
