import type { FriendsActionPayload } from '../../kernel/core/friends-manager'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useMemo, useState } from 'react'

import { useFriendsManagerStore } from '../../state/management/friends-manager'

import { useGetSelectedAccount } from '../../hooks/accounts'

import { toast } from '../../lib/notifications'

/** How long to wait after the last keystroke before hitting Epic's search. */
const searchDebounceMs = 400

export function useFriendsPanel() {
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  const { selected } = useGetSelectedAccount()
  const {
    entries,
    errorMessage,
    isLoading,
    isOpen,
    isSearching,
    loadedFor,
    limitsReached,
    pending,
    searchResults,
  } = useFriendsManagerStore(
    useShallow((state) => ({
      entries: state.entries,
      errorMessage: state.errorMessage,
      isLoading: state.isLoading,
      isOpen: state.isOpen,
      isSearching: state.isSearching,
      loadedFor: state.loadedFor,
      limitsReached: state.limitsReached,
      pending: state.pending,
      searchResults: state.searchResults,
    }))
  )
  const {
    closePanel,
    setPending,
    setResponse,
    setSearching,
    setSearchResults,
    updateLoading,
  } = useFriendsManagerStore(
    useShallow((state) => ({
      closePanel: state.closePanel,
      setPending: state.setPending,
      setResponse: state.setResponse,
      setSearching: state.setSearching,
      setSearchResults: state.setSearchResults,
      updateLoading: state.updateLoading,
    }))
  )

  useEffect(() => {
    const listener = window.electronAPI.responseFriends(async (response) => {
      const previousState = useFriendsManagerStore.getState()
      const previousIncoming = previousState.entries
        .filter((entry) => entry.kind === 'incoming')
        .map((entry) => entry.accountId)
      setResponse({
        accountId: response.accountId,
        entries: response.entries,
        errorMessage: response.errorMessage,
        limitsReached: response.limitsReached,
      })

      const rules = JSON.parse(
        localStorage.getItem('penny-notification-rules') ?? '{}'
      ) as { friendRequests?: boolean }
      const newRequests = response.entries.filter(
        (entry) =>
          entry.kind === 'incoming' && !previousIncoming.includes(entry.accountId)
      )
      if (
        rules.friendRequests !== false &&
        previousState.loadedFor === response.accountId &&
        newRequests.length > 0
      ) {
        window.electronAPI.sendNativeNotification({
          title: 'New friend request',
          body: newRequests.map((entry) => entry.displayName).join(', '),
        })
      }
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.responseFriendsSearch(
      async (response) => {
        if (response.errorMessage) {
          toast(response.errorMessage)
        }

        setSearchResults(response.results)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationFriendsAction(
      async (response) => {
        if (response.targetAccountId === '__bulk__') {
          useFriendsManagerStore.setState({ pending: [] })
        } else {
          setPending(response.targetAccountId, false)
        }

        if (response.errorMessage) {
          toast(response.errorMessage)

          if (response.targetAccountId === '__bulk__') {
            handleReload()
          }

          return
        }

        toast(
          response.total
            ? `${actionMessages[response.action]} (${response.total})`
            : actionMessages[response.action]
        )

        /** The list is stale as soon as an action lands. */
        handleReload()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [selected?.accountId])

  /**
   * Load on open, and whenever the selected account changes underneath an
   * open panel — the point of the panel is that it always shows the current
   * account's friends without being asked.
   */
  useEffect(() => {
    if (!isOpen || !selected) {
      return
    }

    if (loadedFor !== selected.accountId) {
      handleReload()
    }
  }, [isOpen, selected?.accountId])

  /** Debounced remote search; short queries stay local to the filter box. */
  useEffect(() => {
    const trimmed = query.trim()

    if (!isOpen || !selected || trimmed.length < 3) {
      setSearchResults([])

      return
    }

    setSearching(true)

    const timeout = setTimeout(() => {
      window.electronAPI.searchFriends(selected, trimmed)
    }, searchDebounceMs)

    return () => {
      clearTimeout(timeout)
    }
  }, [query, isOpen, selected?.accountId])

  const handleReload = () => {
    if (!selected) {
      return
    }

    updateLoading(true)
    window.electronAPI.requestFriends(selected)
  }

  const handleAction =
    (targetAccountId: string, action: FriendsActionPayload['action']) =>
    () => {
      if (!selected) {
        return
      }

      setPending(targetAccountId, true)
      window.electronAPI.friendsAction(selected, targetAccountId, action)
    }

  const handleAdd = (targetAccountId: string) => {
    if (!selected) {
      return
    }

    setPending(targetAccountId, true)
    setQuery('')
    window.electronAPI.friendsAction(selected, targetAccountId, 'add')
  }

  const handleBulk = (
    targetAccountIds: Array<string>,
    action: 'add' | 'remove'
  ) => {
    if (!selected || targetAccountIds.length === 0) {
      return
    }

    if (
      action === 'remove' &&
      !window.confirm(`Remove all ${targetAccountIds.length} requests?`)
    ) {
      return
    }

    targetAccountIds.forEach((accountId) => setPending(accountId, true))
    window.electronAPI.friendsBulkAction(selected, targetAccountIds, action)
  }

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const matching = needle
      ? entries.filter((entry) =>
          entry.displayName.toLowerCase().includes(needle)
        )
      : entries

    return {
      blocked: matching.filter((entry) => entry.kind === 'blocked'),
      friends: matching.filter((entry) => entry.kind === 'friend'),
      incoming: matching.filter((entry) => entry.kind === 'incoming'),
      outgoing: matching.filter((entry) => entry.kind === 'outgoing'),
    }
  }, [entries, filter])

  return {
    entries,
    errorMessage,
    filter,
    grouped,
    isLoading,
    isOpen,
    isSearching,
    limitsReached,
    pending,
    query,
    searchResults,
    selected,

    closePanel,
    handleAction,
    handleAdd,
    handleBulk,
    handleReload,
    setFilter,
    setQuery,
  }
}

const actionMessages: Record<FriendsActionPayload['action'], string> = {
  add: 'Friend request sent',
  block: 'Account blocked',
  remove: 'Friend removed',
  unblock: 'Account unblocked',
}
