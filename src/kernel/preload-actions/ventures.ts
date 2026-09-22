import { ipcRenderer } from 'electron'
import type { VenturesProgress } from '../../features/ventures/model'
export function requestVentures(accountId: string): Promise<VenturesProgress> { return ipcRenderer.invoke('ventures:query', accountId) }
