import { describe, expect, it } from 'vitest'

import { cosmeticFacts, parseBattleRoyale, parseGifts, parseSaveTheWorld, seasonName } from './facts'

// Cut from three accounts' QueryProfile replies, 2026-10-02.
const reply = (profile: Record<string, unknown>) => ({ profileChanges: [{ changeType: 'fullProfileUpdate', profile }] })

const athena = reply({
  created: '2018-06-16T06:33:49.888Z',
  items: {
    a: { templateId: 'AthenaCharacter:cid_029_athena_commando_f_halloween' },
    b: { templateId: 'AthenaCharacter:cid_028_athena_commando_f' },
    c: { templateId: 'AthenaDance:eid_floss' },
    d: { templateId: 'AthenaDance:spid_001' },
    e: { templateId: 'AthenaPickaxe:pickaxe_lockjaw' },
    f: { templateId: 'Quest:quest_s4_w1' },
    g: { templateId: 'CosmeticVariantToken:vtid_1' },
    h: { templateId: 'AthenaSeason:athenaseason42' },
  },
  stats: {
    attributes: {
      accountLevel: 4294,
      lifetime_wins: 512,
      past_seasons: [
        { numWins: 24, seasonXp: 39662, purchasedVIP: true, seasonLevel: 96, bookLevel: 100, seasonNumber: 5 },
        { numWins: 1, seasonXp: 5390, seasonLevel: 41, bookLevel: 26, seasonNumber: 4 },
        { numWins: 11, purchasedVIP: true, seasonLevel: 349, bookLevel: 100, seasonNumber: 26 },
        { numWins: 22, purchasedVIP: true, seasonLevel: 297, numRoyalRoyales: 2, seasonNumber: 28 },
        { seasonLevel: 5 },
      ],
      past_season_passes: [
        { level: 100, seasonTemplateId: 'AthenaSeason:figmentpass_s01' },
        { level: 147, seasonTemplateId: 'AthenaSeason:athenaseason33' },
        { level: 100, seasonTemplateId: 'AthenaSeason:junoseason1pass' },
        { level: 40, seasonTemplateId: 'AthenaSeason:sparks_season07_seasonasset' },
      ],
    },
  },
})

const campaign = reply({
  created: '2018-06-18T11:52:36.688Z',
  items: {},
  stats: {
    attributes: {
      level: 310,
      rewards_claimed_post_max_level: 199,
      matches_played: 2895,
      packs_granted: 4033,
      daily_rewards: { nextDefaultReward: 201, totalDaysLoggedIn: 873 },
      collection_book: { maxBookXpLevelAchieved: 261 },
      research_levels: { fortitude: 120, offense: 120, resistance: 120, technology: 120 },
      gameplay_stats: [
        { statValue: 2422, statName: 'zonescompleted' },
        { statValue: 0, statName: 'habaneroprogression' },
      ],
    },
  },
})

describe('parseBattleRoyale', () => {
  const br = parseBattleRoyale(athena)!

  it('reads the account level, lifetime wins and other passes', () => {
    expect(br.accountLevel).toBe(4294)
    expect(br.lifetimeWins).toBe(512)
    // athenaseason33 is Battle Royale's own; the OG, LEGO and Festival passes are the others.
    expect(br.otherPasses).toBe(3)
  })

  it('reads every season in order, with Battle Passes and crowns', () => {
    expect(br.seasons).toEqual([
      { season: 4, level: 41, wins: 1, crowns: 0, battlePass: false },
      { season: 5, level: 96, wins: 24, crowns: 0, battlePass: true },
      { season: 26, level: 349, wins: 11, crowns: 0, battlePass: true },
      { season: 28, level: 297, wins: 22, crowns: 2, battlePass: true },
    ])
  })

  it('counts the locker by kind and leaves quests and variants out', () => {
    expect(br.locker).toMatchObject({ outfits: 2, emotes: 2, pickaxes: 1, total: 5 })
  })

  it('is null without a profile', () => {
    expect(parseBattleRoyale({ errorCode: 'errors.com.epicgames.common.oauth.invalid_token' })).toBeNull()
  })
})

describe('parseSaveTheWorld', () => {
  it('reads the campaign’s own counters', () => {
    expect(parseSaveTheWorld(campaign)).toEqual({
      startedAt: '2018-06-18T11:52:36.688Z',
      commanderLevel: 310,
      pastMaxRewards: 199,
      matches: 2895,
      missions: 2422,
      cardPacks: 4033,
      daysLoggedIn: 873,
      collectionBookLevel: 261,
      researchMaxed: true,
    })
  })

  it('reads a fresh campaign as zeros, not as missing', () => {
    expect(parseSaveTheWorld(reply({ created: '2025-01-01T00:00:00Z', stats: { attributes: { level: 1 } } }))).toMatchObject({
      commanderLevel: 1,
      matches: 0,
      missions: 0,
      researchMaxed: false,
    })
    expect(parseSaveTheWorld(null)).toBeNull()
  })
})

describe('parseGifts', () => {
  it('reads the gift counts, falling back to the lists', () => {
    expect(parseGifts(reply({ stats: { attributes: { gift_history: { num_sent: 34, num_received: 42, sentTo: { x: '2019' } } } } }))).toEqual({ sent: 34, received: 42 })
    expect(parseGifts(reply({ stats: { attributes: { gift_history: { sentTo: { x: '2019', y: '2020' }, receivedFrom: {} } } } }))).toEqual({ sent: 2, received: 0 })
    expect(parseGifts(reply({ stats: { attributes: {} } }))).toBeNull()
  })
})

describe('seasonName', () => {
  it('names seasons by chapter through Chapter 5, then by number', () => {
    expect(seasonName(4)).toBe('Chapter 1 Season 4')
    expect(seasonName(14)).toBe('Chapter 2 Season 4')
    expect(seasonName(22)).toBe('Chapter 3 Season 4')
    expect(seasonName(26)).toBe('Chapter 4 Season 4')
    expect(seasonName(28)).toBe('Chapter 5 Season 1')
    expect(seasonName(33)).toBe('Season 33')
  })
})

describe('cosmeticFacts', () => {
  const art = (id: string) => `https://fortnite-api.com/images/cosmetics/br/${id}/icon.png`
  // What the catalogue says, keyed by template id (real names, 2026-10-02).
  const catalogue: Record<string, { name: string; rarity: string; series: string | null; introduced: number | null; featured?: boolean }> = {
    'AthenaCharacter:cid_028_athena_commando_f': { name: 'Renegade Raider', rarity: 'rare', series: null, introduced: 1, featured: true },
    'AthenaCharacter:cid_035_athena_commando_m_medieval': { name: 'Black Knight', rarity: 'legendary', series: null, introduced: 2 },
    'AthenaCharacter:cid_a_290_athena_commando_f_motorcyclist': { name: 'Motorcyclist', rarity: 'marvel', series: 'Marvel Series', introduced: 25 },
    'AthenaCharacter:cid_001_athena_commando_f_default': { name: 'Recruit', rarity: 'common', series: null, introduced: 1 },
    'AthenaPickaxe:pickaxe_lockjaw': { name: 'Raider’s Revenge', rarity: 'epic', series: null, introduced: 1 },
  }
  const lookup = (templateId: string) => {
    const known = catalogue[templateId]

    return known
      ? {
          name: known.name,
          rarity: known.rarity,
          series: known.series,
          seriesColors: null,
          icon: art(templateId.split(':')[1]),
          featured: known.featured ? art('featured') : null,
          introduced: known.introduced,
        }
      : null
  }
  const profile = reply({
    items: {
      a: { templateId: 'AthenaCharacter:cid_a_290_athena_commando_f_motorcyclist', attributes: { favorite: true } },
      b: { templateId: 'AthenaCharacter:cid_035_athena_commando_m_medieval', attributes: { favorite: false } },
      c: { templateId: 'AthenaCharacter:cid_028_athena_commando_f', attributes: { favorite: true } },
      d: { templateId: 'AthenaCharacter:cid_001_athena_commando_f_default', attributes: {} },
      e: { templateId: 'AthenaPickaxe:pickaxe_lockjaw', attributes: { favorite: true } },
      f: { templateId: 'AthenaCharacter:cid_unknown', attributes: { favorite: true } },
      g: { templateId: 'Quest:quest_s4', attributes: { favorite: true } },
    },
  })
  const facts = cosmeticFacts(profile, lookup)!

  it('shows favourites, outfits first and best tier first, counting ones it cannot picture', () => {
    expect(facts.favourites.map((item) => item.name)).toEqual(['Motorcyclist', 'Renegade Raider', 'Raider’s Revenge'])
    expect(facts.favouriteCount).toBe(4)
  })

  it('finds the oldest outfits by the season they came out, leaving defaults out', () => {
    expect(facts.oldest.map((item) => [item.name, item.introduced])).toEqual([
      ['Renegade Raider', 1],
      ['Black Knight', 2],
      ['Motorcyclist', 25],
    ])
    expect(facts.chapterOne).toBe(2)
  })

  it('ranks the rarest outfits and counts outfits by tier', () => {
    expect(facts.rarest.map((item) => item.name)).toEqual(['Motorcyclist', 'Black Knight', 'Renegade Raider'])
    expect(facts.byRarity).toEqual([
      { rarity: 'marvel', label: 'Marvel', count: 1 },
      { rarity: 'legendary', label: 'Legendary', count: 1 },
      { rarity: 'rare', label: 'Rare', count: 1 },
    ])
    expect(facts.outfits).toBe(5)
  })

  it('is null without a profile', () => {
    expect(cosmeticFacts(null, lookup)).toBeNull()
  })
})
