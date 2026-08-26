import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { AlertsSection } from './-section'

export function VBucksSection({
  data,
}: {
  data: Collection<string, WorldInfoMission>
}) {
  const { t } = useTranslation(['alerts'])

  return (
    <AlertsSection
      data={data}
      id="title-vbucks"
      resolveFeatured={(mission) => {
        const alert = mission.ui.alert.rewards.find((reward) =>
          reward.itemId.includes('currency_mtxswap')
        )
        const reward = mission.ui.mission.rewards.find((reward) =>
          reward.itemId.includes('alteration_upgrade_uc')
        )

        return alert ?? reward
      }}
      title={t('sections.vbucks.title')}
      isVBucks
    />
  )
}
