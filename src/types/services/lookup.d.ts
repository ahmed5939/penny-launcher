export type LookupFindOneByDisplayNameResponse = {
  id: string
  displayName: string
  externalAuths?: Partial<Record<string, unknown>>
}

/**
 * One linked console/store account. Epic keys these by platform — `psn`,
 * `xbl`, `steam`, `nintendo` — and not every platform sends every field.
 */
export type LookupExternalAuth = {
  accountId: string
  type: string
  externalAuthId?: string
  externalAuthIdType?: string
  externalAuthSecondaryId?: string
  externalDisplayName?: string
  avatar?: string
  authIds: Array<{
    id: string
    type: string
  }>
}

export type LookupFindManyByDisplayNameResponse =
  Array<LookupFindManyByDisplayName>

export type LookupFindManyByDisplayName = {
  id: string
  displayName?: string
  externalAuths: Partial<Record<string, LookupExternalAuth>>
}
