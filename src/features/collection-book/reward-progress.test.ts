import { describe, expect, it } from 'vitest'

import { bookRewardProgress } from './reward-progress'
import catalog from './reward-levels.json'

const levels = [
  { level: 1, totalXp: 0, xpToNextLevel: 1500 },
  { level: 2, totalXp: 1500, xpToNextLevel: 2300 },
  { level: 3, totalXp: 3800, xpToNextLevel: 3100 },
]

describe('Collection Book next-reward progress', () => {
  it('uses all 1,200 extracted game levels with continuous XP thresholds', () => {
    expect(catalog).toHaveLength(1200)
    for (let i = 0; i < catalog.length - 1; i++) {
      expect(catalog[i].level).toBe(i + 1)
      expect(catalog[i].totalXp + catalog[i].xpToNextLevel).toBe(catalog[i + 1].totalXp)
    }
    expect(catalog[1049]).toMatchObject({
      level: 1050, totalXp: 65233250, label: '1 x Trap Supercharger',
    })
  })
  it('subtracts total XP from the next cumulative threshold', () => {
    expect(bookRewardProgress(levels, 2000)).toMatchObject({
      current: { level: 2 }, next: { level: 3 },
      xpRemaining: 1800, xpForLevel: 2300, xpDebt: 0,
    })
  })
  it('moves to the new level exactly at its threshold', () => {
    expect(bookRewardProgress(levels, 1500)?.current.level).toBe(2)
    expect(bookRewardProgress(levels, 1500)?.xpRemaining).toBe(2300)
  })
  it('includes unslotting debt without lowering the achieved level', () => {
    expect(bookRewardProgress(levels, 1000, 2)).toMatchObject({
      current: { level: 2 }, next: { level: 3 },
      xpDebt: 500, xpRemaining: 2800, progress: 0,
    })
  })
  it('does not treat missing current XP as zero or a full-level remainder', () => {
    expect(bookRewardProgress(levels, null, 2)).toMatchObject({
      next: { level: 3 }, xpForLevel: 2300, xpRemaining: null, progress: null,
    })
    expect(bookRewardProgress(levels, null)).toBeNull()
  })
  it('handles zero XP and the final defined level', () => {
    expect(bookRewardProgress(levels, 0)?.xpRemaining).toBe(1500)
    expect(bookRewardProgress(levels, 4000)).toMatchObject({ next: null, xpRemaining: null })
    expect(bookRewardProgress(levels, null, 4)).toBeNull()
  })
  it('rejects invalid XP and ambiguous zero-based achieved levels', () => {
    expect(() => bookRewardProgress(levels, NaN)).toThrow()
    expect(() => bookRewardProgress(levels, -1)).toThrow()
    expect(() => bookRewardProgress(levels, 100, 0)).toThrow()
  })
})
