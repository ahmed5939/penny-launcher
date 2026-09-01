import { create as createAxios } from 'axios'

import { Manifest } from '../../kernel/core/manifest'

import { eosDeploymentId } from './locker'

/**
 * Sprites — Battle Royale's extractable companions — are "relics" to the
 * backend, and they live in two places that are neither MCP nor the locker.
 *
 * - The *catalogue* (every relic that exists, and what summoning one costs)
 *   is a game-service endpoint keyed by a module id and a schema version.
 * - The *collection* (which relics this account has extracted, their XP and
 *   mastery) is an EOS inventory — internally "magpie" — behind the same
 *   gateway and token as the locker.
 *
 * The module id and version are what the shipping client sends today. Epic
 * bumps the version when the relic schema changes, so if the catalogue call
 * starts answering 404 this is the first thing to check.
 */

export const spriteModuleId = '70329e8f-f377-4a73-90cf-76b7ace87a07'

export const spriteModuleVersion = '8'

/** The magpie inventory's relic filter: `moduleId:version`. */
export const spriteModuleFilter = `${spriteModuleId}:${spriteModuleVersion}`

export const spriteInventoryService = createAxios({
  timeout: 20_000,
  baseURL: `https://fngw-svc-gc-livefn.ol.epicgames.com/api/magpie/v2/deployment/${eosDeploymentId}/domain/FN1`,
})

spriteInventoryService.interceptors.request.use(async (config) => {
  const userAgent = await Manifest.getUserAgent()

  config.headers.setUserAgent(userAgent)

  return config
})
