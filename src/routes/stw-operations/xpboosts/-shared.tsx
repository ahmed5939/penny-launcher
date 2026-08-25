import type { ReactNode } from 'react'
import type { MCPQueryProfileChanges } from '../../../types/services/mcp'

import { useTranslation } from 'react-i18next'

import { individualLimitBoostedXP } from '../../../config/constants/xpboosts'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
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
      <img
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
      <div className="text-white">{value}</div>
    </div>
  )
}

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
    <>
      <AccountBasicInformationSection
        title={t('information.account-id')}
        value={accountId}
      />
      {/* <AccountBasicInformationSection
        title={t('information.power-level')}
        value="⚡130"
      /> */}
      <AccountBasicInformationSection
        title={t('information.commander-level')}
        value={numberWithCommaSeparator(commanderLevel)}
      />
      <AccountBasicInformationSection
        title={t('information.boosted-xp')}
        value={
          <div className="space-x-1.5">
            <span>{numberWithCommaSeparator(extractedBoostedXP)}</span>
            <span>
              ({numberWithCommaSeparator(individualBoosts)} {t('boosts')})
            </span>
          </div>
        }
      />
      <AccountBasicInformationSection
        title={t('information.days-logged-in')}
        value={numberWithCommaSeparator(daysLoggedIn)}
      />
      <AccountBasicInformationSection
        title={t('information.collection-book-level')}
        value={numberWithCommaSeparator(collectionBookLevel)}
      />
      {!hideXPBoostsData && (
        <>
          <AccountBasicInformationSection
            title={
              <>
                <figure className="size-5">
                  <img
                    src={assets('smallxpboost')}
                    className="size-[18px]"
                  />
                </figure>
                {t('information.personal-xp-boosts')}
              </>
            }
            value={numberWithCommaSeparator(personalXPBoosts)}
          />
          <AccountBasicInformationSection
            title={
              <>
                <figure className="size-5">
                  <img
                    src={assets('smallxpboost_gift')}
                    className="size-[18px]"
                  />
                </figure>
                {t('information.teammate-xp-boosts')}
              </>
            }
            value={numberWithCommaSeparator(teammateXPBoosts)}
          />
        </>
      )}
      <AccountBasicInformationSection
        title={
          <>
            <figure className="size-5">
              <img
                src={assets('eventcurrency_founders')}
                className="size-[18px]"
              />
            </figure>
            {t('information.founder-status')}
          </>
        }
        value={t(`founder.${extractFounderStatus(founderStatus)}`)}
      />
    </>
  )
}
