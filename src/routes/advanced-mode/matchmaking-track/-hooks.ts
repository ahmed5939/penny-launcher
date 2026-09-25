import type { MatchmakingTrackStatus } from '../../../types/data/advanced-mode/matchmaking'
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

    return () => {
      listener.removeListener()
    }
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

export function useCurrentActions() {
  const [status, setStatus] = useState<MatchmakingTrackStatus | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [trackedAt, setTrackedAt] = useState<Date | null>(null)

  const { selected } = useGetSelectedAccount()
  const { players, updateRecentlyPlayers } = useMatchmakingPlayersPath()
  const { friends, friendsLoadedFor } = useFriendsManagerStore(
    useShallow((state) => ({
      friends: state.entries.filter((entry) => entry.kind === 'friend'),
      friendsLoadedFor: state.loadedFor,
    }))
  )

  const selectedRef = useRef(selected)
  const targetRef = useRef(target)

  selectedRef.current = selected
  targetRef.current = target

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

  /**
   * The main process resolves the query (Epic lookup, then PennyDB) and
   * answers with the player and their session in one message; answers for
   * an earlier query are dropped.
   */
  useEffect(() => {
    const listener = window.electronAPI.notificationMatchmakingStatus(
      async (response) => {
        if (response.query !== targetRef.current) {
          return
        }

        setStatus(response)
        setTrackedAt(new Date())
        setIsTracking(false)

        if (response.player) {
          updateRecentlyPlayers(response.player)
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const request = (query: string) => {
    const account = selectedRef.current

    if (!account) {
      return
    }

    setIsTracking(true)
    window.electronAPI.requestMatchmakingStatus(account, query)
  }

  /**
   * Re-checks on an interval while the page stays open so the card follows
   * the player between lobby, mission and logout.
   */
  useEffect(() => {
    if (!target) {
      return
    }

    const interval = window.setInterval(() => request(target), 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [target])

  const track = (query: string) => {
    const trimmed = query.trim()

    if (!trimmed || !selected) {
      return
    }

    setStatus(null)
    setTarget(trimmed)
    targetRef.current = trimmed
    request(trimmed)
  }

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

  const handleRefresh = () => {
    if (!target || isTracking) {
      return
    }

    request(target)
  }

  return {
    isTracking,
    options,
    players,
    status,
    trackedAt,

    customFilter,
    handleRefresh,
    track,
  }
}
