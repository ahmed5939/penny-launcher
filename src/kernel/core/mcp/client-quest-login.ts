import { RuntimeLog } from '../../runtime-log'
import type { AccountData } from '../../../types/accounts'

import { Authentication } from '../authentication'

import { setClientQuestLogin } from '../../../services/endpoints/mcp'

/**
 * Kept for the Auto Daily Quests scheduler. The manual "Save quests" tool
 * that used to drive this from the renderer is gone, so there is no longer
 * a notification to send back.
 */
export class MCPClientQuestLogin {
  static async save(accounts: Array<AccountData>) {
    try {
      await Promise.allSettled(
        accounts.map(async (account) => {
          try {
            const accessToken =
              await Authentication.verifyAccessToken(account)

            if (!accessToken) {
              return
            }

            const { accountId } = account

            await setClientQuestLogin({
              accessToken,
              accountId,
            })

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            RuntimeLog.error('caught:core/mcp/client-quest-login.ts', error)
          }
        })
      )

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/mcp/client-quest-login.ts', error)
    }
  }
}
