import { ipcRenderer } from 'electron'
import type { WorldInventory, WorldInventoryLocation } from '../../features/world-inventory/model'
export function requestWorldInventory(accountId: string, location: WorldInventoryLocation): Promise<WorldInventory> { return ipcRenderer.invoke('world-inventory:query', accountId, location) }
