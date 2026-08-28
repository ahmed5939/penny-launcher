import type { WorkerPowerResult } from './trap-height-types'
import type { AccountData } from '../../../types/accounts'

import { Buffer } from 'node:buffer'

import { Authentication } from '../authentication'

import { getQueryProfile } from '../../../services/endpoints/mcp'

/**
 * Worker Power — queries the campaign profile of an account and rewrites
 * every Worker/Hero level to a target value, producing a JSON file external
 * tools can consume. The launcher never sends the modified profile anywhere;
 * it only hands the JSON to the user.
 */

const LEVEL_HIGH = 50
const LEVEL_LOW = 1

export async function generateWorkerPower(
  account: AccountData,
  mode: 'high' | 'low'
): Promise<WorkerPowerResult> {
  try {
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      return {
        error: 'Could not authenticate this account. Try re-adding it.',
        success: false,
      }
    }

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })
    const profile = JSON.parse(JSON.stringify(response.data)) as {
      profileChanges?: Array<{
        profile?: { items?: Record<string, ProfileItem> }
      }>
    }

    const changes = profile.profileChanges

    if (!Array.isArray(changes) || changes.length === 0) {
      return { error: 'No profile changes found in the response', success: false }
    }

    const targetLevel = mode === 'high' ? LEVEL_HIGH : LEVEL_LOW

    let workerCount = 0
    let heroCount = 0
    let modified = 0

    for (const change of changes) {
      const items = change?.profile?.items

      if (!items || typeof items !== 'object') continue

      for (const item of Object.values(items)) {
        const templateId: string = item?.templateId ?? ''
        const isWorker = templateId.startsWith('Worker:')
        const isHero = templateId.startsWith('Hero:')

        if (!isWorker && !isHero) continue

        if (isWorker) workerCount++
        if (isHero) heroCount++

        if (
          item.attributes &&
          typeof item.attributes === 'object' &&
          item.attributes.level !== targetLevel
        ) {
          item.attributes.level = targetLevel
          modified++
        }
      }
    }

    const json = JSON.stringify(profile, null, 2)

    return {
      heroCount,
      json,
      modified,
      sizeMB: (Buffer.byteLength(json, 'utf8') / (1024 * 1024)).toFixed(2),
      success: true,
      workerCount,
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to query the campaign profile',
      success: false,
    }
  }
}

type ProfileItem = {
  attributes?: { level?: number } & Record<string, unknown>
  templateId?: string
}
