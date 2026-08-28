import type { CosmeticMeta } from './locker-catalog'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import {
  escapeXml,
  fitLabel,
  planLockerCard,
  renderLockerCard,
  sortForCard,
} from './locker-card'
import { cardGroupOrder } from './locker-loadout'

function cosmetic(overrides: Partial<CosmeticMeta>): CosmeticMeta {
  return {
    templateId: 'AthenaCharacter:cid_001',
    backendType: 'AthenaCharacter',
    id: 'cid_001',
    name: 'Outfit',
    imageUrl: null,
    rarity: 'common',
    series: null,
    seriesColors: null,
    color: null,
    chapter: null,
    added: null,
    resolved: true,
    ...overrides,
  }
}

describe('planLockerCard', () => {
  it('lays a small locker out wider than tall', () => {
    const layout = planLockerCard(100)

    expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(100)
    expect(layout.width).toBeGreaterThan(layout.height)
    expect(layout.tileSize).toBe(128)
  })

  it('never leaves a row short of items', () => {
    for (const count of [1, 2, 7, 43, 512, 4001]) {
      const layout = planLockerCard(count)

      expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(count)
      expect((layout.rows - 1) * layout.columns).toBeLessThan(count)
    }
  })

  it('shrinks the tile rather than the grid to stay inside the canvas limit', () => {
    const huge = planLockerCard(20_000)

    expect(huge.width).toBeLessThanOrEqual(8192)
    expect(huge.height).toBeLessThanOrEqual(8192)
    expect(huge.tileSize).toBeLessThan(128)
    /* The aspect ratio survives the shrink — it is the tile that gives way. */
    expect(huge.width).toBeGreaterThan(huge.height)
  })

  it('leaves room for the chrome above and below the grid', () => {
    const layout = planLockerCard(64)
    const grid =
      layout.rows * layout.tileSize + (layout.rows - 1) * layout.gap

    expect(layout.height).toBe(
      layout.padding * 2 + layout.headerHeight + grid + layout.footerHeight
    )
  })

  it('draws a single item without dividing by zero', () => {
    const layout = planLockerCard(0)

    expect(layout.columns).toBeGreaterThanOrEqual(1)
    expect(layout.rows).toBeGreaterThanOrEqual(1)
  })
})

describe('sortForCard', () => {
  it('groups by kind, then best rarity, then newest, then name', () => {
    const sorted = sortForCard(
      [
        cosmetic({
          backendType: 'AthenaDance',
          id: 'eid_a',
          name: 'An Emote',
          rarity: 'legendary',
        }),
        cosmetic({ id: 'cid_common', name: 'Bravo', rarity: 'common' }),
        cosmetic({ id: 'cid_marvel', name: 'Charlie', rarity: 'marvel' }),
        cosmetic({
          id: 'cid_common_old',
          name: 'Alpha',
          rarity: 'common',
          added: '2018-01-01T00:00:00Z',
        }),
      ],
      cardGroupOrder
    )

    expect(sorted.map((item) => item.id)).toEqual([
      'cid_marvel',
      'cid_common_old',
      'cid_common',
      'eid_a',
    ])
  })

  it('keeps a cosmetic type the shelf order has never heard of, at the end', () => {
    const sorted = sortForCard(
      [
        cosmetic({
          backendType: 'SomethingNew',
          id: 'new_001',
          rarity: 'legendary',
        }),
        cosmetic({ id: 'cid_001', rarity: 'common' }),
      ],
      cardGroupOrder
    )

    expect(sorted.map((item) => item.id)).toEqual(['cid_001', 'new_001'])
  })

  it('does not mutate the list it was given', () => {
    const input = [
      cosmetic({ id: 'a', rarity: 'common' }),
      cosmetic({ id: 'b', rarity: 'legendary' }),
    ]

    sortForCard(input, cardGroupOrder)

    expect(input.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('fitLabel', () => {
  it('leaves a name that fits alone', () => {
    expect(fitLabel('Raven', 112, 14)).toBe('Raven')
  })

  it('clips a name that does not, with an ellipsis', () => {
    const fitted = fitLabel(
      'The Extremely Long Cosmetic Name Of Doom',
      112,
      14
    )

    expect(fitted.endsWith('…')).toBe(true)
    expect(fitted.length).toBeLessThan(40)
  })

  it('always leaves something to read, however narrow the tile', () => {
    expect(fitLabel('Renegade Raider', 1, 14).length).toBeGreaterThan(0)
  })
})

describe('escapeXml', () => {
  it('escapes everything that would break an SVG label', () => {
    expect(escapeXml(`Rock & "Roll" <it> 'up'`)).toBe(
      'Rock &amp; &quot;Roll&quot; &lt;it&gt; &apos;up&apos;'
    )
  })
})

describe('renderLockerCard', () => {
  /*
   * A real sharp render, deliberately with no `imageUrl` anywhere: the point
   * is the geometry and the SVG — that every composite lands inside the
   * canvas and that the text layer parses — not that fortnite-api is
   * reachable from a test runner.
   */
  it('writes a PNG whose size matches the plan', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'penny-locker-'))

    try {
      const cosmetics = Array.from({ length: 17 }, (_, index) =>
        cosmetic({
          id: `cid_${index}`,
          name: index === 0 ? 'A Very Long Cosmetic Name Indeed' : `Item ${index}`,
          rarity: index % 2 === 0 ? 'legendary' : 'marvel',
          color: index === 3 ? '#D92626' : null,
        })
      )
      const layout = planLockerCard(cosmetics.length)
      const card = await renderLockerCard({
        cosmetics,
        directory,
        displayName: 'Test <Account> & Co',
        subtitle: '17 cosmetics',
      })

      expect(card.count).toBe(17)
      expect(card.width).toBe(layout.width)
      expect(card.height).toBe(layout.height)
      expect(card.previewDataUrl.startsWith('data:image/jpeg')).toBe(true)

      const written = await sharp(card.filePath).metadata()

      expect(written.width).toBe(layout.width)
      expect(written.height).toBe(layout.height)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('refuses to draw nothing', async () => {
    await expect(
      renderLockerCard({
        cosmetics: [],
        directory: tmpdir(),
        displayName: 'Nobody',
        subtitle: '',
      })
    ).rejects.toThrow('Nothing to draw')
  })
})
