import type { PresenceSnapshot } from '../../types/presence'
import type { PresenceSocket, PresenceSocketFactory } from '../core/presence-transport'

import { powerMonitor } from 'electron'
import WebSocket from 'ws'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { checkIfCustomDisplayNameIsValid } from '../../lib/validations/properties'

import { AccountsManager } from './accounts'
import { MainWindow } from './windows/main'
import { RuntimeLog } from '../runtime-log'
import { ProcessWatcher } from '../process-watcher'
import { Authentication } from '../core/authentication'
import { Manifest } from '../core/manifest'
import { PresenceAuth } from '../core/presence-auth'
import {
  abortedFailure,
  failureFromHttp,
  isFortniteGameProcess,
  PresenceFailure,
  productVersionFrom,
} from '../core/presence-model'
import { PresenceController } from '../core/presence-session'
import {
  maxSocketPayloadBytes,
  openPresenceLink,
} from '../core/presence-transport'

import { getAccessTokenUsingDeviceAuth } from '../../services/endpoints/oauth'
import {
  createPresenceExchangeCode,
  exchangeCodeForPresenceToken,
  patchPresence,
  requestEasToken,
} from '../../services/endpoints/presence'

/**
 * Native Fortnite presence, wired to the real app: linked accounts, Epic,
 * the process list and the renderer. All the behaviour lives in
 * `core/presence-session.ts`.
 */

const socketFactory: PresenceSocketFactory = (url, headers) => {
  // No `protocols` argument: see the note at the top of presence-transport.
  const socket = new WebSocket(url, {
    headers,
    handshakeTimeout: 15_000,
    maxPayload: maxSocketPayloadBytes,
    perMessageDeflate: false,
  })

  return {
    get readyState() {
      return socket.readyState
    },
    send: (data) => socket.send(data),
    ping: () => socket.ping(),
    close: (code, reason) => socket.close(code, reason),
    terminate: () => socket.terminate(),
    on: ((event: string, listener: (...args: Array<unknown>) => void) =>
      socket.on(event, listener)) as PresenceSocket['on'],
  }
}

/**
 * The account's saved device auth → exchange code → an Android game-client
 * token that only presence uses. Its refresh token is what EAS takes.
 *
 * Not `Authentication.verifyAccessToken`: that returns null for a network
 * blip as well as a revoked sign-in, and marks the account invalid either
 * way. Here only Epic refusing the device auth means "sign in again"; a
 * blip stays retryable, and Penny's token is left alone.
 */
async function mintGameRefreshToken(accountId: string, signal: AbortSignal) {
  const account = AccountsManager.getAccountById(accountId)

  if (!account) {
    throw new PresenceFailure(
      'unknown-account',
      'That account is not linked to Penny any more.'
    )
  }

  let accountToken: string

  try {
    accountToken = (await getAccessTokenUsingDeviceAuth(account, { signal }))
      .data.access_token
  } catch (error) {
    const failure = failureFromHttp(error, 'auth')

    if (failure.code === 'reauth-required') {
      // Penny's own check reaches the same verdict and flags the account,
      // so the usual sign-in prompt appears across the app.
      void Authentication.verifyAccessToken(account).catch(() => undefined)

      throw new PresenceFailure(
        'reauth-required',
        `Epic no longer accepts Penny's sign-in for ${displayNameOf(account)}. Sign in to the account again, then retry.`,
        { status: failure.status }
      )
    }

    throw failure
  }

  if (signal.aborted) {
    throw abortedFailure()
  }

  const exchange = await createPresenceExchangeCode(accountToken, signal)
  const token = await exchangeCodeForPresenceToken(exchange.data.code, signal)

  if (token.data.account_id?.toLowerCase() !== accountId.toLowerCase()) {
    throw new PresenceFailure(
      'identity-mismatch',
      'Epic signed presence in as a different account than the one selected. Nothing was published.'
    )
  }

  if (!token.data.refresh_token) {
    throw new PresenceFailure(
      'rejected',
      'Epic did not return what presence needs to sign in.'
    )
  }

  return token.data.refresh_token
}

async function gameRunning() {
  const { default: psList } = await import('ps-list')

  return (await psList()).some((process) => isFortniteGameProcess(process.name))
}

function watchGame(listener: (running: boolean) => void) {
  ProcessWatcher.on(
    'presence',
    (processes) => {
      listener(processes.some((process) => isFortniteGameProcess(process.name)))
    },
    10_000
  )

  return () => ProcessWatcher.close('presence')
}

function displayNameOf(account: {
  customDisplayName?: string
  displayName: string
}) {
  return checkIfCustomDisplayNameIsValid(account.customDisplayName)
    ? `${account.customDisplayName}`
    : account.displayName
}

function emit(snapshot: PresenceSnapshot) {
  const window = MainWindow.instance

  if (window && !window.isDestroyed()) {
    window.webContents.send(ElectronAPIEventKeys.PresenceChanged, snapshot)
  }
}

export const PresenceManager = new PresenceController({
  now: () => Date.now(),
  random: () => Math.random(),
  resolveAccount: (accountId) => {
    const account = AccountsManager.getAccountById(accountId)

    return account
      ? { accountId: account.accountId, displayName: displayNameOf(account) }
      : null
  },
  createAuth: (accountId) =>
    new PresenceAuth(accountId, {
      now: () => Date.now(),
      mintGameRefreshToken,
      requestEasToken: async (refreshToken, signal) =>
        (await requestEasToken(refreshToken, signal)).data,
    }),
  connect: (accessToken, signal) =>
    openPresenceLink({ accessToken, signal, socketFactory }),
  publish: async (input) => {
    await patchPresence(input)
  },
  productVersion: async () => productVersionFrom(await Manifest.getUserAgent()),
  gameRunning,
  watchGame,
  emit,
  log: (event, detail) =>
    RuntimeLog.info('presence', detail ? `${event} ${detail}` : event),
})

/*
 * Registered when this module first loads (the first presence request), so
 * an app that never uses presence never loads it. That is always after
 * `ready`, which powerMonitor needs.
 */
AccountsManager.onRemoved((accountId) => PresenceManager.accountRemoved(accountId))
powerMonitor.on('suspend', () => PresenceManager.suspend())
powerMonitor.on('resume', () => PresenceManager.resume())
