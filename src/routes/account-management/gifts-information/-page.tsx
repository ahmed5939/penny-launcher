import { Gift, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Masonry from 'react-responsive-masonry'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion'
import {
  EmptyState,
  PageHeader,
  Panel,
} from '../../../components/page'

import { GiftsInformationData } from '../../../state/management/gifts-information'

import { useGiftsInformationData, useParseAccountInfo } from './-hooks'

import { getDateWithFormat } from '../../../lib/dates'
import { parseCustomDisplayName } from '../../../lib/utils'

/**
 * Gift history — the Glow-Launcher gifts page, wearing this app's page kit.
 *
 * `common_core` knows how many gifts an account has received and from whom;
 * `athena` knows which locker items actually arrived as gifts and when. The
 * main process joins them and resolves cosmetic art, so this page only ever
 * renders what it is handed.
 */

/** Epic uses the year-1 sentinel date for gifts without a real timestamp. */
function usableGiftDate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const year = new Date(value).getUTCFullYear()

  return Number.isFinite(year) && year >= 2017 ? value : null
}

function formatGiftDate(value: string | null): string | null {
  const usable = usableGiftDate(value)

  if (!usable) {
    return null
  }

  try {
    return getDateWithFormat(usable, 'MMM D, YYYY')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null
  }
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])

  return (
    <>
      <PageHeader
        icon={Gift}
        section={t('account-management.title')}
        title={t('account-management.options.gifts-information')}
        description={t('gifts-information.description', {
          ns: 'account-management',
        })}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['account-management'])

  const { data, handleGetInfo, isDisabledForm, isLoading } =
    useGiftsInformationData()

  const totalReceived = data.reduce(
    (accumulator, current) => accumulator + current.numReceived,
    0
  )
  const totalSenders = data.reduce(
    (accumulator, current) => accumulator + current.senders.length,
    0
  )
  const totalCosmetics = data.reduce(
    (accumulator, current) =>
      accumulator +
      current.senders.reduce(
        (senderAccumulator, sender) =>
          senderAccumulator + sender.cosmetics.length,
        0
      ),
    0
  )

  return (
    <>
      {/* The account question is answered by the titlebar picker. */}
      <div className="flex items-center border-b border-border/60 pb-3">
        <Button
          className="ml-auto min-w-40"
          onClick={handleGetInfo}
          disabled={isDisabledForm}
        >
          {isLoading ? (
            <RefreshCw className="animate-spin" />
          ) : (
            t('gifts-information.form.submit-button')
          )}
        </Button>
      </div>

      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-5 py-4">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('gifts-information.results.title', {
              total: data.length,
            })}
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <SummaryStat
              label={t('gifts-information.results.received')}
              value={totalReceived}
            />
            <SummaryStat
              label={t('gifts-information.results.senders')}
              value={totalSenders}
            />
            <SummaryStat
              label={t('gifts-information.results.cosmetics')}
              value={totalCosmetics}
            />
          </span>
        </div>
      )}

      <Masonry
        columnsCount={2}
        gutter="0.75rem"
      >
        {data.map((item) => (
          <AccountPanel
            data={item}
            key={item.accountId}
          />
        ))}
      </Masonry>

      <GoToTop containerId="selector-card" />
    </>
  )
}

function SummaryStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

function AccountPanel({ data }: { data: GiftsInformationData }) {
  const { t } = useTranslation(['account-management'])
  const { account } = useParseAccountInfo({ data })

  return (
    <Panel>
      <header className="border-b border-border/60 px-4 py-3">
        <p className="truncate text-[0.8125rem] font-medium">
          {account ? parseCustomDisplayName(account) : data.accountId}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('gifts-information.account.count', {
            received: data.numReceived,
            senders: data.senders.length,
          })}
        </p>
      </header>

      {data.errorMessage && (
        <p className="px-4 py-3 text-xs text-destructive">
          {t('gifts-information.account.error')} {data.errorMessage}
        </p>
      )}

      {data.senders.length === 0 ? (
        <div className="p-4">
          <EmptyState
            className="py-8"
            description={t('gifts-information.account.empty-description')}
            icon={Gift}
            title={t('gifts-information.account.empty')}
          />
        </div>
      ) : (
        <Accordion
          className="px-2 py-1"
          collapsible
          type="single"
        >
          {data.senders.map((sender) => {
            const lastGift = formatGiftDate(sender.lastGiftDate)

            return (
              <AccordionItem
                className="border-border/40 last:border-b-0"
                key={sender.accountId}
                value={sender.accountId}
              >
                <AccordionTrigger className="gap-3 py-3 no-underline hover:no-underline">
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[0.8125rem] font-medium">
                      {sender.displayName}
                    </span>
                    {lastGift && (
                      <span className="block text-xs text-muted-foreground">
                        {t('gifts-information.sender.last-gift', {
                          date: lastGift,
                        })}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {sender.cosmetics.length}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3 pt-0">
                  <ul className="divide-y divide-border/40">
                    {sender.cosmetics.map((cosmetic) => {
                      const meta = [cosmetic.type, cosmetic.rarity]
                        .filter(Boolean)
                        .join(' · ')
                      const date = formatGiftDate(cosmetic.creationTime)

                      return (
                        <li
                          className="flex items-center gap-3 py-2 text-xs"
                          key={cosmetic.templateId}
                        >
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted/40">
                            {cosmetic.image ? (
                              <img
                                alt=""
                                className="size-full object-contain"
                                decoding="async"
                                loading="lazy"
                                src={cosmetic.image}
                              />
                            ) : (
                              <Gift className="size-3.5 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {cosmetic.name}
                            </span>
                            {meta.length > 0 && (
                              <span className="block truncate text-muted-foreground">
                                {meta}
                              </span>
                            )}
                          </span>
                          {date && (
                            <span className="shrink-0 text-muted-foreground">
                              {date}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </Panel>
  )
}
