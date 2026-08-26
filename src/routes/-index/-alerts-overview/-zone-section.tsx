import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import {
  World,
  WorldColor,
  worldNameByTheaterId,
  zoneColors,
} from '../../../config/constants/fortnite/world-info'

import { CommonMissionsSection } from '../-components/-common-missions-section'
import { EmptySection } from '../-components/-empty'
import { TitleSection } from '../-components/-title'
import { ZonePagination } from './-zone-pagination'

import { useZoneMissionsPagination } from './-hooks'

export function ZoneSection({
  deps,
  missions,
  theaterId,
}: {
  deps?: unknown
  missions: Collection<string, WorldInfoMission>
  theaterId: World
}) {
  const { t } = useTranslation(['alerts', 'zones'])

  const { pagination, perPage, totalPages } = useZoneMissionsPagination({
    id: theaterId,
    total: missions.size,
  })

  /*
   * `zoneColors` is the same lookup the world-info parser runs to colour each
   * mission's rail, so the section rule and the 3px rail of every row beneath
   * it are guaranteed to be the same value. Rule and rails read as one system,
   * which is what makes a long list scannable by zone from the far-left gutter
   * without any row needing a coloured background.
   */
  const accent = zoneColors[theaterId] ?? WorldColor.Ventures

  return (
    <section
      aria-labelledby={`section-${theaterId}`}
      className="mt-6"
      key={theaterId}
    >
      <TitleSection
        accent={accent}
        deps={deps}
        id={`section-${theaterId}`}
      >
        <>
          {worldNameByTheaterId[
            theaterId as keyof typeof worldNameByTheaterId
          ]
            ? t(theaterId, {
                ns: 'zones',
              })
            : t('ventures', {
                ns: 'zones',
              })}
          {/*
            A quiet trailing figure rather than a parenthetical: the count is a
            footnote to the section, not part of its name. It cannot be pushed
            past the rule with `order-last` — `TitleSection` wraps all of its
            children in one inline `.section-label` span, so there is no flex
            context here to order against.
          */}
          <span className="figure ml-2 whitespace-nowrap text-[0.6875rem] font-normal normal-case tracking-normal text-muted-foreground/50">
            {t('information.missions', {
              total: missions.size,
            })}
          </span>
        </>
      </TitleSection>
      <EmptySection total={missions.size}>
        <CommonMissionsSection
          missions={missions}
          currentPageTotalResults={pagination.active * perPage}
        />
        {missions.size > 10 && (
          <ZonePagination
            pagination={pagination}
            perPage={perPage}
            totalMissions={missions.size}
            totalPages={totalPages}
          />
        )}
      </EmptySection>
    </section>
  )
}
