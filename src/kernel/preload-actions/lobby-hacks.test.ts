import { describe, expect, it, vi } from 'vitest'

const invoke = vi.hoisted(() => vi.fn(async () => null))

vi.mock('electron', () => ({ ipcRenderer: { invoke } }))

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { submitLobbyHack } from './lobby-hacks'

describe('submitLobbyHack', () => {
  it('invokes the lobby-hacks channel with the account id and code only', async () => {
    const accountId = 'a'.repeat(32)

    await submitLobbyHack({
      accountId,
      code: 'CODE',
      // Anything else a caller attaches stays in the renderer.
      ...({ accessToken: 'leaked', account: { secret: 'x' } } as object),
    } as Parameters<typeof submitLobbyHack>[0])

    expect(ElectronAPIEventKeys.LobbyHackSubmit).toBe('lobby-hacks:submit')
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('lobby-hacks:submit', {
      accountId,
      code: 'CODE',
    })
  })
})
