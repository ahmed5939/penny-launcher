import type { ExpeditionsEntry } from '../../../kernel/core/expeditions'

import { UpdateIcon } from '@radix-ui/react-icons'
import { CheckCheck, Compass, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Masonry from 'react-responsive-masonry'
import dayjs from 'dayjs'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  PageHeader,
  Panel,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useExpeditionsData } from './-hooks'

import { useGetAccounts } from '../../../hooks/accounts'

import { squadLabelsById } from '../../../config/constants/fortnite/squads'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Compass}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.expeditions')}
            <BetaBadge />
          </span>
        }
        description="Collect every finished expedition across your accounts in one press."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    data,
    handleCollect,
    handleLoad,
    isCollecting,
    isDisabledCollect,
    isDisabledForm,
    isLoading,
    scopeCount,
    totalInFlight,
    totalReady,
  } = useExpeditionsData()

  return (
    <>
      {/*
        The account picker that used to sit here is gone. The rail already
        answers which accounts this is about, and the data loads itself when
        that changes — so this strip is a toolbar over live results rather
        than a form standing between you and them.

        The collect button names its blast radius. A global scope acting on
        several accounts at once must never let you press a bare verb.
      */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <Button
          className="min-w-32"
          variant="secondary"
          onClick={handleLoad}
          disabled={isDisabledForm}
        >
          {isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            'Refresh'
          )}
        </Button>
        <Button
          className="ml-auto min-w-40"
          onClick={handleCollect}
          disabled={isDisabledCollect}
        >
          {isCollecting ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            <>
              <CheckCheck className="size-4" />
              Collect {totalReady} on {scopeCount}{' '}
              {scopeCount === 1 ? 'account' : 'accounts'}
            </>
          )}
        </Button>
      </div>

      {data.length > 0 && (
        <>
          <StatRow className="lg:grid-cols-3">
            <StatTile
              icon={CheckCheck}
              label="Ready to collect"
              tone={totalReady > 0 ? 'success' : 'default'}
              value={totalReady}
            />
            <StatTile
              icon={Timer}
              label="In flight"
              value={totalInFlight}
            />
            <StatTile
              icon={Compass}
              label="Accounts checked"
              value={data.length}
            />
          </StatRow>

          <Masonry
            columnsCount={3}
            gutter="0.75rem"
          >
            {data.map((entry) => (
              <AccountExpeditions
                entry={entry}
                key={entry.accountId}
              />
            ))}
          </Masonry>
        </>
      )}

      <GoToTop containerId="selector-card" />
    </>
  )
}

function AccountExpeditions({ entry }: { entry: ExpeditionsEntry }) {
  const { accountList } = useGetAccounts()

  const account = accountList[entry.accountId]
  const ready = entry.slots.filter((slot) => slot.state === 'ready').length

  return (
    <Panel>
      <header className="border-b border-border/60 px-4 py-3">
        <p className="truncate text-[0.8125rem] font-medium">
          {parseCustomDisplayName(account)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.errorMessage
            ? entry.errorMessage
            : ready > 0
              ? `${ready} ready to collect`
              : 'Nothing ready'}
        </p>
      </header>

      {entry.slots.length > 0 && (
        <ul className="divide-y divide-border/40">
          {entry.slots.map((slot) => (
            <li
              className="flex items-start gap-3 px-4 py-2.5"
              key={slot.itemId}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">
                    {slot.name}
                  </span>
                  {slot.tier > 0 && (
                    <span className="shrink-0 rounded border border-border/70 px-1 text-[0.55rem] font-semibold uppercase text-muted-foreground">
                      T{slot.tier}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[0.65rem] text-muted-foreground">
                  {[
                    slot.vehicle,
                    slot.duration,
                    slot.maxTargetPower > 0 &&
                      `power ${slot.minTargetPower}–${slot.maxTargetPower}`,
                    slot.criteria.length > 0 &&
                      `${slot.criteria.length} hero${slot.criteria.length === 1 ? '' : 'es'}`,
                    slot.squadId && squadLabelsById[slot.squadId],
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {slot.criteria.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {slot.criteria.map((requirement, index) => (
                      <span
                        className="rounded border border-border/60 px-1 text-[0.55rem] uppercase tracking-wide text-muted-foreground"
                        key={`${requirement.rarity}-${requirement.type}-${index}`}
                      >
                        {requirement.rarity}
                        {requirement.type ? ` ${requirement.type}` : ''}
                      </span>
                    ))}
                  </span>
                )}
              </span>

              <span className="shrink-0 text-right">
                {slot.state === 'ready' ? (
                  <span className="text-xs font-semibold text-success">
                    Ready
                  </span>
                ) : slot.state === 'in-flight' ? (
                  <>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {dayjs(slot.endTime).fromNow()}
                    </span>
                    {slot.successChance > 0 && (
                      <span className="block text-[0.6rem] text-muted-foreground">
                        {Math.round(slot.successChance * 100)}% success
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="block text-xs text-muted-foreground">
                      Idle
                    </span>
                    {slot.expiresAt && (
                      <span className="block text-[0.6rem] text-muted-foreground">
                        expires {dayjs(slot.expiresAt).fromNow()}
                      </span>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
