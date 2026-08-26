import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'
import type { RewardLike } from '../-components/-mission-data'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { EmptySection } from '../-components/-empty'
import { MissionItem, MissionsContainer } from '../-components/-missions'
import { TitleSection } from '../-components/-title'

/**
 * The Play tab's curated sections are the same object six times over: a
 * heading, an empty state, and a list of missions whose payload bay is pinned
 * to the one reward the section is named after. Only the matcher genuinely
 * differs between them, so the matcher is the only behaviour that is a prop.
 */
export function AlertsSection({
  data,
  emptyTitle,
  id,
  isVBucks,
  resolveFeatured,
  showCount,
  title,
}: {
  data: Collection<string, WorldInfoMission>
  /** Replaces the generic "nothing here" line, e.g. the survivors one. */
  emptyTitle?: string
  id: string
  isVBucks?: boolean
  /**
   * The reward this section exists to advertise, pinned into every row's
   * payload bay. Returning nothing drops the mission from the list: a section
   * named after a reward the mission turns out not to carry is a row that
   * misrepresents itself.
   *
   * Sections that pass no matcher let `resolveBrief` choose — its fallback,
   * the biggest base reward, is exactly right for the endgame lists.
   */
  resolveFeatured?: (mission: WorldInfoMission) => RewardLike | undefined
  showCount?: boolean
  title: string
}) {
  const { t } = useTranslation(['alerts'])

  return (
    <section aria-labelledby={id}>
      <TitleSection
        deps={data}
        id={id}
      >
        <>
          {title}
          {showCount && (
            <span className="figure ml-2 whitespace-nowrap text-[0.6875rem] font-normal normal-case tracking-normal text-muted-foreground/50">
              {t('information.missions', {
                total: data.size,
              })}
            </span>
          )}
        </>
      </TitleSection>
      <EmptySection
        total={data.size}
        isVBucks={isVBucks}
        title={emptyTitle}
      >
        <MissionsContainer>
          {data.map((mission) => {
            const featured = resolveFeatured?.(mission)

            if (resolveFeatured && !featured) {
              return null
            }

            return (
              <MissionItem
                data={mission}
                featured={featured}
                key={mission.raw.mission.missionGuid}
              />
            )
          })}
        </MissionsContainer>
      </EmptySection>
    </section>
  )
}
