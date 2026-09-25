import type { ExpeditionSlot } from '../../../kernel/core/expeditions'
import type { TimelineSeason } from '../../../kernel/core/timeline'
import type { RewardEvent } from '../../../features/automation-rewards/model'

import { describe, expect, it } from 'vitest'

import {
  activeThisWeek,
  digestRewardEvents,
  formatCountdown,
  isDailyQuest,
  msUntilDailyReset,
  seasonClock,
  summariseExpeditions,
} from './-dashboard-model'

describe('home dashboard model', () => {
  it('counts down to 00:00 UTC', () => {
    expect(msUntilDailyReset(Date.parse('2026-09-24T22:30:00Z'))).toBe(90 * 60_000)
    expect(msUntilDailyReset(Date.parse('2026-09-24T00:00:00Z'))).toBe(86_400_000)
  })

  it('formats countdowns', () => {
    expect(formatCountdown(0)).toBe('now')
    expect(formatCountdown(30_000)).toBe('under a minute')
    expect(formatCountdown(12 * 60_000)).toBe('12m')
    expect(formatCountdown((5 * 60 + 12) * 60_000)).toBe('5h 12m')
    expect(formatCountdown((52 * 60 + 5) * 60_000)).toBe('2d 4h')
  })

  it('recognises dailies by category, or by id without the database', () => {
    expect(isDailyQuest('Quest:Daily_DestroyGnomes', 'DailyQuests')).toBe(true)
    expect(isDailyQuest('Quest:Daily_DestroyGnomes', 'Weekly')).toBe(false)
    expect(isDailyQuest('Quest:Daily_DestroyGnomes', null)).toBe(true)
    expect(isDailyQuest('Quest:stonewoodquest_main', undefined)).toBe(false)
  })

  it('summarises expedition slots and finds the next return', () => {
    const slot = (state: ExpeditionSlot['state'], endTime: string | null = null) => ({ state, endTime }) as ExpeditionSlot
    const later = slot('in-flight', '2026-09-24T12:00:00Z')
    const sooner = slot('in-flight', '2026-09-24T10:00:00Z')
    const summary = summariseExpeditions([slot('ready'), later, sooner, slot('available'), slot('available')])
    expect(summary).toMatchObject({ ready: 1, inFlight: 2, available: 2 })
    expect(summary.nextReturn).toBe(sooner)
  })

  it('places now inside the season and picks that week’s shop', () => {
    const season = {
      duration: 4,
      startsAt: '2026-09-01T00:00:00Z',
      endsAt: '2026-09-29T00:00:00Z',
      eventShop: [['a'], ['b'], ['c'], ['d']],
    } as unknown as TimelineSeason
    const clock = seasonClock(season, Date.parse('2026-09-16T00:00:00Z'))
    expect(clock).toMatchObject({ week: 3, weeks: 4, shop: ['c'] })
    expect(clock.endsInMs).toBe(13 * 86_400_000)
    expect(seasonClock(season, Date.parse('2026-10-10T00:00:00Z')).week).toBe(4)
  })

  it('keeps entries running in the given week', () => {
    const entries = [
      { name: 'a', startWeek: 1, endWeek: 2 },
      { name: 'b', startWeek: 3, endWeek: null },
      { name: 'c', startWeek: null, endWeek: null },
    ]
    expect(activeThisWeek(entries, 3).map((e) => e.name)).toEqual(['b', 'c'])
  })

  it('digests the last 24 hours of reward events, newest first', () => {
    const now = Date.parse('2026-09-24T12:00:00Z')
    const event = (id: string, timestamp: string, status: RewardEvent['status'] = 'complete') =>
      ({ id, timestamp, status, received: [{ templateId: 'x', quantity: 2 }], recycled: [{ templateId: 'y', quantity: 1 }], resources: [] }) as unknown as RewardEvent
    const digest = digestRewardEvents([event('old', '2026-09-22T12:00:00Z'), event('a', '2026-09-24T01:00:00Z'), event('b', '2026-09-24T11:00:00Z', 'error')], now)
    expect(digest.events.map((e) => e.id)).toEqual(['b', 'a'])
    expect(digest).toMatchObject({ received: 4, recycled: 2, failed: 1 })
  })
})
