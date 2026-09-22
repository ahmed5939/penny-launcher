import { describe, expect, it } from 'vitest'
import { dueDay, isDailyRerollQuest, selectDailyQuest } from './policy'

const definition = {
  name: 'Daily quest',
  objectives: [{ backendName: 'kills', count: 100 }],
}
const definitions = { 'quest:daily_test': definition }
const item = (progress: number, state = 'Active') => ({
  templateId: 'Quest:daily_test',
  attributes: { quest_state: state, completion_kills: progress },
})

describe('daily reroll selection', () => {
  it('excludes internal daily quest triggers', () => {
    expect(isDailyRerollQuest('Quest:DailyQuestTrigger')).toBe(false)
    expect(isDailyRerollQuest('Quest:DailySurvivorQuestTrigger')).toBe(false)
    expect(isDailyRerollQuest('Quest:daily_test')).toBe(true)
    expect(
      selectDailyQuest(
        { a: { ...item(0), templateId: 'Quest:DailyQuestTrigger' } },
        { 'quest:dailyquesttrigger': definition },
        [],
      ),
    ).toBeNull()
  })
  it('keeps preferred, completed, claimed, non-daily and unknown quests', () => {
    expect(
      selectDailyQuest({ a: item(0) }, definitions, ['Quest:daily_test']),
    ).toBeNull()
    expect(
      selectDailyQuest(
        { a: item(0, 'Completed'), b: item(0, 'Claimed') },
        definitions,
        [],
      ),
    ).toBeNull()
    expect(
      selectDailyQuest(
        { a: { ...item(0), templateId: 'Quest:weekly_test' } },
        definitions,
        [],
      ),
    ).toBeNull()
    expect(selectDailyQuest({ a: item(0) }, {}, [])).toBeNull()
  })
  it('allows exactly 50% but protects greater progress', () => {
    expect(selectDailyQuest({ a: item(50) }, definitions, [])?.itemId).toBe('a')
    expect(selectDailyQuest({ a: item(51) }, definitions, [])).toBeNull()
  })
  it('chooses only one and protects unknown objective counters', () => {
    expect(
      selectDailyQuest({ a: item(0), b: item(10) }, definitions, [])?.itemId,
    ).toBe('b')
    expect(
      selectDailyQuest(
        {
          a: {
            ...item(0),
            attributes: { quest_state: 'Active', completion_unknown: 1 },
          },
        },
        definitions,
        [],
      ),
    ).toBeNull()
    expect(
      selectDailyQuest(
        { a: { ...item(0), attributes: { quest_state: 'Active' } } },
        definitions,
        [],
      ),
    ).toBeNull()
  })
})

describe('UTC daily schedule', () => {
  const config = { enabled: true, keep: [] }
  it('waits until 00:04 UTC and catches up after reopening', () => {
    expect(dueDay(config, new Date('2026-09-20T00:03:59Z'))).toBeNull()
    expect(dueDay(config, new Date('2026-09-20T00:04:00Z'))).toBe('2026-09-20')
    expect(dueDay(config, new Date('2026-09-20T19:00:00Z'))).toBe('2026-09-20')
  })
  it('respects disable, retry delay and persisted daily attempts', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    expect(dueDay({ ...config, enabled: false }, now)).toBeNull()
    expect(dueDay({ ...config, attemptedDay: '2026-09-20' }, now)).toBeNull()
    expect(dueDay({ ...config, checkedDay: '2026-09-20' }, now)).toBeNull()
    expect(dueDay({ ...config, retryAt: now.getTime() + 1 }, now)).toBeNull()
    expect(dueDay({ ...config, attemptedDay: '2026-09-19' }, now)).toBe(
      '2026-09-20',
    )
  })
})
