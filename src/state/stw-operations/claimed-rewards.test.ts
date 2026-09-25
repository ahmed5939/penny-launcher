import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useClaimedRewardsStore } from './claimed-rewards'
import type { RewardsNotification } from '../../types/notifications'
const entry: RewardsNotification = { id: 'expedition', accountId: 'a', createdAt: '2026-09-25T10:00:00Z', rewards: { wood: 10 }, accolades: { totalMissionXPRedeemed: 0, totalQuestXPRedeemed: 0 } }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T12:00:00Z'))
  useClaimedRewardsStore.setState({ data: [] })
})
afterEach(() => vi.useRealTimers())
it('updates a collected expedition after recycling without counting its receipt twice', () => {
  const { updateData } = useClaimedRewardsStore.getState()
  updateData([entry])
  updateData([{ ...entry, rewards: { wood: 10, xp: 5 } }])
  expect(useClaimedRewardsStore.getState().data).toEqual([{ ...entry, rewards: { wood: 10, xp: 5 } }])
})
it('does not overwrite live updates with an older reconnect snapshot', () => {
  const { updateData } = useClaimedRewardsStore.getState()
  updateData([{ ...entry, description: 'Recycled' }])
  updateData([entry], true)
  expect(useClaimedRewardsStore.getState().data[0].description).toBe('Recycled')
})
it('keeps actions without rewards and orders events by their time', () => {
  const { updateData } = useClaimedRewardsStore.getState()
  updateData([{ ...entry, id: 'reroll', createdAt: '2026-09-25T11:00:00Z', source: 'Auto daily reroll', rewards: {} }])
  updateData([entry], true)
  expect(useClaimedRewardsStore.getState().data.map((e) => e.id)).toEqual(['expedition', 'reroll'])
})

it('expires events and their summary contributions while the launcher remains open', () => {
  const { updateData } = useClaimedRewardsStore.getState()
  updateData([entry])
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'))
  updateData([])
  expect(useClaimedRewardsStore.getState().data).toEqual([])
})
