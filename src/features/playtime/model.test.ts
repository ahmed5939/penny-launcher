import { describe, expect, it } from 'vitest'

import {
  describePlaytime,
  displayTitle,
  formatPlaytime,
  fortniteSeconds,
  graphQLProblems,
  knownApps,
  mergeAppInfo,
  parseAppBuilds,
  parsePlaytimeTotals,
  playtimeErrorMessage,
  unnamedApps,
} from './model'

// Shapes as `launcher.store.epicgames.com/graphql` answered on 2026-10-02.
const playtimeReply = {
  data: {
    PlaytimeTracking: {
      total: [
        { artifactId: '33e479c9bc124e5b8b456e5c2e813032', totalTime: 1802 },
        { artifactId: '94bc5ec13f8f438c97fdbef3e9019e27', totalTime: 21430 },
        { artifactId: 'Fortnite', totalTime: 1448314 },
        { artifactId: 'Fortnite_Studio', totalTime: 5832 },
        { artifactId: 'aa31f9e94e844b299ca757d1d0b97a09', totalTime: 296822 },
        { artifactId: 'afdb5a85efcc45d8ae8e406e2121d81c', totalTime: 287 },
        { artifactId: 'fa4240e57a3c46b39f169041b7811293', totalTime: 114189 },
      ],
    },
  },
}

const deniedReply = {
  errors: [
    {
      message:
        'PlaytimeTrackingQuery/total: Failed to get total playtime: Error: Request failed with status code 403',
      status: 403,
    },
  ],
  data: { PlaytimeTracking: { total: null } },
}

const art = (name: string) => `https://cdn1.epicgames.com/item/fn/${name}.jpg`

const buildsReply = {
  data: {
    Launcher: {
      appBuilds: [
        {
          appName: 'Fortnite',
          namespace: 'fn',
          catalogItem: {
            title: 'Fortnite',
            keyImages: [
              { type: 'DieselGameBox', url: art('fn-wide') },
              { type: 'DieselGameBoxTall', url: art('fn-tall') },
            ],
          },
        },
        {
          appName: 'aa31f9e94e844b299ca757d1d0b97a09',
          namespace: 'fn',
          catalogItem: {
            title: 'Fortnite Save the World Content',
            keyImages: [{ type: 'OfferImageTall', url: art('stw-tall') }],
          },
        },
        {
          appName: '94bc5ec13f8f438c97fdbef3e9019e27',
          namespace: 'fn',
          catalogItem: { title: 'LEGO® Fortnite Content', keyImages: [] },
        },
        {
          appName: 'Fortnite_Studio',
          namespace: 'fn',
          catalogItem: { title: 'Unreal Editor for Fortnite', keyImages: [] },
        },
        {
          appName: 'fa4240e57a3c46b39f169041b7811293',
          namespace: 'e97659b501af4e3981d5430dad170911',
          catalogItem: {
            title: 'Hogwarts Legacy',
            keyImages: [
              // Not an art host the app allows: dropped.
              { type: 'DieselGameBoxTall', url: 'https://example.com/hl.jpg' },
            ],
          },
        },
        {
          appName: '33e479c9bc124e5b8b456e5c2e813032',
          namespace: '0cdc1f2bb18a4384a96ddac4c5c84886',
          catalogItem: { title: 'Operation Tango - Friend Pass' },
        },
        { appName: 'UE_5.4', namespace: 'ue', catalogItem: { title: 'Unreal Engine' } },
        { appName: 'UE_5.4', namespace: 'ue', catalogItem: { title: 'Duplicate' } },
        { namespace: 'ue', catalogItem: { title: 'No app name' } },
      ],
    },
  },
}

describe('graphQLProblems', () => {
  it('reads the service status out of an HTTP 200 refusal', () => {
    expect(graphQLProblems(deniedReply)).toEqual([
      {
        message: expect.stringContaining('status code 403'),
        status: 403,
      },
    ])
  })

  it('takes the status from extensions, and none from nonsense', () => {
    expect(
      graphQLProblems({
        errors: [
          { message: 'a', extensions: { status: 404 } },
          { message: 'b', status: 'x' },
          'junk',
          {},
        ],
      })
    ).toEqual([
      { message: 'a', status: 404 },
      { message: 'b', status: null },
      { message: 'Unknown GraphQL error', status: null },
    ])
  })

  it('is empty for a clean reply or no reply', () => {
    expect(graphQLProblems(playtimeReply)).toEqual([])
    expect(graphQLProblems(null)).toEqual([])
    expect(graphQLProblems('<html>')).toEqual([])
  })
})

describe('parsePlaytimeTotals', () => {
  it('reads every app total', () => {
    const totals = parsePlaytimeTotals(playtimeReply)

    expect(totals).toHaveLength(7)
    expect(totals).toContainEqual({ artifactId: 'Fortnite', seconds: 1448314 })
  })

  it('is null when the field did not come back, and empty when nothing was played', () => {
    expect(parsePlaytimeTotals(deniedReply)).toBeNull()
    expect(parsePlaytimeTotals({ data: null })).toBeNull()
    expect(parsePlaytimeTotals({ data: { PlaytimeTracking: { total: [] } } })).toEqual([])
  })

  it('skips broken rows and does not add a repeated app on top of itself', () => {
    expect(
      parsePlaytimeTotals({
        data: {
          PlaytimeTracking: {
            total: [
              { artifactId: 'Fortnite', totalTime: 100 },
              { artifactId: 'Fortnite', totalTime: 250.4 },
              { artifactId: '', totalTime: 5 },
              { artifactId: 'X', totalTime: -1 },
              { artifactId: 'Y', totalTime: 'soon' },
              null,
            ],
          },
        },
      })
    ).toEqual([{ artifactId: 'Fortnite', seconds: 250 }])
  })
})

describe('parseAppBuilds', () => {
  const apps = parseAppBuilds(buildsReply)

  it('names apps and keeps art only from allowed hosts', () => {
    expect(apps.Fortnite).toEqual({
      title: 'Fortnite',
      namespace: 'fn',
      art: { tall: art('fn-tall'), wide: art('fn-wide') },
    })
    expect(apps.fa4240e57a3c46b39f169041b7811293.art).toEqual({ tall: null, wide: null })
  })

  it('keeps the first of a repeated app and drops rows without a name', () => {
    expect(apps['UE_5.4'].title).toBe('Unreal Engine')
    expect(Object.keys(apps)).toHaveLength(7)
  })

  it('is empty when appBuilds did not come back', () => {
    expect(parseAppBuilds({ errors: [{ message: 'x' }], data: null })).toEqual({})
  })
})

describe('describePlaytime', () => {
  const entries = describePlaytime(parsePlaytimeTotals(playtimeReply) ?? [], parseAppBuilds(buildsReply))

  it('puts Fortnite first, then its modes by time, then UEFN, then other games', () => {
    expect(entries.map((entry) => [entry.kind, entry.title])).toEqual([
      ['fortnite', 'Fortnite'],
      ['mode', 'Save the World'],
      ['mode', 'LEGO® Fortnite'],
      ['uefn', 'UEFN'],
      ['other', 'Hogwarts Legacy'],
      ['other', 'Operation Tango - Friend Pass'],
      ['other', null],
    ])
  })

  it('falls back to the known Fortnite apps when appBuilds could not be read', () => {
    const bare = describePlaytime(parsePlaytimeTotals(playtimeReply) ?? [], {})

    expect(bare.filter((entry) => entry.kind !== 'other').map((entry) => entry.title)).toEqual([
      'Fortnite',
      'Save the World',
      'LEGO® Fortnite',
      'UEFN',
    ])
    expect(bare.filter((entry) => entry.kind === 'other').every((entry) => entry.title === null)).toBe(
      true
    )
  })

  it('counts Fortnite once — the modes are not added to it', () => {
    expect(fortniteSeconds(entries)).toBe(1448314)
    expect(fortniteSeconds([])).toBe(0)
  })
})

describe('unnamedApps', () => {
  it('lists only apps nothing names', () => {
    const totals = parsePlaytimeTotals(playtimeReply) ?? []

    expect(unnamedApps(totals, {})).toEqual([
      '33e479c9bc124e5b8b456e5c2e813032',
      'afdb5a85efcc45d8ae8e406e2121d81c',
      'fa4240e57a3c46b39f169041b7811293',
    ])
    expect(unnamedApps(totals, parseAppBuilds(buildsReply))).toEqual([
      'afdb5a85efcc45d8ae8e406e2121d81c',
    ])
  })
})

describe('mergeAppInfo', () => {
  it('keeps known art and titles the new reply lacks', () => {
    const known = { title: 'Fortnite', namespace: 'fn', art: { tall: art('a'), wide: null } }

    expect(
      mergeAppInfo(known, { title: null, namespace: null, art: { tall: null, wide: art('b') } })
    ).toEqual({ title: 'Fortnite', namespace: 'fn', art: { tall: art('a'), wide: art('b') } })
    expect(mergeAppInfo(undefined, knownApps.Fortnite)).toEqual(knownApps.Fortnite)
  })
})

describe('displayTitle', () => {
  it('names modes the way the game does and leaves other titles alone', () => {
    expect(displayTitle('mode', 'Fortnite Save the World Content')).toBe('Save the World')
    expect(displayTitle('mode', 'LEGO® Fortnite Content')).toBe('LEGO® Fortnite')
    expect(displayTitle('mode', 'Fortnite')).toBe('Fortnite')
    expect(displayTitle('other', 'Fortnite Save the World Content')).toBe(
      'Fortnite Save the World Content'
    )
    expect(displayTitle('mode', null)).toBeNull()
    expect(displayTitle('uefn', 'Unreal Editor for Fortnite')).toBe('UEFN')
  })
})

describe('formatPlaytime', () => {
  it('reads seconds into minutes, tenths of an hour, then whole hours', () => {
    expect(formatPlaytime(0)).toBe('0 min')
    expect(formatPlaytime(NaN)).toBe('0 min')
    expect(formatPlaytime(42)).toBe('under a minute')
    expect(formatPlaytime(287)).toBe('4 min')
    expect(formatPlaytime(5832, 'en-GB')).toBe('1.6 h')
    expect(formatPlaytime(3600, 'en-GB')).toBe('1 h')
    expect(formatPlaytime(296822, 'en-GB')).toBe('82.4 h')
    expect(formatPlaytime(1448314, 'en-GB')).toBe('402 h')
    expect(formatPlaytime(5_000_000, 'en-GB')).toBe('1,388 h')
  })
})

describe('playtimeErrorMessage', () => {
  it('says what failed and what to do', () => {
    expect(playtimeErrorMessage(403, 'x')).toContain('HTTP 403')
    expect(playtimeErrorMessage(500, 'x')).toBe('Could not read playtime (HTTP 500). Try again later.')
    expect(playtimeErrorMessage(null, 'timeout')).toBe('Could not read playtime (timeout). Try again later.')
  })
})
