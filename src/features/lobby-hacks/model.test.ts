import { describe, expect, it } from 'vitest'

import strings from '../../locales/en-US/account-management/lobby-hacks.json'

import {
  formAccountId,
  isResultFor,
  lobbyHackOutcomes,
  mayHaveGoneThrough,
  outcomeChipTone,
  outcomeTone,
  unknownResult,
} from './model'

const alice = 'a'.repeat(32)
const bob = 'b'.repeat(32)

describe('formAccountId', () => {
  it('prefers the account picked on the page while it is linked', () => {
    expect(formAccountId({ chosen: bob, linked: [alice, bob], primary: alice })).toBe(bob)
  })

  it('falls back to the title-bar account, then the first linked one', () => {
    expect(formAccountId({ chosen: null, linked: [alice, bob], primary: bob })).toBe(bob)
    expect(formAccountId({ chosen: 'gone', linked: [alice, bob], primary: null })).toBe(alice)
    expect(formAccountId({ chosen: null, linked: [], primary: alice })).toBeNull()
  })
})

describe('isResultFor', () => {
  it('accepts only a well-formed reply for the account that was sent', () => {
    expect(isResultFor(unknownResult(alice), alice)).toBe(true)
    expect(isResultFor(unknownResult(alice), bob)).toBe(false)
    expect(isResultFor({ ...unknownResult(alice), outcome: 'made-up' }, alice)).toBe(false)
    expect(isResultFor({ ...unknownResult(alice), rewards: null }, alice)).toBe(false)
    expect(isResultFor(undefined, alice)).toBe(false)
  })
})

describe('outcomes', () => {
  it('has a tone and en-US wording for every outcome', () => {
    const outcomes = strings.outcomes as Record<
      string,
      { label?: string; title?: string; body?: string }
    >

    for (const outcome of lobbyHackOutcomes) {
      expect(outcomeTone(outcome)).toBeTruthy()
      expect(outcomeChipTone(outcome)).toBeTruthy()
      expect(outcomes[outcome]?.label).toBeTruthy()
      expect(outcomes[outcome]?.title).toBeTruthy()
      expect(outcomes[outcome]?.body).toBeTruthy()
    }

    expect(Object.keys(outcomes).sort()).toEqual([...lobbyHackOutcomes].sort())
  })

  it('only calls a confirmed grant a success', () => {
    const successes = lobbyHackOutcomes.filter(
      (outcome) => outcomeTone(outcome) === 'success'
    )

    expect(successes).toEqual(['granted'])
  })

  it('warns before a resend only where the code may have gone through', () => {
    expect(lobbyHackOutcomes.filter(mayHaveGoneThrough).sort()).toEqual([
      'uncertain',
      'unconfirmed',
    ])
  })
})
