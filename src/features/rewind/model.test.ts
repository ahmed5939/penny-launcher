import type { AccountLibraryOverview } from '../library/collection'
import type { AccountPlaytime } from '../playtime/model'
import type { AllPlatformsTime } from '../playtime/stats'

import { describe, expect, it } from 'vitest'

import { buildRewind, rewindReady } from './model'
import { rewindSlides } from './slides'

const art = { tall: null, wide: null }

const career = (patch: Partial<AllPlatformsTime>): AllPlatformsTime => ({
  minutes: 0,
  byInput: [],
  matches: 0,
  wins: 0,
  kills: 0,
  outlived: 0,
  modes: [],
  squads: [],
  ...patch,
})

const timed = (entries: Array<[string, number]>, allPlatforms: AllPlatformsTime | null, achievements: AccountPlaytime['achievements'] = []): AccountPlaytime => ({
  status: 'ok',
  entries: entries.map(([artifactId, seconds]) => ({ artifactId, seconds, kind: artifactId === 'Fortnite' ? 'fortnite' : 'other', namespace: null, title: null, art })),
  achievements,
  profileVisibility: null,
  allPlatforms,
  checkedAt: '2026-10-02T00:00:00.000Z',
})

const overview = (created: string | null, founderTier: number | null, campaignAccess: boolean, records: AccountLibraryOverview['records'] = []): AccountLibraryOverview => ({
  status: 'ok',
  records,
  access: { campaignAccess, created, founderTier, tutorialComplete: true },
  checkedAt: '2026-10-02T00:00:00.000Z',
})

// The three real accounts' figures, 2026-10-02.
const input = {
  accounts: [
    { id: 'a', name: 'ay dast xooshhhh' },
    { id: 'b', name: '7urmat' },
    { id: 'c', name: 'LITileSTWHero' },
  ],
  saveTheWorldApps: ['f60bd71e', 'aa31f9e9'],
  overviews: {
    a: overview('2018-06-16T06:33:30.000Z', 2, true, [
      { appName: 'hl', namespace: 'hogwarts', catalogItemId: null, title: 'Hogwarts Legacy', art, categories: ['games'], acquiredAt: null, sandboxName: null },
    ]),
    b: overview('2018-07-23T09:52:00.000Z', 2, true, [
      { appName: 'hl2', namespace: 'hogwarts', catalogItemId: null, title: 'Hogwarts Legacy', art, categories: ['games'], acquiredAt: null, sandboxName: null },
      { appName: 'civ', namespace: 'civ', catalogItemId: null, title: 'Civilization VI', art, categories: ['games'], acquiredAt: null, sandboxName: null },
    ]),
    c: overview('2021-10-29T22:42:00.000Z', null, true),
  },
  playtime: {
    a: timed(
      [['Fortnite', 1448314], ['aa31f9e9', 296822], ['hl', 114189]],
      career({
        minutes: 220133,
        byInput: [{ input: 'gamepad', label: 'Controller', minutes: 217950 }, { input: 'touch', label: 'Touch', minutes: 2183 }],
        matches: 25706,
        wins: 764,
        kills: 41048,
        outlived: 727280,
        modes: [{ key: 'creative', label: 'Creative and islands', minutes: 91300, matches: 0, wins: 0 }],
      }),
      [{ sandboxId: 'hogwarts', title: 'Hogwarts Legacy', unlocked: 17, xp: 255, total: 45, totalXp: 1000, platinum: false, art }]
    ),
    b: timed([['Fortnite', 417255]], career({ minutes: 152741, byInput: [{ input: 'gamepad', label: 'Controller', minutes: 152634 }], matches: 12617, wins: 317, kills: 24878, outlived: 418944 })),
    c: timed([['Fortnite', 4345429]], career({ minutes: 3755, byInput: [{ input: 'gamepad', label: 'Controller', minutes: 3755 }], matches: 233, wins: 138, kills: 2049, outlived: 17560 })),
  },
}

describe('buildRewind', () => {
  const rewind = buildRewind(input)

  it('adds hours up across accounts, both ways, and turns them into days', () => {
    expect(Math.round(rewind.hours.pc)).toBe(1725)
    expect(Math.round(rewind.hours.everywhere)).toBe(6277)
    expect(Math.round(rewind.hours.total)).toBe(6277)
    expect(Math.round(rewind.hours.days)).toBe(262)
  })

  it('finds the earliest first session and the favourite input', () => {
    expect(rewind.since).toEqual({ at: '2018-06-16T06:33:30.000Z', name: 'ay dast xooshhhh' })
    expect(rewind.input?.label).toBe('Controller')
    expect(Math.round(rewind.input?.share ?? 0)).toBe(99)
  })

  it('totals the Battle Royale career with a win rate', () => {
    expect(rewind.battleRoyale).toMatchObject({ matches: 38556, wins: 1219, kills: 67975, outlived: 1163784 })
    expect(rewind.battleRoyale?.winRate?.toFixed(1)).toBe('3.2')
    expect(rewind.battleRoyale?.topMode?.label).toBe('Creative and islands')
  })

  it('counts Founders, Save the World access and its recorded hours', () => {
    expect(rewind.saveTheWorld.founders).toEqual([
      { name: 'ay dast xooshhhh', edition: 'Deluxe' },
      { name: '7urmat', edition: 'Deluxe' },
    ])
    expect(rewind.saveTheWorld.withAccess).toBe(3)
    expect(rewind.saveTheWorld.hours.toFixed(1)).toBe('82.5')
  })

  it('counts games once across accounts, with the most played and achievements', () => {
    expect(rewind.games.owned).toBe(2)
    expect(rewind.games.top).toMatchObject({ title: 'Hogwarts Legacy' })
    expect(rewind.games.achievements).toEqual({ unlocked: 17, xp: 255, games: 1 })
  })

  it('ranks the accounts by their best figure', () => {
    expect(rewind.perAccount.map((account) => [account.name, account.saveTheWorld])).toEqual([
      ['ay dast xooshhhh', 'Deluxe Founder'],
      ['7urmat', 'Deluxe Founder'],
      ['LITileSTWHero', 'Save the World'],
    ])
  })
})

describe('rewindReady', () => {
  it('waits until every account has answered both reads', () => {
    expect(rewindReady(input)).toBe(true)
    expect(rewindReady({ ...input, playtime: { a: input.playtime.a } })).toBe(false)
    expect(rewindReady({ ...input, accounts: [] })).toBe(false)
  })
})

describe('buildRewind with the game profiles', () => {
  const locker = (outfits: number, total: number) => ({ outfits, backBlings: 0, pickaxes: 0, gliders: 0, emotes: 0, wraps: 0, contrails: 0, loadingScreens: 0, total })
  const stw = (matches: number, missions: number, cardPacks: number, daysLoggedIn: number, book: number, startedAt: string) => ({
    startedAt,
    commanderLevel: 310,
    pastMaxRewards: 10,
    matches,
    missions,
    cardPacks,
    daysLoggedIn,
    collectionBookLevel: book,
    researchMaxed: true,
  })
  // The three real accounts' counters, 2026-10-02 (seasons trimmed).
  const facts = {
    a: {
      status: 'ok' as const,
      checkedAt: '2026-10-02T00:00:00.000Z',
      battleRoyale: {
        accountLevel: 4294,
        lifetimeWins: 512,
        otherPasses: 20,
        locker: locker(235, 2666),
        seasons: [
          { season: 4, level: 41, wins: 1, crowns: 0, battlePass: false },
          { season: 26, level: 349, wins: 11, crowns: 0, battlePass: true },
          { season: 28, level: 297, wins: 22, crowns: 2, battlePass: true },
        ],
      },
      saveTheWorld: stw(2895, 2422, 4033, 873, 261, '2018-06-18T11:52:36.688Z'),
      gifts: { sent: 34, received: 42 },
    },
    b: {
      status: 'ok' as const,
      checkedAt: '2026-10-02T00:00:00.000Z',
      battleRoyale: {
        accountLevel: 2578,
        lifetimeWins: 271,
        otherPasses: 2,
        locker: locker(120, 1500),
        seasons: [
          { season: 14, level: 219, wins: 38, crowns: 0, battlePass: true },
          { season: 28, level: 277, wins: 19, crowns: 1, battlePass: true },
        ],
      },
      saveTheWorld: stw(1819, 1521, 2188, 334, 247, '2018-07-24T00:00:00.000Z'),
      gifts: { sent: 18, received: 51 },
    },
    c: {
      status: 'ok' as const,
      checkedAt: '2026-10-02T00:00:00.000Z',
      battleRoyale: {
        accountLevel: 3876,
        lifetimeWins: 135,
        otherPasses: 15,
        locker: locker(80, 900),
        seasons: [{ season: 33, level: 536, wins: 0, crowns: 0, battlePass: true }],
      },
      saveTheWorld: stw(6376, 5671, 6821, 316, 625, '2021-10-30T00:00:00.000Z'),
      gifts: { sent: 22, received: 20 },
    },
  }
  const rewind = buildRewind({ ...input, facts })

  it('builds one season timeline across accounts, each season at its best level', () => {
    expect(rewind.seasons?.timeline).toEqual([
      { season: 4, level: 41, battlePass: false },
      { season: 14, level: 219, battlePass: true },
      { season: 26, level: 349, battlePass: true },
      { season: 28, level: 297, battlePass: true },
      { season: 33, level: 536, battlePass: true },
    ])
    expect(rewind.seasons).toMatchObject({
      first: 4,
      battlePasses: 5,
      otherPasses: 37,
      crowns: 3,
      best: { season: 33, level: 536, name: 'LITileSTWHero' },
      accountLevel: { level: 4294, name: 'ay dast xooshhhh' },
    })
  })

  it('adds the lockers up', () => {
    expect(rewind.locker).toMatchObject({ outfits: 435, total: 5066 })
  })

  it('adds the Save the World grind up, with the highest Collection Book', () => {
    expect(rewind.grind).toEqual({
      startedAt: '2018-06-18T11:52:36.688Z',
      matches: 11090,
      missions: 9614,
      cardPacks: 13042,
      daysLoggedIn: 1523,
      pastMaxRewards: 30,
      researchMaxed: 3,
      book: { level: 625, name: 'LITileSTWHero' },
    })
  })

  it('adds the gifts up', () => {
    expect(rewind.gifts).toEqual({ sent: 74, received: 113 })
  })

  it('waits for the profiles too when it was given them', () => {
    expect(rewindReady({ ...input, facts })).toBe(true)
    expect(rewindReady({ ...input, facts: { a: facts.a } })).toBe(false)
  })

  it('plays without them, those parts left out', () => {
    expect(buildRewind(input)).toMatchObject({ seasons: null, locker: null, grind: null, gifts: null })
  })
})

describe('buildRewind, deeper Battle Royale and the lockers as pictures', () => {
  it('reads K/D, eliminations a match and how often a win comes', () => {
    const br = buildRewind(input).battleRoyale!

    expect(br.winEvery?.toFixed(1)).toBe('31.6')
    expect(br.kd?.toFixed(2)).toBe('1.82')
    expect(br.killsPerMatch?.toFixed(2)).toBe('1.76')
  })

  it('adds squad sizes up across accounts', () => {
    const withSquads = {
      ...input,
      playtime: {
        a: timed([['Fortnite', 1]], career({ matches: 10, squads: [{ size: 'solo', label: 'Solo', matches: 10, wins: 2, kills: 30 }] })),
        b: timed([['Fortnite', 1]], career({ matches: 5, squads: [{ size: 'solo', label: 'Solo', matches: 5, wins: 1, kills: 9 }, { size: 'squad', label: 'Squads', matches: 3, wins: 1, kills: 4 }] })),
        c: timed([['Fortnite', 1]], null),
      },
    }

    expect(buildRewind(withSquads).battleRoyale?.squads).toEqual([
      { size: 'solo', label: 'Solo', matches: 15, wins: 3, kills: 39 },
      { size: 'squad', label: 'Squads', matches: 3, wins: 1, kills: 4 },
    ])
  })

  it('shows each outfit once across accounts, with renders for the slides and a signature per account', () => {
    const outfit = (id: string, rarity: string, introduced: number, featured = false) => ({
      id,
      name: id,
      rarity,
      series: null,
      seriesColors: null,
      icon: `https://fortnite-api.com/${id}/icon.png`,
      featured: featured ? `https://fortnite-api.com/${id}/featured.png` : null,
      introduced,
    })
    const cosmetics = (favourites: Array<ReturnType<typeof outfit>>, oldest: Array<ReturnType<typeof outfit>>) => ({
      favourites,
      favouriteCount: favourites.length,
      oldest,
      rarest: favourites,
      byRarity: [{ rarity: 'legendary', label: 'Legendary', count: 2 }],
      chapterOne: oldest.length,
      outfits: 10,
    })
    const facts = {
      a: { status: 'ok' as const, checkedAt: '', battleRoyale: null, saveTheWorld: null, gifts: null, cosmetics: cosmetics([outfit('raider', 'rare', 1, true), outfit('ikonik', 'icon', 10)], [outfit('raider', 'rare', 1, true)]) },
      b: { status: 'ok' as const, checkedAt: '', battleRoyale: null, saveTheWorld: null, gifts: null, cosmetics: cosmetics([outfit('ikonik', 'icon', 10)], [outfit('skull', 'epic', 1)]) },
    }
    const rewind = buildRewind({ ...input, facts })

    expect(rewind.cosmetics?.favourites.map((item) => item.id)).toEqual(['raider', 'ikonik'])
    expect(rewind.cosmetics?.oldest.map((item) => item.id)).toEqual(['skull', 'raider'])
    expect(rewind.cosmetics?.byRarity).toEqual([{ rarity: 'legendary', label: 'Legendary', count: 4 }])
    expect(rewind.cosmetics?.renders.map((item) => item.id)).toEqual(['raider'])
    expect(rewind.perAccount.find((account) => account.id === 'b')?.signature?.id).toBe('ikonik')
    expect(rewind.perAccount.find((account) => account.id === 'c')?.signature).toBeNull()
  })
})

describe('buildRewind, Save the World first', () => {
  const hero = (name: string, rarity = 'Legendary', templateId = `Hero:${name.toLowerCase()}`) => ({ templateId, name, rarity, image: `https://art/${name}.png`, level: 50 })
  const shields = (finishedAt: string | null, twine: number) => [
    { zone: 'Stonewood', completed: 10, finishedAt },
    { zone: 'Twine Peaks', completed: twine, finishedAt: twine === 10 ? finishedAt : null },
  ]
  const commander = (power: number, loadout: Array<ReturnType<typeof hero>>, mythics: Array<ReturnType<typeof hero>>, shield: ReturnType<typeof shields>, homebase: string | null = null) => ({
    power,
    loadout,
    collection: { heroes: 100, survivors: 300, schematics: 200, defenders: 50 },
    mythics,
    shields: shield,
    homebase,
  })
  const campaign = (level: number) => ({
    startedAt: null,
    commanderLevel: level,
    pastMaxRewards: 0,
    matches: 1,
    missions: 1,
    cardPacks: 0,
    daysLoggedIn: 0,
    collectionBookLevel: null,
    researchMaxed: true,
  })
  // The real accounts' Power and mythics, 2026-10-02, cut down.
  const facts = {
    a: { status: 'ok' as const, checkedAt: '', battleRoyale: null, saveTheWorld: campaign(310), gifts: null, commander: commander(132.94, [hero('Cassie'), hero('Dire', 'Mythic')], [hero('Dire', 'Mythic'), hero("Storm King's Wrath", 'Mythic', 'Schematic:sid_wrath')], shields('2020-08-16T20:18:22.409Z', 10)) },
    b: { status: 'ok' as const, checkedAt: '', battleRoyale: null, saveTheWorld: campaign(250), gifts: null, commander: commander(129.13, [], [hero('Dire', 'Mythic'), hero('Joel', 'Mythic', 'Worker:worker_joel')], shields(null, 4)) },
    c: { status: 'ok' as const, checkedAt: '', battleRoyale: null, saveTheWorld: campaign(310), gifts: null, commander: commander(145.28, [hero('Thunder Thora'), hero('MEGA B.A.S.E. Kyle', 'Mythic')], [hero("Storm King's Fury", 'Mythic', 'Schematic:sid_fury'), hero('Raven', 'Mythic')], shields('2022-08-23T00:30:22.531Z', 10), 'Azkaban') },
  }
  const rewind = buildRewind({ ...input, facts })

  it('finds the best Power and level, and how many accounts are maxed', () => {
    expect(rewind.command?.power).toEqual({ value: 145.28, name: 'LITileSTWHero' })
    expect(rewind.command?.level?.level).toBe(310)
    expect(rewind.command?.maxedLevel).toBe(2)
  })

  it('lists each commander with their loadout, most played first', () => {
    expect(rewind.command?.commanders.map((entry) => [entry.name, entry.hero?.name ?? null, entry.support.length, entry.homebase])).toEqual(
      rewind.perAccount.map((account) => {
        const expected = { a: ['Cassie', 1, null], b: [null, 0, null], c: ['Thunder Thora', 1, 'Azkaban'] }[account.id]!

        return [account.name, ...expected]
      })
    )
    expect(rewind.perAccount.find((account) => account.id === 'c')?.commander?.name).toBe('Thunder Thora')
    expect(rewind.perAccount.find((account) => account.id === 'c')?.power).toBe(145.28)
  })

  it('shows each mythic once, heroes first, and counts the Storm King weapons', () => {
    expect(rewind.command?.mythics.map((item) => item.name)).toEqual(['Dire', 'Raven', "Storm King's Fury", "Storm King's Wrath", 'Joel'])
    expect(rewind.command?.stormKing).toBe(2)
  })

  it('adds the collections up', () => {
    expect(rewind.command?.collection).toEqual({ heroes: 300, survivors: 900, schematics: 600, defenders: 150 })
  })

  it('reads each zone as its best account, with how many cleared it and when the first did', () => {
    expect(rewind.command?.shields).toEqual([
      { zone: 'Stonewood', best: 10, cleared: 3, firstClearedAt: '2020-08-16T20:18:22.409Z' },
      { zone: 'Twine Peaks', best: 10, cleared: 2, firstClearedAt: '2020-08-16T20:18:22.409Z' },
    ])
  })

  it('has no commanders without a campaign profile', () => {
    expect(buildRewind(input).command).toBeNull()
  })

  it('plays Save the World before Battle Royale', () => {
    const keys = rewindSlides(rewind).map((slide) => slide.key)

    expect(keys.indexOf('save-the-world')).toBeGreaterThan(keys.indexOf('intro'))
    expect(keys.indexOf('commanders')).toBeGreaterThan(keys.indexOf('save-the-world'))
    expect(keys.indexOf('storm-shields')).toBeGreaterThan(keys.indexOf('mythics'))
    expect(keys.indexOf('battle-royale')).toBeGreaterThan(keys.indexOf('grind'))
    expect(keys.indexOf('hours')).toBeGreaterThan(keys.indexOf('battle-royale'))
  })
})
