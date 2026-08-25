import type { ShopOffer } from '../../../kernel/core/shop'

import { useShallow } from 'zustand/react/shallow'
import { useEffect } from 'react'

import { useItemDatabaseStore } from '../../../state/items/database'
import { useShopStore } from '../../../state/stw-operations/shop'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { rarityLabels } from '../../../config/constants/fortnite/items'

import { toast } from '../../../lib/notifications'

export function useShopData() {
  /** One account's shop — the X-Ray rolls are rolled per account. */
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
    updateData,
    updateLoading,
    updateOpening,
    updatePurchasing,
    updateSection,
  } = useShopStore(
    useShallow((state) => ({
      updateData: state.updateData,
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

        handleLoad()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId])

  const handleLoad = () => {
    if (!selected) {
      return
    }

    updateLoading(true)
    window.electronAPI.requestShop([selected])
  }

  /** Switching account in the title bar reloads the shop. */
  useEffect(() => {
    if (accountId) {
      handleLoad()
    }
  }, [accountId])

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
