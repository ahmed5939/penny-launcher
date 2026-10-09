import { ipcRenderer } from 'electron'
import type { SixthPerksScan } from '../../features/sixth-perks/types'

/** Read-only. Main reads the profiles; only schematic ids, levels and alterations come back. */
export function requestSixthPerks(accountId: string, includeBook = false): Promise<SixthPerksScan> {
  return ipcRenderer.invoke('sixth-perks:query', accountId, includeBook)
}
