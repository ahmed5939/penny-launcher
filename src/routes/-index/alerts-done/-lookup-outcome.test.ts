import type {
  AlertsDoneSearchPlayerData,
  AlertsDoneSearchPlayerResponse,
} from '../../../types/alerts'

import { describe, expect, it } from 'vitest'

import { lookupOutcome } from './-lookup-outcome'

const lookup = {
  displayName: 'Penny',
  id: '0123456789abcdef0123456789abcdef',
} as AlertsDoneSearchPlayerData['lookup']

const profileChanges = {} as AlertsDoneSearchPlayerData['profileChanges']

describe('alerts done lookup outcome', () => {
  it('is idle before any search', () => {
    expect(lookupOutcome(null)).toBe('idle')
    expect(lookupOutcome(undefined)).toBe('idle')
  })

  it('is ok when the lookup and the profile both loaded', () => {
    const response: AlertsDoneSearchPlayerResponse = {
      data: { lookup, profileChanges },
      errorMessage: null,
      isPrivate: false,
      success: true,
    }

    expect(lookupOutcome(response)).toBe('ok')
  })

  it('is private when public game stats are off', () => {
    const response: AlertsDoneSearchPlayerResponse = {
      data: { lookup },
      errorMessage: null,
      isPrivate: true,
      success: false,
    }

    expect(lookupOutcome(response)).toBe('private')
  })

  it('is partial when the player was found but the profile did not load', () => {
    const response: AlertsDoneSearchPlayerResponse = {
      data: { lookup },
      errorMessage: null,
      isPrivate: false,
      success: false,
    }

    expect(lookupOutcome(response)).toBe('partial')
  })

  it('is not-found when the lookup failed, with or without a message', () => {
    const withMessage: AlertsDoneSearchPlayerResponse = {
      data: null,
      errorMessage: 'Sorry, the request cannot be made',
      isPrivate: false,
      success: false,
    }
    const withoutMessage: AlertsDoneSearchPlayerResponse = {
      data: null,
      errorMessage: null,
      isPrivate: false,
      success: false,
    }

    expect(lookupOutcome(withMessage)).toBe('not-found')
    expect(lookupOutcome(withoutMessage)).toBe('not-found')
  })
})
