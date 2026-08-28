import type { MatchmakingTrackStatus } from '../../../types/data/advanced-mode/matchmaking'
import type { XPBoostsSearchUserResponse } from '../../../types/xpboosts'
import type { FriendsSearchResult } from '../../../kernel/core/friends-manager'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useRef, useState } from 'react'

import {
  ComboboxOption,
  ComboboxProps,
} from '../../../components/ui/extended/combobox/hooks'

import { useMatchmakingPlayersPath } from '../../../hooks/advanced-mode/matchmaking'
import { useGetSelectedAccount } from '../../../hooks/accounts'

import { useFriendsManagerStore } from '../../../state/management/friends-manager'

const playerSearchDebounceMs = 350

/**
 * Epic's prefix search makes the tracker useful before the user knows the
 * exact spelling of a display name. Responses share the Friends IPC channel,
 * so the query is checked before accepting them to avoid stale results.
 */
export function usePlayerSuggestions({
  disabled,
  query,
}: {
  disabled: boolean
  query: string
}) {
  const [results, setResults] = useState<Array<FriendsSearchResult>>([])
  const [isSearching, setIsSearching] = useState(false)
  const latestQuery = useRef('')
  const lastRequest = useRef('')
  const { selected } = useGetSelectedAccount()
  const selectedRef = useRef(selected)

  selectedRef.current = selected

  useEffect(() => {
    const listener = window.electronAPI.responseFriendsSearch(
      async (response) => {
        if (response.query !== latestQuery.current) {
          return
        }

        setResults(response.results)
        setIsSearching(false)
      }
    )

    return () => listener.removeListener()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    latestQuery.current = trimmed

    if (!selected?.accountId || disabled || trimmed.length < 2) {
      setResults([])
      setIsSearching(false)

      return
    }

    setIsSearching(true)
    const timeout = window.setTimeout(() => {
      const account = selectedRef.current
      const requestKey = `${account?.accountId ?? ''}:${trimmed}`

      if (!account || requestKey === lastRequest.current) {
        setIsSearching(false)

        return
      }

      lastRequest.current = requestKey
      window.electronAPI.searchFriends(account, trimmed)
    }, playerSearchDebounceMs)

    return () => window.clearTimeout(timeout)
  }, [disabled, query, selected?.accountId])

  const clear = () => {
    latestQuery.current = ''
    setResults([])
    setIsSearching(false)
  }

  return { clear, isSearching, results }
}

export function useCurrentActions({
  searchedUser,

  handleManualChangeSearchDisplayName,
}: {
  searchedUser: XPBoostsSearchUserResponse | null

  handleManualChangeSearchDisplayName: (value: string) => void
}) {
  const [status, setStatus] = useState<MatchmakingTrackStatus | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [trackedAt, setTrackedAt] = useState<Date | null>(null)

  const { selected } = useGetSelectedAccount()
  const { players } = useMatchmakingPlayersPath()
  const { friends, friendsLoadedFor } = useFriendsManagerStore(
    useShallow((state) => ({
      friends: state.entries.filter((entry) => entry.kind === 'friend'),
      friendsLoadedFor: state.loadedFor,
    }))
  )

  /**
   * Private profiles still resolve a lookup and the session endpoint does
   * not care about profile privacy, so anyone who searched successfully is
   * trackable — `success` only reflects the profile fetch.
   */
  const trackedAccountId = searchedUser?.data?.lookup.id ?? null
  const selectedRef = useRef(selected)

  selectedRef.current = selected

  /**
   * Friends are trackable targets too, so they belong in the same picker as
   * recently-played players. Loaded once per selected account and deduped —
   * someone can be both a friend and recently played.
   */
  useEffect(() => {
    if (!selected || friendsLoadedFor === selected.accountId) {
      return
    }

    window.electronAPI.requestFriends(selected)
  }, [selected?.accountId, friendsLoadedFor])

  const seen = new Set<string>()
  const options: Array<ComboboxOption> = [
    ...players.map((player) => ({
      keywords: [player.displayName, player.id],
      label: player.displayName,
      value: player.id,
    })),
    ...friends.map((friend) => ({
      keywords: [friend.displayName, friend.accountId, 'friend'],
      label: `${friend.displayName} · friend`,
      value: friend.accountId,
    })),
  ].filter((option) => {
    if (seen.has(option.value)) {
      return false
    }

    seen.add(option.value)

    return true
  })

  useEffect(() => {
    const listener = window.electronAPI.notificationMatchmakingStatus(
      async (response) => {
        setStatus(response)
        setTrackedAt(new Date())
        setIsTracking(false)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  /**
   * Tracking fires as soon as a player resolves — there is nothing else to
   * configure — and re-checks on an interval while the page stays open so
   * the card follows the player between lobby, mission and logout.
   */
  useEffect(() => {
    if (!trackedAccountId) {
      setStatus(null)

      return
    }

    const track = () => {
      const account = selectedRef.current

      if (!account) {
        return
      }

      setIsTracking(true)
      window.electronAPI.requestMatchmakingStatus(
        account,
        trackedAccountId
      )
    }

    track()

    const interval = window.setInterval(track, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [trackedAccountId])

  const customFilter: ComboboxProps['customFilter'] = (
    _value,
    search,
    keywords
  ) => {
    const _search = search.toLowerCase().trim()
    const _keys =
      keywords &&
      keywords.some((keyword) =>
        keyword.toLowerCase().trim().includes(_search)
      )

    return _keys ? 1 : 0
  }

  const autoCompletePlayer = (value: string) => {
    const currentPlayer = players.find((item) => item.id === value)
    const currentFriend = friends.find((item) => item.accountId === value)

    handleManualChangeSearchDisplayName(
      currentPlayer?.displayName ?? currentFriend?.displayName ?? ''
    )
  }

  const handleRefresh = () => {
    if (!selected || !trackedAccountId || isTracking) {
      return
    }

    setIsTracking(true)
    window.electronAPI.requestMatchmakingStatus(selected, trackedAccountId)
  }

  return {
    isTracking,
    options,
    players,
    status,
    trackedAt,

    autoCompletePlayer,
    customFilter,
    handleRefresh,
  }
}
