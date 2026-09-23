import { describe, expect, it } from 'vitest'

import { parseQuestHistory, recentActivity, stormShields, zoneProgress } from './model'
import zoneQuests from './zone-quests.json'

const body = (items: Record<string, unknown>, accountId = 'acc') => ({
  profileChanges: [{ profile: { accountId, profileId: 'campaign', items } }],
})
const quest = (templateId: string, quest_state: string, last_state_change_time?: string) => ({
  templateId,
  attributes: { quest_state, ...(last_state_change_time ? { last_state_change_time } : {}) },
})

describe('quest history', () => {
  it('keeps PennyDB’s questline grouping intact', () => {
    const mapping = zoneQuests as Record<string, Record<string, Array<string>>>
    expect(Object.keys(mapping)).toEqual(['Stonewood', 'Plankerton', 'Canny Valley', 'Twine Peaks'])
    expect(mapping.Stonewood['1']).toEqual(['Before and After Science', 'Ride the Lightning'])
    expect(mapping['Canny Valley']['5']).toContain("When There's a Will...")
    expect(mapping['Twine Peaks']['5']).toHaveLength(20)
  })

  it('reads only quests, with their state and date', () => {
    const history = parseQuestHistory(body({
      a: quest('Quest:outpostquest_t1_l1', 'Claimed', '2024-01-02T00:00:00Z'),
      b: quest('Quest:daily_x', 'Active'),
      c: { templateId: 'Hero:hid_x', attributes: {} },
    }), 'acc')
    expect(history.quests).toEqual([
      { templateId: 'Quest:outpostquest_t1_l1', state: 'claimed', changedAt: '2024-01-02T00:00:00Z' },
      { templateId: 'Quest:daily_x', state: 'active', changedAt: null },
    ])
  })

  it('rejects the wrong profile or account', () => {
    expect(() => parseQuestHistory({ profileChanges: [{ profile: { profileId: 'theater0' } }] }, 'acc')).toThrow()
    expect(() => parseQuestHistory(body({}, 'other'), 'acc')).toThrow()
  })

  it('maps SSD quest ids to zone and level, counting Completed as done', () => {
    const history = parseQuestHistory(body({
      a: quest('Quest:outpostquest_t1_l1', 'Claimed', '2024-01-02T00:00:00Z'),
      b: quest('Quest:outpostquest_t1_l2', 'Completed', '2024-01-03T00:00:00Z'),
      c: quest('Quest:outpostquest_t1_l3', 'Active'),
      d: quest('Quest:outpostquest_t3_l7', 'Claimed', '2024-05-01T00:00:00Z'),
    }), 'acc')
    const [stonewood, plankerton, canny] = stormShields(history)
    expect(stonewood.completed).toBe(2)
    expect(stonewood.levels[1]).toEqual({ level: 2, done: true, doneAt: '2024-01-03T00:00:00Z' })
    expect(stonewood.levels[2].done).toBe(false)
    expect(plankerton.completed).toBe(0)
    expect(canny.levels[6].doneAt).toBe('2024-05-01T00:00:00Z')
  })

  it('groups the zone questline by name and never guesses unnamed quests', () => {
    const names: Record<string, string> = {
      'Quest:a': 'Before and After Science',
      'Quest:b': 'Ride the Lightning',
    }
    const history = parseQuestHistory(body({
      a: quest('Quest:a', 'Claimed', '2024-01-05T00:00:00Z'),
      b: quest('Quest:b', 'Active'),
      c: quest('Quest:unknown', 'Claimed', '2024-01-01T00:00:00Z'),
      d: quest('Quest:outpostquest_t1_l1', 'Claimed', '2024-01-06T00:00:00Z'),
    }), 'acc')
    const stonewood = zoneProgress(history, (id) => names[id])[0]
    expect(stonewood.levels[0].quests).toEqual([
      { name: 'Before and After Science', done: true, doneAt: '2024-01-05T00:00:00Z' },
      { name: 'Ride the Lightning', done: false, doneAt: null },
    ])
    expect(stonewood.levels[0].defence.done).toBe(true)
    expect(stonewood.questsDone).toBe(1)
    expect(stonewood.firstAt).toBe('2024-01-05T00:00:00Z')
    expect(stonewood.lastAt).toBe('2024-01-06T00:00:00Z')
  })

  it('leaves late additions out of the zone date range', () => {
    const names: Record<string, string> = { 'Quest:late': 'Stand and Fight', 'Quest:a': 'Please Hold' }
    const history = parseQuestHistory(body({
      a: quest('Quest:a', 'Claimed', '2019-01-01T00:00:00Z'),
      b: quest('Quest:late', 'Claimed', '2024-06-01T00:00:00Z'),
    }), 'acc')
    const canny = zoneProgress(history, (id) => names[id])[2]
    expect(canny.questsDone).toBe(2)
    expect(canny.lastAt).toBe('2019-01-01T00:00:00Z')
  })

  it('keeps the earliest date when the same quest appears twice', () => {
    const history = parseQuestHistory(body({
      a: quest('Quest:outpostquest_t2_l1', 'Claimed', '2024-03-01T00:00:00Z'),
      b: quest('Quest:outpostquest_t2_l1', 'Claimed', '2024-02-01T00:00:00Z'),
    }), 'acc')
    expect(stormShields(history)[1].levels[0].doneAt).toBe('2024-02-01T00:00:00Z')
  })

  it('lists done quests newest first and skips undated ones', () => {
    const history = parseQuestHistory(body({
      a: quest('Quest:old', 'Claimed', '2024-01-01T00:00:00Z'),
      b: quest('Quest:new', 'Claimed', '2024-06-01T00:00:00Z'),
      c: quest('Quest:nodate', 'Claimed'),
      d: quest('Quest:live', 'Active', '2024-07-01T00:00:00Z'),
    }), 'acc')
    expect(recentActivity(history).map((q) => q.templateId)).toEqual(['Quest:new', 'Quest:old'])
  })
})
