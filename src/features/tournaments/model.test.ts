import { describe, expect, it } from 'vitest'

import {
  eventTitle,
  eventTitleLine,
  formatPlacement,
  formatPoints,
  isWindowEligible,
  notableEvents,
  parseEventHistory,
  parseEventsData,
  recentEventsForHistory,
  summarizeEvents,
  tournamentsErrorMessage,
} from './model'

// Shapes as `events-public-service-live.ol.epicgames.com` answers them.
const eventsReply = {
  player: {
    accountId: 'abc',
    tokens: ['Verified', 'S33_ArenaDiv7', 'group_a'],
    pendingPayouts: [],
  },
  templates: [
    {
      eventTemplateId: 'Fortnite_S33_FNCS_Trios',
      playlistId: 'Playlist_ShowdownAlt_Trios',
      scoringRules: [],
    },
    { eventTemplateId: 'Fortnite_Arena_Trios', playlistId: 'Playlist_ShowdownAlt_Trios' },
    { eventTemplateId: '', playlistId: 'ignored' },
  ],
  events: [
    {
      eventId: 'epicgames_S33_FNCS_Major1_EU',
      displayDataId: 'epicgames_S33_FNCS_Major1',
      regions: ['EU'],
      beginTime: '2026-09-01T18:00:00.000Z',
      endTime: '2026-09-01T22:00:00.000Z',
      eventWindows: [
        {
          eventWindowId: 'S33_FNCS_Major1_EU_Round1',
          eventTemplateId: 'Fortnite_S33_FNCS_Trios',
          round: 0,
          beginTime: '2026-09-01T18:00:00.000Z',
          endTime: '2026-09-01T20:00:00.000Z',
          requireAllTokens: [],
          requireAnyTokens: ['group_a', 'group_b'],
        },
        {
          eventWindowId: 'S33_FNCS_Major1_EU_Round2',
          eventTemplateId: 'Fortnite_S33_FNCS_Trios',
          round: 1,
          beginTime: '2026-09-01T20:00:00.000Z',
          endTime: '2026-09-01T22:00:00.000Z',
          requireAllTokens: ['S33_FNCS_Major1_Qualified'],
          requireAnyTokens: [],
        },
      ],
    },
    {
      eventId: 'epicgames_Arena_S33_Trios_EU',
      displayDataId: 'epicgames_Arena_S33_Trios',
      regions: ['EU'],
      beginTime: '2026-08-15T00:00:00.000Z',
      endTime: '2026-08-30T00:00:00.000Z',
      eventWindows: [
        {
          eventWindowId: 'Arena_S33_Trios_EU_W1',
          eventTemplateId: 'Fortnite_Arena_Trios',
          round: 0,
          beginTime: '2026-08-15T00:00:00.000Z',
          endTime: '2026-08-30T00:00:00.000Z',
          requireAllTokens: [],
          requireAnyTokens: [],
        },
      ],
    },
    {
      // Future, not held token, never played — noise the account should not see.
      eventId: 'epicgames_S34_Cash_Cup_Solo_NAE',
      displayDataId: 'epicgames_S34_Cash_Cup_Solo',
      regions: ['NAE'],
      beginTime: '2027-01-01T00:00:00.000Z',
      endTime: '2027-01-02T00:00:00.000Z',
      eventWindows: [
        {
          eventWindowId: 'S34_Cash_Cup_Solo_NAE_W1',
          eventTemplateId: 'Fortnite_Cash_Cup_Solo',
          round: 0,
          beginTime: '2027-01-01T00:00:00.000Z',
          endTime: '2027-01-02T00:00:00.000Z',
          requireAllTokens: ['S34_access'],
          requireAnyTokens: [],
        },
      ],
    },
    { displayDataId: 'no event id, dropped' },
  ],
}

const fncsHistory = [
  {
    eventId: 'epicgames_S33_FNCS_Major1_EU',
    eventWindowId: 'S33_FNCS_Major1_EU_Round1',
    pointsEarned: 180,
    rank: 420,
    percentile: 0.08,
    sessionHistory: [{}, {}, {}],
  },
  {
    eventId: 'epicgames_S33_FNCS_Major1_EU',
    eventWindowId: 'S33_FNCS_Major1_EU_Round2',
    pointsEarned: 240,
    rank: 95,
    percentile: 0.02,
    sessionHistory: [{}, {}],
  },
  { eventWindowId: '', rank: 1 },
]

describe('eventTitle', () => {
  it('reads name, season, region and mode out of the ids', () => {
    expect(
      eventTitle(
        'epicgames_S33_FNCS_Major1',
        'epicgames_S33_FNCS_Major1_EU',
        'Playlist_ShowdownAlt_Trios'
      )
    ).toEqual({
      label: 'FNCS Major 1',
      season: 'Season 33',
      // Recovered from the raw eventId; the clean displayDataId omits it.
      region: 'Europe',
      mode: 'Trios',
    })
  })

  it('reads a chapter-and-season id with its own mode and region', () => {
    expect(eventTitle('epicgames_Ch2S5_DreamHack_Duos_NAE', null)).toEqual({
      label: 'Dream Hack',
      season: 'Chapter 2 Season 5',
      region: 'NA East',
      mode: 'Duos',
    })
  })

  it('humanises an unknown shape and never throws on an empty id', () => {
    expect(eventTitle('epicgames_CommunityCup', undefined).label).toBe('Community Cup')
    expect(eventTitle(null, null)).toEqual({
      label: 'Competitive event',
      season: null,
      region: null,
      mode: null,
    })
  })

  it('joins the parts into one caption line', () => {
    expect(
      eventTitleLine({ label: 'FNCS', season: 'Season 33', region: 'Europe', mode: 'Trios' })
    ).toBe('FNCS · Season 33 · Trios · Europe')
  })
})

describe('parseEventsData', () => {
  const data = parseEventsData(eventsReply)

  it('reads the calendar, the account tokens and the template playlists', () => {
    expect(data.events).toHaveLength(3)
    expect(data.tokens).toContain('group_a')
    expect(data.playlists['Fortnite_S33_FNCS_Trios']).toBe('Playlist_ShowdownAlt_Trios')
    expect(data.events[0].windows).toHaveLength(2)
  })

  it('is an empty calendar when the reply did not come through', () => {
    expect(parseEventsData(null)).toEqual({ events: [], playlists: {}, tokens: [] })
    expect(parseEventsData('<html>').events).toEqual([])
  })
})

describe('parseEventHistory', () => {
  it('reads each window result and drops ones with no window id', () => {
    const results = parseEventHistory(fncsHistory)

    expect(results).toHaveLength(2)
    expect(results.find((result) => result.eventWindowId.endsWith('Round2'))).toEqual({
      eventWindowId: 'S33_FNCS_Major1_EU_Round2',
      rank: 95,
      points: 240,
      percentile: 0.02,
      matches: 2,
    })
  })

  it('reads the wrapped-object shape and keeps the best of a repeated window', () => {
    const results = parseEventHistory({
      eventWindowHistory: [
        { eventWindowId: 'w', rank: 300, pointsEarned: 50 },
        { eventWindowId: 'w', rank: 120, pointsEarned: 90 },
      ],
    })

    expect(results).toEqual([
      { eventWindowId: 'w', rank: 120, points: 90, percentile: null, matches: null },
    ])
  })
})

describe('isWindowEligible', () => {
  const tokens = new Set(['group_a'])

  it('clears an open window and a requireAny the account holds', () => {
    expect(
      isWindowEligible({ requireAllTokens: [], requireAnyTokens: [] } as never, tokens)
    ).toBe(true)
    expect(
      isWindowEligible(
        { requireAllTokens: [], requireAnyTokens: ['group_a', 'group_b'] } as never,
        tokens
      )
    ).toBe(true)
  })

  it('blocks a requireAll the account is missing', () => {
    expect(
      isWindowEligible({ requireAllTokens: ['qualified'], requireAnyTokens: [] } as never, tokens)
    ).toBe(false)
  })
})

describe('summarizeEvents', () => {
  const data = parseEventsData(eventsReply)
  const summaries = summarizeEvents(data, {
    'epicgames_S33_FNCS_Major1_EU': parseEventHistory(fncsHistory),
  })

  it('merges history into each event with its best placement and points', () => {
    const fncs = summaries.find((event) => event.eventId === 'epicgames_S33_FNCS_Major1_EU')!

    expect(fncs.played).toBe(true)
    expect(fncs.eligible).toBe(true)
    expect(fncs.bestRank).toBe(95)
    expect(fncs.bestPoints).toBe(240)
    expect(fncs.matchesPlayed).toBe(5)
    // Windows are newest first: Round 2 (20:00) before Round 1 (18:00).
    expect(fncs.windows.map((window) => window.eventWindowId)).toEqual([
      'S33_FNCS_Major1_EU_Round2',
      'S33_FNCS_Major1_EU_Round1',
    ])
    expect(fncs.title.mode).toBe('Trios')
  })

  it('marks an eligible-but-unplayed event and leaves its scores empty', () => {
    const arena = summaries.find((event) => event.eventId === 'epicgames_Arena_S33_Trios_EU')!

    expect(arena.played).toBe(false)
    expect(arena.eligible).toBe(true)
    expect(arena.bestRank).toBeNull()
    expect(arena.bestPoints).toBeNull()
  })

  it('keeps only events the account played or can enter, newest first', () => {
    expect(notableEvents(summaries).map((event) => event.eventId)).toEqual([
      'epicgames_S33_FNCS_Major1_EU',
      'epicgames_Arena_S33_Trios_EU',
    ])
  })
})

describe('recentEventsForHistory', () => {
  it('picks begun, eligible events newest first, capped', () => {
    const data = parseEventsData(eventsReply)

    expect(
      recentEventsForHistory(data, { now: Date.parse('2026-10-01T00:00:00.000Z'), cap: 5 })
    ).toEqual(['epicgames_S33_FNCS_Major1_EU', 'epicgames_Arena_S33_Trios_EU'])
  })
})

describe('formatPlacement and formatPoints', () => {
  it('ordinals the podium, hashes the rest, and dashes the unknown', () => {
    expect(formatPlacement(1)).toBe('1st')
    expect(formatPlacement(2)).toBe('2nd')
    expect(formatPlacement(3)).toBe('3rd')
    expect(formatPlacement(95)).toBe('#95')
    expect(formatPlacement(null)).toBe('—')
    expect(formatPoints(240)).toBe('240 pts')
    expect(formatPoints(1240.6)).toBe('1,241 pts')
    expect(formatPoints(null)).toBe('—')
  })
})

describe('tournamentsErrorMessage', () => {
  it('says what failed and what to do', () => {
    expect(tournamentsErrorMessage(403, 'x')).toContain('HTTP 403')
    expect(tournamentsErrorMessage(null, 'timeout')).toBe(
      'Could not read competitive history (timeout). Try again later.'
    )
  })
})
