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
import { LookupManager } from './lookup'

import { findPlayer } from '../../services/endpoints/matchmaking'
import { findUsersByAccountIds } from '../../services/endpoints/lookup'
import { getPennyDBProfile } from '../../services/endpoints/pennydb'
import { parsePennyDBMission } from './matchmaking-pennydb'

function fetchPennyDBProfile(query: string) {
  return getPennyDBProfile(query)
    .then((response) => response.data)
    .catch((error) => {
      RuntimeLog.error('caught:core/matchmaking-track.ts', error)

      return null
    })
}

export class MatchmakingTrack {
  /**
   * `query` is whatever the user typed — display name (Epic, PSN, Xbox) or
   * account id. Epic resolves it first; PennyDB, which accepts both, is the
   * fallback for names Epic's lookup misses.
   */
  static async status(account: AccountData, query: string) {
    const response: MatchmakingTrackStatus = {
      query,
      player: null,
      playing: false,
      mission: null,
      session: null,
    }
    const send = () => {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.MatchmakingTrackStatusNotification,
        response
      )
    }

    const [lookup, profileByQuery] = await Promise.all([
      LookupManager.searchUserByDisplayName({
        account,
        displayName: query,
      }).catch(() => null),
      fetchPennyDBProfile(query),
    ])
    const pennydbSummary = profileByQuery?.profile_summary

    if (lookup?.success) {
      response.player = {
        id: lookup.data.id,
        displayName: lookup.data.displayName,
      }
    } else if (pennydbSummary?.account_id) {
      response.player = {
        id: pennydbSummary.account_id,
        displayName: pennydbSummary.display_name ?? pennydbSummary.account_id,
      }
    }

    if (!response.player) {
      send()

      return
    }

    const accountId = response.player.id

    /**
     * PennyDB names the mission, zone and rewards for us; Epic's session
     * only has ids. The profile fetched by query is reused when it is the
     * same player, otherwise it is fetched again by id.
     */
    const pennydb = (
      pennydbSummary?.account_id === accountId
        ? Promise.resolve(profileByQuery)
        : fetchPennyDBProfile(accountId)
    ).then((profile) => parsePennyDBMission(profile?.what_mission_data))

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

    response.mission = await pennydb
    response.playing = response.playing || response.mission !== null

    send()
  }
}
