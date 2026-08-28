import type { FriendsActionPayload } from '../../kernel/core/friends-manager'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useMemo, useState } from 'react'

import { useFriendsManagerStore } from '../../state/management/friends-manager'
import { useAccountListStore } from '../../state/accounts/list'
import { useAccountScopeStore } from '../../state/accounts/scope'

import { groupFriendEntries } from './group'

import { useGetSelectedAccount } from '../../hooks/accounts'

import { toast } from '../../lib/notifications'

function getSelectedAccount() {
  const primary = useAccountScopeStore.getState().primary

  if (!primary) {
    return null
  }

  return useAccountListStore.getState().accounts[primary] ?? null
}

function reloadFriends() {
  const account = getSelectedAccount()

  if (!account) {
    return
  }

  useFriendsManagerStore.getState().updateLoading(true)
  window.electronAPI.requestFriends(account)
}

/** How long to wait after the last keystroke before hitting Epic's search. */
const searchDebounceMs = 400

/**
 * IPC listeners for the friends workspace.
 *
 * Mounted once from the docked panel (always in the tree) so the hub page
 * can reuse the same store without doubling toasts or reloads.
 */
export function useFriendsManagerListeners() {
  const { selected } = useGetSelectedAccount()
  const { isHubActive, isOpen, loadedFor } = useFriendsManagerStore(
    useShallow((state) => ({
      isHubActive: state.isHubActive,
      isOpen: state.isOpen,
      loadedFor: state.loadedFor,
    }))
  )
  const {
    setPending,
    setResponse,
    setSearchResults,
    updateLoading,
  } = useFriendsManagerStore(
    useShallow((state) => ({
      setPending: state.setPending,
      setResponse: state.setResponse,
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
  }, [setResponse])

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
  }, [setSearchResults])

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
            reloadFriends()
          }

          return
        }

        toast(
          response.total
            ? `${actionMessages[response.action]} (${response.total})`
            : actionMessages[response.action]
        )

        /** The list is stale as soon as an action lands. */
        reloadFriends()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [selected?.accountId, setPending])

  useEffect(() => {
    const listener = window.electronAPI.notificationInvite(async (response) => {
      const { inviting } = useFriendsManagerStore.getState()

      if (inviting.length === 0) {
        return
      }

      inviting.forEach((accountId) => setPending(accountId, false))
      useFriendsManagerStore.setState({ inviting: [] })

      if (response.length <= 0) {
        toast('Could not send the party invite. Join a party first?')

        return
      }

      const totalInvitations = response.filter(
        (item) => item.type === 'invite'
      ).length
      const totalFriendRequests = response.filter(
        (item) => item.type === 'friend-request'
      ).length
      const messages: Array<string> = []

      if (totalInvitations > 0) {
        messages.push(
          totalInvitations === 1
            ? 'Party invite sent'
            : `${totalInvitations} party invites sent`
        )
      }

      if (totalFriendRequests > 0) {
        messages.push(
          totalFriendRequests === 1
            ? 'Friend request sent'
            : `${totalFriendRequests} friend requests sent`
        )
      }

      toast(messages.join('. '))
    })

    return () => {
      listener.removeListener()
    }
  }, [setPending])

  /**
   * Load while the panel or the hub is showing this account — the point of
   * both surfaces is that they always show the current account's friends
   * without being asked.
   */
  useEffect(() => {
    if ((!isOpen && !isHubActive) || !selected) {
      return
    }

    if (loadedFor !== selected.accountId) {
      updateLoading(true)
      window.electronAPI.requestFriends(selected)
    }
  }, [isHubActive, isOpen, loadedFor, selected?.accountId, updateLoading])
}

/**
 * Filter, search, and per-row actions for a friends surface.
 *
 * `active` gates remote search so a closed panel cannot wipe results the
 * hub page is in the middle of using.
 */
export function useFriendsWorkspace({ active }: { active: boolean }) {
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  const { selected } = useGetSelectedAccount()
  const {
    entries,
    errorMessage,
    isLoading,
    isSearching,
    limitsReached,
    pending,
    searchResults,
  } = useFriendsManagerStore(
    useShallow((state) => ({
      entries: state.entries,
      errorMessage: state.errorMessage,
      isLoading: state.isLoading,
      isSearching: state.isSearching,
      limitsReached: state.limitsReached,
      pending: state.pending,
      searchResults: state.searchResults,
    }))
  )
  const {
    closePanel,
    openPanel,
    setInviting,
    setPending,
    setSearching,
    setSearchResults,
    updateLoading,
  } = useFriendsManagerStore(
    useShallow((state) => ({
      closePanel: state.closePanel,
      openPanel: state.openPanel,
      setInviting: state.setInviting,
      setPending: state.setPending,
      setSearching: state.setSearching,
      setSearchResults: state.setSearchResults,
      updateLoading: state.updateLoading,
    }))
  )

  /** Debounced remote search; short queries stay local to the filter box. */
  useEffect(() => {
    if (!active || !selected) {
      return
    }

    const trimmed = query.trim()

    if (trimmed.length < 3) {
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
  }, [active, query, selected, setSearchResults, setSearching])

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

  const handleInvite = (targetAccountId: string) => {
    if (!selected) {
      return
    }

    setPending(targetAccountId, true)
    setInviting(targetAccountId, true)
    window.electronAPI.invite(selected, [targetAccountId])
  }

  const grouped = useMemo(
    () => groupFriendEntries(entries, filter),
    [entries, filter]
  )

  return {
    entries,
    errorMessage,
    filter,
    grouped,
    isLoading,
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
    handleInvite,
    handleReload,
    openPanel,
    setFilter,
    setQuery,
  }
}

/** Panel surface: listeners live here because the panel is always mounted. */
export function useFriendsPanel() {
  const isOpen = useFriendsManagerStore((state) => state.isOpen)

  useFriendsManagerListeners()

  return {
    ...useFriendsWorkspace({ active: isOpen }),
    isOpen,
  }
}

/** Hub page: keep the list loaded while this route is showing. */
export function useFriendsHub() {
  const setHubActive = useFriendsManagerStore((state) => state.setHubActive)

  useEffect(() => {
    setHubActive(true)

    return () => {
      setHubActive(false)
    }
  }, [setHubActive])

  return useFriendsWorkspace({ active: true })
}

const actionMessages: Record<FriendsActionPayload['action'], string> = {
  add: 'Friend request sent',
  block: 'Account blocked',
  remove: 'Friend removed',
  unblock: 'Account unblocked',
}
