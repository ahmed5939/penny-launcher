import type { AccountData } from '../../types/accounts'
import type { LobbyHackDependencies } from './lobby-hacks'

import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  accounts: new Map<string, unknown>(),
  verifyAccessToken: vi.fn(),
  setExecuteTerminalCommand: vi.fn(),
  info: vi.fn(),
  catalog: null as unknown,
}))

vi.mock('../runtime-log', () => ({
  RuntimeLog: { info: mocks.info, error: vi.fn() },
}))
vi.mock('../startup/accounts', () => ({
  AccountsManager: {
    getAccountById: (accountId: string) => mocks.accounts.get(accountId),
  },
}))
vi.mock('./authentication', () => ({
  Authentication: { verifyAccessToken: mocks.verifyAccessToken },
}))
vi.mock('../../services/endpoints/mcp', () => ({
  setExecuteTerminalCommand: mocks.setExecuteTerminalCommand,
}))
vi.mock('./locker-catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./locker-catalog')>()),
  peekCosmeticsCatalog: () => mocks.catalog,
}))

import { buildCosmeticsCatalog } from './locker-catalog'
import {
  LobbyHacks,
  createLobbyHackSubmitter,
  nameLobbyHackReward,
} from './lobby-hacks'

const accountId = 'a'.repeat(32)
const account = {
  accountId,
  displayName: 'Alice',
  deviceId: 'device-secret',
  secret: 'device-auth-secret',
} as AccountData

const granted = {
  status: 200,
  data: {
    profileId: 'athena',
    notifications: [
      { type: 'terminalCommandResult', canRepeat: false, rewardGranted: true },
    ],
  },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function setup(overrides: Partial<LobbyHackDependencies> = {}) {
  const linked = new Map([[accountId, account]])
  const deps = {
    getAccount: vi.fn((id: string) => linked.get(id)),
    verifyAccessToken: vi.fn(async () => 'access-token-1' as string | null),
    execute: vi.fn(async () => granted as { data: unknown; status?: number }),
    nameOf: vi.fn((itemType: string) => ({ name: itemType, imageUrl: null })),
    log: vi.fn(),
    now: () => new Date('2026-10-09T12:00:00.000Z'),
    ...overrides,
  }

  return { deps, linked, submit: createLobbyHackSubmitter(deps) }
}

function timeout() {
  const config = { headers: new AxiosHeaders() }

  return new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED', config)
}

describe('createLobbyHackSubmitter', () => {
  it('signs in for the named account and sends its code once', async () => {
    const { deps, submit } = setup()

    const result = await submit({ accountId, code: '  Cheat-Code 42!  ' })

    expect(deps.getAccount).toHaveBeenCalledWith(accountId)
    expect(deps.verifyAccessToken).toHaveBeenCalledWith(account)
    expect(deps.execute).toHaveBeenCalledTimes(1)
    expect(deps.execute).toHaveBeenCalledWith({
      accessToken: 'access-token-1',
      accountId,
      command: 'Cheat-Code 42!',
    })
    expect(result).toMatchObject({
      accountId,
      outcome: 'granted',
      canRepeat: false,
      httpStatus: 200,
      finishedAt: '2026-10-09T12:00:00.000Z',
    })
  })

  it('sends nothing for malformed input', async () => {
    const { deps, submit } = setup()

    for (const input of [
      null,
      { accountId: 'bad', code: 'X' },
      { accountId, code: '' },
      { accountId, code: 'ONE\nTWO' },
      { accountId, code: 'x'.repeat(257) },
      { accountId, code: ['ONE', 'TWO'] },
    ]) {
      expect((await submit(input)).outcome).toBe('invalid-input')
    }

    expect(deps.getAccount).not.toHaveBeenCalled()
    expect(deps.verifyAccessToken).not.toHaveBeenCalled()
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it('does not sign in for an account that is not linked', async () => {
    const { deps, submit } = setup()
    const other = 'b'.repeat(32)

    expect(await submit({ accountId: other, code: 'X' })).toMatchObject({
      accountId: other,
      outcome: 'account-missing',
    })
    expect(deps.verifyAccessToken).not.toHaveBeenCalled()
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it('stops when the saved sign-in is refused or throws', async () => {
    const refused = setup({ verifyAccessToken: vi.fn(async () => null) })
    const threw = setup({
      verifyAccessToken: vi.fn(async () => {
        throw new Error('network')
      }),
    })

    expect((await refused.submit({ accountId, code: 'X' })).outcome).toBe(
      'auth-failed'
    )
    expect((await threw.submit({ accountId, code: 'X' })).outcome).toBe(
      'auth-failed'
    )
    expect(refused.deps.execute).not.toHaveBeenCalled()
    expect(threw.deps.execute).not.toHaveBeenCalled()
  })

  it('rechecks the account after signing in and sends nothing if it was removed', async () => {
    const { deps, linked, submit } = setup()

    vi.mocked(deps.verifyAccessToken).mockImplementation(async () => {
      linked.delete(accountId)

      return 'access-token-1'
    })

    expect((await submit({ accountId, code: 'X' })).outcome).toBe(
      'account-missing'
    )
    expect(deps.execute).not.toHaveBeenCalled()
  })

  it('refuses a second submission while one is running, for any account', async () => {
    const pending = deferred<{ data: unknown; status?: number }>()
    const { deps, linked, submit } = setup({
      execute: vi.fn(() => pending.promise),
    })
    const other = 'b'.repeat(32)

    linked.set(other, { ...account, accountId: other })

    const first = submit({ accountId, code: 'FIRST' })

    await vi.waitFor(() => expect(deps.execute).toHaveBeenCalledTimes(1))

    expect((await submit({ accountId, code: 'SECOND' })).outcome).toBe('busy')
    expect((await submit({ accountId: other, code: 'THIRD' })).outcome).toBe(
      'busy'
    )

    pending.resolve(granted)

    expect((await first).outcome).toBe('granted')
    expect(deps.execute).toHaveBeenCalledTimes(1)

    // The lock is released once the first answer is in.
    await submit({ accountId, code: 'FOURTH' })
    expect(deps.execute).toHaveBeenCalledTimes(2)
  })

  it('holds the lock while signing in, before anything is sent', async () => {
    const signIn = deferred<string | null>()
    const { deps, submit } = setup({
      verifyAccessToken: vi.fn(() => signIn.promise),
    })

    const first = submit({ accountId, code: 'FIRST' })

    expect((await submit({ accountId, code: 'SECOND' })).outcome).toBe('busy')

    signIn.resolve('access-token-1')
    await first

    expect(deps.verifyAccessToken).toHaveBeenCalledTimes(1)
    expect(deps.execute).toHaveBeenCalledTimes(1)
  })

  it('releases the lock after a failure', async () => {
    const { deps, submit } = setup({
      execute: vi.fn(async () => {
        throw timeout()
      }),
    })

    await submit({ accountId, code: 'X' })
    await submit({ accountId, code: 'X' })

    expect(deps.execute).toHaveBeenCalledTimes(2)
  })

  it('never retries a timeout and reports it as unknown', async () => {
    const { deps, submit } = setup({
      execute: vi.fn(async () => {
        throw timeout()
      }),
    })

    expect(await submit({ accountId, code: 'X' })).toMatchObject({
      outcome: 'uncertain',
      httpStatus: null,
    })
    expect(deps.execute).toHaveBeenCalledTimes(1)
  })

  it('maps an Epic 401 on the command to a sign-in failure', async () => {
    const config = { headers: new AxiosHeaders() }
    const { submit } = setup({
      execute: vi.fn(async () => {
        throw new AxiosError('401', undefined, config, {}, {
          status: 401,
          statusText: '',
          headers: {},
          config,
          data: {
            errorCode:
              'errors.com.epicgames.common.authentication.token_verification_failed',
          },
        })
      }),
    })

    expect((await submit({ accountId, code: 'X' })).outcome).toBe('auth-failed')
  })

  it('reports unconfirmed when the answer cannot be read', async () => {
    const { submit } = setup({
      execute: vi.fn(async () => ({
        status: 200,
        data: {
          notifications: [
            {
              type: 'questClaim',
              loot: { items: [{ itemType: 'AthenaDance:eid_x' }] },
            },
          ],
        },
      })),
      nameOf: () => {
        throw new Error('catalogue exploded')
      },
    })

    expect(await submit({ accountId, code: 'X' })).toMatchObject({
      outcome: 'unconfirmed',
      httpStatus: 200,
    })
  })

  it('keeps tokens and the code out of logs and results', async () => {
    const { deps, submit } = setup()

    const result = await submit({ accountId, code: 'MY-SECRET-CODE' })
    const logged = JSON.stringify(vi.mocked(deps.log).mock.calls)
    const returned = JSON.stringify(result)

    for (const secret of [
      'access-token-1',
      'MY-SECRET-CODE',
      'device-secret',
      'device-auth-secret',
    ]) {
      expect(logged).not.toContain(secret)
      expect(returned).not.toContain(secret)
    }

    expect(deps.log).toHaveBeenCalledWith('lobby-hacks:submit', {
      outcome: 'granted',
      httpStatus: 200,
      errorCode: null,
      rewards: 0,
    })
  })
})

describe('LobbyHacks', () => {
  beforeEach(() => {
    mocks.accounts.clear()
    mocks.verifyAccessToken.mockReset()
    mocks.setExecuteTerminalCommand.mockReset()
    mocks.info.mockReset()
    mocks.catalog = null
  })

  it("uses Penny's account manager, authentication and game-service endpoint", async () => {
    mocks.accounts.set(accountId, account)
    mocks.verifyAccessToken.mockResolvedValue('access-token-1')
    mocks.setExecuteTerminalCommand.mockResolvedValue(granted)

    const result = await LobbyHacks.submit({ accountId, code: 'CODE-XYZ' })

    expect(result.outcome).toBe('granted')
    expect(mocks.verifyAccessToken).toHaveBeenCalledWith(account)
    expect(mocks.setExecuteTerminalCommand).toHaveBeenCalledTimes(1)
    expect(mocks.setExecuteTerminalCommand).toHaveBeenCalledWith({
      accessToken: 'access-token-1',
      accountId,
      command: 'CODE-XYZ',
    })

    const logged = JSON.stringify(mocks.info.mock.calls)

    expect(logged).toContain('granted')
    expect(logged).not.toContain('access-token-1')
    expect(logged).not.toContain('CODE-XYZ')
  })
})

describe('nameLobbyHackReward', () => {
  beforeEach(() => {
    mocks.catalog = null
  })

  it('names V-Bucks without a catalogue', () => {
    expect(nameLobbyHackReward('Currency:MtxGiveaway')).toEqual({
      name: 'V-Bucks',
      imageUrl: null,
    })
  })

  it('reads a name off the id when no locker screen has loaded the catalogue', () => {
    expect(
      nameLobbyHackReward(
        'MagpieEntitlementReward:magpiereward_jonesy_gold_sprite'
      )
    ).toEqual({ name: 'Magpiereward Jonesy Gold Sprite', imageUrl: null })
  })

  it('uses the cosmetics catalogue when it is already loaded', () => {
    mocks.catalog = buildCosmeticsCatalog({
      br: [
        {
          id: 'Backpack_WinterGift',
          name: 'Winter Gift',
          type: { backendValue: 'AthenaBackpack' },
          rarity: { value: 'uncommon' },
          images: { smallIcon: 'https://example.test/gift.png' },
        },
      ],
    } as Parameters<typeof buildCosmeticsCatalog>[0])

    expect(nameLobbyHackReward('AthenaBackpack:backpack_wintergift')).toEqual({
      name: 'Winter Gift',
      imageUrl: 'https://example.test/gift.png',
    })
  })
})
