import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { app } from 'electron'

import { Authentication } from './authentication'
import { ItemDatabase } from './item-database'
import { AccountsManager } from '../startup/accounts'
import {
  FinderFailure,
  RULES_VERSION,
  SOURCES,
  counts,
  fallback,
  normalizeProfile,
  safeError,
} from '../../features/rare-item-finder/model'
import type {
  FinderMetadata,
  FinderSourceId,
  RareItemScan,
  ScannedProfile,
  SlotRules,
} from '../../features/rare-item-finder/types'

/**
 * Rare Item Finder — a read-only scan of the four weapon/trap inventories.
 *
 * Replaces the plugin's private API-v2 adapter: the renderer names an account,
 * the main process resolves the linked record, authenticates, reads the
 * profiles and classifies them here. No token, raw profile or service body
 * reaches the renderer, and there is no mutation channel at all.
 */

const profileURL = (accountId: string, profileId: FinderSourceId) =>
  `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`

/**
 * The extracted slot rules are ~20MB, so they live beside the app as an extra
 * resource rather than in the bundle, and are dropped a minute after the last
 * scan rather than held for the whole session.
 */
const rulesDirectory = () =>
  path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'rare-item-finder-assets')

let rulesCache: Promise<SlotRules> | null = null
let rulesEviction: NodeJS.Timeout | null = null

export function loadSlotRules(): Promise<SlotRules> {
  rulesCache ??= readFile(path.join(rulesDirectory(), 'slot-rules.json'), 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw) as SlotRules
      if (!parsed || typeof parsed.items !== 'object' || !Array.isArray(parsed.knownPerks)) {
        throw new FinderFailure('The bundled slot rules are unreadable. Reinstall Penny.', 'RULES_UNAVAILABLE')
      }
      return parsed
    })
    .catch((error) => {
      rulesCache = null
      throw error instanceof FinderFailure
        ? error
        : new FinderFailure('The bundled slot rules could not be loaded. Reinstall Penny.', 'RULES_UNAVAILABLE')
    })
  if (rulesEviction) clearTimeout(rulesEviction)
  rulesEviction = setTimeout(() => {
    rulesCache = null
    rulesEviction = null
  }, 60_000)
  rulesEviction.unref()
  return rulesCache
}

/** The live item database when it is available; the bundled snapshot otherwise. */
async function metadata(): Promise<FinderMetadata> {
  try {
    const payload = await ItemDatabase.snapshot()
    return payload.total > 0 ? { records: payload.records, ratings: payload.ratings } : fallback
  } catch {
    return fallback
  }
}

async function queryProfile(accountId: string, accessToken: string, profileId: FinderSourceId) {
  const response = await fetch(profileURL(accountId, profileId), {
    method: 'POST',
    headers: { Authorization: `bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(30_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    // Surface the status and Epic's error code only; never its message.
    const code = body && typeof body === 'object' && typeof body.errorCode === 'string' ? body.errorCode : ''
    throw Object.assign(new Error('Epic rejected the profile request.'), { status: response.status, code })
  }
  return body
}

export async function requestRareItemScan(accountId: string): Promise<RareItemScan> {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new FinderFailure('Choose a valid Epic account.', 'NO_ACCOUNT')
  }
  const account = AccountsManager.getAccounts().get(accountId)
  if (!account) throw new FinderFailure('Select a linked account.', 'ACCOUNT_REMOVED')
  const accessToken = await Authentication.verifyAccessToken(account)
  if (!accessToken) throw new FinderFailure('Epic authentication expired. Sign in again.', 'AUTH_REQUIRED')
  const [rules, records] = await Promise.all([loadSlotRules(), metadata()])

  // One inventory failing must not hide the other three, or look complete.
  const profiles: Array<ScannedProfile> = await Promise.all(
    SOURCES.map(async (source): Promise<ScannedProfile> => {
      try {
        const response = await queryProfile(accountId, accessToken, source.id)
        if (!AccountsManager.getAccounts().has(accountId)) {
          throw new FinderFailure('That account is no longer in Penny.', 'ACCOUNT_REMOVED')
        }
        return normalizeProfile(accountId, source.id, response, rules, records)
      } catch (error) {
        return { sourceId: source.id, status: 'error', items: [], error: safeError(error) }
      }
    }),
  )

  return {
    accountId,
    fetchedAt: new Date().toISOString(),
    profiles,
    counts: counts(profiles),
    rulesVersion: RULES_VERSION,
  }
}
