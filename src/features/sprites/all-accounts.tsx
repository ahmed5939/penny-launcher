import type { SpritesAccountColumn } from '../../state/management/sprites-all'
import type { MatrixOwnership, SpriteMatrixCell, SpriteMatrixFamily } from './matrix'
import type { PickerOption } from '../../components/page'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ghost, Loader2, Star, Users } from 'lucide-react'

import { useSpritesAllStore } from '../../state/management/sprites-all'
import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'

import {
  Callout,
  EmptyState,
  FilterBar,
  Pager,
  Panel,
  PanelHeader,
  Picker,
  ProgressBar,
  SearchField,
  StatRow,
  StatTile,
  paginate,
} from '../../components/page'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip'

import { buildSpriteMatrix, filterSpriteMatrix } from './matrix'
import { rarityColour, SpriteArt } from './sprite-art'

import { cn, parseCustomDisplayName } from '../../lib/utils'

const ownershipOptions: Array<PickerOption<MatrixOwnership>> = [
  { value: 'all', label: 'Every sprite' },
  { value: 'none', label: 'Owned by none' },
  { value: 'some', label: 'Owned by some' },
  { value: 'every', label: 'Owned by all' },
  { value: 'lost', label: 'Lost somewhere' },
]

const rarityWords = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

/** Families per page: a page stays around a screen of treatments. */
const pageSize = 10

type Column = {
  accountId: string
  name: string
  column: SpritesAccountColumn | null
}

/**
 * Every linked account's sprites in one grid: a row per treatment, grouped
 * under its creature, a column per account. The point is the questions one
 * account's page cannot answer — which sprite nobody has yet, which one is
 * only on the alt, where a lost one could be recovered from.
 *
 * The sweep is the main process reading each account in turn, so columns
 * fill in as accounts land and a failed account is a mark on its column,
 * not a failed page.
 */
export function AllAccountsTab() {
  const { accountsArray, idsList } = useGetAccounts()
  const { selected } = useGetSelectedAccount()
  const { catalogueError, columns, landed, request, running, sweepId, total } =
    useSpritesAllStore()

  const [ownership, setOwnership] = useState<MatrixOwnership>('all')
  const [rarity, setRarity] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  // First visit this session: read everything once. Refresh reads again.
  useEffect(() => {
    if (!sweepId && !running && accountsArray.length > 0) {
      request(false)
    }
  }, [])

  /*
   * Columns follow the title bar's account order, so the grid reads like
   * the switcher; an account the sweep saw but the list no longer has is
   * kept at the end until the next sweep.
   */
  const accountColumns = useMemo<Array<Column>>(() => {
    const byId = new Map(accountsArray.map((account) => [account.accountId, account]))
    const ordered = idsList.filter((id) => byId.has(id))
    const extra = Object.keys(columns).filter((id) => !byId.has(id))

    return [...ordered, ...extra].map((accountId) => {
      const account = byId.get(accountId)

      return {
        accountId,
        name: account
          ? parseCustomDisplayName(account)
          : (columns[accountId]?.displayName ?? 'Unlinked account'),
        column: columns[accountId] ?? null,
      }
    })
  }, [accountsArray, idsList, columns])

  const matrix = useMemo(
    () =>
      buildSpriteMatrix(
        accountColumns.flatMap(({ accountId, column }) =>
          column?.collection ? [{ accountId, collection: column.collection }] : []
        )
      ),
    [accountColumns]
  )

  const filtered = useMemo(
    () => filterSpriteMatrix(matrix, { ownership, query, rarity }),
    [matrix, ownership, query, rarity]
  )
  const shown = paginate(filtered, page, pageSize)
  const shownRows = filtered.reduce((sum, family) => sum + family.rows.length, 0)

  const rarityOptions = useMemo<Array<PickerOption>>(
    () => [
      { value: 'all', label: 'All rarities' },
      ...rarityWords
        .filter((word) => matrix.families.some((family) => family.rarity === word))
        .map((word) => ({
          value: word,
          label: word.charAt(0).toUpperCase() + word.slice(1),
        })),
    ],
    [matrix]
  )

  const resetPage = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPage(0)
  }

  if (accountColumns.length === 0) {
    return (
      <EmptyState
        description="Link an account and its sprites appear here beside every other account's."
        icon={Users}
        title="No accounts linked"
      />
    )
  }

  const { totals } = matrix
  const reading = Math.min(total, landed.length + 1)

  return (
    <>
      <StatRow>
        <StatTile
          hint={`of ${totals.sprites.toLocaleString()} released`}
          label="Owned on any account"
          value={totals.ownedAnywhere.toLocaleString()}
        />
        <StatTile
          hint={
            totals.lostAnywhere > 0
              ? `${totals.lostAnywhere.toLocaleString()} ${totals.lostAnywhere === 1 ? 'sprite' : 'sprites'} lost somewhere`
              : 'Nothing waiting to be recovered'
          }
          label="Lost across accounts"
          tone={totals.lostPairs > 0 ? 'warning' : 'default'}
          value={totals.lostPairs.toLocaleString()}
        />
        <StatTile
          hint={
            totals.dust === null
              ? 'No account reported a balance'
              : totals.dustUnknown > 0
                ? `${totals.dustUnknown.toLocaleString()} ${totals.dustUnknown === 1 ? 'account' : 'accounts'} did not report a balance`
                : 'Every account counted'
          }
          label="Sprite Dust across accounts"
          value={totals.dust === null ? 'Unavailable' : totals.dust.toLocaleString()}
        />
      </StatRow>

      {catalogueError && (
        <Callout
          title="Summon costs are unavailable"
          tone="warning"
        >
          Could not read Epic’s sprite catalogue ({catalogueError}). Ownership is
          still accurate; try Refresh for costs.
        </Callout>
      )}

      <Panel>
        <PanelHeader
          actions={
            <span className="text-xs text-muted-foreground">
              <span className="figure">{shownRows.toLocaleString()}</span>
              {' of '}
              <span className="figure">{totals.sprites.toLocaleString()}</span>
              {' sprites'}
            </span>
          }
          compact
          title="Every account"
        />
        <FilterBar className="px-4">
          <SearchField
            label="Search sprites"
            onChange={resetPage(setQuery)}
            placeholder="Search by name, treatment or ability"
            value={query}
          />
          <Picker
            label="Ownership"
            onChange={resetPage(setOwnership)}
            options={ownershipOptions}
            value={ownership}
          />
          <Picker
            label="Rarity"
            onChange={resetPage(setRarity)}
            options={rarityOptions}
            value={rarity}
          />
        </FilterBar>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          {running && (
            <div
              className="flex min-w-48 flex-1 items-center gap-3 text-xs text-muted-foreground"
              role="status"
            >
              <span className="shrink-0">
                {total > 0
                  ? `Reading ${reading.toLocaleString()} of ${total.toLocaleString()} accounts…`
                  : 'Starting…'}
              </span>
              <ProgressBar
                className="max-w-48"
                label="Accounts read"
                total={total}
                value={landed.length}
              />
            </div>
          )}
          <Legend />
        </div>

        {matrix.readCount === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description={
              running
                ? 'Each account is read with its own sign-in, one after another. Results appear as they land.'
                : 'No account could be read. Check the marks on the account names, then try Refresh.'
            }
            icon={Ghost}
            title={running ? 'Reading your accounts…' : 'Nothing read yet'}
          />
        ) : shown.items.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description="Nothing matches these filters."
            icon={Ghost}
            title="Nothing to show"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-ui">
              <thead>
                <tr>
                  <th
                    className="px-4 py-2 text-left font-normal"
                    colSpan={2}
                    scope="col"
                  >
                    <span className="micro-label">Sprite</span>
                  </th>
                  {accountColumns.map((column) => (
                    <AccountHead
                      column={column}
                      key={column.accountId}
                      selected={column.accountId === selected?.accountId}
                    />
                  ))}
                </tr>
              </thead>
              {shown.items.map((family) => (
                <FamilyRows
                  columns={accountColumns}
                  family={family}
                  key={family.family}
                  selectedId={selected?.accountId ?? null}
                />
              ))}
            </table>
          </div>
        )}

        <Pager
          onPageChange={setPage}
          page={shown.page}
          pageSize={pageSize}
          total={filtered.length}
        />
      </Panel>
    </>
  )
}

function AccountHead({
  column,
  selected,
}: {
  column: Column
  selected: boolean
}) {
  const state = column.column?.state ?? null
  const collection = column.column?.collection ?? null

  return (
    <th
      className={cn(
        'w-20 min-w-20 max-w-24 px-1 py-2 align-bottom font-normal',
        selected && 'bg-primary/5'
      )}
      scope="col"
    >
      <span className="flex flex-col items-center gap-0.5">
        <span className="flex max-w-full items-center gap-1">
          <span
            className={cn('truncate text-xs font-semibold', selected && 'text-primary')}
            title={column.name}
          >
            {column.name}
          </span>
          {state === 'reading' && (
            <Loader2
              aria-label="Reading"
              className="size-3 shrink-0 animate-spin text-muted-foreground"
            />
          )}
          {state === 'failed' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={`Could not read ${column.name}: ${column.column?.errorMessage ?? 'unknown error'}`}
                  className="inline-flex"
                  role="img"
                  tabIndex={0}
                >
                  <AlertTriangle className="size-3 shrink-0 text-warning" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Could not read this account
                {collection ? ', so this column shows its last good read' : ''}:{' '}
                {column.column?.errorMessage ?? 'unknown error'}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="figure text-2xs text-muted-foreground">
          {collection
            ? `${collection.ownedVariants.toLocaleString()} / ${collection.totalVariants.toLocaleString()}`
            : state === 'reading'
              ? 'Reading…'
              : 'Not read'}
        </span>
      </span>
    </th>
  )
}

function FamilyRows({
  columns,
  family,
  selectedId,
}: {
  columns: Array<Column>
  family: SpriteMatrixFamily
  selectedId: string | null
}) {
  const colour = rarityColour(family.rarity)

  return (
    <tbody>
      {family.rows.map((row, index) => (
        <tr
          className="hover:bg-accent/20"
          key={row.key}
        >
          {index === 0 && (
            <th
              className="w-44 border-t border-border/40 px-4 py-2 text-left align-top font-normal"
              rowSpan={family.rows.length}
              scope="rowgroup"
            >
              <span className="flex items-center gap-3">
                <SpriteArt
                  iconFile={family.iconFile}
                  rarity={family.rarity}
                  size="md"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {family.name}
                  </span>
                  <span
                    className="block text-xs capitalize"
                    style={colour ? { color: colour } : undefined}
                  >
                    {family.rarity}
                  </span>
                </span>
              </span>
            </th>
          )}
          <th
            className={cn(
              'px-2 py-1 text-left font-normal',
              index === 0 && 'border-t border-border/40'
            )}
            scope="row"
          >
            <span className="flex items-center gap-2 whitespace-nowrap">
              <SpriteArt
                dim={row.ownedBy === 0}
                iconFile={row.entry.iconFile}
                size="sm"
              />
              {row.entry.variantLabel}
            </span>
          </th>
          {columns.map((column) => (
            <td
              className={cn(
                'px-1 py-1 text-center',
                index === 0 && 'border-t border-border/40',
                column.accountId === selectedId && 'bg-primary/5'
              )}
              key={column.accountId}
            >
              <CellMark
                account={column.name}
                cell={row.cells[column.accountId] ?? null}
                sprite={
                  row.entry.variant === 'base'
                    ? family.name
                    : `${row.entry.variantLabel} ${family.name}`
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/**
 * One account's state for one sprite. Shape carries the state as well as
 * colour — a filled dot, a hollow ring, a faint speck — so the grid still
 * reads for anyone who cannot tell the tones apart.
 */
function CellMark({
  account,
  cell,
  sprite,
}: {
  account: string
  cell: SpriteMatrixCell | null
  sprite: string
}) {
  if (!cell) {
    return (
      <span className="text-xs text-muted-foreground/40">
        <span aria-hidden>·</span>
        <span className="sr-only">{`${sprite} on ${account}: not read`}</span>
      </span>
    )
  }

  const words = [
    cell.status === 'owned'
      ? 'owned'
      : cell.status === 'lost'
        ? 'lost — recoverable for Sprite Dust'
        : 'never secured',
    cell.mastered ? 'mastered' : null,
    cell.equipped ? 'equipped' : null,
  ]
    .filter(Boolean)
    .join(', ')
  const label = `${sprite} on ${account}: ${words}`

  return (
    <span
      className={cn(
        'inline-grid size-5 place-items-center rounded-full',
        cell.equipped && 'ring-1 ring-primary'
      )}
      title={label}
    >
      {cell.mastered && cell.status === 'owned' ? (
        <Star className="size-3.5 fill-success text-success" />
      ) : cell.status === 'owned' ? (
        <span className="size-2.5 rounded-full bg-success" />
      ) : cell.status === 'lost' ? (
        <span className="size-2.5 rounded-full border-2 border-warning" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/30" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-success" />
        Owned
      </span>
      <span className="flex items-center gap-1.5">
        <Star className="size-3 fill-success text-success" />
        Mastered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full border-2 border-warning" />
        Lost — recoverable
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-muted-foreground/30" />
        Never secured
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-full ring-1 ring-primary" />
        Equipped
      </span>
    </p>
  )
}
