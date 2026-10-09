import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { PickerOption } from '../../components/page'
import type { LlamaPreview, OpenLlamasProgress, PackType, RecycleChoice } from './model'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PackageOpen } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { ItemIcon } from '../../components/items/item-icon'
import {
  AccountResourceGate,
  Callout,
  Chip,
  EmptyState,
  FieldGroup,
  FieldRow,
  FilterBar,
  ListRow,
  PageHeader,
  Pager,
  Panel,
  PanelBody,
  PanelHeader,
  Picker,
  ProgressBar,
  RefreshButton,
  SearchField,
  StatRow,
  StatTile,
  ToolBadges,
  paginate,
  useAccountResource,
} from '../../components/page'

import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'
import { useAccountListStore } from '../../state/accounts/list'
import { getItemRecord, useItemDatabaseStore } from '../../state/items/database'
import { defaultChoices, listenForOpenLlamas, toggleExcluded, useOpenLlamasStore } from '../../state/stw-operations/open-llamas'
import { toast } from '../../lib/notifications'
import { cn } from '../../lib/utils'

import { includedTypeIds, isRunActive, parseOpenCount, planOpening, recycleChoices, selectableTypes, selectedPackCount, shortfallMessage } from './model'

const PAGE_SIZE = 10

const recycleOptions: ReadonlyArray<PickerOption<RecycleChoice>> = recycleChoices.map((choice) => ({ value: choice.value, label: choice.label }))

async function loadPreview(accountId: string) {
  const result = await window.electronAPI.requestLlamaPreview(accountId)
  if (!result.ok) throw new Error(result.error)
  return result.preview
}

/** The game's name for a pack, or its id made readable when the database has none. */
function packName(templateId: string, records: ItemRecordMap) {
  return (
    getItemRecord(records, templateId)?.name ??
    templateId
      .replace(/^CardPack:/, '')
      .replace(/^cardpack_/i, '')
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  )
}

export function OpenLlamasPage() {
  const { t } = useTranslation(['sidebar'])
  useRequestItemDatabase()
  useEffect(listenForOpenLlamas, [])

  const resource = useAccountResource(loadPreview, {
    fallbackError: "Could not read this account's llamas. Try Refresh.",
    owner: (preview) => preview.accountId,
  })
  const run = useOpenLlamasStore((state) => (resource.accountId ? state.runs[resource.accountId] : undefined))

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <RefreshButton
            disabled={!resource.accountId || isRunActive(run)}
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
        description="Open the llamas this account already owns. Choose the types, how many, and what to recycle."
        icon={PackageOpen}
        section={t('stw-operations.title')}
        status={<ToolBadges beta />}
        title={t('stw-operations.options.open-llamas')}
      />
      <AccountResourceGate
        icon={PackageOpen}
        loading={{ title: 'Loading llamas…', description: 'Counting unopened llamas.' }}
        resource={resource}
        what="this account's llamas"
      >
        {(preview) => (
          <OpenLlamas
            isRefreshing={resource.loading}
            key={preview.accountId}
            onRefresh={resource.refresh}
            preview={preview}
          />
        )}
      </AccountResourceGate>
    </div>
  )
}

/** Everything under the header for one account's preview. Exported for its tests. */
export function OpenLlamas({
  isRefreshing,
  onRefresh,
  preview,
}: {
  isRefreshing: boolean
  onRefresh: () => void
  preview: LlamaPreview
}) {
  const { accountId } = preview
  const records = useItemDatabaseStore((state) => state.records)
  const account = useAccountListStore((state) => state.accounts[accountId])
  const choices = useOpenLlamasStore((state) => state.choices[accountId]) ?? defaultChoices
  const updateChoices = useOpenLlamasStore((state) => state.updateChoices)
  const run = useOpenLlamasStore((state) => state.runs[accountId])
  const dismissRun = useOpenLlamasStore((state) => state.dismissRun)

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [isStarting, setStarting] = useState(false)

  const isRunning = isRunActive(run)
  const isLocked = isRunning || isStarting

  // A run that just ended changed the inventory; read it again.
  const lastStatus = useRef(run?.status)
  useEffect(() => {
    if (isRunActive({ status: lastStatus.current ?? 'done' }) && run && !isRunActive(run)) onRefresh()
    lastStatus.current = run?.status
  }, [run?.status])

  const excluded = useMemo(() => new Set(choices.excluded), [choices.excluded])
  const included = useMemo(() => new Set(includedTypeIds(preview, excluded)), [preview, excluded])
  const selectable = selectableTypes(preview)
  const selected = selectedPackCount(preview, included)
  const count = parseOpenCount(choices.count, selected)
  const requested = count.ok ? count.value : null
  const plan = useMemo(
    () => planOpening(preview.stacks.filter((stack) => included.has(stack.templateId)), requested),
    [preview, included, requested]
  )
  const planProblem = count.ok && plan.total !== plan.target ? shortfallMessage(plan) : null
  const canOpen = count.ok && !planProblem && plan.total > 0 && !isLocked && !isRefreshing
  const isLimited = count.ok && count.value !== null

  const names = useMemo(() => {
    const byType = new Map(preview.types.map((type) => [type.templateId, packName(type.templateId, records)]))
    const seen = new Map<string, number>()
    byType.forEach((name) => seen.set(name, (seen.get(name) ?? 0) + 1))
    return { byType, collides: (name: string) => (seen.get(name) ?? 0) > 1 }
  }, [preview.types, records])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? preview.types.filter((type) => `${names.byType.get(type.templateId) ?? ''} ${type.templateId}`.toLowerCase().includes(needle))
    : preview.types
  const paged = paginate(visible, page, PAGE_SIZE)

  // Any change to what Open would do disarms the confirmation.
  const actionKey = [[...included].join('|'), count.ok ? count.value : 'x', choices.recycle, preview.previewId].join('/')
  const isConfirming = confirmKey === actionKey

  const setIncluded = (templateId: string, include: boolean) =>
    updateChoices(accountId, { excluded: toggleExcluded(choices.excluded, templateId, include) })

  const handleOpen = async () => {
    if (!canOpen) return
    if (!isConfirming) {
      setConfirmKey(actionKey)
      return
    }

    setConfirmKey(null)
    setStarting(true)

    try {
      const result = await window.electronAPI.startOpenLlamas({
        accountId,
        previewId: preview.previewId,
        templateIds: [...included],
        count: requested,
        recycle: choices.recycle,
      })

      if (!result.ok) {
        toast.error(result.error)
        onRefresh()
      }
    } catch {
      toast.error('Could not start opening. Refresh and try again.')
    } finally {
      setStarting(false)
    }
  }

  const packs = (value: number) => `${value.toLocaleString()} ${value === 1 ? 'pack' : 'packs'}`
  const recycles = choices.recycle !== 'none'

  return (
    <>
      <StatRow>
        <StatTile
          label="Unopened packs"
          value={preview.total.toLocaleString()}
        />
        <StatTile
          label="Selected packs"
          value={
            <>
              {selected.toLocaleString()}
              <span className="text-muted-foreground"> / {preview.total.toLocaleString()}</span>
            </>
          }
        />
        <StatTile
          label="Llama types"
          value={preview.types.length.toLocaleString()}
        />
      </StatRow>

      {run && (
        <RunPanel
          onDismiss={() => dismissRun(accountId)}
          onStop={() => void window.electronAPI.cancelOpenLlamas(accountId)}
          run={run}
        />
      )}

      {preview.total <= 0 ? (
        <EmptyState
          description="Llamas you earn or buy show up here until they are opened."
          icon={PackageOpen}
          title="No unopened llamas"
        />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel>
            <PanelHeader
              actions={
                <span className="flex gap-1">
                  <Button
                    disabled={isLocked || included.size === selectable.length}
                    onClick={() => updateChoices(accountId, { excluded: [] })}
                    size="sm"
                    variant="ghost"
                  >
                    Select all types
                  </Button>
                  <Button
                    disabled={isLocked || included.size === 0}
                    onClick={() => updateChoices(accountId, { excluded: selectable.map((type) => type.templateId) })}
                    size="sm"
                    variant="ghost"
                  >
                    Clear selection
                  </Button>
                </span>
              }
              compact
              icon={PackageOpen}
              title="Llama types to open"
            />
            {preview.types.length > PAGE_SIZE && (
              <FilterBar>
                <SearchField
                  label="Search llama types"
                  onChange={(value) => {
                    setQuery(value)
                    setPage(0)
                  }}
                  placeholder="Search llama types"
                  value={query}
                />
              </FilterBar>
            )}
            {paged.items.length > 0 ? (
              <ul className="divide-y divide-border/40">
                {paged.items.map((type) => (
                  <TypeRow
                    collides={names.collides(names.byType.get(type.templateId) ?? '')}
                    disabled={isLocked}
                    included={included.has(type.templateId)}
                    key={type.templateId}
                    name={names.byType.get(type.templateId) ?? type.templateId}
                    onChange={(include) => setIncluded(type.templateId, include)}
                    planned={isLimited ? (plan.perType[type.templateId] ?? 0) : null}
                    records={records}
                    type={type}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                className="border-0 bg-transparent py-8"
                description="Try another name."
                icon={PackageOpen}
                title="No llama types match"
              />
            )}
            <Pager
              onPageChange={setPage}
              page={paged.page}
              pageSize={PAGE_SIZE}
              total={visible.length}
            />
          </Panel>

          <Panel>
            <PanelHeader
              compact
              title="Open"
            />
            <PanelBody className="space-y-4">
              <FieldGroup>
                <FieldRow label="Account">
                  <span className="text-ui font-medium">
                    {account?.customDisplayName || account?.displayName || accountId}
                  </span>
                </FieldRow>
                <FieldRow
                  hint="Recycling permanently removes matching new rewards. Mythic, favourite, assigned and quest items are always kept."
                  label="Auto Recycle"
                  stacked
                >
                  <Picker
                    className="w-full"
                    disabled={isLocked}
                    label="Auto Recycle"
                    onChange={(recycle) => updateChoices(accountId, { recycle })}
                    options={recycleOptions}
                    value={choices.recycle}
                  />
                </FieldRow>
                <FieldRow
                  hint={
                    count.ok && !planProblem
                      ? count.value === null
                        ? `Blank opens all ${selected.toLocaleString()} selected ${selected === 1 ? 'pack' : 'packs'}.`
                        : 'Opens in type order, then pack order.'
                      : undefined
                  }
                  label="Number to open"
                  stacked
                >
                  <Input
                    aria-invalid={!count.ok || planProblem !== null}
                    aria-label="Number to open"
                    className="h-8"
                    disabled={isLocked}
                    inputMode="numeric"
                    onChange={(event) => updateChoices(accountId, { count: event.target.value })}
                    placeholder={`All selected (${selected.toLocaleString()})`}
                    value={choices.count}
                  />
                  {(!count.ok || planProblem) && (
                    <div role="alert">
                      <Callout
                        className="py-2"
                        tone="warning"
                      >
                        {count.ok ? planProblem : count.message}
                      </Callout>
                    </div>
                  )}
                </FieldRow>
              </FieldGroup>
              <Button
                className="w-full"
                disabled={!canOpen}
                onClick={() => void handleOpen()}
                variant={isConfirming ? 'destructive' : 'default'}
              >
                <PackageOpen className="size-4" />
                {isStarting
                  ? 'Starting…'
                  : isConfirming
                    ? `Confirm — opens ${packs(plan.total)}${recycles ? ' and recycles' : ''}`
                    : `Open ${packs(count.ok && !planProblem ? plan.total : 0)}`}
              </Button>
            </PanelBody>
          </Panel>
        </div>
      )}
    </>
  )
}

function TypeRow({
  collides,
  disabled,
  included,
  name,
  onChange,
  planned,
  records,
  type,
}: {
  collides: boolean
  disabled: boolean
  included: boolean
  name: string
  onChange: (include: boolean) => void
  /** Packs of this type the limited plan opens; null when opening all. */
  planned: number | null
  records: ItemRecordMap
  type: PackType
}) {
  const choiceOnly = type.openable <= 0
  const choiceCount = type.quantity - type.openable
  const caption = [
    collides ? type.templateId.replace(/^CardPack:/, '') : null,
    choiceOnly ? 'Pick a reward in game to open these' : choiceCount > 0 ? `${choiceCount.toLocaleString()} need a choice in game and are left` : null,
    included && planned !== null ? `Opens ${planned.toLocaleString()} of ${type.openable.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={cn('flex items-center gap-3 px-4 py-2', !included && 'opacity-70')}
      title={type.templateId}
    >
      <Checkbox
        aria-label={`Include ${name}`}
        checked={included && !choiceOnly}
        disabled={disabled || choiceOnly}
        onCheckedChange={onChange}
      />
      <ul className="min-w-0 flex-1">
        <ListRow
          caption={caption || undefined}
          figure={`×${type.quantity.toLocaleString()}`}
          name={name}
          well={
            <ItemIcon
              records={records}
              templateId={type.templateId}
              title={name}
            />
          }
        />
      </ul>
      <Chip tone={choiceOnly ? 'warning' : included ? 'accent' : 'neutral'}>
        {choiceOnly ? 'Needs a choice' : included ? 'Included' : 'Excluded'}
      </Chip>
    </li>
  )
}

const runTitles: Record<OpenLlamasProgress['status'], string> = {
  waiting: 'Starting…',
  running: 'Opening llamas…',
  done: 'Llamas opened',
  cancelled: 'Stopped',
  stopped: 'Stopped early',
  failed: 'Could not open llamas',
}

/** One panel, updated in place. Totals only — never a list of rewards. */
function RunPanel({
  onDismiss,
  onStop,
  run,
}: {
  onDismiss: () => void
  onStop: () => void
  run: OpenLlamasProgress
}) {
  const isRunning = isRunActive(run)

  return (
    <Panel aria-live="polite">
      <PanelHeader
        actions={
          isRunning ? (
            <Button
              disabled={run.cancelRequested}
              onClick={onStop}
              size="sm"
              variant="outline"
            >
              {run.cancelRequested ? 'Stopping…' : 'Stop'}
            </Button>
          ) : (
            <Button
              onClick={onDismiss}
              size="sm"
              variant="ghost"
            >
              Close
            </Button>
          )
        }
        compact
        icon={PackageOpen}
        title={runTitles[run.status]}
      />
      <PanelBody className="space-y-3">
        <ProgressBar
          label="Packs opened"
          total={run.target}
          value={run.opened}
        />
        <ul>
          <ListRow
            className="py-1"
            figure={`${run.opened.toLocaleString()} / ${run.target.toLocaleString()}`}
            name="Packs opened"
          />
          <ListRow
            className="py-1"
            figure={run.recycled.toLocaleString()}
            name="Items recycled"
          />
          <ListRow
            className="py-1"
            figure={run.kept.toLocaleString()}
            name="Items not recycled"
          />
          <ListRow
            className="py-1"
            figure={run.packsLeft === null ? 'Unavailable' : run.packsLeft.toLocaleString()}
            name="Packs left on account"
          />
        </ul>
        <p className="text-xs text-muted-foreground">
          Items leave out resources such as XP. Packs left counts every type, excluded ones too.
        </p>
        {run.cancelRequested && isRunning && (
          <p className="text-xs text-muted-foreground">Finishing the current request, then stopping.</p>
        )}
        {run.message && (
          <div role="alert">
            <Callout tone={run.status === 'failed' ? 'danger' : 'warning'}>{run.message}</Callout>
          </div>
        )}
        {run.uncertain && (
          <Callout
            title="Not confirmed"
            tone="warning"
          >
            {run.uncertain}
          </Callout>
        )}
      </PanelBody>
    </Panel>
  )
}
