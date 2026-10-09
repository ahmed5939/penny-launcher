import type { InternalAxiosRequestConfig } from 'axios'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../kernel/core/manifest', () => ({
  Manifest: {
    getUserAgent: async () => 'Fortnite/++Fortnite+Release-38.10-CL-1-Windows',
  },
}))

import { baseGameService } from '../config/base-game'
import { setExecuteTerminalCommand } from './mcp'

const accountId = 'a'.repeat(32)
const sent: Array<InternalAxiosRequestConfig> = []
const originalAdapter = baseGameService.defaults.adapter

beforeEach(() => {
  sent.length = 0
  baseGameService.defaults.adapter = async (config) => {
    sent.push(config)

    return {
      config,
      data: { profileId: 'athena', notifications: [] },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
})

afterEach(() => {
  baseGameService.defaults.adapter = originalAdapter
})

describe('setExecuteTerminalCommand', () => {
  it('posts the code to athena ExecuteTerminalCommand on the game service', async () => {
    await setExecuteTerminalCommand({
      accessToken: 'token-1',
      accountId,
      command: 'Cheat Code-42!',
    })

    expect(sent).toHaveLength(1)

    const [config] = sent
    const url = new URL(baseGameService.getUri(config))

    expect(config.method).toBe('post')
    expect(url.origin).toBe('https://fngw-mcp-gc-livefn.ol.epicgames.com')
    expect(url.pathname).toBe(
      `/fortnite/api/game/v2/profile/${accountId}/client/ExecuteTerminalCommand`
    )
    expect(url.searchParams.get('profileId')).toBe('athena')
    expect(url.searchParams.get('rvn')).toBe('-1')
    expect(JSON.parse(config.data as string)).toEqual({
      command: 'Cheat Code-42!',
    })
    expect(config.headers.get('Authorization')).toBe('bearer token-1')
    expect(config.headers.get('Content-Type')).toBe('application/json')
    // The shared interceptor's game User-Agent, not a second one.
    expect(config.headers.get('User-Agent')).toBe(
      'Fortnite/++Fortnite+Release-38.10-CL-1-Windows'
    )
  })

  it('sends once and surfaces a timeout instead of retrying', async () => {
    baseGameService.defaults.adapter = async (config) => {
      sent.push(config)
      throw new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED', config)
    }

    await expect(
      setExecuteTerminalCommand({ accessToken: 't', accountId, command: 'X' })
    ).rejects.toMatchObject({ code: 'ECONNABORTED' })
    expect(sent).toHaveLength(1)
  })
})
