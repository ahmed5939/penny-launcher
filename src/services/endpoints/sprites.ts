import type {
  SpriteCatalogResponse,
  SpriteInventoryResponse,
} from '../../types/services/sprites'

import { baseGameService } from '../config/base-game'
import {
  spriteInventoryService,
  spriteModuleFilter,
  spriteModuleId,
  spriteModuleVersion,
} from '../config/sprites'

/**
 * Every relic in the module, with summoning costs. An ordinary eg1 token.
 *
 * The trailing slash is deliberate — it is how the client requests it.
 */
export function getSpriteCatalog({ accessToken }: { accessToken: string }) {
  return baseGameService.get<SpriteCatalogResponse>(
    `/extractablerelics/${spriteModuleId}/${spriteModuleVersion}/getBackendCatalog/`,
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    }
  )
}

/**
 * The account's relic collection.
 *
 * An EOS token, not eg1 — see `eosToken` in `kernel/core/locker.ts` — and,
 * as with the locker, the gateway wants the scheme spelled `Bearer`.
 */
export function getSpriteInventory({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return spriteInventoryService.get<SpriteInventoryResponse>(
    `/account/${accountId}/workspace/default/linkMode/live/inventory`,
    {
      params: {
        moduleFilters: spriteModuleFilter,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
}
