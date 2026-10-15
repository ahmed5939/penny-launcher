import type {
  ShopEntry,
  ShopOffer,
  ShopPurchaseNotification,
} from '../../../kernel/core/shop'

import { useShallow } from 'zustand/react/shallow'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAccountResource } from '../../../components/page'

import { useAccountListStore } from '../../../state/accounts/list'
import { useShopStore } from '../../../state/stw-operations/shop'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import { parseCustomDisplayName } from '../../../lib/utils'

/** How long a follow-up waits for the reply the main process sends by itself. */
const followTimeoutMs = 15_000

/**
 * The shop IPC is fire-and-forget: the request goes out with a list of
 * accounts and one payload per account comes back on its own channel. This
 * turns one account's round trip into a promise for `useAccountResource`.
 *
 * `follow` skips the request and waits for the reply the main process
 * already sends after a purchase, so a purchase costs one shop read rather
 * than two. If that reply never shows, it asks after all.
 */
function readShop(accountId: string, follow: boolean) {
  const account = useAccountListStore.getState().accounts[accountId]

  if (!account) {
    return Promise.reject(
      new Error('This account is no longer in the launcher. Choose another.')
    )
  }

  return new Promise<ShopEntry>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = window.electronAPI.responseShop(async (response) => {
      const entry = response[accountId]

      if (!entry) {
        return
      }

      clearTimeout(timer)
      listener.removeListener()

      if (entry.errorMessage) {
        reject(
          new Error(
            `Could not read this account's shop (${entry.errorMessage}). Try Refresh.`
          )
        )
      } else {
        resolve(entry)
      }
    })

    if (follow) {
      timer = setTimeout(
        () => window.electronAPI.requestShop([account]),
        followTimeoutMs
      )
    } else {
      window.electronAPI.requestShop([account])
    }
  })
}

export function useShopResource() {
  const followNext = useRef(false)
  const resource = useAccountResource(
    (accountId) => {
      const follow = followNext.current
      followNext.current = false

      return readShop(accountId, follow)
    },
    {
      cacheKey: 'stw.shop',
      fallbackError: "Could not read this account's shop. Try Refresh.",
      owner: (result) => result.accountId,
    }
  )
  const { refresh } = resource

  /** Pick up the fresh shop the main process sends after a purchase. */
  const followUp = useCallback(() => {
    followNext.current = true
    refresh()
  }, [refresh])

  return { followUp, resource }
}

export type ShopActions = ReturnType<typeof useShopActions>

/**
 * The toast after a purchase. Names the account it was made on, so a reply
 * that lands while another account is on screen still reads as its own.
 */
export function purchaseToast(
  notification: ShopPurchaseNotification,
  accountName: string | undefined
) {
  const on = accountName ? ` on ${accountName}` : ''

  if (notification.errorMessage) {
    return `Could not buy ${notification.offerTitle}${on}. Refresh the shop and try again.`
  }

  return `Bought ${notification.quantity}× ${notification.offerTitle}${on}`
}

function accountNameOf(accountId: string) {
  const account = useAccountListStore.getState().accounts[accountId]

  return account ? parseCustomDisplayName(account) : undefined
}

/** The offer each account is buying, keyed by account id. */
export type PendingPurchases = Map<string, string>

export function startPendingPurchase(
  pending: PendingPurchases,
  accountId: string,
  offerId: string
): PendingPurchases {
  return new Map(pending).set(accountId, offerId)
}

/** Only the account that replied is cleared; the others stay locked. */
export function finishPendingPurchase(
  pending: PendingPurchases,
  accountId: string
): PendingPurchases {
  if (!pending.has(accountId)) {
    return pending
  }

  const next = new Map(pending)

  next.delete(accountId)

  return next
}

export function pendingOfferFor(
  pending: PendingPurchases,
  accountId: string | null
): string | null {
  return accountId === null ? null : (pending.get(accountId) ?? null)
}

/**
 * Purchases. Mounted by the page itself, not by either view, so a purchase
 * started from Browse still gets its response and toast after switching
 * back. Opening owned llamas lives on its own page (Open llamas).
 */
export function useShopActions(followUp: () => void) {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  /** Purchases in flight, one per account, so each account's own reply clears it. */
  const [pending, setPending] = useState<PendingPurchases>(() => new Map())

  useEffect(() => {
    const listener = window.electronAPI.notificationShopPurchase(
      async (response) => {
        setPending((current) =>
          finishPendingPurchase(current, response.accountId)
        )

        toast[response.errorMessage ? 'error' : 'success'](
          purchaseToast(response, accountNameOf(response.accountId))
        )

        if (response.accountId === accountId) {
          followUp()
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId, followUp])

  /** Offer id being bought on the selected account, so only that button spins. */
  const purchasingOfferId = pendingOfferFor(pending, accountId)

  const handlePurchase = (offer: ShopOffer, quantity = 1) => {
    if (!selected || pendingOfferFor(pending, selected.accountId) !== null) {
      return
    }

    setPending((current) =>
      startPendingPurchase(current, selected.accountId, offer.offerId)
    )

    window.electronAPI.purchaseShopOffer(selected, {
      offerId: offer.offerId,
      title: offer.title,
      currency: offer.currency,
      currencySubType: offer.currencySubType,
      finalPrice: offer.finalPrice,
      quantity,
    })
  }

  return {
    purchasingOfferId,

    handlePurchase,
  }
}

/**
 * The public Penny DB catalog. Not an account resource — it is the same for
 * everyone and needs no sign-in — so it stays in the shop store, where it
 * survives leaving the page. Loaded the first time Browse is opened.
 */
export function useShopCatalog(isActive: boolean) {
  const { catalog, catalogLoading, catalogSection } = useShopStore(
    useShallow((state) => ({
      catalog: state.catalog,
      catalogLoading: state.catalogLoading,
      catalogSection: state.catalogSection,
    }))
  )
  const { updateCatalog, updateCatalogLoading, updateCatalogSection } =
    useShopStore(
      useShallow((state) => ({
        updateCatalog: state.updateCatalog,
        updateCatalogLoading: state.updateCatalogLoading,
        updateCatalogSection: state.updateCatalogSection,
      }))
    )

  useEffect(() => {
    const listener = window.electronAPI.responseShopCatalog(
      async (response) => {
        updateCatalogLoading(false)
        updateCatalog(response)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleLoadCatalog = () => {
    updateCatalogLoading(true)
    window.electronAPI.requestShopCatalog()
  }

  useEffect(() => {
    if (isActive && catalog === null && !catalogLoading) {
      handleLoadCatalog()
    }
  }, [isActive])

  return {
    catalog,
    catalogLoading,
    catalogSection,
    handleLoadCatalog,
    updateCatalogSection,
  }
}

export function useShopView() {
  return useShopStore(
    useShallow((state) => ({
      section: state.section,
      updateSection: state.updateSection,
      updateView: state.updateView,
      view: state.view,
    }))
  )
}
