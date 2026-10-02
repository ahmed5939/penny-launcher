import { describe, expect, it } from 'vitest'

import fixture from './fixtures/ecosystem.json'
import {
  dayFigures,
  formatMinutes,
  formatPercent,
  latestValue,
  normaliseIsland,
  normaliseMetricSet,
  normaliseSeries,
  pickRetention,
} from './metrics'

// The recording was taken a few minutes after 21:00 UTC on 1 October.
const fetchedAt = Date.parse('2026-10-01T21:05:00Z')

describe('ecosystem metrics', () => {
  it('drops the bucket still being counted but keeps a gap in the middle', () => {
    const hour = normaliseMetricSet(fixture.hour)

    expect(fixture.hour.peakCCU).toHaveLength(25)
    expect(hour.peakCCU).toHaveLength(24)
    expect(hour.peakCCU[12]).toEqual({ t: '2026-10-01T09:00:00.000Z', value: null })
    expect(hour.peakCCU.at(-1)).toEqual({ t: '2026-10-01T20:00:00.000Z', value: 8415 })
    expect(latestValue(hour.peakCCU)?.value).toBe(8415)
    // A metric the response did not carry is an empty series, not a crash.
    expect(normaliseMetricSet({}).plays).toEqual([])
  })

  it('reads the ten-minute peak the watchlist alerts on', () => {
    const minute = normaliseMetricSet(fixture.minute)

    expect(minute.peakCCU).toHaveLength(6)
    expect(latestValue(minute.peakCCU)).toEqual({ t: '2026-10-01T20:50:00.000Z', value: 8415 })
  })

  it('sorts, de-duplicates and ignores junk points', () => {
    expect(
      normaliseSeries([
        { value: 3, timestamp: '2026-10-01T02:00:00Z' },
        { value: 1, timestamp: '2026-10-01T00:00:00Z' },
        { value: 'x', timestamp: '2026-10-01T01:00:00Z' },
        { value: 9, timestamp: 'not a date' },
        null,
        { value: 2, timestamp: '2026-10-01T00:00:00Z' },
        { value: null, timestamp: '2026-10-01T03:00:00Z' },
      ])
    ).toEqual([
      { t: '2026-10-01T00:00:00Z', value: 2 },
      { t: '2026-10-01T01:00:00Z', value: null },
      { t: '2026-10-01T02:00:00Z', value: 3 },
    ])
    expect(normaliseSeries({})).toEqual([])
    expect(latestValue([{ t: 'a', value: null }])).toBeNull()
  })

  it('quotes the last finished day, with its own retention', () => {
    const day = normaliseMetricSet(fixture.day)
    const figures = dayFigures(day, fetchedAt)

    expect(figures).toMatchObject({
      t: '2026-09-30T00:00:00.000Z',
      partial: false,
      uniquePlayers: 323115,
      plays: 476660,
      minutesPlayed: 11139386,
      favorites: 2068,
      peakCCU: 14066,
    })
    expect(pickRetention(fixture.day.retention, day, fetchedAt)).toEqual({ d1: 0.34, d7: 0.2 })
  })

  it('falls back to today, flagged, when no day has finished', () => {
    const day = normaliseMetricSet(fixture.day)
    const early = Date.parse('2026-09-30T12:00:00Z')

    expect(dayFigures(day, early)).toMatchObject({ t: '2026-10-01T00:00:00.000Z', partial: true, plays: 321929 })
    expect(dayFigures(normaliseMetricSet(null), fetchedAt)).toBeNull()
    expect(pickRetention(null, day, fetchedAt)).toBeNull()
    expect(pickRetention([{ d1: 5, d7: null, timestamp: '2026-09-30T00:00:00.000Z' }], day, fetchedAt)).toBeNull()
  })

  it('reads island metadata defensively', () => {
    expect(normaliseIsland(fixture.island)).toEqual({
      title: '1V1 WITH EVERY GUN',
      creatorCode: 'hive',
      createdIn: 'UEFN',
      tags: ['pvp', 'just for fun', '1v1'],
    })
    expect(normaliseIsland({ tags: [1, ' ok '] })).toEqual({ title: null, creatorCode: null, createdIn: null, tags: ['ok'] })
    expect(normaliseIsland('x')).toBeNull()
  })

  it('formats retention and play time for reading', () => {
    expect(formatPercent(0.344)).toBe('34%')
    expect(formatPercent(null)).toBe('—')
    expect(formatMinutes(11139386)).toBe('185,656 hours')
    expect(formatMinutes(812)).toBe('812 minutes')
  })
})
