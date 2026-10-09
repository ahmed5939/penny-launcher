import type { Items } from '../../features/expeditions/model'
import type { LlamaPreview, OpenLlamasProgress } from '../../features/open-llamas/model'
import type { OpenLlamasClient } from './open-llamas-run'

import { randomUUID } from 'node:crypto'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { buildPreview, freezeRun, isRunActive } from '../../features/open-llamas/model'
import { getQueryProfile, setOpenCardPackBatch, setRecycleItemBatch } from '../../services/endpoints/mcp'

import { RuntimeLog } from '../runtime-log'
import { AccountsManager } from '../startup/accounts'
import { AutomationRewards } from '../startup/automation-rewards'
import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'
import { ItemDatabase } from './item-database'
import { RequestNotSentError, runOpenLlamas } from './open-llamas-run'

/**
 * Open Llamas, main-process side. The renderer names an account and quotes
 * a preview id; the preview itself — the GUIDs a run may open — never leaves
 * this process, so a renderer cannot hand back a pool of its own.
 */

export type PreviewResult = { ok: true; preview: LlamaPreview } | { ok: false; error: string }
export type StartResult = { ok: true } | { ok: false; error: string }

const accountIdPattern = /^[a-f0-9]{32}$/i
/** Re-verify the sign-in this often during a long run. */
const tokenMaxAgeMs = 5 * 60_000
/** Progress at most this often; the final summary always goes. */
const progressIntervalMs = 500
/** How long a run waits for the item database before recycling without it. */
const databaseWaitMs = 10_000

type RunState = { progress: OpenLlamasProgress; cancelled: boolean }

const previews = new Map<string, LlamaPreview>()
const runs = new Map<string, RunState>()

function accountFor(accountId: unknown) {
  if (typeof accountId !== 'string' || !accountIdPattern.test(accountId)) return null
  return AccountsManager.getAccounts().get(accountId) ?? null
}

function campaignItems(accountId: string, data: { profileChanges?: Array<{ profile?: { accountId?: string; items?: Items } }> }) {
  const profile = data.profileChanges?.[0]?.profile

  // Never read one account's inventory into another account's run.
  if (!profile?.items || (profile.accountId && profile.accountId !== accountId)) {
    throw new Error('Epic returned an incomplete or mismatched profile.')
  }

  return profile.items
}

/** The endpoints, bound to one account, with the token checked now and then rather than per call. */
function clientFor(accountId: string): OpenLlamasClient {
  let token: string | null = null
  let verifiedAt = 0
  const accessToken = async () => {
    if (!token || Date.now() - verifiedAt > tokenMaxAgeMs) {
      const account = AccountsManager.getAccounts().get(accountId)
      token = account ? await Authentication.verifyAccessToken(account).catch(() => null) : null
      verifiedAt = Date.now()
      if (!token) throw new RequestNotSentError(account ? 'Epic sign-in expired — sign in again' : 'the account was removed')
    }
    return token
  }

  return {
    queryProfile: async () => campaignItems(accountId, (await getQueryProfile({ accessToken: await accessToken(), accountId })).data),
    openCardPacks: async (cardPackItemIds) => (await setOpenCardPackBatch({ accessToken: await accessToken(), accountId, cardPackItemIds })).data,
    recycleItems: async (targetItemIds) => (await setRecycleItemBatch({ accessToken: await accessToken(), accountId, targetItemIds })).data,
  }
}

async function catalogRarityLookup() {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), databaseWaitMs))
  const database = await Promise.race([ItemDatabase.snapshot().catch(() => null), timeout])
  const records = database?.records

  return records && Object.keys(records).length > 0 ? (templateId: string) => records[templateId.toLowerCase()]?.rarity ?? null : undefined
}

function send(progress: OpenLlamasProgress) {
  const window = MainWindow.instance

  if (window && !window.isDestroyed()) {
    window.webContents.send(ElectronAPIEventKeys.OpenLlamasProgress, progress)
  }
}

/** Short status for the runtime log: no request, no headers, no body. */
function describeError(error: unknown) {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  return typeof status === 'number' ? `HTTP ${status}` : error instanceof Error ? error.name : 'unknown error'
}

export class OpenLlamas {
  /** Reads the account's unopened packs and keeps them as the only pool a run may draw from. */
  static async preview(accountId: unknown): Promise<PreviewResult> {
    const account = accountFor(accountId)

    if (!account) return { ok: false, error: 'Select a linked account.' }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) return { ok: false, error: 'Epic sign-in expired. Sign in again, then Refresh.' }

      const response = await getQueryProfile({ accessToken, accountId: account.accountId })
      const preview = buildPreview(account.accountId, randomUUID(), campaignItems(account.accountId, response.data))

      // A run already under way keeps its own frozen copy; this one is for the next.
      previews.set(account.accountId, preview)

      return { ok: true, preview }
    } catch (error) {
      RuntimeLog.error('open-llamas:preview', describeError(error))
      const status = (error as { response?: { status?: unknown } })?.response?.status

      return { ok: false, error: `Could not read this account's llamas${typeof status === 'number' ? ` (HTTP ${status})` : ''}. Try Refresh.` }
    }
  }

  static start(request: unknown): StartResult {
    const accountId = (request as { accountId?: unknown } | null)?.accountId
    const account = accountFor(accountId)

    if (!account) return { ok: false, error: 'Select a linked account.' }
    if (isRunActive(runs.get(account.accountId)?.progress)) {
      return { ok: false, error: 'Llamas are already being opened on this account.' }
    }

    const preview = previews.get(account.accountId)

    if (!preview) return { ok: false, error: 'This preview is out of date. Refresh and check the selection again.' }

    // The run validates again; this answers the button straight away.
    const frozen = freezeRun(preview, request)

    if (!frozen.ok) return { ok: false, error: frozen.error }

    // One run per preview: the next one starts from a fresh read.
    previews.delete(account.accountId)

    const state: RunState = {
      cancelled: false,
      progress: {
        accountId: account.accountId,
        status: 'waiting',
        target: frozen.run.plan.target,
        opened: 0,
        recycled: 0,
        kept: 0,
        packsLeft: preview.total,
        recycle: frozen.run.recycle,
        message: null,
        uncertain: null,
        cancelRequested: false,
      },
    }
    let lastSent = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const publish = (progress: OpenLlamasProgress) => {
      state.progress = { ...progress, cancelRequested: progress.cancelRequested || state.cancelled }
      if (timer) clearTimeout(timer)
      timer = null
      const wait = progressIntervalMs - (Date.now() - lastSent)

      if (!isRunActive(state.progress) || wait <= 0) {
        lastSent = Date.now()
        send(state.progress)
      } else {
        timer = setTimeout(() => {
          timer = null
          lastSent = Date.now()
          send(state.progress)
        }, wait)
      }
    }

    // Set before the first await, so a second Open for this account is refused.
    runs.set(account.accountId, state)
    send(state.progress)

    // Shares the per-account queue with Auto Llamas and Auto Expeditions, so
    // their before/after inventory reads never interleave with this run.
    void AutomationRewards.withAccount(account.accountId, async () =>
      runOpenLlamas({
        catalogRarity: frozen.run.recycle === 'none' ? undefined : await catalogRarityLookup(),
        client: clientFor(account.accountId),
        isCancelled: () => state.cancelled,
        onProgress: publish,
        preview,
        request,
      })
    ).catch((error) => {
      RuntimeLog.error('open-llamas:run', describeError(error))
      publish({ ...state.progress, status: 'failed', message: 'The run stopped unexpectedly. Refresh to see what was opened.' })
    })

    return { ok: true }
  }

  /** Takes effect before the next opening request; one in flight is finished and counted first. */
  static cancel(accountId: unknown) {
    const state = typeof accountId === 'string' ? runs.get(accountId) : undefined

    if (!state || !isRunActive(state.progress)) return false
    state.cancelled = true
    state.progress = { ...state.progress, cancelRequested: true }
    send(state.progress)

    return true
  }

  /** The latest progress of every run since Penny started, for a page that mounts mid-run. */
  static status(): Array<OpenLlamasProgress> {
    return [...runs.values()].map((state) => state.progress)
  }
}
