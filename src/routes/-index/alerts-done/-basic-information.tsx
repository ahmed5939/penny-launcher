import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AnimatedNumber,
  KeyValue,
  StatRow,
  StatTile,
} from '../../../components/page'

import { pennyDBProfileURL } from '../../../config/fortnite/links'

import { ExternalAuthTypeImage } from '../../../routes/stw-operations/xpboosts/-shared'

import { useAlertsDoneData } from '../../../hooks/alerts/alerts-done'
import { usePlayerData, usePlayerDataActions } from './-hooks'

import { stripColon } from '../-components/-mission-data'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { extractCommanderLevel } from '../../../lib/parsers/query-profile'
import { getShortDateFormat } from '../../../lib/dates'

/**
 * The player's card: who they are, then their record as one line of
 * figures — lifetime alerts first, because that is what this tab is for.
 */
export function BasicInformation() {
  const { t } = useTranslation(['alerts', 'general'])

  const { playerData } = useAlertsDoneData()
  const { handleOpenExternalFNDBProfileUrl } = usePlayerDataActions()
  const { missions } = usePlayerData()

  if (!playerData?.data) {
    return null
  }

  const firstMission = missions.last()
  const lastMission = missions.first()
  const { lookup } = playerData.data
  /*
   * With "Public Game Stats" off Epic answers the lookup but nothing else, so
   * the account id is all there is to show.
   */
  const showFullStats = !playerData.isPrivate && playerData.success
  const totalAlerts =
    playerData.data.profileChanges?.profile.stats.attributes
      .mission_alert_redemption_record?.claimData?.length ?? 0

  return (
    <section className="panel mt-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/30 px-5 py-3.5">
        <ExternalAuthTypeImage externalAuthType={lookup.externalAuthType} />
        {/*
          The page's one h1: this screen is about a player, and everything
          under it is a section of that player's record.
        */}
        <h1 className="min-w-0 flex-1 text-title font-bold leading-tight">
          <a
            href={pennyDBProfileURL(lookup.id)}
            className="inline-flex max-w-full items-center gap-1.5 transition-colors hover:text-primary"
            onClick={handleOpenExternalFNDBProfileUrl(lookup.id)}
          >
            <span className="truncate">{lookup.displayName}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />
          </a>
        </h1>
        <dl className="w-full sm:w-auto sm:max-w-80">
          <KeyValue
            copyable
            label={stripColon(t('information.account-id', { ns: 'general' }))}
            value={
              <span className="select-text break-all font-mono text-xs">
                {lookup.id}
              </span>
            }
          />
        </dl>
      </div>

      {showFullStats ? (
        /*
          The claim record is lifetime; only the part of it that overlaps
          today's rotation can be listed below, so "today" is what explains a
          short list under a large count.
        */
        <StatRow className="px-5 py-4">
          <StatTile
            label={t('information.alerts-completed')}
            tone="primary"
            value={<AnimatedNumber value={totalAlerts} />}
          />
          <StatTile
            label="Claimed from today's board"
            value={numberWithCommaSeparator(missions.size)}
          />
          <StatTile
            label={stripColon(t('information.commander-level', { ns: 'general' }))}
            value={numberWithCommaSeparator(
              extractCommanderLevel(playerData.data.profileChanges).total
            )}
          />
          <StatTile
            hint={
              firstMission
                ? `First claim ${getShortDateFormat(firstMission.redemptionDateUtc)}`
                : undefined
            }
            label="Last claim"
            value={
              <span className="text-base">
                {lastMission
                  ? getShortDateFormat(lastMission.redemptionDateUtc)
                  : '—'}
              </span>
            }
          />
        </StatRow>
      ) : (
        playerData.isPrivate && (
          <p className="px-5 py-3 text-ui leading-snug text-muted-foreground">
            {t('public-stats', {
              ns: 'general',
            })}
          </p>
        )
      )}
    </section>
  )
}
