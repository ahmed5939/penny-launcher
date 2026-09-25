import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { DataDirectory } from './data-directory'
import { AutomationHistoryStore } from './automation-history-store'
import { RuntimeLog } from '../runtime-log'
import type { RewardsNotification } from '../../types/notifications'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { MainWindow } from './windows/main'

const store = new AutomationHistoryStore(path.join(DataDirectory.getDataDirectoryPath(), 'automation-history.json'))
export function automationHistory() { return store.list() }
export function flushAutomationHistory() { return store.flush() }
export function recordAutomationHistory(entry: Pick<RewardsNotification, 'accountId'> & Partial<RewardsNotification>) {
  const value: RewardsNotification = {
    id: randomUUID(), createdAt: new Date().toISOString(), rewards: {},
    accolades: { totalMissionXPRedeemed: 0, totalQuestXPRedeemed: 0 },
    ...entry,
  }
  void store.record(value).catch((error) => RuntimeLog.error('automation-history:save', error))
  // UI delivery must never turn a confirmed game action into an automation failure.
  try {
    MainWindow.instance?.webContents.send(ElectronAPIEventKeys.ClaimRewardsClientGlobalSyncNotification, [value])
  } catch { /* The renderer can retrieve the snapshot when it reconnects. */ }
}
