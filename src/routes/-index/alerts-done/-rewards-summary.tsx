import { CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CommonMissionsSection } from '../-components/-common-missions-section'
import { EmptySection } from '../-components/-empty'
import { RewardsSummaryList } from '../-components/-rewards-summary-list'

import { useAlertsDoneData } from '../../../hooks/alerts/alerts-done'
import { usePlayerData } from './-hooks'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'

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
      <section
        className="mt-6"
        aria-labelledby="alerts-completed"
      >
        <div className="panel flex items-center gap-4 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20">
            <CheckCheck className="size-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="micro-label"
              id="alerts-completed"
            >
              {t('information.alerts-completed')}
            </h2>
            <div className="figure mt-1.5 text-4xl font-bold leading-none">
              {numberWithCommaSeparator(totalAlerts)}
            </div>
          </div>
          {/*
            The claim record is lifetime; only the part of it that overlaps
            today's rotation can be listed below, so the second figure is what
            explains a short list under a large count.
          */}
          <div className="shrink-0 border-l border-border/40 pl-4 text-right">
            <div className="micro-label">
              {t('missions', {
                ns: 'general',
              })}
            </div>
            <div className="figure mt-1.5 text-xl font-bold leading-none text-foreground/85">
              {numberWithCommaSeparator(missions.size)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="section-label mb-2">
          {t('information.rewards-summary')}
        </h2>
        <RewardsSummaryList rewards={rewards} />
      </section>

      <section className="mt-6">
        <h2 className="section-label mb-2 flex items-center gap-2">
          {t('missions', {
            ns: 'general',
          })}
          <span className="text-[0.6875rem] font-normal normal-case tracking-normal text-muted-foreground/50">
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
