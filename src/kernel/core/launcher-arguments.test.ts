import { describe, expect, it } from 'vitest'

import { createLauncherArguments, isIslandOverride } from './launcher-arguments'

const base = { accountId: 'acc', displayName: 'Someone', exchangeCode: 'code' }

describe('createLauncherArguments', () => {
  it('opens a mode straight away, before the user’s own arguments so theirs still win', () => {
    const args = createLauncherArguments({ ...base, islandOverride: 'campaign', launchArgs: '-IslandOverride=playlist_juno' })

    expect(args.filter((arg) => arg.startsWith('-IslandOverride='))).toEqual([
      '-IslandOverride=campaign',
      '-IslandOverride=playlist_juno',
    ])
  })

  it('adds nothing for no island, or one that is not an island id', () => {
    expect(createLauncherArguments(base).some((arg) => arg.startsWith('-IslandOverride'))).toBe(false)
    expect(createLauncherArguments({ ...base, islandOverride: 'campaign -nosound' }).some((arg) => arg.startsWith('-IslandOverride'))).toBe(false)
  })

  it('knows an island id', () => {
    expect(isIslandOverride('set_br_playlists')).toBe(true)
    expect(isIslandOverride('1234-5678-9012')).toBe(true)
    expect(isIslandOverride('a b')).toBe(false)
    expect(isIslandOverride(null)).toBe(false)
  })
})
