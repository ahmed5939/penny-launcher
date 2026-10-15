import { describe, expect, it } from 'vitest'

import strings from '../../locales/en-US/account-management/lobby-hacks.json'

import {
  armedKeyAfter,
  formAccountId,
  formKeyOf,
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

describe('the submit arm', () => {
  /**
   * The view's arm, driven the way its renders and presses drive it: every
   * render settles the arm against the form as it reads, and a first press
   * arms that form.
   */
  function arm() {
    let armedKey: string | null = null

    const read = (key: string | null) => {
      armedKey = armedKeyAfter(armedKey, key)

      return key !== null && armedKey === key
    }

    return {
      read,
      press(key: string) {
        if (read(key)) {
          armedKey = null

          return 'sent'
        }

        armedKey = key

        return 'armed'
      },
    }
  }

  it('sends on the second press of the same form', () => {
    const form = arm()
    const code = formKeyOf(alice, 'OverrideXP')

    expect(form.press(code!)).toBe('armed')
    expect(form.read(code)).toBe(true)
    expect(form.press(code!)).toBe('sent')
    expect(form.read(code)).toBe(false)
  })

  it('drops the arm when a code is picked from the list, even the armed code picked again', () => {
    const form = arm()
    const armedCode = formKeyOf(alice, 'OverrideXP')
    const otherCode = formKeyOf(alice, 'H0p0nVC')

    expect(form.press(armedCode!)).toBe('armed')
    expect(form.read(otherCode)).toBe(false)
    expect(form.read(armedCode)).toBe(false)
    expect(form.press(armedCode!)).toBe('armed')
  })

  it('drops the arm when the title-bar account changes and comes back', () => {
    const form = arm()
    const aliceForm = formKeyOf(alice, 'OverrideXP')
    const bobForm = formKeyOf(bob, 'OverrideXP')

    expect(form.press(aliceForm!)).toBe('armed')
    expect(form.read(bobForm)).toBe(false)
    expect(form.read(aliceForm)).toBe(false)
    expect(form.press(aliceForm!)).toBe('armed')
  })

  it('drops the arm when the form has no account to submit for', () => {
    const form = arm()
    const code = formKeyOf(alice, 'OverrideXP')

    expect(form.press(code!)).toBe('armed')
    expect(form.read(null)).toBe(false)
    expect(form.read(code)).toBe(false)
  })
})

describe('formKeyOf', () => {
  it('differs by account and by code, and is null without an account', () => {
    expect(formKeyOf(alice, 'CODE')).not.toBe(formKeyOf(bob, 'CODE'))
    expect(formKeyOf(alice, 'CODE')).not.toBe(formKeyOf(alice, 'CODE2'))
    expect(formKeyOf(null, 'CODE')).toBeNull()
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
