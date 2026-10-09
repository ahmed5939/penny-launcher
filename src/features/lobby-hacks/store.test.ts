import type {
  LobbyHackRequest,
  LobbyHackResult,
} from '../../types/lobby-hacks'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { unknownResult } from './model'
import {
  setLobbyHackDraft,
  submitLobbyHackCode,
  useLobbyHackStore,
} from './store'

const alice = 'a'.repeat(32)
const bob = 'b'.repeat(32)

function reply(
  accountId: string,
  fields: Partial<LobbyHackResult> = {}
): LobbyHackResult {
  return { ...unknownResult(accountId), outcome: 'granted', ...fields }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  useLobbyHackStore.setState({
    draft: { accountId: null, code: '' },
    pending: null,
    last: null,
  })
})

describe('submitLobbyHackCode', () => {
  it('sends only the account id and the trimmed code, and shows it pending', async () => {
    const answer = deferred<LobbyHackResult>()
    const send = vi.fn<(request: LobbyHackRequest) => Promise<LobbyHackResult>>(
      () => answer.promise
    )

    const running = submitLobbyHackCode(alice, '  Up-Up Down!  ', send)

    expect(send).toHaveBeenCalledWith({ accountId: alice, code: 'Up-Up Down!' })
    expect(Object.keys(send.mock.calls[0][0]).sort()).toEqual([
      'accountId',
      'code',
    ])
    expect(useLobbyHackStore.getState().pending).toEqual({
      accountId: alice,
      code: 'Up-Up Down!',
    })

    answer.resolve(reply(alice))

    const submission = await running

    expect(submission?.result.outcome).toBe('granted')
    expect(useLobbyHackStore.getState()).toMatchObject({
      pending: null,
      last: { accountId: alice, code: 'Up-Up Down!' },
    })
  })

  it('refuses a second submission while one is pending', async () => {
    const answer = deferred<LobbyHackResult>()
    const send = vi.fn(() => answer.promise)

    const first = submitLobbyHackCode(alice, 'FIRST', send)

    expect(await submitLobbyHackCode(alice, 'SECOND', send)).toBeNull()
    expect(await submitLobbyHackCode(bob, 'THIRD', send)).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)

    answer.resolve(reply(alice))
    await first

    await submitLobbyHackCode(alice, 'FOURTH', send)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sends nothing for a code or account the main process would refuse', async () => {
    const send = vi.fn(async () => reply(alice))

    for (const code of ['', '   ', 'ONE\nTWO', 'TAB\tBED', 'x'.repeat(257)]) {
      expect(await submitLobbyHackCode(alice, code, send)).toBeNull()
    }

    expect(await submitLobbyHackCode('not-an-id', 'CODE', send)).toBeNull()
    expect(send).not.toHaveBeenCalled()
    expect(useLobbyHackStore.getState().last).toBeNull()
  })

  it('keeps the result on the account the code was sent for', async () => {
    const send = vi.fn(async () => reply(bob))

    const submission = await submitLobbyHackCode(alice, 'CODE', send)

    // A reply naming another account is not trusted as a grant.
    expect(submission?.accountId).toBe(alice)
    expect(submission?.result).toMatchObject({
      accountId: alice,
      outcome: 'uncertain',
    })
  })

  it('reports an unknown result when the IPC call itself fails, and never resends', async () => {
    const send = vi.fn(async () => {
      throw new Error('Request failed.')
    })

    const submission = await submitLobbyHackCode(alice, 'CODE', send)

    expect(submission?.result.outcome).toBe('uncertain')
    expect(send).toHaveBeenCalledTimes(1)
    expect(useLobbyHackStore.getState().pending).toBeNull()
  })

  it('clears a granted code from the form and keeps any other', async () => {
    setLobbyHackDraft({ accountId: alice, code: ' CODE ' })
    await submitLobbyHackCode(alice, ' CODE ', async () => reply(alice))
    expect(useLobbyHackStore.getState().draft).toEqual({
      accountId: alice,
      code: '',
    })

    setLobbyHackDraft({ code: 'AGAIN' })
    await submitLobbyHackCode(alice, 'AGAIN', async () =>
      reply(alice, { outcome: 'invalid-code' })
    )
    expect(useLobbyHackStore.getState().draft.code).toBe('AGAIN')
  })

  it('leaves a code typed while the first was pending alone', async () => {
    const answer = deferred<LobbyHackResult>()

    setLobbyHackDraft({ code: 'FIRST' })

    const running = submitLobbyHackCode(alice, 'FIRST', () => answer.promise)

    setLobbyHackDraft({ code: 'NEXT' })
    answer.resolve(reply(alice))
    await running

    expect(useLobbyHackStore.getState().draft.code).toBe('NEXT')
  })
})
