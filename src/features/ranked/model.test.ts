import { describe, expect, it } from 'vitest'

import {
  collapseTracks,
  currentSeason,
  describeRanked,
  formatPromotion,
  isPlacedTrack,
  parseTrackProgress,
  parseTracks,
  peakTrack,
  rankedErrorMessage,
  rankingTypeLabel,
  rankTier,
  rankTierNames,
} from './model'

/** A RankedTrack with just the fields the collapse/placed helpers read. */
function track(
  rankingType: string,
  division: number,
  promotionProgress = 0,
  lastUpdated: string | null = null
) {
  const tier = rankTier(division)
  return {
    trackguid: `${rankingType}-${division}-${promotionProgress}-${lastUpdated ?? ''}`,
    rankingType,
    label: rankingTypeLabel(rankingType),
    tier,
    highestTier: tier,
    promotionProgress,
    showProgress: tier !== null,
    ranking: null,
    season: null,
    lastUpdated,
  }
}

// Shapes as the Habanero service answered `/trackprogress/{accountId}` on
// 2026-10-02: a bare array, one row per active track.
const progressReply = [
  {
    gameId: 'fortnite',
    trackguid: 'br-guid',
    accountId: 'a',
    rankingType: 'ranked-br',
    lastUpdated: '2026-09-30T12:00:00.000Z',
    currentDivision: 7,
    highestDivision: 8,
    promotionProgress: 0.42,
    currentPlayerRanking: null,
  },
  {
    gameId: 'fortnite',
    trackguid: 'zb-guid',
    accountId: 'a',
    rankingType: 'ranked-zb',
    lastUpdated: '2026-09-30T12:00:00.000Z',
    currentDivision: 17,
    highestDivision: 17,
    promotionProgress: 1,
    currentPlayerRanking: 1234,
  },
  {
    gameId: 'fortnite',
    trackguid: 'rr-guid',
    accountId: 'a',
    rankingType: 'delmar-competitive',
    lastUpdated: null,
    currentDivision: -1,
    highestDivision: -1,
    promotionProgress: 0,
    currentPlayerRanking: null,
  },
  // Broken rows: no trackguid, no rankingType, not an object.
  { trackguid: '', rankingType: 'ranked-feral', currentDivision: 3 },
  { trackguid: 'x', currentDivision: 3 },
  null,
]

const tracksReply = [
  { trackguid: 'br-guid', rankingType: 'ranked-br', beginTime: '2026-09-01', endTime: '2026-12-01', season: 35 },
  { trackguid: 'zb-guid', rankingType: 'ranked-zb', season: 35 },
  { trackguid: 'rr-guid', rankingType: 'delmar-competitive', season: 34 },
]

describe('rankTier', () => {
  it('maps every division to its tier, with roman numerals on the graded ones', () => {
    expect(rankTier(0)).toMatchObject({ name: 'Bronze I', group: 'Bronze', roman: 'I', index: 0 })
    expect(rankTier(2)).toMatchObject({ name: 'Bronze III', roman: 'III' })
    expect(rankTier(3)).toMatchObject({ name: 'Silver I', group: 'Silver' })
    expect(rankTier(8)).toMatchObject({ name: 'Gold III', group: 'Gold' })
    expect(rankTier(14)).toMatchObject({ name: 'Diamond III', group: 'Diamond' })
    expect(rankTier(15)).toMatchObject({ name: 'Elite', group: 'Elite', roman: null })
    expect(rankTier(16)).toMatchObject({ name: 'Champion', roman: null })
    expect(rankTier(17)).toMatchObject({ name: 'Unreal', roman: null })
    expect(rankTier(0)?.color).toMatch(/^#/)
  })

  it('has eighteen tiers and no tier for an unplaced or out-of-range division', () => {
    expect(rankTierNames).toHaveLength(18)
    expect(rankTier(-1)).toBeNull()
    expect(rankTier(18)).toBeNull()
    expect(rankTier(3.5)).toBeNull()
    expect(rankTier(null)).toBeNull()
    expect(rankTier(undefined)).toBeNull()
  })
})

describe('rankingTypeLabel', () => {
  it('names every known track', () => {
    expect(rankingTypeLabel('ranked-br')).toBe('Battle Royale (Build)')
    expect(rankingTypeLabel('ranked-zb')).toBe('Zero Build')
    expect(rankingTypeLabel('ranked_blastberry_build')).toBe('Reload (Build)')
    expect(rankingTypeLabel('ranked_blastberry_nobuild')).toBe('Reload (Zero Build)')
    expect(rankingTypeLabel('ranked-feral')).toBe('Ballistic')
    expect(rankingTypeLabel('ranked-figment-build')).toBe('OG (Build)')
    expect(rankingTypeLabel('delmar-competitive')).toBe('Rocket Racing')
  })

  it('humanizes an id it does not know', () => {
    expect(rankingTypeLabel('ranked-splat-build')).toBe('Splat Build')
    expect(rankingTypeLabel('habanero_foo')).toBe('Habanero Foo')
  })
})

describe('parseTrackProgress', () => {
  it('reads every well-formed track row and skips the broken ones', () => {
    const rows = parseTrackProgress(progressReply)

    expect(rows).toHaveLength(3)
    expect(rows).toContainEqual({
      trackguid: 'br-guid',
      rankingType: 'ranked-br',
      currentDivision: 7,
      highestDivision: 8,
      promotionProgress: 0.42,
      currentPlayerRanking: null,
      lastUpdated: '2026-09-30T12:00:00.000Z',
    })
  })

  it('clamps the bar, keeps the Unreal ranking, and reads an unplaced track as -1', () => {
    const rows = parseTrackProgress(progressReply) ?? []
    const unreal = rows.find((row) => row.trackguid === 'zb-guid')
    const unplaced = rows.find((row) => row.trackguid === 'rr-guid')

    expect(unreal?.currentPlayerRanking).toBe(1234)
    expect(unreal?.promotionProgress).toBe(1)
    expect(unplaced?.currentDivision).toBe(-1)
    expect(unplaced?.lastUpdated).toBeNull()
  })

  it('is null when the reply was not an array, and empty when nothing was played', () => {
    expect(parseTrackProgress({ data: null })).toBeNull()
    expect(parseTrackProgress('<html>')).toBeNull()
    expect(parseTrackProgress([])).toEqual([])
  })
})

describe('parseTracks', () => {
  it('reads the tracks and the season, as an array or under a tracks key', () => {
    expect(parseTracks(tracksReply)['br-guid']).toEqual({
      trackguid: 'br-guid',
      rankingType: 'ranked-br',
      beginTime: '2026-09-01',
      endTime: '2026-12-01',
      season: 35,
    })
    expect(parseTracks({ tracks: tracksReply })['zb-guid'].season).toBe(35)
  })

  it('is empty for anything else', () => {
    expect(parseTracks(null)).toEqual({})
    expect(parseTracks({ errors: [{ message: 'x' }] })).toEqual({})
  })
})

describe('describeRanked', () => {
  const tracks = describeRanked(parseTrackProgress(progressReply) ?? [], parseTracks(tracksReply))

  it('labels and orders the tracks, BR then Zero Build then Rocket Racing', () => {
    expect(tracks.map((track) => track.label)).toEqual([
      'Battle Royale (Build)',
      'Zero Build',
      'Rocket Racing',
    ])
  })

  it('shows the bar below Unreal, hides it at Unreal and when unplaced', () => {
    const [br, zb, rr] = tracks

    expect(br.tier?.name).toBe('Gold II')
    expect(br.highestTier?.name).toBe('Gold III')
    expect(br.showProgress).toBe(true)
    expect(br.ranking).toBeNull()

    expect(zb.tier?.name).toBe('Unreal')
    expect(zb.showProgress).toBe(false)
    expect(zb.ranking).toBe(1234)

    expect(rr.tier).toBeNull()
    expect(rr.showProgress).toBe(false)
    expect(rr.season).toBe(34)
  })

  it('still labels tracks when the metadata could not be read', () => {
    const bare = describeRanked(parseTrackProgress(progressReply) ?? [])

    expect(bare.map((track) => track.label)).toEqual([
      'Battle Royale (Build)',
      'Zero Build',
      'Rocket Racing',
    ])
    expect(bare.every((track) => track.season === null)).toBe(true)
  })
})

describe('isPlacedTrack', () => {
  it('treats an untouched Bronze I (division 0, 0%) as not placed', () => {
    expect(isPlacedTrack(track('ranked-br', 0, 0))).toBe(false)
  })

  it('counts any division, promotion progress, or highest as placed', () => {
    expect(isPlacedTrack(track('ranked-br', 3, 0))).toBe(true)
    expect(isPlacedTrack(track('ranked-br', 0, 0.61))).toBe(true)
  })
})

describe('collapseTracks', () => {
  it('keeps one row per ranking type — the best — dropping season/split dupes', () => {
    const collapsed = collapseTracks([
      track('ranked_blastberry_nobuild', 0, 0), // untouched Bronze I ×3
      track('ranked_blastberry_nobuild', 0, 0),
      track('ranked_blastberry_nobuild', 0, 0.61), // played Bronze I
      track('ranked-blastberry-combined', 4, 0.14), // Silver II
      track('ranked-blastberry-combined', 11, 0.5), // Platinum III (best)
    ])

    expect(collapsed).toHaveLength(2)
    const combined = collapsed.find(
      (t) => t.rankingType === 'ranked-blastberry-combined'
    )
    expect(combined?.tier?.name).toBe('Platinum III')
    const reloadZb = collapsed.find(
      (t) => t.rankingType === 'ranked_blastberry_nobuild'
    )
    expect(reloadZb?.promotionProgress).toBe(0.61)
  })

  it('a mode with only untouched tracks collapses to one unplaced row', () => {
    const collapsed = collapseTracks([
      track('ranked-figment-build', 0, 0),
      track('ranked-figment-build', 0, 0),
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed.filter(isPlacedTrack)).toHaveLength(0)
  })
})

describe('currentSeason', () => {
  it('is the newest season among the tracks, or null without one', () => {
    expect(currentSeason(parseTracks(tracksReply))).toBe(35)
    expect(currentSeason({})).toBeNull()
  })
})

describe('peakTrack', () => {
  const tracks = describeRanked(parseTrackProgress(progressReply) ?? [], parseTracks(tracksReply))

  it('is the highest tier across the tracks', () => {
    expect(peakTrack(tracks)?.tier?.name).toBe('Unreal')
  })

  it('is null when nothing is placed', () => {
    const unplaced = describeRanked([
      {
        trackguid: 'rr-guid',
        rankingType: 'delmar-competitive',
        currentDivision: -1,
        highestDivision: -1,
        promotionProgress: 0,
        currentPlayerRanking: null,
        lastUpdated: null,
      },
    ])

    expect(peakTrack(unplaced)).toBeNull()
    expect(peakTrack([])).toBeNull()
  })

  it('breaks a tie by promotion progress', () => {
    const tie = describeRanked([
      {
        trackguid: 'a',
        rankingType: 'ranked-br',
        currentDivision: 7,
        highestDivision: 7,
        promotionProgress: 0.2,
        currentPlayerRanking: null,
        lastUpdated: null,
      },
      {
        trackguid: 'b',
        rankingType: 'ranked-zb',
        currentDivision: 7,
        highestDivision: 7,
        promotionProgress: 0.8,
        currentPlayerRanking: null,
        lastUpdated: null,
      },
    ])

    expect(peakTrack(tie)?.trackguid).toBe('b')
  })
})

describe('formatPromotion', () => {
  it('reads the 0–1 bar as a whole percent', () => {
    expect(formatPromotion(0)).toBe('0%')
    expect(formatPromotion(0.42)).toBe('42%')
    expect(formatPromotion(1)).toBe('100%')
    expect(formatPromotion(2)).toBe('100%')
  })
})

describe('rankedErrorMessage', () => {
  it('says what failed and what to do', () => {
    expect(rankedErrorMessage(403)).toContain('HTTP 403')
    expect(rankedErrorMessage(500)).toBe('Could not read ranked progress (HTTP 500). Try again later.')
    expect(rankedErrorMessage(null)).toBe('Could not read ranked progress. Try again later.')
  })
})
