import type { PlaytimeEntry } from './model'

import { describe, expect, it } from 'vitest'

import {
  achievementCaption,
  achievementIconUrl,
  buildGameAchievements,
  describeVisibility,
  isSandboxId,
  otherGameRows,
  parseAchievementDefinitions,
  parseAchievementSummaries,
  parsePlayerAchievements,
} from './achievements'

// Shapes as `launcher.store.epicgames.com/graphql` answered on 2026-10-02.
const hogwarts = 'e97659b501af4e3981d5430dad170911'
const cdn = (name: string) => `https://cdn1.epicgames.com/offer/${hogwarts}/${name}`
const icon = (name: string) =>
  `https://shared-static-prod.epicgames.com/epic-achievements/1fe6c9f68a644626a4e400c56ad4ef6d/${hogwarts}/icons/${name}`

const summaryReply = {
  data: {
    PlayerProfile: {
      playerProfile: {
        privacy: { accessLevel: 'FRIENDS_OF_FRIENDS' },
        achievementsSummaries: {
          __typename: 'PlayerAchievementResponseSuccess',
          data: [
            {
              sandboxId: hogwarts,
              totalUnlocked: 17,
              totalXP: 255,
              baseOfferForSandbox: {
                keyImages: [
                  { type: 'OfferImageTall', url: cdn('tall.jpg') },
                  { type: 'OfferImageWide', url: cdn('wide.jpg') },
                ],
              },
              product: { name: 'Hogwarts Legacy', slug: 'hogwarts-legacy' },
              productAchievements: { totalAchievements: 45, totalProductXP: 1000 },
              playerAwards: [],
            },
            { totalUnlocked: 3 },
          ],
        },
      },
    },
  },
}

const definitionsReply = {
  data: {
    Achievement: {
      productAchievementsRecordBySandbox: {
        sandboxId: hogwarts,
        totalAchievements: 45,
        totalProductXP: 1000,
        platinumRarity: { percent: 0.1 },
        achievements: [
          {
            achievement: {
              name: 'PFA_1',
              hidden: true,
              unlockedDisplayName: 'The Sort Who Makes an Entrance',
              lockedDisplayName: 'The Sort Who Makes an Entrance',
              unlockedDescription: 'Complete the introduction and finish the Sorting Ceremony',
              XP: 15,
              unlockedIconLink: icon('a'),
              lockedIconLink: icon('a-grey'),
              rarity: { percent: 89 },
            },
          },
          {
            achievement: {
              name: 'PFA_10',
              hidden: true,
              unlockedDisplayName: 'Grappling with a Graphorn',
              unlockedDescription: 'Subdue the Lord of the Shore',
              XP: 15,
              unlockedIconLink: icon('b'),
              lockedIconLink: 'https://example.com/b.png',
              rarity: { percent: 9 },
            },
          },
          {
            achievement: {
              name: 'PFA_40',
              hidden: false,
              lockedDisplayName: 'Locked only',
              XP: 30,
              rarity: { percent: 40 },
            },
          },
          {
            achievement: {
              name: 'PFA_41',
              hidden: false,
              unlockedDisplayName: 'Rarest',
              XP: 90,
              rarity: { percent: 2 },
            },
          },
          { achievement: { hidden: false } },
        ],
      },
    },
  },
}

const playerReply = {
  data: {
    PlayerAchievement: {
      playerAchievementGameRecordsBySandbox: {
        records: [
          {
            totalXP: 30,
            totalUnlocked: 2,
            playerAwards: [],
            playerAchievements: [
              {
                playerAchievement: {
                  achievementName: 'PFA_1',
                  unlocked: true,
                  progress: 1,
                  XP: 15,
                  unlockDate: '2025-12-12T19:03:07.639Z',
                },
              },
              {
                playerAchievement: {
                  achievementName: 'PFA_10',
                  unlocked: true,
                  progress: 1,
                  XP: 15,
                  unlockDate: '2025-12-14T18:22:25.445Z',
                },
              },
              {
                playerAchievement: { achievementName: 'PFA_40', unlocked: false, progress: 0.5 },
              },
            ],
          },
        ],
      },
    },
  },
}

describe('parseAchievementSummaries', () => {
  it('reads visibility and each game, skipping rows without a sandbox', () => {
    const { games, visibility } = parseAchievementSummaries(summaryReply)

    expect(visibility).toBe('FRIENDS_OF_FRIENDS')
    expect(games).toEqual([
      {
        sandboxId: hogwarts,
        title: 'Hogwarts Legacy',
        unlocked: 17,
        xp: 255,
        total: 45,
        totalXp: 1000,
        platinum: false,
        art: { tall: cdn('tall.jpg'), wide: cdn('wide.jpg') },
      },
    ])
  })

  it('tells a service error (null) from no achievements (empty)', () => {
    expect(
      parseAchievementSummaries({
        data: {
          PlayerProfile: {
            playerProfile: {
              privacy: null,
              achievementsSummaries: { __typename: 'ServiceError', status: 500, message: 'x' },
            },
          },
        },
      })
    ).toEqual({ visibility: null, games: null })
    expect(
      parseAchievementSummaries({
        data: { PlayerProfile: { playerProfile: { achievementsSummaries: { data: [] } } } },
      }).games
    ).toEqual([])
  })

  it('spots a platinum award', () => {
    const reply = structuredClone(summaryReply)

    reply.data.PlayerProfile.playerProfile.achievementsSummaries.data[0].playerAwards = [
      { awardType: 'PLATINUM' },
    ] as never

    expect(parseAchievementSummaries(reply).games?.[0].platinum).toBe(true)
  })
})

describe('parseAchievementDefinitions', () => {
  const parsed = parseAchievementDefinitions(definitionsReply)

  it('reads totals and definitions, falling back from unlocked to locked names', () => {
    expect(parsed?.total).toBe(45)
    expect(parsed?.totalXp).toBe(1000)
    expect(parsed?.platinumRarity).toBe(0.1)
    expect(parsed?.definitions.map((item) => item.title)).toEqual([
      'The Sort Who Makes an Entrance',
      'Grappling with a Graphorn',
      'Locked only',
      'Rarest',
    ])
  })

  it('keeps icons only from the achievement host', () => {
    expect(parsed?.definitions[1].unlockedIcon).toBe(icon('b'))
    expect(parsed?.definitions[1].lockedIcon).toBeNull()
  })

  it('is null for a game without achievements, as Fortnite is', () => {
    expect(
      parseAchievementDefinitions({
        data: {
          Achievement: {
            productAchievementsRecordBySandbox: { productId: null, achievements: null },
          },
        },
      })
    ).toBeNull()
  })
})

describe('parsePlayerAchievements', () => {
  it('keeps unlocked achievements only', () => {
    const { platinum, unlocks } = parsePlayerAchievements(playerReply)

    expect([...unlocks.keys()]).toEqual(['PFA_1', 'PFA_10'])
    expect(unlocks.get('PFA_10')).toEqual({ unlockedAt: '2025-12-14T18:22:25.445Z', progress: 1 })
    expect(platinum).toBe(false)
  })

  it('is empty when the account has no record for the game', () => {
    expect(
      parsePlayerAchievements({
        data: { PlayerAchievement: { playerAchievementGameRecordsBySandbox: { records: [] } } },
      }).unlocks.size
    ).toBe(0)
    expect(parsePlayerAchievements(null).unlocks.size).toBe(0)
  })
})

describe('buildGameAchievements', () => {
  const summary = parseAchievementSummaries(summaryReply).games?.[0] ?? null
  const built = buildGameAchievements({
    accountId: 'a',
    sandboxId: hogwarts,
    definitions: parseAchievementDefinitions(definitionsReply)!,
    player: parsePlayerAchievements(playerReply),
    summary,
  })

  it('puts unlocked first (newest first), then locked from most to least common', () => {
    expect(built.rows.map((row) => [row.name, row.unlocked])).toEqual([
      ['PFA_10', true],
      ['PFA_1', true],
      ['PFA_40', false],
      ['PFA_41', false],
    ])
  })

  it('counts what is unlocked and takes the title and art from the summary', () => {
    expect(built).toMatchObject({
      title: 'Hogwarts Legacy',
      total: 45,
      totalXp: 1000,
      unlocked: 2,
      unlockedXp: 30,
      platinum: false,
      platinumRarity: 0.1,
    })
    expect(built.art.tall).toBe(cdn('tall.jpg'))
  })
})

describe('otherGameRows', () => {
  const summary = parseAchievementSummaries(summaryReply).games!
  const entry = (patch: Partial<PlaytimeEntry>): PlaytimeEntry => ({
    artifactId: 'x',
    seconds: 1,
    kind: 'other',
    namespace: null,
    title: null,
    art: { tall: null, wide: null },
    ...patch,
  })

  it('joins achievements to the most played app of the game, once', () => {
    const rows = otherGameRows(
      [
        entry({ artifactId: 'Fortnite', kind: 'fortnite', namespace: 'fn', seconds: 9 }),
        entry({ artifactId: 'hl', namespace: hogwarts, title: 'Hogwarts Legacy', seconds: 100 }),
        entry({ artifactId: 'hl-dlc', namespace: hogwarts, title: 'HL DLC', seconds: 5 }),
        entry({ artifactId: 'tango', namespace: 'tango-ns', title: 'Operation Tango', seconds: 50 }),
      ],
      summary
    )

    expect(rows.map((row) => [row.key, row.achievements?.unlocked ?? null])).toEqual([
      ['hl', 17],
      ['hl-dlc', null],
      ['tango', null],
    ])
    // Catalogue art missing on the app: the achievements' box art fills in.
    expect(rows[0].art.tall).toBe(cdn('tall.jpg'))
  })

  it('adds games with achievements but no time recorded, after the played ones', () => {
    const rows = otherGameRows([entry({ artifactId: 'tango', namespace: 'tango-ns' })], summary)

    expect(rows.map((row) => [row.key, row.seconds])).toEqual([
      ['tango', 1],
      [`sandbox:${hogwarts}`, null],
    ])
  })

  it('works with achievements unavailable', () => {
    expect(otherGameRows([entry({ artifactId: 'tango' })], null)).toHaveLength(1)
  })
})

describe('small readers', () => {
  it('captions, visibility and ids', () => {
    expect(achievementCaption(parseAchievementSummaries(summaryReply).games![0])).toBe(
      '17 of 45 achievements'
    )
    expect(
      achievementCaption({
        sandboxId: 's',
        title: null,
        unlocked: 1,
        xp: 5,
        total: null,
        totalXp: null,
        platinum: true,
        art: { tall: null, wide: null },
      })
    ).toBe('1 achievement · Platinum')
    expect(describeVisibility('FRIENDS_OF_FRIENDS')).toBe('friends of friends')
    expect(describeVisibility('SOME_NEW_LEVEL')).toBe('some new level')
    expect(describeVisibility(null)).toBeNull()
    expect(isSandboxId(hogwarts)).toBe(true)
    expect(isSandboxId('../etc')).toBe(false)
    expect(achievementIconUrl('http://shared-static-prod.epicgames.com/a.png')).toBeNull()
  })
})
