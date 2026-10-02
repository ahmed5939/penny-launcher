import { describe, expect, it } from 'vitest'

import {
  formatCount,
  formatKd,
  formatWinRate,
  inputLines,
  parseBrStats,
  topPlacements,
} from './model'

// A small slice of a `statsproxy` reply, keys as Epic sends them.
const sample = {
  stats: {
    // Keyboard and mouse: two playlists summed into one input line.
    br_placetop1_keyboardmouse_m0_playlist_defaultsolo: 10,
    br_matchesplayed_keyboardmouse_m0_playlist_defaultsolo: 100,
    br_kills_keyboardmouse_m0_playlist_defaultsolo: 250,
    br_minutesplayed_keyboardmouse_m0_playlist_defaultsolo: 600,
    br_placetop10_keyboardmouse_m0_playlist_defaultsolo: 40,
    br_placetop1_keyboardmouse_m0_playlist_defaultduo: 5,
    br_matchesplayed_keyboardmouse_m0_playlist_defaultduo: 50,
    br_kills_keyboardmouse_m0_playlist_defaultduo: 120,
    br_placetop25_keyboardmouse_m0_playlist_defaultduo: 44,
    // Controller: every match was a win, so there are no deaths.
    br_placetop1_gamepad_m0_playlist_defaultsquad: 3,
    br_matchesplayed_gamepad_m0_playlist_defaultsquad: 3,
    br_kills_gamepad_m0_playlist_defaultsquad: 9,
    // Ignored: non-positive, a metric we do not chart, and junk.
    br_matchesplayed_touch_m0_playlist_defaultsolo: 0,
    br_score_keyboardmouse_m0_playlist_defaultsolo: 9999,
    br_lastmodified_keyboardmouse_m0_playlist_defaultsolo: 1700000000,
    nonsense_key: 1,
  },
}

describe('parseBrStats', () => {
  const summary = parseBrStats(sample)

  it('sums a metric across every playlist and input into the overall line', () => {
    expect(summary.overall.wins).toBe(18)
    expect(summary.overall.matches).toBe(153)
    expect(summary.overall.kills).toBe(379)
    expect(summary.overall.minutes).toBe(600)
    expect(summary.overall.top).toEqual({ 10: 40, 25: 44 })
    expect(summary.empty).toBe(false)
  })

  it('keeps a separate line per input device', () => {
    expect(summary.byInput.keyboardmouse.wins).toBe(15)
    expect(summary.byInput.keyboardmouse.matches).toBe(150)
    expect(summary.byInput.keyboardmouse.kills).toBe(370)
    expect(summary.byInput.gamepad.matches).toBe(3)
    // Touch's only key was zero, so it was never counted.
    expect(summary.byInput.touch.matches).toBe(0)
  })

  it('derives win rate from wins over matches', () => {
    expect(summary.byInput.keyboardmouse.winRate).toBeCloseTo(0.1, 10)
    expect(summary.byInput.gamepad.winRate).toBe(1)
    expect(summary.byInput.touch.winRate).toBe(0)
  })

  it('guards the K/D divide-by-zero: all wins falls back to the kill count', () => {
    // 370 kills over (150 − 15) = 135 deaths.
    expect(summary.byInput.keyboardmouse.kd).toBeCloseTo(370 / 135, 10)
    // 3 matches, 3 wins: no deaths, so K/D is the 9 kills, not Infinity.
    expect(summary.byInput.gamepad.kd).toBe(9)
    // No matches at all is also no deaths: 0 kills, so 0.
    expect(summary.byInput.touch.kd).toBe(0)
  })

  it('treats a reply with no Battle Royale stats as empty, not an error', () => {
    const empty = parseBrStats({ stats: {} })

    expect(empty.empty).toBe(true)
    expect(empty.overall.matches).toBe(0)
    expect(empty.overall.kd).toBe(0)
    expect(empty.overall.winRate).toBe(0)

    // A missing or malformed body is empty just the same.
    expect(parseBrStats(null).empty).toBe(true)
    expect(parseBrStats({ stats: [] }).empty).toBe(true)
    expect(parseBrStats('<html>').empty).toBe(true)
  })
})

describe('inputLines', () => {
  it('lists only inputs with matches, in display order', () => {
    expect(inputLines(parseBrStats(sample)).map((entry) => entry.input)).toEqual([
      'keyboardmouse',
      'gamepad',
    ])
  })
})

describe('topPlacements', () => {
  it('lists non-zero brackets, smallest first', () => {
    expect(topPlacements(parseBrStats(sample).overall)).toEqual([
      { tier: 10, value: 40 },
      { tier: 25, value: 44 },
    ])
  })
})

describe('formatWinRate', () => {
  it('rounds whole above ten per cent and keeps a decimal below', () => {
    expect(formatWinRate(0)).toBe('0%')
    expect(formatWinRate(0.1)).toBe('10%')
    expect(formatWinRate(0.124)).toBe('12%')
    expect(formatWinRate(0.014)).toBe('1.4%')
    expect(formatWinRate(NaN)).toBe('0%')
  })
})

describe('formatKd', () => {
  it('shows two places, and zero for nothing', () => {
    expect(formatKd(9)).toBe('9.00')
    expect(formatKd(2.7407)).toBe('2.74')
    expect(formatKd(0)).toBe('0.00')
    expect(formatKd(Infinity)).toBe('0.00')
  })
})

describe('formatCount', () => {
  it('groups for the locale', () => {
    expect(formatCount(1234, 'en-GB')).toBe('1,234')
    expect(formatCount(5, 'en-GB')).toBe('5')
    expect(formatCount(NaN)).toBe('0')
  })
})
