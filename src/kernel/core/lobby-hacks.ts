import type { AccountData } from '../../types/accounts'
import type { LobbyHackResult } from '../../types/lobby-hacks'

import { RuntimeLog } from '../runtime-log'
import { AccountsManager } from '../startup/accounts'
import { Authentication } from './authentication'
import {
  peekCosmeticsCatalog,
  prettifyCosmeticId,
  resolveCosmetic,
  splitTemplateId,
} from './locker-catalog'
import {
  type LobbyHackVerdict,
  type RewardNamer,
  classifyTerminalCommandError,
  readTerminalCommandResponse,
  verdict,
} from './lobby-hacks-model'

import { setExecuteTerminalCommand } from '../../services/endpoints/mcp'

import { parseLobbyHackRequest } from '../../lib/lobby-hacks'

/**
 * BR Lobby Hacks: one Admin Panel code for one linked account.
 *
 * The renderer sends an account id and the code, nothing else. This side
 * looks the account up, signs in with Penny's usual token, checks the
 * account is still linked, and sends the code once. One submission runs at
 * a time across all accounts, and a failure is never retried: a timeout can
 * land after Epic has granted the rewards.
 *
 * Only remote reward codes are in scope. The Admin Panel's local lobby
 * effects run inside the game client and are not reproduced here.
 */

export type LobbyHackDependencies = {
  getAccount: (accountId: string) => AccountData | undefined
  verifyAccessToken: (account: AccountData) => Promise<string | null>
  execute: (request: {
    accessToken: string
    accountId: string
    command: string
  }) => Promise<{ data: unknown; status?: number }>
  nameOf: RewardNamer
  log: (scope: string, value: unknown) => void
  now: () => Date
}

export function createLobbyHackSubmitter(deps: LobbyHackDependencies) {
  let inFlight = false

  const finish = (accountId: string, result: LobbyHackVerdict) => {
    // Outcome and Epic's code only: never the code typed or a token.
    deps.log('lobby-hacks:submit', {
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      errorCode: result.errorCode,
      rewards: result.rewards.length,
    })

    return {
      accountId,
      ...result,
      finishedAt: deps.now().toISOString(),
    } satisfies LobbyHackResult
  }

  return async function submit(input: unknown): Promise<LobbyHackResult> {
    const parsed = parseLobbyHackRequest(input)

    if (!parsed.ok) {
      return finish(parsed.accountId ?? '', verdict('invalid-input'))
    }

    const { accountId, code } = parsed.request

    if (inFlight) {
      return finish(accountId, verdict('busy'))
    }

    inFlight = true

    try {
      const account = deps.getAccount(accountId)

      if (!account) {
        return finish(accountId, verdict('account-missing'))
      }

      let accessToken: string | null = null

      try {
        accessToken = await deps.verifyAccessToken(account)
      } catch {
        accessToken = null
      }

      if (!accessToken) {
        return finish(accountId, verdict('auth-failed'))
      }

      // Signing in can take a while; the account may have been removed.
      if (!deps.getAccount(accountId)) {
        return finish(accountId, verdict('account-missing'))
      }

      let response: { data: unknown; status?: number }

      try {
        response = await deps.execute({ accessToken, accountId, command: code })
      } catch (error) {
        return finish(accountId, classifyTerminalCommandError(error))
      }

      try {
        return finish(
          accountId,
          readTerminalCommandResponse(
            response.data,
            deps.nameOf,
            response.status ?? null
          )
        )
      } catch {
        // Epic answered 2xx; whatever broke the reading, it was not a refusal.
        return finish(
          accountId,
          verdict('unconfirmed', { httpStatus: response.status ?? null })
        )
      }
    } finally {
      inFlight = false
    }
  }
}

/** V-Bucks have no cosmetic to look up. */
const currencyNames: Record<string, string> = {
  'currency:mtxgiveaway': 'V-Bucks',
  'currency:mtxcomplimentary': 'V-Bucks',
  'currency:mtxpurchased': 'V-Bucks',
  'currency:mtxpurchasebonus': 'V-Bucks',
}

/**
 * The cosmetics catalogue if a locker screen has already loaded it, never a
 * 20 MB fetch for a reward line; otherwise a name read off the id.
 */
export function nameLobbyHackReward(itemType: string) {
  const currency = currencyNames[itemType.toLowerCase()]

  if (currency) {
    return { name: currency, imageUrl: null }
  }

  const catalog = peekCosmeticsCatalog()

  if (catalog) {
    const meta = resolveCosmetic(catalog, itemType)

    return { name: meta.name, imageUrl: meta.imageUrl }
  }

  return {
    name: prettifyCosmeticId(splitTemplateId(itemType).id),
    imageUrl: null,
  }
}

const submitLobbyHack = createLobbyHackSubmitter({
  getAccount: (accountId) => AccountsManager.getAccountById(accountId),
  verifyAccessToken: (account) => Authentication.verifyAccessToken(account),
  execute: setExecuteTerminalCommand,
  nameOf: nameLobbyHackReward,
  log: (scope, value) => RuntimeLog.info(scope, JSON.stringify(value)),
  now: () => new Date(),
})

export class LobbyHacks {
  static submit(input: unknown) {
    return submitLobbyHack(input)
  }
}
