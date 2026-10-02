import { describe, expect, it } from 'vitest'

import { inputLabel, modeOfPlaylist, parseMinutesPlayed } from './stats'

// The shape of `statsproxy …/statsv2/account/{id}`, keys as seen 2026-10-02.
const reply = {
  startTime: 0,
  endTime: Number.MAX_SAFE_INTEGER,
  stats: {
    br_minutesplayed_gamepad_m0_playlist_defaultsolo: 1200,
    br_minutesplayed_gamepad_m0_playlist_playgroundv2: 6000,
    br_minutesplayed_keyboardmouse_m0_playlist_defaultsquad: 600,
    br_minutesplayed_touch_m0_playlist_habaneroduo: 60,
    br_matchesplayed_gamepad_m0_playlist_defaultsolo: 90,
    br_matchesplayed_keyboardmouse_m0_playlist_defaultsquad: 30,
    br_placetop1_gamepad_m0_playlist_defaultsolo: 7,
    br_kills_gamepad_m0_playlist_defaultsolo: 400,
    br_kills_touch_m0_playlist_habaneroduo: 5,
    br_playersoutlived_gamepad_m0_playlist_defaultsolo: 5000,
    br_score_gamepad_m0_playlist_defaultsolo: 99999,
    br_lastmodified_gamepad_m0_playlist_defaultsolo: 1790000000,
    br_minutesplayed_gamepad_m0_playlist_broken: 'x',
  },
}

describe('parseMinutesPlayed', () => {
  const career = parseMinutesPlayed(reply)!

  it('adds every playlist up by input device, most played first', () => {
    expect(career.minutes).toBe(7860)
    expect(career.byInput).toEqual([
      { input: 'gamepad', label: 'Controller', minutes: 7200 },
      { input: 'keyboardmouse', label: 'Keyboard and mouse', minutes: 600 },
      { input: 'touch', label: 'Touch', minutes: 60 },
    ])
  })

  it('totals matches, wins, kills and players outlived', () => {
    expect(career).toMatchObject({ matches: 120, wins: 7, kills: 405, outlived: 5000 })
  })

  it('splits matches, wins and kills by squad size', () => {
    expect(career.squads).toEqual([
      { size: 'solo', label: 'Solo', matches: 90, wins: 7, kills: 400 },
      { size: 'squad', label: 'Squads', matches: 30, wins: 0, kills: 0 },
    ])
  })

  it('groups playlists into the modes players know, most played first', () => {
    expect(career.modes).toEqual([
      { key: 'creative', label: 'Creative and islands', minutes: 6000, matches: 0, wins: 0 },
      { key: 'battleroyale', label: 'Battle Royale', minutes: 1800, matches: 120, wins: 7 },
      { key: 'ranked', label: 'Ranked', minutes: 60, matches: 0, wins: 0 },
    ])
  })

  it('is zero for an account that never played a stat-keeping mode, and null without stats', () => {
    expect(parseMinutesPlayed({ stats: {} })).toEqual({ minutes: 0, byInput: [], matches: 0, wins: 0, kills: 0, outlived: 0, modes: [], squads: [] })
    expect(parseMinutesPlayed({ errorCode: 'x' })).toBeNull()
    expect(parseMinutesPlayed(null)).toBeNull()
  })

  it('names inputs and playlists', () => {
    expect(inputLabel('gamepad')).toBe('Controller')
    expect(inputLabel('wheel')).toBe('Wheel')
    expect(modeOfPlaylist('showdowntournament_duos').label).toBe('Tournaments')
    expect(modeOfPlaylist('showdownalt_trios').label).toBe('Arena')
    expect(modeOfPlaylist('nobuildbr_squad').label).toBe('Zero Build')
    expect(modeOfPlaylist('bots_trios').label).toBe('Battle Royale')
    expect(modeOfPlaylist('deimos_solo_winter').label).toBe('Limited-time modes')
  })
})
