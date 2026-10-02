import { describe, expect, it } from 'vitest'

import fixture from './fixtures/discover.json'
import {
  appendPage,
  branchFromVersion,
  buildPanels,
  deltaOneHour,
  discoverySummary,
  formatDelta,
  formatPlayers,
  historyLimits,
  panelKey,
  parseDiscoveryToken,
  parseHistory,
  parseLinks,
  parseSurface,
  parseSurfacePage,
  recordHistory,
  risingIslands,
  serialiseHistory,
  uniqueIslands,
  withTrends,
} from './model'

const minute = 60 * 1000
const now = Date.parse('2026-10-01T21:00:00Z')

/** The documented surface, with one constructed panel of creator islands after it. */
const surface = parseSurface({
  ...fixture.docSurface,
  panels: [...fixture.docSurface.panels, fixture.constructedPanel],
})
const links = parseLinks([...fixture.docLinks, ...fixture.constructedLinks])
const panels = buildPanels(surface, links)

describe('discovery access', () => {
  it('finds the branch in a build version or a user agent', () => {
    expect(branchFromVersion('++Fortnite+Release-38.10-CL-47722112-Windows')).toBe('++Fortnite+Release-38.10')
    expect(branchFromVersion('Fortnite/++Fortnite+Release-38.10-CL-47722112 Windows/10.0.26100.1.256.64bit')).toBe('++Fortnite+Release-38.10')
    expect(branchFromVersion('++Fortnite+Release-37.51')).toBe('++Fortnite+Release-37.51')
    expect(branchFromVersion('')).toBeNull()
    expect(branchFromVersion(undefined)).toBeNull()
  })

  it('reads the token out of the documented response', () => {
    expect(parseDiscoveryToken(fixture.docToken)).toBe(fixture.docToken.token)
    expect(parseDiscoveryToken({ token: '' })).toBeNull()
    expect(parseDiscoveryToken(null)).toBeNull()
  })
})

describe('discovery surface', () => {
  it('parses the documented response', () => {
    const documented = parseSurface(fixture.docSurface)

    expect(documented.testVariantName).toBe('Baseline')
    expect(documented.panels).toEqual([
      { name: 'Featured_EpicPage', label: 'Featured', results: [{ code: 'playlist_juno', ccu: 56152 }], hasMore: false },
      { name: 'PublishedIslands', label: 'More Islands', results: [], hasMore: false },
    ])
  })

  it('drops invisible, duplicate and malformed tiles and keeps a hidden count hidden', () => {
    const shooters = surface.panels[2]

    expect(shooters.label).toBe('By Epic No Build Shooters')
    expect(shooters.hasMore).toBe(true)
    expect(shooters.results).toEqual([
      { code: '2198-3887-7937', ccu: 1714 },
      { code: '6155-1398-4059', ccu: 8415 },
      { code: '5066-7426-3382', ccu: null },
      { code: '0468-6365-1453', ccu: 107 },
    ])
    expect(parseSurface(null)).toEqual({ testVariantName: null, panels: [] })
    expect(parseSurface({ panels: [{ panelDisplayName: 'No name' }, 'junk'] }).panels).toEqual([])
  })

  it('adds a further page without repeating tiles', () => {
    const next = appendPage(surface.panels[0], {
      ...fixture.docPage,
      results: [...fixture.docPage.results, { linkCode: 'playlist_juno', globalCCU: 1, isVisible: true }],
    })

    expect(next.results.map((result) => result.code)).toEqual(['playlist_juno', 'set_habanero_blastberry_playlists'])
    expect(next.results[1].ccu).toBe(370554)
    expect(next.hasMore).toBe(false)
    expect(parseSurfacePage(fixture.docPage).results).toHaveLength(1)
  })
})

describe('links service', () => {
  it('reads titles, art and creators from the documented response', () => {
    expect(links.get('playlist_defaultsolo')).toEqual({
      code: 'playlist_defaultsolo',
      title: 'Solo',
      imageUrl: 'https://cdn2.unrealengine.com/solosize-640-640x360-0062a2e4e8b4.jpg',
      heroImageUrl: 'https://cdn2.unrealengine.com/solosize-1920-1920x1080-741c5c77900f.jpg',
      creator: 'Epic',
      ageRating: null,
      linkType: 'BR:Playlist',
      disabled: false,
    })
  })

  it('states an age only when a rating board gives one, preferring the generic board', () => {
    expect(links.get('6155-1398-4059')?.ageRating).toBe('12+')
    expect(links.get('6155-1398-4059')?.imageUrl).toMatch(/landscape_comp_m\.jpeg$/)
    expect(links.has('../../etc')).toBe(false)
  })
})

describe('cards', () => {
  it('skips empty panels and disabled links, and keeps Epic playlists', () => {
    expect(panels.map((panel) => [panel.key, panel.label])).toEqual([
      ['featured-epicpage', 'Featured'],
      ['byepicnobuild-shooters', 'By Epic No Build Shooters'],
    ])
    expect(panels[1].islands.map((island) => island.code)).toEqual(['2198-3887-7937', '6155-1398-4059', '5066-7426-3382'])
  })

  it('falls back to the code when the links service has nothing, and only links creator islands to fortnite.com', () => {
    const [juno] = panels[0].islands
    const [unknown, described] = panels[1].islands

    expect(juno).toMatchObject({ code: 'playlist_juno', title: 'playlist_juno', imageUrl: null, url: null, ccu: 56152 })
    expect(unknown).toMatchObject({ title: '2198-3887-7937', url: 'https://www.fortnite.com/creative/island-codes/2198-3887-7937' })
    expect(described).toMatchObject({
      title: '1V1 WITH EVERY GUN',
      creator: 'hive',
      ageRating: '12+',
      heroImageUrl: expect.stringMatching(/landscape_comp\.jpeg$/),
      delta1h: null,
    })
  })

  it('keeps panel keys unique', () => {
    const twice = buildPanels(
      { testVariantName: null, panels: [surface.panels[0], { ...surface.panels[0], label: 'Again' }] },
      links
    )

    expect(twice.map((panel) => panel.key)).toEqual(['featured-epicpage', 'featured-epicpage-2'])
    expect(panelKey('Genre & More')).toBe('genre-and-more')
  })

  it('counts an island on two panels once', () => {
    const doubled = [...panels, { ...panels[1], key: 'again' }]
    const summary = discoverySummary(doubled)

    expect(uniqueIslands(doubled)).toHaveLength(4)
    expect(summary).toMatchObject({ islands: 4, hidden: 1, players: 56152 + 1714 + 8415 })
    expect(summary.busiest?.code).toBe('playlist_juno')
    expect(formatPlayers(null)).toBe('—')
    expect(formatPlayers(0)).toBe('0')
  })
})

describe('hour-on-hour trend', () => {
  it('compares against the sample nearest an hour ago', () => {
    const samples = [
      { t: now - 120 * minute, ccu: 10 },
      { t: now - 85 * minute, ccu: 40 },
      { t: now - 62 * minute, ccu: 50 },
      { t: now - 45 * minute, ccu: 70 },
      { t: now - 5 * minute, ccu: 90 },
    ]

    expect(deltaOneHour(samples, 100, now)).toBe(50)
    expect(formatDelta(50)).toBe('+50')
    expect(formatDelta(-1200)).toBe('−1,200')
  })

  it('says nothing without a sample 40–90 minutes old', () => {
    expect(deltaOneHour([{ t: now - 20 * minute, ccu: 5 }], 10, now)).toBeNull()
    expect(deltaOneHour([{ t: now - 120 * minute, ccu: 5 }], 10, now)).toBeNull()
    expect(deltaOneHour([], 10, now)).toBeNull()
    expect(deltaOneHour(undefined, 10, now)).toBeNull()
    expect(deltaOneHour([{ t: now - 60 * minute, ccu: 5 }], null, now)).toBeNull()
  })

  it('fills deltas from history and ranks the risers', () => {
    const history = {
      '2198-3887-7937': [{ t: now - 60 * minute, ccu: 1000 }],
      '6155-1398-4059': [{ t: now - 70 * minute, ccu: 8400 }],
      playlist_juno: [{ t: now - 55 * minute, ccu: 60000 }],
    }
    const trended = withTrends(panels, history, now)

    expect(risingIslands(trended).map((island) => [island.code, island.delta1h])).toEqual([
      ['2198-3887-7937', 714],
      ['6155-1398-4059', 15],
    ])
    expect(trended[0].islands[0].delta1h).toBe(56152 - 60000)
    expect(risingIslands(panels)).toEqual([])
  })
})

describe('history file', () => {
  it('appends at most one sample per spacing and skips hidden counts', () => {
    const first = recordHistory({}, [{ code: 'a', ccu: 5 }, { code: 'b', ccu: null }], now)
    const tooSoon = recordHistory(first, [{ code: 'a', ccu: 9 }], now + 5 * minute)
    const later = recordHistory(tooSoon, [{ code: 'a', ccu: 9 }], now + historyLimits.spacingMs)

    expect(first).toEqual({ a: [{ t: now, ccu: 5 }] })
    expect(tooSoon).toEqual(first)
    expect(later.a).toHaveLength(2)
  })

  it('forgets samples older than a day and caps the island count', () => {
    const old = { a: [{ t: now - 25 * 60 * minute, ccu: 1 }], b: [{ t: now - minute, ccu: 2 }] }

    expect(recordHistory(old, [], now)).toEqual({ b: [{ t: now - minute, ccu: 2 }] })

    const many = Object.fromEntries(
      Array.from({ length: historyLimits.maxIslands + 3 }, (_, index) => [
        `c${index}`,
        [{ t: now - (index + 1) * 1000, ccu: index }],
      ])
    )
    const capped = recordHistory(many, [], now)

    expect(Object.keys(capped)).toHaveLength(historyLimits.maxIslands)
    // The three seen longest ago go.
    expect(capped[`c${historyLimits.maxIslands + 2}`]).toBeUndefined()
    expect(capped.c0).toBeDefined()
  })

  it('round-trips through the file format and rejects junk', () => {
    const history = { '1111-2222-3333': [{ t: now - minute, ccu: 3 }, { t: now, ccu: 4 }] }

    expect(parseHistory(JSON.parse(JSON.stringify(serialiseHistory(history))))).toEqual(history)
    expect(parseHistory({ version: 2, islands: {} })).toEqual({})
    expect(parseHistory({ version: 1, islands: { '../x': [[1, 2]], ok: [[1, -1], ['x', 2], [5, 6]] } })).toEqual({
      ok: [{ t: 5, ccu: 6 }],
    })
    expect(parseHistory('nonsense')).toEqual({})
  })
})
