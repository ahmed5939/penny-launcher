import type { GiftsInformationCosmetic } from '../../../kernel/core/gifts-information'
import type { SegmentedOption } from '../../../components/page'

import {
  CalendarDays,
  Gift,
  Package,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { VirtualList } from '../../../components/virtual-list'
import { Input } from '../../../components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  Callout,
  Chip,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useGiftsInformationData } from './-hooks'

import { useGetAccounts } from '../../../hooks/accounts'

import { getDateWithFormat, getRawDate } from '../../../lib/dates'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

/**
 * Gift history — who gifted what, to which account, on which day.
 *
 * The page is a single full-width ledger rather than a masonry of per-account
 * cards with an accordion inside each one. Gifts are events on a timeline: the
 * question is almost always "what arrived, and when", and an accordion answers
 * that only after you have opened every sender on every account to compare.
 * One table, grouped by day, answers it at a glance — and every row opens the
 * item, because the small icon in a row is a hint, not the thing itself.
 */

/** Epic uses the year-1 sentinel date for gifts without a real timestamp. */
function usableGiftDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const year = new Date(value).getUTCFullYear()

  return Number.isFinite(year) && year >= 2017 ? value : null
}

function formatGiftDate(
  value: string | null,
  template = 'MMM D, YYYY'
): string | null {
  const usable = usableGiftDate(value)

  if (!usable) {
    return null
  }

  try {
    return getDateWithFormat(usable, template)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null
  }
}

/**
 * Battle-royale rarities carry their own palette, not the STW one in
 * `page/rarity` — that ladder is built from `RarityType` and knows nothing of
 * the series tiers Epic ships cosmetics in. Anything unmapped simply has no
 * colour, which keeps the ledger quiet.
 */
const rarityAccents: Record<string, string> = {
  common: '#bfbaba',
  uncommon: '#04c577',
  rare: '#51a1db',
  epic: '#d076f6',
  legendary: '#ed7e39',
  mythic: '#ffd93d',
  'icon series': '#20c9c0',
  'dark series': '#c034c4',
  'frozen series': '#8ed4f5',
  'lava series': '#f0913a',
  'shadow series': '#7a7a7a',
  'slurp series': '#1cd2c8',
  'star wars series': '#d7d7d7',
  'marvel series': '#ea3c3c',
  'dc series': '#5089d4',
  'gaming legends series': '#6a4bd6',
}

function rarityAccent(rarity: string | null) {
  return rarity ? rarityAccents[rarity.toLowerCase()] ?? null : null
}

type GiftRow = {
  accountId: string
  accountName: string
  cosmetic: GiftsInformationCosmetic
  /** The best date the payload has for this item, sentinel dates dropped. */
  date: string | null
  key: string
  senderId: string
  senderName: string
  timestamp: number | null
}

type GiftGroup = {
  count: number
  key: string
  label: string
  meta: string | null
  rows: Array<GiftRow>
}

type GroupMode = 'day' | 'sender'

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

  const { accountList } = useGetAccounts()
  const { data, handleGetInfo, isDisabledForm, isLoading } =
    useGiftsInformationData()

  const groupOptions: Array<SegmentedOption<GroupMode>> = [
    { label: t('gifts-information.filters.group-day'), value: 'day' },
    { label: t('gifts-information.filters.group-sender'), value: 'sender' },
  ]

  const [groupMode, setGroupMode] = useState<GroupMode>('day')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<GiftRow | null>(null)

  /*
   * One flat list of gifts is the page's real data shape. Both groupings, the
   * search and every total are derived from it, so nothing can disagree with
   * anything else about how many gifts there are.
   */
  const rows = useMemo(() => {
    const flattened: Array<GiftRow> = []

    data.forEach((entry) => {
      const account = accountList[entry.accountId]
      const accountName = account
        ? parseCustomDisplayName(account)
        : entry.accountId

      entry.senders.forEach((sender) => {
        sender.cosmetics.forEach((cosmetic, index) => {
          const date =
            usableGiftDate(cosmetic.creationTime) ??
            usableGiftDate(sender.lastGiftDate)
          const timestamp = date ? new Date(date).getTime() : null

          flattened.push({
            accountName,
            cosmetic,
            date,
            accountId: entry.accountId,
            key: `${entry.accountId}:${sender.accountId}:${cosmetic.templateId}:${index}`,
            senderId: sender.accountId,
            senderName: sender.displayName,
            timestamp: Number.isFinite(timestamp) ? timestamp : null,
          })
        })
      })
    })

    return flattened
  }, [accountList, data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (term.length === 0) {
      return rows
    }

    return rows.filter((row) =>
      [
        row.cosmetic.name,
        row.cosmetic.type,
        row.cosmetic.rarity,
        row.cosmetic.templateId,
        row.senderName,
        row.accountName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    )
  }, [rows, search])

  const groups = useMemo(
    () =>
      buildGroups(filtered, groupMode, {
        lastGift: (date) =>
          t('gifts-information.table.last-gift', { date }),
        unknownDate: t('gifts-information.table.unknown-date'),
      }),
    [filtered, groupMode, t]
  )

  const senderCount = new Set(rows.map((row) => row.senderId)).size
  const totalReceived = data.reduce(
    (accumulator, current) => accumulator + current.numReceived,
    0
  )
  const failures = data.filter((entry) => entry.errorMessage !== undefined)
  const showAccount = data.length > 1

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <Segmented
          onChange={setGroupMode}
          options={groupOptions}
          value={groupMode}
        />

        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('gifts-information.filters.search')}
            value={search}
          />
        </div>

        <Button
          className="min-w-32"
          disabled={isDisabledForm}
          onClick={handleGetInfo}
        >
          {isLoading ? (
            <RefreshCw className="animate-spin" />
          ) : (
            t('gifts-information.form.submit-button')
          )}
        </Button>
      </div>

      {data.length > 0 && (
        <StatRow>
          <StatTile
            icon={Users}
            label={t('gifts-information.results.title')}
            value={data.length}
          />
          <StatTile
            icon={Gift}
            label={t('gifts-information.results.received')}
            tone="primary"
            value={totalReceived}
          />
          <StatTile
            icon={Send}
            label={t('gifts-information.results.senders')}
            value={senderCount}
          />
          <StatTile
            hint={
              filtered.length === rows.length
                ? undefined
                : t('gifts-information.results.filtered', {
                    total: rows.length,
                  })
            }
            icon={Package}
            label={t('gifts-information.results.cosmetics')}
            value={filtered.length}
          />
        </StatRow>
      )}

      {failures.map((entry) => (
        <Callout
          key={entry.accountId}
          tone="danger"
        >
          {t('gifts-information.account.error')} {entry.errorMessage}
        </Callout>
      ))}

      <Panel id="gifts-card">
        <PanelHeader
          compact
          icon={CalendarDays}
          title={
            groupMode === 'day'
              ? t('gifts-information.table.by-day')
              : t('gifts-information.table.by-sender')
          }
          actions={
            <span className="micro-label">
              {t('gifts-information.table.groups', {
                total: groups.length,
              })}
            </span>
          }
        />

        {groups.length === 0 ? (
          <div className="p-4">
            <EmptyState
              className="py-10"
              description={
                rows.length > 0
                  ? t('gifts-information.table.no-matches-description')
                  : t('gifts-information.account.empty-description')
              }
              icon={Gift}
              title={
                rows.length > 0
                  ? t('gifts-information.table.no-matches')
                  : t('gifts-information.account.empty')
              }
            />
          </div>
        ) : (
          <GiftsTable
            groups={groups}
            onSelect={setSelected}
            showAccount={showAccount}
          />
        )}
      </Panel>

      <GiftDetailDialog
        onClose={() => setSelected(null)}
        row={selected}
      />

      <GoToTop containerId="gifts-card" />
    </>
  )
}

/**
 * `sender.lastGiftDate` is the only date Epic records for some accounts, so a
 * row can share a day with a hundred others. Undated gifts are collected at
 * the end rather than dropped — they are still gifts you received.
 */
function buildGroups(
  rows: Array<GiftRow>,
  mode: GroupMode,
  labels: { lastGift: (date: string) => string; unknownDate: string }
): Array<GiftGroup> {
  const sorted = [...rows].sort(
    (rowA, rowB) => (rowB.timestamp ?? -1) - (rowA.timestamp ?? -1)
  )

  if (mode === 'sender') {
    const bySender = new Map<string, Array<GiftRow>>()

    sorted.forEach((row) => {
      const current = bySender.get(row.senderId) ?? []

      current.push(row)
      bySender.set(row.senderId, current)
    })

    return [...bySender.values()]
      .sort((groupA, groupB) => groupB.length - groupA.length)
      .map((groupRows) => {
        const latest = groupRows[0]

        return {
          count: groupRows.length,
          key: latest.senderId,
          label: latest.senderName,
          meta: latest.date
            ? labels.lastGift(formatGiftDate(latest.date) as string)
            : null,
          rows: groupRows,
        }
      })
  }

  const byDay = new Map<string, Array<GiftRow>>()

  sorted.forEach((row) => {
    const key = row.date ? getDateWithFormat(row.date, 'YYYY-MM-DD') : 'unknown'
    const current = byDay.get(key) ?? []

    current.push(row)
    byDay.set(key, current)
  })

  /*
   * The day is already the group's heading and the time is already the last
   * column, so a day group carries no second line.
   */
  return [...byDay.entries()].map(([key, groupRows]) => ({
    key,
    count: groupRows.length,
    label: key === 'unknown' ? labels.unknownDate : formatDayLabel(key),
    meta: null,
    rows: groupRows,
  }))
}

/** Today and yesterday are worth naming; everything older wants its weekday. */
function formatDayLabel(dayKey: string) {
  const day = getRawDate(dayKey)
  const today = getRawDate().startOf('day')
  const difference = today.diff(day.startOf('day'), 'day')

  if (difference === 0) {
    return `Today · ${day.format('MMM D, YYYY')}`
  }

  if (difference === 1) {
    return `Yesterday · ${day.format('MMM D, YYYY')}`
  }

  return day.format('dddd, MMM D, YYYY')
}

/**
 * The ledger's column track, shared by the heading strip and every row so the
 * two cannot drift apart — the job a `<colgroup>` used to do.
 *
 * It is a grid rather than a table because the rows are virtualised: a
 * `<tbody>` cannot be sliced into a window without spacer rows, and a grid
 * row is a div like any other.
 */
function columnTemplate(showAccount: boolean) {
  return `minmax(12rem, 1fr) 9rem 9rem 12rem${
    showAccount ? ' 12rem' : ''
  } 7rem`
}

/** First guesses; every line reports its real height once it mounts. */
const giftRowHeight = 48
const giftGroupHeight = 37

type GiftLine =
  | { group: GiftGroup; kind: 'group' }
  | { kind: 'gift'; row: GiftRow }

function GiftsTable({
  groups,
  onSelect,
  showAccount,
}: {
  groups: Array<GiftGroup>
  onSelect: (row: GiftRow) => void
  showAccount: boolean
}) {
  const { t } = useTranslation(['account-management'])

  const template = columnTemplate(showAccount)

  /*
   * Groups and their gifts, flattened into the one list the virtualiser
   * windows. A day heading is just another line.
   */
  const lines = useMemo(() => {
    const result: Array<GiftLine> = []

    groups.forEach((group) => {
      result.push({ group, kind: 'group' })
      group.rows.forEach((row) => result.push({ kind: 'gift', row }))
    })

    return result
  }, [groups])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[52rem]">
        {/*
          Not sticky: `overflow-x-auto` makes this wrapper a scroll container
          on both axes, and a sticky child of a container that never scrolls
          vertically simply scrolls away like anything else. The day headings
          are what keep you oriented on the way down.
        */}
        <div
          className="grid items-center gap-3 border-b border-border/60 bg-card/95 px-4 py-2.5"
          style={{ gridTemplateColumns: template }}
        >
          <span className="micro-label">
            {t('gifts-information.table.item')}
          </span>
          <span className="micro-label">
            {t('gifts-information.table.type')}
          </span>
          <span className="micro-label">
            {t('gifts-information.table.rarity')}
          </span>
          <span className="micro-label">
            {t('gifts-information.table.from')}
          </span>
          {showAccount && (
            <span className="micro-label">
              {t('gifts-information.table.account')}
            </span>
          )}
          <span className="micro-label text-right">
            {t('gifts-information.table.received')}
          </span>
        </div>

        <VirtualList
          count={lines.length}
          estimateSize={(index) =>
            lines[index].kind === 'group' ? giftGroupHeight : giftRowHeight
          }
          getKey={(index) => {
            const line = lines[index]

            return line.kind === 'group'
              ? `group:${line.group.key}`
              : line.row.key
          }}
          renderLine={(index) => {
            const line = lines[index]

            if (line.kind === 'group') {
              return (
                <div className="flex flex-wrap items-center gap-2 border-y border-border/40 bg-surface/60 px-4 py-2">
                  <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-semibold">
                    {line.group.label}
                  </span>
                  <Chip>
                    {t('gifts-information.table.items', {
                      total: line.group.count,
                    })}
                  </Chip>
                  {line.group.meta && (
                    <span className="micro-label">{line.group.meta}</span>
                  )}
                </div>
              )
            }

            return (
              <GiftTableRow
                onSelect={onSelect}
                row={line.row}
                showAccount={showAccount}
                template={template}
              />
            )
          }}
        />
      </div>
    </div>
  )
}

const GiftTableRow = memo(function GiftTableRow({
  onSelect,
  row,
  showAccount,
  template,
}: {
  onSelect: (row: GiftRow) => void
  row: GiftRow
  showAccount: boolean
  template: string
}) {
  const accent = rarityAccent(row.cosmetic.rarity)
  const time = formatGiftDate(row.date, 'h:mm A')

  return (
    <div
      className="grid cursor-pointer items-center gap-3 border-b border-border/30 px-4 py-2 text-[0.8125rem] transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
      onClick={() => onSelect(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(row)
        }
      }}
      role="button"
      style={{ gridTemplateColumns: template }}
      tabIndex={0}
    >
      <span className="flex min-w-0 items-center gap-3">
        <CosmeticArt
          accent={accent}
          cosmetic={row.cosmetic}
        />
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {row.cosmetic.name}
          </span>
          <span className="block truncate text-[0.6875rem] text-muted-foreground">
            {row.cosmetic.templateId}
          </span>
        </span>
      </span>
      <span className="truncate text-muted-foreground">
        {row.cosmetic.type ?? '—'}
      </span>
      <RarityLabel rarity={row.cosmetic.rarity} />
      <span className="truncate">{row.senderName}</span>
      {showAccount && (
        <span className="truncate text-muted-foreground">
          {row.accountName}
        </span>
      )}
      <span className="text-right tabular-nums text-muted-foreground">
        {time ?? '—'}
      </span>
    </div>
  )
})

function CosmeticArt({
  accent,
  className,
  cosmetic,
}: {
  accent: string | null
  className?: string
  cosmetic: GiftsInformationCosmetic
}) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40',
        className
      )}
      style={
        accent
          ? {
              borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            }
          : { borderColor: 'hsl(var(--border) / 0.6)' }
      }
    >
      {cosmetic.image ? (
        <img
          alt=""
          className="size-full object-contain"
          decoding="async"
          loading="lazy"
          src={cosmetic.image}
        />
      ) : (
        <Gift className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}

function RarityLabel({ rarity }: { rarity: string | null }) {
  const accent = rarityAccent(rarity)

  if (!rarity) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent ?? 'hsl(var(--muted-foreground))' }}
      />
      <span
        className="truncate"
        style={accent ? { color: accent } : undefined}
      >
        {rarity}
      </span>
    </span>
  )
}

/**
 * The row's own art is 36px — enough to recognise a skin you already own and
 * not enough to look at one. The dialog is where the item is actually shown,
 * along with the ids you would otherwise have to go digging in a profile
 * dump for.
 */
function GiftDetailDialog({
  onClose,
  row,
}: {
  onClose: () => void
  row: GiftRow | null
}) {
  const { t } = useTranslation(['account-management'])

  const accent = row ? rarityAccent(row.cosmetic.rarity) : null
  const received = row
    ? formatGiftDate(row.date, 'dddd, MMMM D, YYYY · h:mm A')
    : null

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      open={row !== null}
    >
      <DialogContent className="max-w-xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-left">
                {row.cosmetic.name}
              </DialogTitle>
              <DialogDescription className="text-left">
                {t('gifts-information.detail.subtitle', {
                  sender: row.senderName,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 sm:flex-row">
              <span
                className="grid aspect-square w-full shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/30 sm:size-40"
                style={
                  accent
                    ? {
                        borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
                        backgroundImage: `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${accent} 28%, transparent), transparent 70%)`,
                      }
                    : undefined
                }
              >
                {row.cosmetic.image ? (
                  <img
                    alt={row.cosmetic.name}
                    className="size-full object-contain"
                    decoding="async"
                    src={row.cosmetic.image}
                  />
                ) : (
                  <Gift className="size-10 text-muted-foreground" />
                )}
              </span>

              <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 self-start">
                <KeyValue
                  label={t('gifts-information.table.type')}
                  value={row.cosmetic.type ?? '—'}
                />
                <KeyValue
                  label={t('gifts-information.table.rarity')}
                  value={<RarityLabel rarity={row.cosmetic.rarity} />}
                />
                <KeyValue
                  className="col-span-2"
                  label={t('gifts-information.table.received')}
                  value={received ?? t('gifts-information.detail.no-date')}
                />
                <KeyValue
                  className="col-span-2"
                  copyable
                  label={t('gifts-information.detail.sender-id')}
                  value={
                    <span className="truncate font-mono text-xs">
                      {row.senderId}
                    </span>
                  }
                />
                <KeyValue
                  className="col-span-2"
                  label={t('gifts-information.table.account')}
                  value={row.accountName}
                />
                <KeyValue
                  className="col-span-2"
                  copyable
                  label={t('gifts-information.detail.template-id')}
                  value={
                    <span className="truncate font-mono text-xs">
                      {row.cosmetic.templateId}
                    </span>
                  }
                />
                {row.cosmetic.cosmeticId && (
                  <KeyValue
                    className="col-span-2"
                    copyable
                    label={t('gifts-information.detail.cosmetic-id')}
                    value={
                      <span className="truncate font-mono text-xs">
                        {row.cosmetic.cosmeticId}
                      </span>
                    }
                  />
                )}
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
