import type { ShopOffer } from '../../../kernel/core/shop'

import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

import { useItemDatabaseStore } from '../../../state/items/database'
import { useShopStore } from '../../../state/stw-operations/shop'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { rarityLabels } from '../../../config/constants/fortnite/items'

import { toast } from '../../../lib/notifications'

/**
 * IPC listeners and auto-loads for both the account shop and the public
 * catalog. Must stay mounted while this page is open so a purchase started
 * from Browse still gets the MCP response and toast.
 */
export function useShopPage() {
  useRequestItemDatabase()

  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const { catalog, catalogLoading, view } = useShopStore(
    useShallow((state) => ({
      catalog: state.catalog,
      catalogLoading: state.catalogLoading,
      view: state.view,
    }))
  )
  const {
    updateCatalog,
    updateCatalogLoading,
    updateData,
    updateLoading,
    updateOpening,
    updatePurchasing,
    updateView,
  } = useShopStore(
    useShallow((state) => ({
      updateCatalog: state.updateCatalog,
      updateCatalogLoading: state.updateCatalogLoading,
      updateData: state.updateData,
      updateLoading: state.updateLoading,
      updateOpening: state.updateOpening,
      updatePurchasing: state.updatePurchasing,
      updateView: state.updateView,
    }))
  )

  useEffect(() => {
    const listener = window.electronAPI.responseShop(async (response) => {
      updateLoading(false)
      updatePurchasing(null)
      updateData(response)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationShopPurchase(
      async (response) => {
        updatePurchasing(null)

        toast(
          response.errorMessage
            ? `Purchase failed: ${response.errorMessage}`
            : `Bought ${response.quantity}× ${response.offerTitle}`
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationShopOpen(
      async (response) => {
        updateOpening(false)

        const opened = response.results.reduce(
          (accumulator, current) => accumulator + current.opened,
          0
        )
        const failed = response.results.filter((item) => item.errorMessage)

        toast(
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
          toast(`Loot: ${lootSummary}`)
        }

        if (failed.length > 0) {
          toast(`Epic reported an error: ${failed[0].errorMessage}`)
        }

        if (selected) {
          updateLoading(true)
          window.electronAPI.requestShop([selected])
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId])

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

  /** Switching account in the title bar reloads the shop. */
  useEffect(() => {
    if (accountId && selected) {
      updateLoading(true)
      window.electronAPI.requestShop([selected])
    }
  }, [accountId])

  useEffect(() => {
    if (view === 'browse' && catalog === null && !catalogLoading) {
      updateCatalogLoading(true)
      window.electronAPI.requestShopCatalog()
    }
  }, [view])

  return {
    updateView,
    view,
  }
}

export function useShopData() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)

  const { data, isLoading, isOpening, purchasingOfferId, section } =
    useShopStore(
      useShallow((state) => ({
        data: state.data,
        isLoading: state.isLoading,
        isOpening: state.isOpening,
        purchasingOfferId: state.purchasingOfferId,
        section: state.section,
      }))
    )
  const {
    updateLoading,
    updateOpening,
    updatePurchasing,
    updateSection,
  } = useShopStore(
    useShallow((state) => ({
      updateLoading: state.updateLoading,
      updateOpening: state.updateOpening,
      updatePurchasing: state.updatePurchasing,
      updateSection: state.updateSection,
    }))
  )

  const entry = accountId ? data[accountId] : undefined
  const offers = (entry?.offers ?? []).filter(
    (offer) => offer.section === section
  )

  const isDisabledOpen =
    isOpening || !accountId || (entry?.unopenedLlamas ?? 0) <= 0

  const handleLoad = () => {
    if (!selected) {
      return
    }

    updateLoading(true)
    window.electronAPI.requestShop([selected])
  }

  const handlePurchase = (offer: ShopOffer, quantity = 1) => {
    if (!selected || purchasingOfferId !== null) {
      return
    }

    updatePurchasing(offer.offerId)

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
    if (isDisabledOpen || !selected) {
      return
    }

    updateOpening(true)
    window.electronAPI.openLlamas([selected])
  }

  return {
    account: selected ?? null,
    currencies: entry?.currencies ?? [],
    errorMessage: entry?.errorMessage ?? null,
    expiration: entry?.expiration ?? null,
    hasLoaded: entry !== undefined,
    isDisabledOpen,
    isLoading,
    isOpening,
    offers,
    purchasingOfferId,
    records,
    section,
    unopenedLlamas: entry?.unopenedLlamas ?? 0,

    handleLoad,
    handleOpenLlamas,
    handlePurchase,
    updateSection,
  }
}

export function useShopCatalog() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const { catalog, catalogLoading, catalogSection, data, purchasingOfferId } =
    useShopStore(
      useShallow((state) => ({
        catalog: state.catalog,
        catalogLoading: state.catalogLoading,
        catalogSection: state.catalogSection,
        data: state.data,
        purchasingOfferId: state.purchasingOfferId,
      }))
    )
  const { updateCatalogLoading, updateCatalogSection, updatePurchasing } =
    useShopStore(
      useShallow((state) => ({
        updateCatalogLoading: state.updateCatalogLoading,
        updateCatalogSection: state.updateCatalogSection,
        updatePurchasing: state.updatePurchasing,
      }))
    )

  const accountOffers = accountId ? (data[accountId]?.offers ?? []) : []
  const offersById = new Map(
    accountOffers.map((offer) => [offer.offerId, offer])
  )

  const handleLoadCatalog = () => {
    updateCatalogLoading(true)
    window.electronAPI.requestShopCatalog()
  }

  const handlePurchase = (offer: ShopOffer, quantity = 1) => {
    if (!selected || purchasingOfferId !== null) {
      return
    }

    updatePurchasing(offer.offerId)

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
    account: selected ?? null,
    catalog,
    catalogLoading,
    catalogSection,
    handleLoadCatalog,
    handlePurchase,
    offersById,
    purchasingOfferId,
    updateCatalogSection,
  }
}
