import type { IpcRendererEvent } from 'electron'
import type {
  ShopCatalogPayload,
  ShopOpenNotification,
  ShopPayload,
  ShopPurchaseNotification,
} from '../core/shop'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestShop(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.ShopRequest, accounts)
}

export function purchaseShopOffer(
  account: AccountData,
  offer: {
    offerId: string
    title: string
    currency: string
    currencySubType: string
    finalPrice: number
    quantity: number
  }
) {
  ipcRenderer.send(ElectronAPIEventKeys.ShopPurchase, account, offer)
}

export function openLlamas(accounts: Array<AccountData>) {
  ipcRenderer.send(ElectronAPIEventKeys.ShopOpen, accounts)
}

export function responseShop(
  callback: (response: ShopPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: ShopPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ShopResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ShopResponse,
        customCallback
      ),
  }
}

export function notificationShopPurchase(
  callback: (response: ShopPurchaseNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ShopPurchaseNotification
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ShopPurchaseNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ShopPurchaseNotification,
        customCallback
      ),
  }
}

export function requestShopCatalog() {
  ipcRenderer.send(ElectronAPIEventKeys.ShopCatalogRequest)
}

export function responseShopCatalog(
  callback: (response: ShopCatalogPayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ShopCatalogPayload
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ShopCatalogResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ShopCatalogResponse,
        customCallback
      ),
  }
}

export function notificationShopOpen(
  callback: (response: ShopOpenNotification) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: ShopOpenNotification
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ShopOpenNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ShopOpenNotification,
        customCallback
      ),
  }
}
