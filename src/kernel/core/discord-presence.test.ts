import { describe, expect, it } from 'vitest'

import {
  classifyFortniteLogLine,
  classifyLinkMnemonic,
  discordActivity,
  discordActivityCopy,
  extractIslandSelection,
  trayLaunchLabels,
} from './discord-presence'

// Copied from a real FortniteGame.log (an STW session).
const campaignSelected =
  '[2026.10.01-19.10.40:890][909]MatchmakingLog: [2a77] Link id changing from [Mnemonic=[] Version=[latest]] to [Mnemonic=[campaign] Version=[latest]]'
const campaignReread =
  "[2026.10.01-19.10.41:927][951]LogMatchmakingUtility: [3273] LinkId: 'Mnemonic=[campaign] Version=[latest]'."
// The same lines as they read for a creator island and a reset.
const islandSelected =
  '[2026.10.01-19.20.02:114][512]MatchmakingLog: [2a77] Link id changing from [Mnemonic=[campaign] Version=[latest]] to [Mnemonic=[6155-1398-4059] Version=[latest]]'
const islandReread =
  "[2026.10.01-19.20.03:002][540]LogMatchmakingUtility: [3273] LinkId: 'Mnemonic=[6155-1398-4059] Version=[latest]'."
const selectionReset =
  '[2026.10.01-19.25.40:010][871]MatchmakingLog: [2a77] Link id changing from [Mnemonic=[6155-1398-4059] Version=[latest]] to [Mnemonic=[] Version=[latest]]'

const notSelections = [
  // Discover prefetching art for islands on the front page.
  '[2026.10.01-19.10.51:428][295]LogActivityImageContext: Warning: Requesting PNG image for activity [Mnemonic=[0148-0322-5437] Version=[latest]]. Path: [https://cdn2.unrealengine.com/cdn-uploader-UEFN_39-00_Piece_Control_2v2_A_Spot-FG--1096x384-e54f7aec.png]',
  '[2026.10.01-19.10.51:367][294]LogMotd: [3c87] Refreshing Motds for [Product.FNE.0148-0322-5437, Product.FNE.Akita.8532-9413-6963, Product.FNE.2515-6266-7600, Product.BR, Product.FNE.3305-1551-7747]',
  '\tProduct.FNE.3305-1551-7747',
  '[2026.10.01-19.10.50:906][282]LogFortLinkEntry: Error: Failed To Parse or Query Link Entry (Mnemonic=[playlist_smarttunapre] Version=[latest]) because of: ELinkEntryQueryResult::FailedQuery',
  '[2026.10.01-19.10.40:890][909]MatchmakingLog: [3805] No V2 mapping found for V1 playlist [8532-9413-6963]. Skipping conversion.',
  // Party-member blocks span several lines; only the indented ones carry ids.
  '[2026.10.01-19.10.40:890][909]MatchmakingLog: [267c] GHTǃ has updated matchmaking info:',
  '\t\tLinkId [Mnemonic=[campaign] Version=[latest]] ',
  '\t\tLinkId Mnemonic=[campaign] Version=[latest]',
  '[2026.10.01-19.10.41:925][951]MatchmakingLog: [35e2] Found Playable Island [LinkId [Mnemonic=[campaign] Version=[latest]] - Title [Save the World] - ProductTag [Product.STW]] with matching Configuration. Configuration: [Unranked] With matchmaking group size of [1]',
]

describe('Fortnite log presence', () => {
  it('treats STW playlists and zone loads as Save the World', () => {
    expect(
      classifyFortniteLogLine(
        'LogOnlineGame: Playlist_Dungeons joined session'
      )
    ).toBe('stw')
    expect(
      classifyFortniteLogLine(
        'LogFortStreaming: Loading map /Game/World/Zones/Forest'
      )
    ).toBe('stw')
    expect(
      classifyFortniteLogLine('LogFort: ZoneTheme StormShieldDefense')
    ).toBe('stw')
  })

  it('treats BR playlists and Athena lines as Battle Royale', () => {
    expect(
      classifyFortniteLogLine(
        'LogOnlineGame: Join session Playlist_DefaultSolo'
      )
    ).toBe('br')
    expect(
      classifyFortniteLogLine('LogAthena: Display: Match started')
    ).toBe('br')
  })

  it('ignores unrelated log noise', () => {
    expect(classifyFortniteLogLine('LogInit: Win64 shipping')).toBeNull()
  })
})

describe('Fortnite island selection', () => {
  it('reads the selected link from the two selection lines', () => {
    expect(extractIslandSelection(campaignSelected)).toEqual({
      mnemonic: 'campaign',
    })
    expect(extractIslandSelection(campaignReread)).toEqual({
      mnemonic: 'campaign',
    })
    expect(extractIslandSelection(islandSelected)).toEqual({
      mnemonic: '6155-1398-4059',
    })
    expect(extractIslandSelection(islandReread)).toEqual({
      mnemonic: '6155-1398-4059',
    })
    expect(extractIslandSelection(selectionReset)).toEqual({ mnemonic: '' })
  })

  it('ignores art prefetches, product lists, errors and party blocks', () => {
    for (const line of notSelections) {
      expect(extractIslandSelection(line)).toBeNull()
    }
  })

  it('maps a link mnemonic to STW, an island, a playlist or nothing', () => {
    expect(classifyLinkMnemonic('campaign')).toEqual({ kind: 'stw' })
    expect(classifyLinkMnemonic('6155-1398-4059')).toEqual({
      kind: 'island',
      code: '6155-1398-4059',
    })
    expect(classifyLinkMnemonic('playlist_figment_martin_md')).toEqual({
      kind: 'playlist',
      id: 'playlist_figment_martin_md',
    })
    expect(classifyLinkMnemonic('')).toEqual({ kind: 'none' })
    expect(classifyLinkMnemonic('none')).toEqual({ kind: 'none' })
  })
})

describe('Discord activity copy', () => {
  it('reports launcher when Fortnite is not running', () => {
    expect(
      discordActivityCopy({
        accountName: 'PennyMain',
        gameRunning: false,
        mode: 'stw',
      })
    ).toEqual({
      details: 'In launcher',
      state: 'PennyMain',
    })
  })

  it('reports STW and BR while the game is running', () => {
    expect(
      discordActivityCopy({
        accountName: 'PennyMain',
        gameRunning: true,
        mode: 'stw',
      }).details
    ).toBe('In Save the World')
    expect(
      discordActivityCopy({
        accountName: 'PennyMain',
        gameRunning: true,
        mode: 'br',
      }).details
    ).toBe('In Battle Royale')
  })

  it('names the creator island, falling back to its code', () => {
    expect(
      discordActivityCopy({
        accountName: 'PennyMain',
        gameRunning: true,
        island: { code: '6155-1398-4059', title: '1V1 WITH EVERY GUN' },
        mode: 'br',
      })
    ).toEqual({ details: '1V1 WITH EVERY GUN', state: 'PennyMain' })
    expect(
      discordActivityCopy({
        accountName: null,
        gameRunning: true,
        island: { code: '6155-1398-4059', title: null },
        mode: 'br',
      })
    ).toEqual({
      details: 'Island 6155-1398-4059',
      state: '6155-1398-4059',
    })
  })
})

describe('Discord activity payload', () => {
  const island = {
    code: '6155-1398-4059',
    title: '1V1 WITH EVERY GUN',
    imageUrl:
      'https://cdn-0001.qstv.on.epicgames.com/LCLNkOFcWZzuXqOpFO/image/landscape_comp_s_b.jpeg',
  }
  const base = {
    accountName: 'PennyMain',
    gameRunning: true,
    mode: 'br' as const,
    startedAt: 1_790_881_837_000,
  }

  it('shows island art, its code and a link to its page', () => {
    expect(discordActivity({ ...base, island })).toEqual({
      details: '1V1 WITH EVERY GUN',
      state: 'PennyMain',
      timestamps: { start: 1_790_881_837 },
      assets: { large_image: island.imageUrl, large_text: '6155-1398-4059' },
      buttons: [
        {
          label: 'View island',
          url: 'https://www.fortnite.com/creative/island-codes/6155-1398-4059',
        },
      ],
      instance: false,
    })
  })

  it('keeps the link but drops art that is missing or not https', () => {
    for (const imageUrl of [null, 'http://example.com/art.png', 'not a url']) {
      const activity = discordActivity({
        ...base,
        island: { ...island, title: null, imageUrl },
      })

      expect(activity.details).toBe('Island 6155-1398-4059')
      expect(activity.assets).toBeUndefined()
      expect(activity.buttons).toHaveLength(1)
    }
  })

  it('clips titles to what Discord accepts', () => {
    const activity = discordActivity({
      ...base,
      island: { ...island, title: 'A'.repeat(200) },
    })

    expect(activity.details).toHaveLength(128)
    expect(activity.details.endsWith('…')).toBe(true)
  })

  it('adds no art or buttons outside an island or after the game exits', () => {
    for (const activity of [
      discordActivity({ ...base, island: null, mode: 'stw' }),
      discordActivity({ ...base, island, gameRunning: false }),
    ]) {
      expect(activity).not.toHaveProperty('assets')
      expect(activity).not.toHaveProperty('buttons')
    }
    expect(
      discordActivity({ ...base, island, gameRunning: false }).details
    ).toBe('In launcher')
  })
})

describe('tray launch labels', () => {
  it('disables launch without a selected account', () => {
    const labels = trayLaunchLabels({
      gameRunning: false,
      primaryId: null,
      primaryName: null,
      running: [],
      total: 0,
    })

    expect(labels.launchEnabled).toBe(false)
    expect(labels.launchLabel).toBe('Launch Fortnite')
  })

  it('names the selected account on the launch item', () => {
    const labels = trayLaunchLabels({
      gameRunning: false,
      primaryId: 'abc',
      primaryName: 'PennyMain',
      running: ['Auto-kick'],
      total: 2,
    })

    expect(labels.launchEnabled).toBe(true)
    expect(labels.launchLabel).toBe('Launch Fortnite — PennyMain')
  })

  it('does not offer a second launch while Fortnite is running', () => {
    const labels = trayLaunchLabels({
      gameRunning: true,
      primaryId: 'abc',
      primaryName: 'PennyMain',
      running: [],
      total: 1,
    })

    expect(labels.launchEnabled).toBe(false)
    expect(labels.launchLabel).toBe('Fortnite is running')
  })
})
