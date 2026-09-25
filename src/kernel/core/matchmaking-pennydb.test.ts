import { describe, expect, it } from 'vitest'

import { World } from '../../config/constants/fortnite/world-info'

import {
  parsePennyDBMission,
  parsePennyDBSessionSeconds,
} from './matchmaking-pennydb'

describe('PennyDB what_mission_data parsing', () => {
  const now = Date.parse('2026-09-25T17:00:00.000Z')

  it('reads a live storm shield mission', () => {
    expect(
      parsePennyDBMission(
        {
          mission_playing: 'Twine Peaks Homebase Storm Shield',
          players: { player_1: 'GreaterMom ʸᵀ' },
          zone: 'Twine Peaks',
          difficulty: '70',
          session_time: '4:39 mins',
          mission_rewards: ['Mini Reward Llama', 'Hero XP'],
          mission_alerts: [],
          launched_mission: true,
        },
        now
      )
    ).toEqual({
      name: 'Twine Peaks Homebase Storm Shield',
      zone: 'Twine Peaks',
      theaterId: World.TwinePeaks,
      difficulty: 70,
      startedAt: '2026-09-25T16:55:21.000Z',
      launched: true,
      players: ['GreaterMom ʸᵀ'],
      rewards: ['Mini Reward Llama', 'Hero XP'],
      alerts: [],
    })
  })

  it('treats the idle message as no mission', () => {
    expect(
      parsePennyDBMission({
        mission_playing: 'Player is not currently in a mission',
      })
    ).toBeNull()
    expect(parsePennyDBMission(undefined)).toBeNull()
  })

  it('keeps unknown zones and alert objects', () => {
    const mission = parsePennyDBMission({
      mission_playing: 'Ride the Lightning',
      zone: 'Ventures',
      mission_alerts: [{ name: 'Pure Drop of Rain' }, 'Legendary Perk-UP!'],
    })

    expect(mission?.theaterId).toBeNull()
    expect(mission?.difficulty).toBeNull()
    expect(mission?.startedAt).toBeNull()
    expect(mission?.launched).toBe(false)
    expect(mission?.alerts).toEqual(['Pure Drop of Rain', 'Legendary Perk-UP!'])
  })

  it('parses elapsed session time', () => {
    expect(parsePennyDBSessionSeconds('4:57 mins')).toBe(297)
    expect(parsePennyDBSessionSeconds('1:02:10 mins')).toBe(3730)
    expect(parsePennyDBSessionSeconds('soon')).toBeNull()
  })
})
