import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { AlertsSection } from './-section'

export function EndgameVenturesSection({
  data,
}: {
  data: Collection<string, WorldInfoMission>
}) {
  const { t } = useTranslation(['alerts'])

  /*
   * No matcher: a Ventures endgame mission is not named after one reward, so
   * the row leads with its alert — the schematic, whose rarity the bay now
   * spells out in words instead of an unnamed swatch.
   */
  return (
    <AlertsSection
      data={data}
      id="title-endgame-ventures"
      title={t('sections.ventures.title-endgame')}
    />
  )
}
