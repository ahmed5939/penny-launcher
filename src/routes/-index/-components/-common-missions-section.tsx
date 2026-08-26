import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'

import { MissionItem, MissionsContainer } from '../-components/-missions'

/*
 * Deliberately thin: the mission element owns its own contents, so there is
 * nothing for a caller to assemble and no row shape to copy into a seventh
 * file.
 */
export function CommonMissionsSection({
  currentPageTotalResults,
  hideCompletedCheck,
  missions,
}: {
  currentPageTotalResults?: number
  hideCompletedCheck?: boolean
  missions: Collection<string, WorldInfoMission>
}) {
  const currentMissions =
    currentPageTotalResults !== undefined
      ? missions.entries().toArray().slice(0, currentPageTotalResults)
      : missions.entries().toArray()

  return (
    <MissionsContainer>
      {currentMissions.map(([missionId, mission]) => (
        <MissionItem
          data={mission}
          hideCompletedCheck={hideCompletedCheck}
          key={missionId}
        />
      ))}
    </MissionsContainer>
  )
}
