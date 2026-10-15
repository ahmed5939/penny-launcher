import { describe, expect, it } from 'vitest'

import { ipcErrorMessage } from './ipc-error'

describe('ipcErrorMessage', () => {
  it('strips the Electron channel prefix and error class', () => {
    const cause = new Error("Error invoking remote method 'account:load': Error: Token expired. Sign in again.")
    expect(ipcErrorMessage(cause, 'Could not load.')).toBe('Token expired. Sign in again.')
  })

  it('strips the prefix when the main process threw a typed error', () => {
    const cause = new Error("Error invoking remote method 'account:load': TypeError: Bad account id")
    expect(ipcErrorMessage(cause, 'Could not load.')).toBe('Bad account id')
  })

  it('keeps a message that has no Electron prefix', () => {
    expect(ipcErrorMessage(new Error('Network is offline.'), 'Could not load.')).toBe('Network is offline.')
  })

  it('falls back when the message is empty or the generic request failure', () => {
    expect(ipcErrorMessage(new Error(''), 'Could not load.')).toBe('Could not load.')
    expect(ipcErrorMessage(new Error('Request failed.'), 'Could not load.')).toBe('Could not load.')
    expect(ipcErrorMessage(new Error("Error invoking remote method 'account:load': Error: "), 'Could not load.')).toBe('Could not load.')
  })

  it('falls back for a value that is not an Error', () => {
    expect(ipcErrorMessage('boom', 'Could not load.')).toBe('Could not load.')
    expect(ipcErrorMessage(undefined, 'Could not load.')).toBe('Could not load.')
  })
})
