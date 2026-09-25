import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseCommanderProfile } from './model'
import { evalCurve, homebasePower, parseSurvivorTemplate, researchFort, survivorRating } from './power'

describe('power curves', () => {
  it('interpolates and clamps', () => {
    expect(evalCurve([[0, 1], [10, 11]], -5)).toBe(1)
    expect(evalCurve([[0, 1], [10, 11]], 5)).toBe(6)
    expect(evalCurve([[0, 1], [10, 11]], 50)).toBe(11)
  })

  it('matches PennyDB for maxed accounts, whatever their heroes and weapons', () => {
    const maxed = researchFort({ fortitude: 120, offense: 120, resistance: 120, technology: 120 })

    expect(homebasePower({ fortitude: 2742, offense: 2758, resistance: 2742, technology: 2758 }, maxed)).toBeCloseTo(145.28, 1)
    expect(homebasePower({ fortitude: 2742, offense: 2758, resistance: 2758, technology: 2712 }, maxed)).toBeCloseTo(145.01, 1)
  })

  it('rates survivors from their template ids', () => {
    expect(parseSurvivorTemplate('Worker:managerdoctor_sr_kingsly_t05')).toEqual({ lead: true, rarity: 'sr', tier: 5 })
    expect(survivorRating('Worker:workerbasic_sr_t05', 50)).toBeGreaterThan(0)
  })
})

/*
 * A real campaign profile, when one is on disk (`reports/` is local-only).
 * PennyDB shows this account at 5,662 / 5,678 / 5,662 / 5,678.
 */
const sample = 'reports/public-campaign-6dfb73df4e364e7c9601249c22b9d9f5.json'

describe.skipIf(!existsSync(sample))('a real account', () => {
  it('matches the F.O.R.T. and Power PennyDB shows', () => {
    const entry = parseCommanderProfile(JSON.parse(readFileSync(sample, 'utf8')), '6dfb73df4e364e7c9601249c22b9d9f5', 'x')

    expect(entry.fort).toEqual({ fortitude: 5662, offense: 5678, resistance: 5662, technology: 5678 })
    expect(entry.power?.value).toBeCloseTo(145.28, 1)
    expect(entry.power?.approximate).toBe(false)
  })
})
