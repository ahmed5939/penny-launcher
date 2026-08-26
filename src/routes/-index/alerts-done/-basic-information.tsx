import type { ReactNode } from 'react'

import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { pennyDBProfileURL } from '../../../config/fortnite/links'

import { ExternalAuthTypeImage } from '../../../routes/stw-operations/xpboosts/-shared'

import { useAlertsDoneData } from '../../../hooks/alerts/alerts-done'
import { usePlayerData, usePlayerDataActions } from './-hooks'

import { stripColon } from '../-components/-mission-data'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { extractCommanderLevel } from '../../../lib/parsers/query-profile'
import { getShortDateFormat } from '../../../lib/dates'

export function BasicInformation() {
  const { t } = useTranslation(['alerts', 'general'])

  const { playerData } = useAlertsDoneData()
  const { handleOpenExternalFNDBProfileUrl } = usePlayerDataActions()
  const { missions } = usePlayerData()

  const firstMission = missions.last()
  const lastMission = missions.first()
  const firstDate = firstMission
    ? getShortDateFormat(firstMission.redemptionDateUtc)
    : 'N/A'
  const lastDate = lastMission
    ? getShortDateFormat(lastMission.redemptionDateUtc)
    : 'N/A'

  if (!playerData?.data) {
    return null
  }

  const { lookup } = playerData.data
  /*
   * With "Public Game Stats" off Epic answers the lookup but nothing else, so
   * the account id is all there is to show.
   */
  const showFullStats = !playerData.isPrivate && playerData.success

  return (
    <section className="panel mt-6 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/20">
          <ExternalAuthTypeImage
            externalAuthType={lookup.externalAuthType}
          />
        </span>
        {/*
          The page's one h1: this screen is about a player, and everything
          under it is a section of that player's record.
        */}
        <h1 className="min-w-0 flex-1 text-lg font-bold leading-tight">
          <a
            href={pennyDBProfileURL(lookup.id)}
            className="inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-primary"
            onClick={handleOpenExternalFNDBProfileUrl(lookup.id)}
          >
            <span className="truncate">{lookup.displayName}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />
          </a>
        </h1>
      </div>

      <dl className="mt-4 space-y-3 border-t border-border/40 pt-4">
        <InfoStat
          title={t('information.account-id', {
            ns: 'general',
          })}
          value={
            <span className="select-text break-all font-mono text-[0.75rem]">
              {lookup.id}
            </span>
          }
        />
        {showFullStats && (
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoStat
              title={t('information.commander-level', {
                ns: 'general',
              })}
              value={
                <span className="figure">
                  {numberWithCommaSeparator(
                    extractCommanderLevel(playerData.data.profileChanges)
                      .total
                  )}
                </span>
              }
            />
            <InfoStat
              title={t('information.first-claim')}
              value={<span className="figure">{firstDate}</span>}
            />
            <InfoStat
              title={t('information.last-played')}
              value={<span className="figure">{lastDate}</span>}
            />
          </div>
        )}
      </dl>

      {playerData.isPrivate && (
        <p className="mt-3 text-[0.8125rem] leading-snug text-muted-foreground">
          {t('public-stats', {
            ns: 'general',
          })}
        </p>
      )}
    </section>
  )
}

/*
 * The `information.*` strings ship with their trailing colon baked in, which a
 * micro-label cap-and-track treatment turns into a stray floating dot.
 */
function InfoStat({
  title,
  value,
}: {
  title: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="micro-label">{stripColon(title)}</dt>
      <dd className="mt-1 text-[0.8125rem] leading-tight text-foreground/85">
        {value}
      </dd>
    </div>
  )
}
