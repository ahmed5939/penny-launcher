import { setSkipTutorial } from '../../services/endpoints/mcp'
import { storeRequestAccess } from '../../services/endpoints/store'

/** Account access setup shared by the authentication flows. */
export class Unlock {
  static async storeAccess({
    accessToken,
    accountId,
  }: {
    accessToken: string
    accountId: string
  }) {
    try {
      await storeRequestAccess({
        accessToken,
        accountId,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Access may already exist.
    }

    try {
      await setSkipTutorial({
        accessToken,
        accountId,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Tutorial state may already be initialized.
    }
  }
}
