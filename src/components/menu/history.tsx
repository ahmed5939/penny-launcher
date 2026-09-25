import type { RewardsNotification } from '../../types/notifications'

import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { SheetClose } from '../ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

import { EmptyState, RewardLine } from '../page'

import {
  useClaimedRewards,
  useParseSummary,
} from '../../hooks/stw-operations/claimed-rewards'
import { useGetAccounts } from '../../hooks/accounts'

import { parseResource } from '../../lib/parsers/resources'
import { getShortDateFormat } from '../../lib/dates'
import { assets } from '../../lib/repository'
import { parseCustomDisplayName } from '../../lib/utils'

enum HistoryTabs {
  History = 'history',
  Summary = 'summary',
}
const defaultSelectedTab: HistoryTabs = HistoryTabs.History

export function HistoryMenu() {
  const { t } = useTranslation(['history', 'general'])

  const { data } = useClaimedRewards()
  const dataOrderByDesc = data.toReversed()

  return (
    /*
     * The flyout is a full-height column, so every pane below measures itself
     * against its parent rather than against `100vh` minus a guess at the
     * chrome above it.
     */
    <Tabs
      className="flex min-h-0 flex-1 flex-col"
      defaultValue={defaultSelectedTab}
    >
      {/*
        The flyout's own header strip, at the panel gutter — deliberately not
        the titlebar's height token and not a drag region. A second draggable
        strip inside a modal overlay makes every control in it opt back out
        one by one.
      */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <TabsList>
          <TabsTrigger value={HistoryTabs.History}>
            {t('history', {
              ns: 'general',
            })}
          </TabsTrigger>
          <TabsTrigger value={HistoryTabs.Summary}>
            {t('summary', {
              ns: 'general',
            })}
          </TabsTrigger>
        </TabsList>
        <SheetClose asChild>
          <Button
            className="ml-auto size-7"
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
            <span className="sr-only">close history sidebar</span>
          </Button>
        </SheetClose>
      </header>

      <HistoryPane value={HistoryTabs.History}>
        <PaneNote>{t('history.note')}</PaneNote>
        {dataOrderByDesc.length > 0 ? (
          <div className="divide-y divide-border/60">
            {dataOrderByDesc.map((item) => (
              <RewardSection
                data={item}
                key={item.id}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t('history.empty')} />
        )}
      </HistoryPane>

      <HistoryPane value={HistoryTabs.Summary}>
        <PaneNote>{t('summary.note')}</PaneNote>
        <SummarySection />
      </HistoryPane>
    </Tabs>
  )
}

/**
 * One tab's scrolling pane.
 *
 * `data-[state=active]:flex` rather than a bare `flex`: Radix hides an
 * inactive tab with the `hidden` attribute, and a display utility from the
 * later cascade layer would override it and show every tab at once.
 */
function HistoryPane({
  children,
  value,
}: {
  children: React.ReactNode
  value: HistoryTabs
}) {
  return (
    <TabsContent
      className="mt-0 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
      value={value}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 pb-6 pt-3">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}

/** Explain the history retention window. */
function PaneNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ui leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

function SummarySection() {
  const { t } = useTranslation(['history', 'general'])

  const { accountList } = useGetAccounts()
  const { accountsSummary, globalSummary } = useParseSummary()
  const { data } = useClaimedRewards()
  const sources = new Map<string, number>()
  for (const entry of data) {
    const source = entry.source ?? 'Reward claims'
    sources.set(source, (sources.get(source) ?? 0) + 1)
  }
  const isEmpty = data.length === 0

  if (isEmpty) {
    return <EmptyState title={t('summary.empty')} />
  }

  return (
    <Accordion
      className="w-full space-y-1"
      type="multiple"
      defaultValue={['summary']}
    >
      <AccordionItem
        className="border-none"
        value="summary"
      >
        <SummaryTrigger>{t('summary.all-accounts')}</SummaryTrigger>
        <AccordionContent className="px-1 pb-2 pt-1">
          <ul className="mb-3 space-y-1 text-ui">
            {[...sources].map(([source, count]) => <li className="flex justify-between gap-3" key={source}><span>{source}</span><span>{count} {count === 1 ? 'event' : 'events'}</span></li>)}
          </ul>
          <DateRange
            startsAt={globalSummary.startsAt}
            endsAt={globalSummary.endsAt}
          />
          <ul>
            <RewardItems rewards={globalSummary.rewards} />
            <AccoladesItem accolades={globalSummary.accolades} />
          </ul>
        </AccordionContent>
      </AccordionItem>

      {accountsSummary.map((account) => (
        <AccordionItem
          className="border-none"
          value={account.accountId}
          key={account.accountId}
        >
          <SummaryTrigger>
            {t(parseCustomDisplayName(accountList[account.accountId]), {
              ns: 'general',
            })}
          </SummaryTrigger>
          <AccordionContent className="px-1 pb-2 pt-1">
            <DateRange
              startsAt={account.startsAt}
              endsAt={account.endsAt}
            />
            <ul>
              <RewardItems rewards={account.rewards} />
              <AccoladesItem accolades={account.accolades} />
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/**
 * A summary group's header. Its title is an account name as often as it is a
 * heading, so it stays at body weight instead of taking the section rank —
 * uppercasing somebody's display name is not a heading, it is shouting.
 */
function SummaryTrigger({ children }: { children: React.ReactNode }) {
  return (
    <AccordionTrigger className="break-all rounded-lg bg-muted/40 px-3 py-2 text-left text-ui font-medium">
      {children}
    </AccordionTrigger>
  )
}

function DateRange({
  endsAt,
  startsAt,
}: {
  endsAt: string
  startsAt: string
}) {
  const { t } = useTranslation(['general'])

  return (
    <div className="mb-1 space-y-0.5 text-xs text-muted-foreground">
      <div>
        {t('first-claim', {
          date: startsAt === '' ? 'N/A' : getShortDateFormat(startsAt),
          interpolation: { escapeValue: false },
        })}
      </div>
      <div>
        {t('last-played', {
          date: endsAt === '' ? 'N/A' : getShortDateFormat(endsAt),
          interpolation: { escapeValue: false },
        })}
      </div>
    </div>
  )
}

function RewardSection({ data }: { data: RewardsNotification }) {
  const { accountList } = useGetAccounts()

  return (
    <section className="py-2 first:pt-0 last:pb-0">
      <header className="flex items-baseline gap-2">
        <h3 className="min-w-0 flex-1 break-all text-ui font-medium">
          {accountList[data.accountId] ? parseCustomDisplayName(accountList[data.accountId]) : 'Removed account'}
        </h3>
        <span className="figure shrink-0 text-xs text-muted-foreground">
          {getShortDateFormat(data.createdAt)}
        </span>
      </header>
      {(data.source || data.description) && (
        <p className={`mt-1 text-ui ${data.outcome === 'error' ? 'text-warning' : 'text-muted-foreground'}`}>
          {data.source}{data.description ? ` · ${data.description}` : ''}
        </p>
      )}
      <ul>
        <RewardItems rewards={data.rewards} />
        <AccoladesItem accolades={data.accolades} />
      </ul>
    </section>
  )
}

function RewardItems({ rewards }: Pick<RewardsNotification, 'rewards'>) {
  const rawItems = Object.entries(rewards)
  const items = rawItems.map(([key, quantity]) =>
    parseResource({ key, quantity }),
  )

  /*
   * `rarity` and `type` are handed over already resolved. `RewardLine` would
   * otherwise re-derive them from the id, and the answer it reached would be
   * the one this parse already has.
   */
  return items.map((item) => (
    <RewardLine
      key={item.itemType}
      reward={{
        imageUrl: item.imgUrl,
        itemId: item.itemType,
        quantity: item.quantity,
        rarity: item.rarity,
        type: item.type,
      }}
    />
  ))
}

function AccoladesItem({
  accolades,
}: Pick<RewardsNotification, 'accolades'>) {
  return (
    <RewardLine
      reward={{
        imageUrl: assets('brxp'),
        /*
         * Account XP has no item id, and nothing resolves this one — which is
         * what the row wants: the name falls back to the id itself and no
         * rarity is claimed for a currency that has none.
         */
        itemId: 'Accolades',
        quantity:
          accolades.totalMissionXPRedeemed + accolades.totalQuestXPRedeemed,
      }}
    />
  )
}
