import type { CatalogItem } from './model'

import { describe, expect, it } from 'vitest'

import {
  fortniteAppInfo,
  founderEdition,
  grantGroup,
  libraryGames,
  modeAppIds,
  parseLibraryPage,
  parseProfileAccess,
  recordTitles,
  rewardSource,
  secondsByApp,
  timeFor,
} from './account'

// Shapes as Epic answered for three accounts on 2026-10-02.
const profile = (...templateIds: Array<string>) => ({
  profileChanges: [
    { profile: { items: Object.fromEntries(templateIds.map((templateId, index) => [`item-${index}`, { templateId }])) } },
  ],
})

const cdn = (name: string) => `https://cdn1.epicgames.com/item/${name}`

const page = (records: Array<Record<string, unknown>>, nextCursor: string | null = null) => ({
  data: { Library: { libraryItems: { records, responseMetadata: { nextCursor } } } },
})

const libraryRecord = (
  appName: string,
  namespace: string,
  title: string,
  paths: Array<string>,
  acquisitionDate = '2025-01-01T00:00:00.000Z',
  tall: string | null = null
) => ({
  appName,
  namespace,
  catalogItemId: `${appName}-item`,
  acquisitionDate,
  sandboxName: title,
  catalogItem: {
    title,
    categories: paths.map((path) => ({ path })),
    keyImages: tall ? [{ type: 'DieselGameBoxTall', url: tall }] : [],
  },
})

describe('parseProfileAccess', () => {
  it('reads Save the World access, the highest Founder token and the tutorial', () => {
    expect(
      parseProfileAccess(
        profile('Token:campaignaccess', 'Token:campaigntutorialcomplete', 'Token:fnbraddon', 'Token:founderspack_1', 'Token:founderspack_2')
      )
    ).toEqual({ campaignAccess: true, created: null, founderTier: 2, tutorialComplete: true })
  })

  it('reads a non-Founder with access, and an account without', () => {
    expect(parseProfileAccess(profile('Token:campaignaccess', 'Token:campaigntutorialcomplete'))).toEqual({
      campaignAccess: true,
      created: null,
      founderTier: null,
      tutorialComplete: true,
    })
    expect(parseProfileAccess(profile('Currency:MtxPurchased'))?.campaignAccess).toBe(false)
  })

  it('reads when the profile was made', () => {
    const made = profile('Token:campaignaccess')

    ;(made.profileChanges[0].profile as Record<string, unknown>).created = '2018-06-16T06:33:30.123Z'
    expect(parseProfileAccess(made)?.created).toBe('2018-06-16T06:33:30.123Z')
  })

  it('is null without a profile', () => {
    expect(parseProfileAccess({ errorCode: 'errors.com.epicgames.common.oauth.invalid_token' })).toBeNull()
    expect(parseProfileAccess(null)).toBeNull()
  })

  it('names the Founder editions', () => {
    expect([1, 2, 3, 4, 5, 6, null].map(founderEdition)).toEqual([
      'Standard',
      'Deluxe',
      'Super Deluxe',
      'Limited',
      'Ultimate',
      null,
      null,
    ])
  })
})

describe('the Epic library', () => {
  const parsed = parseLibraryPage(
    page(
      [
        libraryRecord('Fortnite', 'fn', 'Fortnite', ['games', 'applications'], '2018-06-16T00:00:00Z'),
        libraryRecord('aa31f9e94e844b299ca757d1d0b97a09', 'fn', 'Fortnite Save the World Content', ['hidden']),
        libraryRecord('fa4240e57a3c46b39f169041b7811293', 'e97659b5', 'Hogwarts Legacy', ['public', 'games', 'applications'], '2025-12-12T00:00:00Z', cdn('hl-tall')),
        libraryRecord('WorldExplorersLive', 'wex', 'Battle Breakers', ['games', 'applications'], '2020-09-09T00:00:00Z', cdn('bb-tall')),
        libraryRecord('Civ6', 'civ', "Sid Meier's Civilization VI", ['games', 'applications'], '2025-07-19T00:00:00Z'),
        libraryRecord('Civ6-dlc', 'civ', 'Civilization VI DLC', ['addons'], '2025-07-20T00:00:00Z', cdn('civ-tall')),
        libraryRecord('UE_5.4', 'ue', 'Unreal Engine', ['engines/ue5', 'engines']),
        libraryRecord('UE_5.5', 'ue', 'Unreal Engine', ['engines/ue5', 'engines']),
        libraryRecord('QuixelBridge_5.4', 'ue', 'Quixel Bridge', ['plugins/engine', 'plugins']),
        { namespace: 'broken' },
      ],
      'next-page'
    )
  )

  it('reads a page and its cursor, dropping records without an app or namespace', () => {
    expect(parsed.records).toHaveLength(9)
    expect(parsed.nextCursor).toBe('next-page')
    expect(parsed.records[2]).toMatchObject({
      appName: 'fa4240e57a3c46b39f169041b7811293',
      title: 'Hogwarts Legacy',
      acquiredAt: '2025-12-12T00:00:00.000Z',
      art: { tall: cdn('hl-tall'), wide: null },
    })
    expect(parseLibraryPage({ errors: [{ message: 'x' }] })).toEqual({ records: [], nextCursor: null })
  })

  it('lists games outside Fortnite, newest first, one per game, and names the tools', () => {
    const { games, tools } = libraryGames(parsed.records)

    expect(games.map((game) => [game.title, game.appNames, game.acquiredAt?.slice(0, 10)])).toEqual([
      ['Hogwarts Legacy', ['fa4240e57a3c46b39f169041b7811293'], '2025-12-12'],
      ["Sid Meier's Civilization VI", ['Civ6', 'Civ6-dlc'], '2025-07-19'],
      ['Battle Breakers', ['WorldExplorersLive'], '2020-09-09'],
    ])
    // The game's own record names it; art from whichever app has some.
    expect(games[1].art.tall).toBe(cdn('civ-tall'))
    expect(tools).toEqual(['Unreal Engine', 'Quixel Bridge'])
  })

  it('names apps for cloud saves', () => {
    expect(recordTitles(parsed.records)).toMatchObject({
      fa4240e57a3c46b39f169041b7811293: 'Hogwarts Legacy',
      aa31f9e94e844b299ca757d1d0b97a09: 'Fortnite Save the World Content',
    })
  })
})

describe('Fortnite modes and their apps', () => {
  const command = (island: string) => ({ AdditionalCommandLine: { type: 'STRING', value: `-epicapp=Fortnite -IslandOverride=${island}` } })
  const modes: Array<CatalogItem> = [
    { id: 'br', title: 'Fortnite Battle Royale', categories: [{ path: 'addons/launchable' }], releaseInfo: [{ appId: 'afdb5a85' }], customAttributes: command('set_br_playlists') },
    { id: 'stw', title: 'Fortnite Save the World', categories: [{ path: 'addons/launchable' }], releaseInfo: [{ appId: 'f60bd71e' }], customAttributes: command('campaign') },
    { id: 'stw-content', title: 'Fortnite Save the World Content', categories: [{ path: 'hidden' }], releaseInfo: [{ appId: 'aa31f9e9' }], customAttributes: command('campaign') },
    // A launchable mode on the same island is not a content item of it.
    { id: 'stw-twin', title: 'Twin', categories: [{ path: 'addons/launchable' }], releaseInfo: [{ appId: 'twin' }], customAttributes: command('campaign') },
  ]

  it('collects a mode’s own app and its hidden content item’s', () => {
    expect(modeAppIds(modes[0], modes)).toEqual(['afdb5a85'])
    expect(modeAppIds(modes[1], modes)).toEqual(['f60bd71e', 'aa31f9e9'])
  })

  it('names every app id the catalogue knows', () => {
    const apps = fortniteAppInfo({ id: 'main', dlcItemList: modes })

    expect(apps.afdb5a85.title).toBe('Fortnite Battle Royale')
    expect(apps.aa31f9e9.title).toBe('Fortnite Save the World Content')
    expect(fortniteAppInfo(null)).toEqual({})
  })

  it('takes the larger of a mode’s records, never the sum, and null when none', () => {
    const seconds = secondsByApp([
      { artifactId: 'aa31f9e9', seconds: 296822 },
      { artifactId: 'f60bd71e', seconds: 100 },
    ])

    expect(timeFor(['f60bd71e', 'aa31f9e9'], seconds)).toBe(296822)
    expect(timeFor(['afdb5a85'], seconds)).toBeNull()
    expect(timeFor([], seconds)).toBeNull()
  })
})

describe('grants', () => {
  const group = (title: string, categories: Array<string>, offerType: string | null = null, entitlementType = 'ENTITLEMENT') =>
    grantGroup({ categories, entitlementType, offerType, title })

  it('sorts access, purchases and rewards', () => {
    expect(group('UEFN Free Audience', ['audience', 'public'])).toBe('access')
    expect(group('Founder Audience Access', ['games', 'applications'])).toBe('access')
    expect(group('045a89e5', [], null, 'AUDIENCE')).toBe('access')
    expect(group('Juno AddOn', ['testing'], 'EXPERIENCE')).toBe('access')
    expect(group('Seasalt', ['points/packs', 'points'])).toBe('purchase')
    expect(group('Overclocked Combo Pack', ['testing'])).toBe('purchase')
    expect(group('RaF T1', ['testing'])).toBe('reward')
    expect(group('Kurohomura', ['cross_promo'])).toBe('reward')
  })

  it('says where a reward came from only when its name says so', () => {
    expect(rewardSource('FN_Sugar_1', ['testing'])).toBe('Rocket League')
    expect(rewardSource('BB_Kuro', ['cross_promo'])).toBe('Battle Breakers')
    expect(rewardSource('FN_RaF3_Spray', ['testing'])).toBe('Refer a Friend')
    expect(rewardSource('FN_Raft1', ['testing'])).toBe('Refer a Friend')
    expect(rewardSource('Promo', ['cross_promo'])).toBe('Cross-promotion')
    expect(rewardSource('FN_BF_Tier1', ['testing'])).toBeNull()
  })
})
