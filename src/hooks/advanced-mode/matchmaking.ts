import { useShallow } from 'zustand/react/shallow'

import { useMatchmakingRecentlyPlayersStore } from '../../state/advanced-mode/matchmaking-track/temp-players'

export function useMatchmakingPlayersPath() {
  return useMatchmakingRecentlyPlayersStore(
    useShallow((state) => ({
      players: state.players,
      updateRecentlyPlayers: state.updateRecentlyPlayers,
    }))
  )
}
