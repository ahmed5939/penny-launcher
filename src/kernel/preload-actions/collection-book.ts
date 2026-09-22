import { ipcRenderer } from 'electron'
import type { CollectionBookData } from '../../features/collection-book/types'

export function requestCollectionBook(accountId: string): Promise<CollectionBookData> {
  return ipcRenderer.invoke('collection-book:query', accountId)
}
