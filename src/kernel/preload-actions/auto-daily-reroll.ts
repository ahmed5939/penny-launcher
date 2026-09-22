import { ipcRenderer } from 'electron'
import type {
  DailyRerollPreferences,
  DailyRerollStatus,
} from '../../features/daily-reroll/policy'

export function getAutoDailyRerollStatus(): Promise<DailyRerollStatus> {
  return ipcRenderer.invoke('auto-daily-reroll:status')
}

export function updateAutoDailyReroll(
  accountId: string,
  settings: DailyRerollPreferences,
): Promise<DailyRerollStatus> {
  return ipcRenderer.invoke('auto-daily-reroll:update', accountId, settings)
}
