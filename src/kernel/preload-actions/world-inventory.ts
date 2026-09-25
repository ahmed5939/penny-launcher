import { ipcRenderer } from 'electron'
import type { WorldInventory, WorldInventoryLocation, WorldTransfer } from '../../features/world-inventory/model'
export function requestWorldInventory(accountId: string, location: WorldInventoryLocation): Promise<WorldInventory> { return ipcRenderer.invoke('world-inventory:query', accountId, location) }
export function transferWorldItems(accountId: string, transfers: WorldTransfer[]): Promise<{ moved: number }> { return ipcRenderer.invoke('world-inventory:transfer', accountId, transfers) }
