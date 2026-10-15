import { describe, expect, it } from 'vitest'

import { defaultOverlaySettings } from '../../../config/constants/overlay'
import { settingsSchema } from './settings'

const legacySettings = {
  autoDailyQuests: true,
  claimingRewards: '1',
  customProcess: 'FortniteClient-Win64-Shipping.exe',
  missionInterval: '3',
  path: 'C:\\Fortnite',
  systemTray: false,
  discordRichPresence: true,
  userAgent: 'Fortnite/test',
}

describe('overlay settings', () => {
  it('adds overlay defaults to settings saved by older versions', () => {
    const parsed = settingsSchema.parse(legacySettings)

    expect(parsed.overlay).toEqual(defaultOverlaySettings)
  })

  it('keeps valid overlay visibility preferences', () => {
    const parsed = settingsSchema.parse({
      ...legacySettings,
      overlay: {
        ...defaultOverlaySettings,
        enabled: false,
        position: 'bottom-left',
        questGroups: {
          ...defaultOverlaySettings.questGroups,
          daily: false,
          active: false,
        },
      },
    })

    expect(parsed.overlay.enabled).toBe(false)
    expect(parsed.overlay.position).toBe('bottom-left')
    expect(parsed.overlay.questGroups.daily).toBe(false)
    expect(parsed.overlay.questGroups.active).toBe(false)
  })

  it('rejects unsafe numeric ranges', () => {
    const parsed = settingsSchema.safeParse({
      ...legacySettings,
      overlay: {
        ...defaultOverlaySettings,
        opacity: 10,
        refreshMinutes: 0,
      },
    })

    expect(parsed.success).toBe(false)
  })
})

describe('settings validation messages', () => {
  it('asks for a game folder when the path is blank', () => {
    const parsed = settingsSchema.safeParse({
      ...legacySettings,
      path: '   ',
    })

    expect(parsed.error?.issues.map((issue) => issue.message)).toContain('Choose the game folder.')
  })

  it('gives a plain message for an overlay number that is cleared', () => {
    const parsed = settingsSchema.safeParse({
      ...legacySettings,
      overlay: {
        ...defaultOverlaySettings,
        opacity: Number.NaN,
      },
    })

    expect(parsed.error?.issues.map((issue) => issue.message)).toContain('Enter a number from 50 to 100.')
  })

  it('names the setting in range errors', () => {
    const parsed = settingsSchema.safeParse({
      ...legacySettings,
      claimingRewards: '9',
    })

    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      'Reward claim delay must be from 0 to 5 seconds.',
    )
  })
})
