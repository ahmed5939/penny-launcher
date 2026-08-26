import { RuntimeLog } from '../runtime-log'
import type { AccountData } from '../../types/accounts'
import type {
  MatchmakingTrackStatus,
  MatchmakingTrackStatusPlayer,
  MatchmakingZoneInstance,
} from '../../types/data/advanced-mode/matchmaking'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { findPlayer } from '../../services/endpoints/matchmaking'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'

export class MatchmakingTrack {
  static async status(account: AccountData, accountId: string) {
    const response: MatchmakingTrackStatus = {
      accountId,
      playing: false,
      session: null,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (accessToken) {
        const sessions = await findPlayer({
          accessToken,
          accountId,
        })
        const session = sessions.data?.[0]

        if (session) {
          let zone: MatchmakingZoneInstance | null = null

          try {
            const parsed = JSON.parse(
              session.attributes.ZONEINSTANCEID_s
            ) as Record<string, string>

            if (parsed?.theaterId && parsed?.theaterMissionId) {
              zone = {
                theaterId: parsed.theaterId,
                theaterMissionId: parsed.theaterMissionId,
                theaterMissionAlertId: parsed.theaterMissionAlertId ?? null,
              }
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            RuntimeLog.error('caught:core/matchmaking-track.ts', error)
          }

          const playerIds = [
            ...new Set([
              ...(session.publicPlayers ?? []),
              ...(session.privatePlayers ?? []),
            ]),
          ]
          let players: Array<MatchmakingTrackStatusPlayer> =
            playerIds.map((id) => ({
              id,
              displayName: null,
            }))

          try {
            const lookups = await findUsersByAccountIds({
              accessToken,
              accountIds: playerIds,
            })

            players = playerIds.map((id) => {
              const lookup = lookups.data?.find(
                (current) => current.id === id
              )

              return {
                id,
                displayName:
                  lookup?.displayName ??
                  Object.values(lookup?.externalAuths ?? {}).find(
                    (external) => external?.externalDisplayName
                  )?.externalDisplayName ??
                  null,
              }
            })

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            RuntimeLog.error('caught:core/matchmaking-track.ts', error)
          }

          response.playing = true
          response.session = {
            zone,
            players,
            totalPlayers: session.totalPlayers ?? playerIds.length,
            maxPlayers:
              (session.maxPublicPlayers ?? 0) +
                (session.maxPrivatePlayers ?? 0) || 4,
            started: session.started === true,
            lastUpdated: session.lastUpdated ?? null,
            region: session.attributes.REGION_s ?? null,
            minDifficulty: session.attributes.MINDIFFICULTY_i ?? null,
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/matchmaking-track.ts', error)
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.MatchmakingTrackStatusNotification,
      response
    )
  }
}
