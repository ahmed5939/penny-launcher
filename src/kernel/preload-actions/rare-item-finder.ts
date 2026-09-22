import { ipcRenderer } from 'electron'
import type { RareItemScan } from '../../features/rare-item-finder/types'

/** Read-only. There is deliberately no favourite/recycle/transfer counterpart. */
export function requestRareItemScan(accountId: string): Promise<RareItemScan> {
  return ipcRenderer.invoke('rare-item-finder:scan', accountId)
}
