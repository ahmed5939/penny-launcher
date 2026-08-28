import type { CosmeticMeta } from '../../../kernel/core/locker-catalog'
import type { LockerSlotKey } from '../../../config/fortnite/locker'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useMemo } from 'react'

import { ownedForSlot } from '../../../kernel/core/locker-loadout'

import { useLockerStore } from '../../../state/management/locker'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

/**
 * The page's one connection to the main process.
 *
 * Both requests are fired together on mount and whenever the scoped account
 * changes: the board is useless without the owned list (a slot picker with
 * nothing in it), and the owned list is a single MCP call, so there is no
 * reason to make the user ask for it separately.
 */
export function useLockerPage() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const {
    card,
    cardError,
    equipping,
    errorMessage,
    filters,
    isGenerating,
    isLoading,
    isLoadingOwned,
    loadedFor,
    owned,
    ownedError,
    ownedLoadedFor,
    progress,
    slots,
  } = useLockerStore(
    useShallow((state) => ({
      card: state.card,
      cardError: state.cardError,
      equipping: state.equipping,
      errorMessage: state.errorMessage,
      filters: state.filters,
      isGenerating: state.isGenerating,
      isLoading: state.isLoading,
      isLoadingOwned: state.isLoadingOwned,
      loadedFor: state.loadedFor,
      owned: state.owned,
      ownedError: state.ownedError,
      ownedLoadedFor: state.ownedLoadedFor,
      progress: state.progress,
      slots: state.slots,
    }))
  )
  const {
    reset,
    setCard,
    setEquipping,
    setGenerating,
    setLoading,
    setLoadingOwned,
    setOwned,
    setProgress,
    setResponse,
  } = useLockerStore(
    useShallow((state) => ({
      reset: state.reset,
      setCard: state.setCard,
      setEquipping: state.setEquipping,
      setGenerating: state.setGenerating,
      setLoading: state.setLoading,
      setLoadingOwned: state.setLoadingOwned,
      setOwned: state.setOwned,
      setProgress: state.setProgress,
      setResponse: state.setResponse,
    }))
  )

  useEffect(() => {
    const listeners = [
      window.electronAPI.responseLocker(async (response) => {
        setResponse(response)
      }),
      window.electronAPI.responseLockerOwned(async (response) => {
        setOwned(response)
      }),
      window.electronAPI.notificationLockerEquip(async (response) => {
        setEquipping(null)

        toast(
          response.errorMessage
            ? `Could not equip ${response.itemName}: ${response.errorMessage}`
            : response.templateId
              ? `Equipped ${response.itemName}`
              : 'Slot cleared'
        )
      }),
      window.electronAPI.notificationLockerCard(async (response) => {
        setCard(response)

        if (response.errorMessage) {
          toast(`Could not draw the card: ${response.errorMessage}`)
        }
      }),
      window.electronAPI.progressLockerCard((response) => {
        setProgress({ done: response.done, total: response.total })
      }),
    ]

    return () => {
      listeners.forEach((listener) => listener.removeListener())
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      reset()

      return
    }

    /*
     * Guarded on `loadedFor` so returning to the page does not refetch a
     * locker that is already on screen — only a genuine account switch does.
     */
    if (loadedFor !== selected.accountId) {
      setLoading(true)
      window.electronAPI.requestLocker(selected)
    }

    if (ownedLoadedFor !== selected.accountId) {
      setLoadingOwned(true)
      window.electronAPI.requestLockerOwned(selected)
    }
    /* Keyed on the account id alone — `selected` is a new object each render. */
  }, [accountId])

  const handleReload = () => {
    if (!selected || isLoading) {
      return
    }

    setLoading(true)
    setLoadingOwned(true)
    window.electronAPI.requestLocker(selected)
    /* Reload is the one path that must get past the owned-list cache. */
    window.electronAPI.requestLockerOwned(selected, true)
  }

  const handleEquip = (
    slotKey: LockerSlotKey,
    templateId: string | null,
    itemName: string
  ) => {
    if (!selected || equipping) {
      return
    }

    setEquipping(slotKey)
    window.electronAPI.equipLockerItem(selected, slotKey, templateId, itemName)
  }

  const handleGenerate = () => {
    if (!selected || isGenerating) {
      return
    }

    setGenerating(true)
    window.electronAPI.generateLockerCard(selected, filters)
  }

  return {
    account: selected,
    card,
    cardError,
    equipping,
    errorMessage,
    filters,
    handleEquip,
    handleGenerate,
    handleReload,
    isGenerating,
    isLoading,
    isLoadingOwned,
    owned,
    ownedError,
    progress,
    slots,
  }
}

/**
 * What can legally go in a slot, by name.
 *
 * Memoised on the owned list and the slot: this runs on every keystroke in
 * the picker's search box, and the account may own several thousand emotes,
 * so neither the filter pass nor the sort belongs in that path.
 */
export function useOwnedForSlot(
  owned: Array<CosmeticMeta>,
  slotKey: LockerSlotKey | null
) {
  return useMemo(() => {
    if (!slotKey) {
      return []
    }

    return ownedForSlot(owned, slotKey).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [owned, slotKey])
}
