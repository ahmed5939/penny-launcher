import { ipcRenderer } from 'electron'
import type { RecycleLevel, RewardsStatus } from '../../features/automation-rewards/model'
export function getAutomationRewards(): Promise<RewardsStatus> { return ipcRenderer.invoke('automation-rewards:status') }
export function updateLlamaRecycling(accountId: string, level: RecycleLevel): Promise<RewardsStatus> { return ipcRenderer.invoke('automation-rewards:update', accountId, level) }
