import { describe, expect, it } from 'vitest'

import { publicIpcMessage, UserError } from './user-error'

describe('publicIpcMessage', () => {
  it('passes a UserError message through', () => {
    expect(
      publicIpcMessage(new UserError('Epic authentication expired. Sign in again.'))
    ).toBe('Epic authentication expired. Sign in again.')
  })

  it('hides the message of a plain error', () => {
    expect(publicIpcMessage(new Error('ENOENT C:\\Users\\ahmed\\tokens.json'))).toBe(
      'Request failed.'
    )
  })

  it('hides a non-Error value', () => {
    expect(publicIpcMessage('C:\\Users\\ahmed\\tokens.json')).toBe('Request failed.')
    expect(publicIpcMessage(null)).toBe('Request failed.')
  })

  it('hides an empty UserError', () => {
    expect(publicIpcMessage(new UserError(''))).toBe('Request failed.')
  })
})
