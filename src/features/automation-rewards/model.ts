import { confirmedRewards, type Reward } from '../expeditions/model'
export const recycleLevels = ['off', 'Common', 'Uncommon', 'Rare', 'Epic'] as const
export type RecycleLevel = typeof recycleLevels[number]
export type RewardEvent = {
  id: string; accountId: string; source: 'llamas' | 'expeditions'; timestamp: string
  description: string; received: Reward[]; recycled: Reward[]; resources: Reward[]
  status: 'received' | 'complete' | 'recycling' | 'error'; error?: string
}
export type RewardsStatus = {
  accounts: { accountId: string; name: string }[]
  llamaRecycling: Record<string, RecycleLevel>
  events: RewardEvent[]
}
export function llamaRewards(notifications: unknown): Reward[] {
  if (!Array.isArray(notifications)) return []
  return notifications.flatMap((n) => confirmedRewards(n?.loot?.items ?? n?.loot?.lootGranted?.items ?? n?.lootGranted?.items ?? n?.lootResult?.items ?? []))
    .filter((r) => !r.templateId.toLowerCase().startsWith('accolades:'))
}
export function rewardTotals(events: RewardEvent[], field: 'received' | 'recycled' | 'resources') {
  const totals = new Map<string, number>()
  for (const event of events) for (const reward of event[field]) totals.set(reward.templateId, (totals.get(reward.templateId) ?? 0) + reward.quantity)
  return [...totals].map(([templateId, quantity]) => ({ templateId, quantity })).sort((a, b) => b.quantity - a.quantity || a.templateId.localeCompare(b.templateId))
}
