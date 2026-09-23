import { ipcRenderer } from 'electron'
import type { QuestHistory } from '../../features/quest-history/model'
export function requestQuestHistory(accountId: string): Promise<QuestHistory> { return ipcRenderer.invoke('quest-history:query', accountId) }
