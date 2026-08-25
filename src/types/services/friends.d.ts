export type FetchFriendResponse = {
  accountId: string
  groups: Array<unknown>
  alias: string
  note: string
  favorite: boolean
  created: string
}

export type FriendSummaryEntry = {
  accountId: string
  groups: Array<unknown>
  mutual?: number
  alias: string
  note?: string
  favorite?: boolean
  created: string
}

export type FetchFriendsSummaryResponse = {
  friends: Array<FriendSummaryEntry>
  incoming: Array<FriendSummaryEntry>
  outgoing: Array<FriendSummaryEntry>
  blocklist: Array<FriendSummaryEntry>
  settings: {
    acceptInvites: string
  }
  limitsReached?: {
    incoming: boolean
    outgoing: boolean
    accepted: boolean
  }
}
