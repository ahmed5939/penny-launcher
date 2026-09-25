import { ipcRenderer } from 'electron'
import type { BookUpgradeRequest, CollectionBookData } from '../../features/collection-book/types'

export function requestCollectionBook(accountId: string): Promise<CollectionBookData> {
  return ipcRenderer.invoke('collection-book:query', accountId)
}

export function upgradeCollectionBookItem(accountId: string, request: BookUpgradeRequest): Promise<{ ok: true }> {
  return ipcRenderer.invoke('collection-book:upgrade', accountId, request)
}
