import type { AccountResource } from '../../../components/page'
import type { ShopEntry, ShopOffer } from '../../../kernel/core/shop'

import { useShallow } from 'zustand/react/shallow'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAccountResource } from '../../../components/page'

import { useAccountListStore } from '../../../state/accounts/list'
import { useShopStore } from '../../../state/stw-operations/shop'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { rarityLabels } from '../../../config/constants/fortnite/items'

import { toast } from '../../../lib/notifications'

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
 * Purchases and llama opening. Mounted by the page itself, not by either
 * view, so a purchase started from Browse still gets its response and toast
 * after switching back.
 */
export function useShopActions(
  resource: AccountResource<ShopEntry>,
  followUp: () => void
) {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const { refresh } = resource

  /** Offer id currently being bought, so only that button spins. */
  const [purchasingOfferId, setPurchasing] = useState<string | null>(null)
  const [isOpening, setOpening] = useState(false)

  useEffect(() => {
    const listener = window.electronAPI.notificationShopPurchase(
      async (response) => {
        setPurchasing(null)

        toast[response.errorMessage ? 'error' : 'success'](
          response.errorMessage
            ? `Purchase failed: ${response.errorMessage}`
            : `Bought ${response.quantity}× ${response.offerTitle}`
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

  useEffect(() => {
    const listener = window.electronAPI.notificationShopOpen(
      async (response) => {
        setOpening(false)

        const opened = response.results.reduce(
          (accumulator, current) => accumulator + current.opened,
          0
        )
        const failed = response.results.filter((item) => item.errorMessage)

        toast[opened > 0 ? 'success' : 'info'](
          opened > 0
            ? `Opened ${opened} llama${opened === 1 ? '' : 's'}`
            : 'Nothing to open'
        )

        const loot = response.results.reduce<Record<string, number>>(
          (accumulator, current) => {
            Object.entries(current.loot).forEach(([rarity, count]) => {
              accumulator[rarity] = (accumulator[rarity] ?? 0) + count
            })

            return accumulator
          },
          {}
        )
        const lootSummary = Object.entries(loot)
          .filter(([, count]) => count > 0)
          .map(
            ([rarity, count]) =>
              `${count} ${rarityLabels[rarity as keyof typeof rarityLabels] ?? rarity}`
          )
          .join(', ')

        if (lootSummary.length > 0) {
          toast.info(`Loot: ${lootSummary}`)
        }

        if (failed.length > 0) {
          toast.error(`Epic reported an error: ${failed[0].errorMessage}`)
        }

        // Opening does not re-read the shop on its own; ask for it.
        refresh()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [refresh])

  const handlePurchase = (offer: ShopOffer, quantity = 1) => {
    if (!selected || purchasingOfferId !== null) {
      return
    }

    setPurchasing(offer.offerId)

    window.electronAPI.purchaseShopOffer(selected, {
      offerId: offer.offerId,
      title: offer.title,
      currency: offer.currency,
      currencySubType: offer.currencySubType,
      finalPrice: offer.finalPrice,
      quantity,
    })
  }

  const handleOpenLlamas = () => {
    if (isOpening || !selected) {
      return
    }

    setOpening(true)
    window.electronAPI.openLlamas([selected])
  }

  return {
    isOpening,
    purchasingOfferId,

    handleOpenLlamas,
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
