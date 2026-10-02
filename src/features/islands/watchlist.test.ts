import { describe, expect, it } from 'vitest'

import {
  applyWatchlistUpdate,
  busyNotification,
  emptyWatchlist,
  evaluateWatch,
  normaliseWatchlist,
  thresholdLabel,
  watchlistLimit,
  type Watchlist,
} from './watchlist'

const now = Date.parse('2026-10-01T21:00:00Z')
const code = '6155-1398-4059'

function withIsland(overrides: Partial<Watchlist['islands'][number]> = {}): Watchlist {
  return {
    version: 1,
    islands: [
      {
        code,
        title: '1V1 WITH EVERY GUN',
        threshold: 1000,
        addedAt: '2026-10-01T00:00:00.000Z',
        lastPeakCcu: null,
        lastCheckedAt: null,
        above: false,
        ...overrides,
      },
    ],
  }
}

describe('threshold crossings', () => {
  it('fires once on the way up', () => {
    let state = { threshold: 1000, above: false }
    const fired: Array<number> = []

    for (const peak of [400, 999, 1000, 1400, 1200, 950, 1100]) {
      const verdict = evaluateWatch(state, peak)

      if (verdict.fire) fired.push(peak)
      state = { ...state, above: verdict.above }
    }

    // 950 is still within 90% of 1,000, so 1,100 does not fire again.
    expect(fired).toEqual([1000])
  })

  it('re-arms only below 90% of the threshold', () => {
    let state = { threshold: 1000, above: true }
    const fired: Array<number> = []

    for (const peak of [905, 899, 950, 1001]) {
      const verdict = evaluateWatch(state, peak)

      if (verdict.fire) fired.push(peak)
      state = { ...state, above: verdict.above }
    }

    expect(fired).toEqual([1001])
  })

  it('holds its state when there is no reading, and never fires without a threshold', () => {
    expect(evaluateWatch({ threshold: 1000, above: true }, null)).toEqual({ above: true, fire: false })
    expect(evaluateWatch({ threshold: null, above: true }, 50_000)).toEqual({ above: false, fire: false })
  })

  it('words the toast as the brief asks', () => {
    expect(busyNotification({ code, title: '1V1 WITH EVERY GUN' }, 14066)).toEqual({
      title: '1V1 WITH EVERY GUN is busy',
      body: `14,066 players in the last 10 minutes · ${code}`,
    })
    expect(thresholdLabel(null)).toBe('No alert')
    expect(thresholdLabel(2500)).toBe('Alert at 2,500 players')
  })
})

describe('watchlist updates', () => {
  it('adds, refuses duplicates and bad codes, and removes', () => {
    const added = applyWatchlistUpdate(emptyWatchlist(), { action: 'add', code, title: '  Box fights  ' }, now)

    expect(added.changed).toBe(true)
    expect(added.list.islands[0]).toEqual({
      code,
      title: 'Box fights',
      threshold: null,
      addedAt: '2026-10-01T21:00:00.000Z',
      lastPeakCcu: null,
      lastCheckedAt: null,
      above: false,
    })
    expect(applyWatchlistUpdate(added.list, { action: 'add', code }, now).changed).toBe(false)
    expect(applyWatchlistUpdate(added.list, { action: 'add', code: 'playlist_solo' }, now).error).toBeDefined()
    expect(applyWatchlistUpdate(added.list, { action: 'remove', code }, now).list.islands).toEqual([])
  })

  it('caps the list', () => {
    const full: Watchlist = {
      version: 1,
      islands: Array.from({ length: watchlistLimit }, (_, index) => ({
        ...withIsland().islands[0],
        code: `1000-0000-${String(index).padStart(4, '0')}`,
      })),
    }

    expect(applyWatchlistUpdate(full, { action: 'add', code }, now)).toMatchObject({ changed: false, error: expect.stringContaining('50') })
  })

  it('arms a new threshold against the count already on screen', () => {
    const busy = withIsland({ lastPeakCcu: 5000, threshold: null })
    const set = applyWatchlistUpdate(busy, { action: 'threshold', code, threshold: 1000 }, now)

    expect(set.list.islands[0]).toMatchObject({ threshold: 1000, above: true })
    expect(applyWatchlistUpdate(withIsland({ lastPeakCcu: 200 }), { action: 'threshold', code, threshold: 1000 }, now).list.islands[0].above).toBe(false)
    expect(applyWatchlistUpdate(busy, { action: 'threshold', code, threshold: null }, now).list.islands[0]).toMatchObject({ threshold: null, above: false })
    expect(applyWatchlistUpdate(busy, { action: 'threshold', code, threshold: -5 }, now).changed).toBe(false)
    expect(applyWatchlistUpdate(busy, { action: 'threshold', code, threshold: 1.5 }, now).changed).toBe(false)
  })

  it('loads a damaged file as far as it makes sense', () => {
    expect(normaliseWatchlist(null)).toEqual(emptyWatchlist())
    expect(normaliseWatchlist({ version: 2, islands: [] })).toEqual(emptyWatchlist())
    expect(
      normaliseWatchlist({
        version: 1,
        islands: [
          { code, title: '', threshold: 0, lastPeakCcu: -3, above: 'yes', addedAt: 'later' },
          { code },
          { code: 'nope' },
          'junk',
        ],
      }).islands
    ).toEqual([
      {
        code,
        title: code,
        threshold: null,
        addedAt: '1970-01-01T00:00:00.000Z',
        lastPeakCcu: null,
        lastCheckedAt: null,
        above: false,
      },
    ])
  })
})
