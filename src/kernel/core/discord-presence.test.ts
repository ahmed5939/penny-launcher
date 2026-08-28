import { describe, expect, it } from 'vitest'

import {
  classifyFortniteLogLine,
  discordActivityCopy,
  trayLaunchLabels,
} from './discord-presence'

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
