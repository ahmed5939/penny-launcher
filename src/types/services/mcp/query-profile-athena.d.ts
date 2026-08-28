import { StringUnion } from '../../utils.d'

/**
 * The Battle Royale locker profile, narrowed to the gift data this app reads:
 * which cosmetics carry a `giftFromAccountId` attribute and when they landed.
 * Everything else Epic ships on this profile is folded into loose records
 * on purpose — the shape is not pinned by the endpoint documentation.
 */
export type MCPQueryProfileAthenaProfile = {
  profileRevision: number
  profileId: 'athena'
  profileChangesBaseRevision: number
  profileCommandRevision: number
  serverTime: string
  responseVersion: number
  profileChanges: [
    {
      changeType: StringUnion<'fullProfileUpdate'>
      profile: {
        _id: string
        created: string
        updated: string
        rvn: number
        wipeNumber: number
        accountId: string
        profileId: 'athena'
        version: string
        commandRevision: number
        stats: {
          attributes: Record<string, unknown>
        }
        items: Record<
          string,
          {
            /**
             * `AthenaCharacter:cid_001…`, and increasingly not: the same
             * profile now files instruments (`SparksGuitar:`), jam tracks
             * (`SparksSong:`), shoes (`CosmeticShoes:`), car parts
             * (`VehicleCosmetics_Body:`) and companions (`CosmeticMimosa:`).
             * Narrowing this to `Athena${string}` would hide most of a
             * modern locker from the type system.
             */
            templateId: `${string}:${string}`
            attributes: Partial<{
              /** Set when the cosmetic arrived as a gift — the sender's id. */
              giftFromAccountId: string
              creation_time: string
              item_seen: boolean
              variants: Array<unknown>
              item_since: string
            }>
            quantity: number
          }
        >
      }
    },
  ]
}
