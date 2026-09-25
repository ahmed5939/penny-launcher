export type RewardsNotification = {
  accolades: {
    totalMissionXPRedeemed: number
    totalQuestXPRedeemed: number
  }
  source?: string
  description?: string
  outcome?: 'success' | 'error' | 'info'
  accountId: string
  createdAt: string
  id: string
  rewards: Record<string, number>
}
