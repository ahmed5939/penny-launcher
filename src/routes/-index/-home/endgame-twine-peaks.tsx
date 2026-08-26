import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { AlertsSection } from './-section'

export function EndgameTwinePeaksSection({
  data,
}: {
  data: Collection<string, WorldInfoMission>
}) {
  const { t } = useTranslation(['alerts', 'zones'])

  /*
   * No matcher: an endgame mission is not named after one reward, so the row
   * leads with the biggest thing it drops and a bad roll surfaces where every
   * other caveat does — the meta strip, in the destructive token.
   */
  return (
    <AlertsSection
      data={data}
      id="title-endgame-twine-peaks"
      title={t('sections.twine-peaks.title-endgame')}
    />
  )
}
