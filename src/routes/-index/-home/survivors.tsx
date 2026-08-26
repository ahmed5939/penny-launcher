import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { AlertsSection } from './-section'

import { isLegendaryOrMythicSurvivor } from '../../../lib/validations/resources'

export function SurvivorsSection({
  data,
}: {
  data: Collection<string, WorldInfoMission>
}) {
  const { t } = useTranslation(['alerts'])

  return (
    <AlertsSection
      data={data}
      emptyTitle={t('sections.survivors.empty')}
      id="title-survivors"
      resolveFeatured={(mission) => {
        const alert = mission.ui.alert.rewards.find((reward) =>
          isLegendaryOrMythicSurvivor(reward.itemId)
        )
        const reward = mission.ui.mission.rewards.find((reward) =>
          reward.itemId.includes('alteration_upgrade_uc')
        )

        return alert ?? reward
      }}
      title={t('sections.survivors.title')}
    />
  )
}
