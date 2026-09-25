import type { ReactNode } from 'react'
import type { MCPQueryProfileChanges } from '../../../types/services/mcp'

import { useTranslation } from 'react-i18next'

import { KeyValue, StatRow, StatTile } from '../../../components/page'

import { individualLimitBoostedXP } from '../../../config/constants/xpboosts'

import {
  compactNumber,
  numberWithCommaSeparator,
} from '../../../lib/parsers/numbers'
import {
  extractBoostedXP,
  extractFounderStatus,
} from '../../../lib/parsers/query-profile'
import { assets } from '../../../lib/repository'

/**
 * Account summary pieces shared by the XP boosts page, the matchmaking
 * tracker and the alerts-done panel.
 *
 * They live here rather than in `-page.tsx` so that importing them does not
 * drag the whole XP boosts route into another route's chunk.
 */

export function ExternalAuthTypeImage({
  externalAuthType,
}: {
  externalAuthType?: 'psn' | 'xbl'
}) {
  return (
    <figure>
      <img decoding="async" loading="lazy"
        src={assets(externalAuthType ?? 'epicgames')}
        className="size-5"
      />
    </figure>
  )
}

export function AccountBasicInformationSection({
  title,
  value,
}: {
  title: ReactNode
  value: ReactNode
}) {
  return (
    <div className="break-all flex gap-1.5 items-center">
      <div className="flex flex-shrink-0 gap-1.5 items-center text-muted-foreground">
        {title}
      </div>
      <div className="text-foreground">{value}</div>
    </div>
  )
}

/** The locale strings carry a trailing colon for the old inline layout. */
function label(text: string) {
  return text.replace(/:\s*$/, '')
}

function BoostFigure({ art, value }: { art: string; value: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <img
        alt=""
        className="size-7 object-contain"
        decoding="async"
        loading="lazy"
        src={assets(art)}
      />
      {value}
    </span>
  )
}

/**
 * A player's record as a line of figures, the boosts drawn with the game's
 * own boost art. Used by the look-up tab and the send sheet.
 */
export function SearchedUserData({
  accountId,
  boostedXP,
  collectionBookLevel,
  commanderLevel,
  daysLoggedIn,
  founderStatus,
  personalXPBoosts,
  teammateXPBoosts,

  hideXPBoostsData,
}: {
  accountId: string
  boostedXP?: MCPQueryProfileChanges
  collectionBookLevel: number
  commanderLevel: number
  daysLoggedIn: number
  founderStatus?: MCPQueryProfileChanges
  personalXPBoosts: number
  teammateXPBoosts: number

  hideXPBoostsData?: boolean
}) {
  const { t } = useTranslation(['general'])

  const extractedBoostedXP = extractBoostedXP(boostedXP)
  const individualBoosts = Math.round(
    extractedBoostedXP / individualLimitBoostedXP,
  )

  return (
    <div className="space-y-4">
      <StatRow className="gap-x-8">
        {!hideXPBoostsData && (
          <>
            <StatTile
              label={label(t('information.teammate-xp-boosts'))}
              tone="primary"
              value={
                <BoostFigure
                  art="smallxpboost_gift"
                  value={numberWithCommaSeparator(teammateXPBoosts)}
                />
              }
            />
            <StatTile
              label={label(t('information.personal-xp-boosts'))}
              value={
                <BoostFigure
                  art="smallxpboost"
                  value={numberWithCommaSeparator(personalXPBoosts)}
                />
              }
            />
          </>
        )}
        <StatTile
          hint={`${numberWithCommaSeparator(individualBoosts)} ${t('boosts')}`}
          label={label(t('information.boosted-xp'))}
          value={compactNumber(extractedBoostedXP)}
        />
        <StatTile
          label={label(t('information.commander-level'))}
          value={numberWithCommaSeparator(commanderLevel)}
        />
        <StatTile
          label={label(t('information.collection-book-level'))}
          value={numberWithCommaSeparator(collectionBookLevel)}
        />
        <StatTile
          label={label(t('information.days-logged-in'))}
          value={numberWithCommaSeparator(daysLoggedIn)}
        />
        <StatTile
          label={label(t('information.founder-status'))}
          value={
            <BoostFigure
              art="eventcurrency_founders"
              value={
                <span className="text-base">
                  {t(`founder.${extractFounderStatus(founderStatus)}`)}
                </span>
              }
            />
          }
        />
      </StatRow>
      <dl>
        <KeyValue
          copyable
          label={label(t('information.account-id'))}
          value={
            <span className="select-text break-all font-mono text-xs">
              {accountId}
            </span>
          }
        />
      </dl>
    </div>
  )
}
