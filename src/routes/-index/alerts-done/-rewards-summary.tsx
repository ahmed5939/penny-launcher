import { useTranslation } from 'react-i18next'

import { CommonMissionsSection } from '../-components/-common-missions-section'
import { EmptySection } from '../-components/-empty'
import { RewardsSummaryList } from '../-components/-rewards-summary-list'

import { useAlertsDoneData } from '../../../hooks/alerts/alerts-done'
import { usePlayerData } from './-hooks'

export function RewardsSummary() {
  const { t } = useTranslation(['alerts', 'general'])

  const { playerData } = useAlertsDoneData()
  const { missions, rewards } = usePlayerData()

  if (!playerData?.data) {
    return null
  }

  const totalAlerts =
    playerData?.data?.profileChanges?.profile.stats.attributes
      .mission_alert_redemption_record?.claimData?.length ?? 0

  return (
    <>
      <section className="mt-6">
        <h2 className="section-label mb-2">Rewards from today&apos;s claims</h2>
        <RewardsSummaryList rewards={rewards} />
      </section>

      <section className="mt-6">
        <h2 className="section-label mb-2 flex items-center gap-2">
          {t('missions', {
            ns: 'general',
          })}
          <span className="text-caption font-normal normal-case tracking-normal text-muted-foreground/50">
            {t('sort.newest', {
              ns: 'general',
            })}
          </span>
        </h2>
        <EmptySection
          total={missions.size}
          title={
            totalAlerts > 0 && missions.size <= 0
              ? t('results.empty.alerts-done')
              : undefined
          }
        >
          <CommonMissionsSection
            missions={missions}
            hideCompletedCheck
          />
        </EmptySection>
      </section>
    </>
  )
}
