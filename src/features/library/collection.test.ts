import type { AccountPlaytime } from '../playtime/model'
import type { AccountLibraryOverview } from './collection'
import type { LibraryRecord } from './account'

import { describe, expect, it } from 'vitest'

import { accountsOwning, buildCollection, modeTimes, sortCollection } from './collection'

const art = (tall: string | null = null) => ({ tall, wide: null })

const record = (appName: string, namespace: string, title: string, acquiredAt: string, tall: string | null = null): LibraryRecord => ({
  appName,
  namespace,
  catalogItemId: null,
  title,
  art: art(tall),
  categories: ['games', 'applications'],
  acquiredAt,
  sandboxName: title,
})

const overview = (records: Array<LibraryRecord>): AccountLibraryOverview => ({
  status: 'ok',
  records,
  access: null,
  checkedAt: '2026-10-02T00:00:00.000Z',
})

const timed = (entries: Array<[string, number]>, achievements: AccountPlaytime['achievements'] = []): AccountPlaytime => ({
  status: 'ok',
  entries: entries.map(([artifactId, seconds]) => ({ artifactId, seconds, kind: 'other', namespace: null, title: null, art: art() })),
  achievements,
  profileVisibility: null,
  allPlatforms: null,
  checkedAt: '2026-10-02T00:00:00.000Z',
})

// Real shapes: Hogwarts Legacy on two of three accounts, recorded 2026-10-02.
const hogwarts = 'e97659b5'
const overviews = {
  a: overview([
    record('Fortnite', 'fn', 'Fortnite', '2018-06-16T00:00:00.000Z'),
    record('hl', hogwarts, 'Hogwarts Legacy', '2025-12-12T00:00:00.000Z', 'https://cdn1.epicgames.com/hl'),
    record('bb', 'wex', 'Battle Breakers', '2020-09-09T00:00:00.000Z'),
  ]),
  b: overview([
    record('hl', hogwarts, 'Hogwarts Legacy', '2025-12-01T00:00:00.000Z'),
    record('civ', 'civ', 'Civilization VI', '2025-07-19T00:00:00.000Z'),
  ]),
  c: { ...overview([]), status: 'unknown' as const },
}
const playtime = {
  a: timed([['hl', 114189]], [{ sandboxId: hogwarts, title: 'Hogwarts Legacy', unlocked: 17, xp: 255, total: 45, totalXp: 1000, platinum: false, art: art() }]),
  b: timed([['hl', 3600], ['civ', 7200]]),
}

describe('buildCollection', () => {
  const { games } = buildCollection({ accountIds: ['a', 'b', 'c'], overviews, playtime })
  const byTitle = Object.fromEntries(games.map((game) => [game.title, game]))

  it('merges a game owned by several accounts, with each owner’s time and achievements', () => {
    expect(byTitle['Hogwarts Legacy'].owners).toEqual([
      expect.objectContaining({ accountId: 'a', seconds: 114189, achievements: expect.objectContaining({ unlocked: 17 }) }),
      expect.objectContaining({ accountId: 'b', seconds: 3600, achievements: null }),
    ])
    expect(byTitle['Hogwarts Legacy'].seconds).toBe(117789)
    expect(byTitle['Hogwarts Legacy'].acquiredAt).toBe('2025-12-01T00:00:00.000Z')
    expect(byTitle['Hogwarts Legacy'].art.tall).toBe('https://cdn1.epicgames.com/hl')
  })

  it('leaves out Fortnite and accounts that could not be read, and keeps unplayed games unplayed', () => {
    expect(Object.keys(byTitle).sort()).toEqual(['Battle Breakers', 'Civilization VI', 'Hogwarts Legacy'])
    expect(byTitle['Battle Breakers'].seconds).toBeNull()
  })

  it('sorts by time, newest or name', () => {
    expect(sortCollection(games, 'played').map((game) => game.title)).toEqual(['Hogwarts Legacy', 'Civilization VI', 'Battle Breakers'])
    expect(sortCollection(games, 'recent').map((game) => game.title)).toEqual(['Hogwarts Legacy', 'Civilization VI', 'Battle Breakers'])
    expect(sortCollection(games, 'name').map((game) => game.title)).toEqual(['Battle Breakers', 'Civilization VI', 'Hogwarts Legacy'])
  })
})

describe('accountsOwning and modeTimes', () => {
  it('says which accounts have a game already', () => {
    expect(accountsOwning(hogwarts, ['a', 'b', 'c'], overviews)).toEqual(['a', 'b'])
    expect(accountsOwning('nobody', ['a', 'b', 'c'], overviews)).toEqual([])
  })

  it('reads a mode’s time per account, telling unread from unplayed', () => {
    expect(modeTimes({ appIds: ['hl'] }, ['a', 'c'], playtime)).toEqual([
      { accountId: 'a', seconds: 114189, read: true },
      { accountId: 'c', seconds: null, read: false },
    ])
  })
})
