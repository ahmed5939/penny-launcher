import type { SpriteData } from './sprite-collection'
import type {
  SpriteHistoryFile,
  SpriteRelicState,
  SpriteSnapshot,
} from './sprite-history-model'

import { describe, expect, it } from 'vitest'

import {
  catalogueStatus,
  clampWatchInterval,
  diffSnapshots,
  emptySpriteHistory,
  historyEventLimit,
  normaliseSpriteHistory,
  observeCatalogue,
  recordSnapshot,
  summariseAccounts,
  summariseBatch,
} from './sprite-history-model'

const data: SpriteData = {
  families: {
    Water: {
      name: 'Water',
      rarity: 'rare',
      season: 'c7s3',
      ability: null,
      icons: { base: 'water_base.webp', gold: 'water_gold.webp' },
    },
    Klombo: {
      name: 'Klombo',
      rarity: 'mythic',
      season: 'c7s4',
      ability: null,
      icons: { base: 'klombo_base.webp' },
    },
  },
}

const owned = (xp: number | null = 10, mastered = false): SpriteRelicState => ({
  status: 'owned',
  xp,
  mastered,
})
const lost: SpriteRelicState = { status: 'lost', xp: null, mastered: false }

function snapshot(
  relics: Record<string, SpriteRelicState>,
  { dust = 500, equipped = null }: { dust?: number | null; equipped?: string | null } = {}
): SpriteSnapshot {
  return { dust, equippedRelicId: equipped, relics }
}

const t0 = new Date('2026-09-01T10:00:00Z')
const t1 = new Date('2026-09-01T10:30:00Z')

function withBaseline(base: SpriteSnapshot): SpriteHistoryFile {
  return recordSnapshot(emptySpriteHistory(), 'main', base, t0).file
}

describe('recordSnapshot', () => {
  it('keeps the first read of an account as a silent baseline', () => {
    const result = recordSnapshot(
      emptySpriteHistory(),
      'main',
      snapshot({ Water_Variant_A: owned(), Water_Variant_Gold: owned() }),
      t0
    )

    expect(result.events).toEqual([])
    expect(result.file.events).toEqual([])
    expect(result.file.accounts.main.updatedAt).toBe(t0.toISOString())
  })

  it('tells a first catch apart from a lost sprite caught again', () => {
    const file = withBaseline(snapshot({ Water_Variant_Gold: lost }))
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_Gold: owned(), Klombo_Variant_A: owned() }),
      t1
    )

    expect(events.map((event) => [event.kind, event.relicId])).toEqual([
      ['secured', 'Klombo_Variant_A'],
      ['recovered', 'Water_Variant_Gold'],
    ])
    expect(new Set(events.map((event) => event.batchId)).size).toBe(1)
    expect(events.every((event) => event.at === t1.toISOString())).toBe(true)
  })

  it('reports an owned sprite that reads as lost', () => {
    const file = withBaseline(snapshot({ Water_Variant_Gold: owned() }))
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_Gold: lost }),
      t1
    )

    expect(events.map((event) => event.kind)).toEqual(['lost'])
  })

  it('says nothing about a sprite first seen as lost', () => {
    const file = withBaseline(snapshot({}))
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_Gold: lost }),
      t1
    )

    expect(events).toEqual([])
  })

  it('reports mastery once, when it is first reached', () => {
    const file = withBaseline(snapshot({ Water_Variant_A: owned(900) }))
    const first = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_A: owned(1000, true) }),
      t1
    )
    const again = recordSnapshot(
      first.file,
      'main',
      snapshot({ Water_Variant_A: owned(1000, true) }),
      new Date('2026-09-01T11:00:00Z')
    )

    expect(first.events.map((event) => event.kind)).toEqual(['mastered'])
    expect(again.events).toEqual([])
  })

  it('reports a newly equipped sprite with the one it replaced', () => {
    const file = withBaseline(
      snapshot({ Water_Variant_A: owned(), Klombo_Variant_A: owned() }, {
        equipped: 'Water_Variant_A',
      })
    )
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_A: owned(), Klombo_Variant_A: owned() }, {
        equipped: 'Klombo_Variant_A',
      }),
      t1
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: 'equipped',
      relicId: 'Klombo_Variant_A',
      previousRelicId: 'Water_Variant_A',
    })
  })

  it('ignores the same relic spelt another way', () => {
    const file = withBaseline(
      snapshot({ Water_Variant_A: owned() }, { equipped: 'Water_Variant_A' })
    )
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variation_Base: owned() }, {
        equipped: 'Water_Variation_Base',
      }),
      t1
    )

    expect(events).toEqual([])
  })

  it('puts the batch dust change on every event, and null when unknown', () => {
    const file = withBaseline(snapshot({}, { dust: 500 }))
    const gained = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_A: owned() }, { dust: 740 }),
      t1
    )
    const unknown = recordSnapshot(
      gained.file,
      'main',
      snapshot({ Water_Variant_A: owned(), Klombo_Variant_A: owned() }, {
        dust: null,
      }),
      new Date('2026-09-01T11:00:00Z')
    )

    expect(gained.events[0].dustDelta).toBe(240)
    expect(unknown.events[0].dustDelta).toBeNull()
  })

  it('keeps a relic a partial read left out, so the next full read is not news', () => {
    const file = withBaseline(
      snapshot({ Water_Variant_A: owned(), Klombo_Variant_A: owned() })
    )
    const partial = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_A: owned() }),
      t1
    )
    const full = recordSnapshot(
      partial.file,
      'main',
      snapshot({ Water_Variant_A: owned(), Klombo_Variant_A: owned() }),
      new Date('2026-09-01T11:00:00Z')
    )

    expect(partial.events).toEqual([])
    expect(partial.file.accounts.main.snapshot.relics).toHaveProperty(
      'Klombo_Variant_A'
    )
    expect(full.events).toEqual([])
  })

  it('caps the log, newest first', () => {
    let file = emptySpriteHistory()

    file = {
      ...file,
      events: Array.from({ length: historyEventLimit }, (_, index) => ({
        id: `old-${index}`,
        batchId: 'old',
        accountId: 'main',
        at: t0.toISOString(),
        kind: 'secured' as const,
        relicId: 'Water_Variant_A',
        previousRelicId: null,
        dustDelta: null,
      })),
      accounts: {
        main: { updatedAt: t0.toISOString(), snapshot: snapshot({}) },
      },
    }

    const result = recordSnapshot(
      file,
      'main',
      snapshot({ Klombo_Variant_A: owned() }),
      t1
    )

    expect(result.file.events).toHaveLength(historyEventLimit)
    expect(result.file.events[0].relicId).toBe('Klombo_Variant_A')
    expect(result.file.events.at(-1)?.id).toBe(`old-${historyEventLimit - 2}`)
  })
})

describe('diffSnapshots', () => {
  it('does not call a relic missing from the read lost', () => {
    const { changes } = diffSnapshots(
      snapshot({ Water_Variant_A: owned() }),
      snapshot({})
    )

    expect(changes).toEqual([])
  })
})

describe('catalogue tracking', () => {
  it('takes the first catalogue read as a baseline with no dates', () => {
    const record = observeCatalogue(
      { knownRelicIds: [], firstSeen: {} },
      ['Water_Variant_A', 'Currency_ExtractionPoints', 'Water_Variant_Gold'],
      t0
    )

    expect(record.knownRelicIds).toEqual(['Water_Variant_A', 'Water_Variant_Gold'])
    expect(record.firstSeen).toEqual({
      Water_Variant_A: null,
      Water_Variant_Gold: null,
    })
  })

  it('stamps relics that turn up later, and returns the same record when nothing is new', () => {
    const baseline = observeCatalogue(
      { knownRelicIds: [], firstSeen: {} },
      ['Water_Variant_A'],
      t0
    )
    const later = observeCatalogue(
      baseline,
      ['Water_Variation_Base', 'Frog_Variant_A'],
      t1
    )

    expect(later.firstSeen.Frog_Variant_A).toBe(t1.toISOString())
    expect(later.knownRelicIds).toEqual(['Frog_Variant_A', 'Water_Variant_A'])
    expect(observeCatalogue(later, ['Frog_Variant_A'], t1)).toBe(later)
  })

  it('lists relics first seen in the last fortnight as new, and ones with no data as unresolved', () => {
    const record = {
      knownRelicIds: ['Frog_Variant_A', 'Klombo_Variant_A', 'Water_Variant_Gold'],
      firstSeen: {
        Frog_Variant_A: '2026-09-25T00:00:00Z',
        Klombo_Variant_A: '2026-09-01T00:00:00Z',
        Water_Variant_Gold: null,
      },
    }
    const status = catalogueStatus(record, {
      now: new Date('2026-10-02T00:00:00Z'),
      source: data,
      version: 15,
      versionNote: 'moved',
    })

    expect(status).toEqual({
      version: 15,
      newRelicIds: ['Frog_Variant_A'],
      unresolvedRelicIds: ['Frog_Variant_A'],
      versionNote: 'moved',
    })
  })
})

describe('summaries', () => {
  it('names the most interesting change and counts the rest', () => {
    const file = withBaseline(snapshot({}))
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({
        Water_Variant_Gold: owned(),
        Water_Variant_A: owned(),
        Klombo_Variant_A: owned(),
      }),
      t1
    )

    expect(summariseBatch(events, 'Main', data)).toBe(
      'Main secured Klombo and 2 more.'
    )
  })

  it('leaves equipping out of a toast', () => {
    const file = withBaseline(snapshot({ Water_Variant_A: owned() }))
    const { events } = recordSnapshot(
      file,
      'main',
      snapshot({ Water_Variant_A: owned() }, { equipped: 'Water_Variant_A' }),
      t1
    )

    expect(events.map((event) => event.kind)).toEqual(['equipped'])
    expect(summariseBatch(events, 'Main', data)).toBeNull()
  })

  it('summarises each account with its equipped sprite resolved', () => {
    const file = withBaseline(
      snapshot({ Water_Variant_Gold: owned(), Klombo_Variant_A: lost }, {
        dust: 120,
        equipped: 'Water_Variant_Gold',
      })
    )

    expect(summariseAccounts(file, data).main).toEqual({
      updatedAt: t0.toISOString(),
      equippedRelicId: 'Water_Variant_Gold',
      equipped: { name: 'Gold Water', iconFile: 'water_gold.webp', rarity: 'rare' },
      dust: 120,
      ownedCount: 1,
    })
  })
})

describe('reading the file back', () => {
  it('drops malformed parts and clamps the watch interval', () => {
    const file = normaliseSpriteHistory({
      version: 1,
      watch: { enabled: true, intervalMinutes: 2 },
      catalogue: { knownRelicIds: ['Water_Variant_A', 4], firstSeen: { Water_Variant_A: 'x' } },
      accounts: {
        main: { updatedAt: t0.toISOString(), snapshot: { dust: 'lots', relics: { Water_Variant_A: { status: 'owned' }, Bad: { status: 'gone' } } } },
        broken: { snapshot: {} },
      },
      events: [{ id: 'a' }, null],
    })

    expect(file.watch).toEqual({ enabled: true, intervalMinutes: 15 })
    expect(file.catalogue.knownRelicIds).toEqual(['Water_Variant_A'])
    expect(Object.keys(file.accounts)).toEqual(['main'])
    expect(file.accounts.main.snapshot).toEqual({
      dust: null,
      equippedRelicId: null,
      relics: { Water_Variant_A: { status: 'owned', xp: null, mastered: false } },
    })
    expect(file.events).toEqual([])
  })

  it('starts empty from another version or junk', () => {
    expect(normaliseSpriteHistory({ version: 2 })).toEqual(emptySpriteHistory())
    expect(normaliseSpriteHistory('nope')).toEqual(emptySpriteHistory())
    expect(clampWatchInterval(undefined)).toBe(30)
    expect(clampWatchInterval(10_000)).toBe(24 * 60)
  })
})
