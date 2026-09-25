import type {
  AutoExpeditionConfig,
  AutoExpeditionsData,
} from '../../../kernel/startup/auto-expeditions'
import type {
  ExpeditionsPayload,
  ExpeditionSlot,
} from '../../../kernel/core/expeditions'
import type { AccountData } from '../../../types/accounts'
import type { ReactNode } from 'react'
import type { SelectOption } from '../../../components/ui/third-party/extended/input-tags'

import { CheckCheck, Clock3, Compass, PackageOpen, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'

import { ExpeditionArt, ExpeditionHistory, categoryArt } from '../../../features/expeditions/history'
import { ArtToggle, RecycleCeilingPicker } from '../../../features/automation-rewards/view'
import { expeditionKind, rewardTypes } from '../../../features/expeditions/model'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { Switch } from '../../../components/ui/switch'
import { Button } from '../../../components/ui/button'
import {
  AccountResourceGate,
  Callout,
  Chip,
  EmptyState,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
  RefreshButton,
  StatRow,
  StatTile,
  useAccountResource,
} from '../../../components/page'
import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'
import { useMinuteClock } from '../../-index/-home/-dashboard-hooks'
import { formatCountdown } from '../../-index/-home/-dashboard-model'
import { cn } from '../../../lib/utils'

/** The board is re-read this often while the page is open. */
const REFRESH_INTERVAL_MS = 60_000
/** How long to wait for every account's board before giving up on the stragglers. */
const REPLY_TIMEOUT_MS = 60_000

/**
 * The expeditions IPC is fire-and-forget: one request for many accounts, then
 * one reply per account on a shared channel. This gathers the replies for the
 * accounts asked about into a single payload, so the page can load through
 * `useAccountResource`. The listener is registered before the request goes
 * out, so a fast reply cannot be missed.
 *
 * The IPC still takes whole account records; they are resolved from ids at
 * call time, so a refreshed token is always the current one.
 */
function loadExpeditionBoards(accounts: Array<AccountData>) {
  return new Promise<ExpeditionsPayload>((resolve, reject) => {
    const pending = new Set(accounts.map((account) => account.accountId))
    const result: ExpeditionsPayload = {}

    const listener = window.electronAPI.responseExpeditions(async (response) => {
      for (const [accountId, entry] of Object.entries(response)) {
        if (!pending.has(accountId)) continue
        result[accountId] = entry
        pending.delete(accountId)
      }
      if (pending.size === 0) finish()
    })
    const timer = window.setTimeout(() => {
      for (const accountId of pending) {
        result[accountId] = { accountId, errorMessage: 'Epic did not answer in time.', slots: [] }
      }
      finish()
    }, REPLY_TIMEOUT_MS)

    function finish() {
      window.clearTimeout(timer)
      listener.removeListener()
      const entries = Object.values(result)
      // Every account failed: that is a failed load, not a page of errors.
      if (entries.length > 0 && entries.every((entry) => entry.errorMessage)) {
        reject(new Error(`${entries[0].errorMessage}. Try Refresh.`))
      } else {
        resolve(result)
      }
    }

    if (pending.size === 0) finish()
    else window.electronAPI.requestExpeditions(accounts)
  })
}

type UpdateConfig = (accountId: string, partial: Partial<AutoExpeditionConfig>) => Promise<void>

const offConfig: AutoExpeditionConfig = { enabled: false, rewardTypes: [] }

/** Auto-expedition settings for every account, polled because the automation writes them in the background. */
function useAutoExpeditionConfigs() {
  const [configs, setConfigs] = useState<AutoExpeditionsData>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () =>
      window.electronAPI
        .getAutoExpeditionsStatus()
        .then((data) => { if (active) { setConfigs(data); setError('') } })
        .catch(() => { if (active) setError('Could not load auto-expedition settings.') })
    void refresh()
    const timer = setInterval(refresh, 10_000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const update = useCallback<UpdateConfig>(async (accountId, partial) => {
    try {
      setConfigs(await window.electronAPI.updateAutoExpeditions(accountId, partial))
      setError('')
    } catch {
      setError('Could not save auto-expedition settings. Try again.')
    }
  }, [])

  return { configs, error, update }
}

export function RouteComponent() {
  useRequestItemDatabase()
  const { t } = useTranslation(['sidebar'])
  const { getAccounts, parsedSelectedAccounts } = useAccountSelectorData()
  const scopeKey = parsedSelectedAccounts.map((account) => account.value).join(',')
  const auto = useAutoExpeditionConfigs()
  /*
   * Auto-expeditions are nudged once per scope, before its first board load —
   * not on every refresh, because starting them can send expeditions.
   */
  const ensuredScope = useRef<string | null>(null)

  const resource = useAccountResource(
    async () => {
      const accounts = getAccounts()
      if (ensuredScope.current !== scopeKey) {
        ensuredScope.current = scopeKey
        await window.electronAPI
          .ensureAutoExpeditionsStarted(accounts.map((account) => account.accountId))
          .catch(() => undefined)
      }
      return loadExpeditionBoards(accounts)
    },
    {
      cacheKey: 'stw.expeditions',
      deps: [scopeKey],
      fallbackError: 'Could not load expeditions. Try Refresh.',
    }
  )
  const { refresh } = resource

  useEffect(() => {
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <RefreshButton
            disabled={!resource.accountId}
            loading={resource.loading}
            onClick={refresh}
          />
        }
        description="What is out, what is back, and what auto-expeditions will send next."
        icon={Compass}
        section={t('groups.automate')}
        title={t('stw-operations.options.expeditions')}
      />
      {parsedSelectedAccounts.length === 0 ? (
        <EmptyState
          description="Select at least one account in the title bar to see its expeditions."
          icon={Compass}
          title="Choose an account"
        />
      ) : (
        <>
          {/* The board first: what is out and what is back is why you open
              this page. Automation settings and history come after. */}
          <AccountResourceGate
            icon={Compass}
            loading={{
              title: 'Loading expeditions…',
              description: 'Reading the expedition board for each selected account.',
            }}
            resource={resource}
            what="expeditions"
          >
            {(data) => (
              <ExpeditionBoard
                accounts={parsedSelectedAccounts}
                configs={auto.configs}
                data={data}
                update={auto.update}
              />
            )}
          </AccountResourceGate>

          {auto.error && <div role="alert"><Callout tone="danger">{auto.error}</Callout></div>}

          <AutoExpeditionSettings accounts={parsedSelectedAccounts} configs={auto.configs} update={auto.update} />

          {parsedSelectedAccounts.map((account) => (
            <ExpeditionHistory
              history={auto.configs[account.value]?.history ?? []}
              key={account.value}
              title={parsedSelectedAccounts.length > 1 ? `Expedition history · ${account.label}` : 'Expedition history'}
            />
          ))}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Auto-expeditions run when rewards return, otherwise hourly, while Penny Launcher is open. Teams keep heroes that are already busy and must meet the vehicle, criteria and power. Recycling touches only confirmed new Hero, Survivor, Defender and Schematic rewards up to the chosen rarity; favourites, assigned items, Legendary and Mythic are always kept.
          </p>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ settings */

function AutoExpeditionSettings({
  accounts,
  configs,
  update,
}: {
  accounts: Array<SelectOption>
  configs: AutoExpeditionsData
  update: UpdateConfig
}) {
  return (
    <Panel>
      <PanelHeader compact icon={WandSparkles} title="Auto-expeditions" />

      <ul className="divide-y divide-border/50">
        {accounts.map((account) => {
          const config = configs[account.value] ?? offConfig
          const allSelected = rewardTypes.every((type) => config.rewardTypes.includes(type))

          return (
            <li className="space-y-3 px-4 py-3.5" key={account.value}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Switch
                  aria-label={`Auto-expeditions for ${account.label}`}
                  checked={config.enabled}
                  onCheckedChange={(enabled) => void update(account.value, { enabled })}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-ui font-semibold">{account.label}</span>
                    {config.lastError ? (
                      <Chip tone="danger">Last run failed</Chip>
                    ) : config.enabled ? (
                      <Chip tone="success">On</Chip>
                    ) : (
                      <Chip>Off</Chip>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {config.lastActivity
                      ? `Last run ${dayjs(config.lastActivity).fromNow()} · collected ${config.lastCollected ?? 0}, sent ${config.lastSent ?? 0}`
                      : 'No automatic runs yet'}
                    {config.enabled && config.nextRunAt ? ` · next ${dayjs(config.nextRunAt).fromNow()}` : ''}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Notify
                  <Switch
                    aria-label={`Notify for ${account.label}`}
                    checked={config.notificationsEnabled !== false}
                    onCheckedChange={(notificationsEnabled) => void update(account.value, { notificationsEnabled })}
                  />
                </label>
              </div>

              {config.lastError ? (
                <Callout tone="danger">{config.lastError}</Callout>
              ) : null}

              {/* What to send, as the game's art rather than a row of text buttons. */}
              <div className="flex flex-wrap items-center gap-2">
                {rewardTypes.map((type) => {
                  const selected = config.rewardTypes.includes(type)

                  return (
                    <ArtToggle
                      art={categoryArt[type]}
                      key={type}
                      label={type}
                      onChange={() =>
                        void update(account.value, {
                          rewardTypes: selected
                            ? config.rewardTypes.filter((item) => item !== type)
                            : [...config.rewardTypes, type],
                        })
                      }
                      pressed={selected}
                    />
                  )
                })}
                <Button
                  disabled={allSelected}
                  onClick={() => void update(account.value, { rewardTypes: [...rewardTypes] })}
                  size="sm"
                  variant="ghost"
                >
                  Select all
                </Button>
              </div>

              <FieldGroup>
                <FieldRow
                  className="py-0"
                  hint="Survivors includes lead survivors and people runs; Materials includes supply, crafting and resource runs."
                  label="Recycle new rewards"
                >
                  <RecycleCeilingPicker onChange={(recycleBelow) => void update(account.value, { recycleBelow })} value={config.recycleBelow ?? 'off'} />
                </FieldRow>
              </FieldGroup>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* --------------------------------------------------------------- board */

type StatusItem = {
  accountId: string
  accountName: string
  config: AutoExpeditionConfig
  slot: ExpeditionSlot
}

function ExpeditionBoard({
  accounts,
  configs,
  data,
  update,
}: {
  accounts: Array<SelectOption>
  configs: AutoExpeditionsData
  data: ExpeditionsPayload
  update: UpdateConfig
}) {
  const now = useMinuteClock()
  const names = Object.fromEntries(
    accounts.map((account) => [account.value, account.label])
  )
  const inScope = Object.values(data).filter((entry) => entry.accountId in names)
  const failed = inScope.filter((entry) => entry.errorMessage)
  const slots: Array<StatusItem> = inScope.flatMap((entry) =>
    entry.slots.map((slot) => ({
      accountId: entry.accountId,
      accountName: names[entry.accountId] ?? entry.accountId,
      config: configs[entry.accountId] ?? offConfig,
      slot,
    }))
  )
  const available = slots.filter((item) => item.slot.state === 'available')
  const running = slots
    .filter((item) => item.slot.state === 'in-flight')
    .sort((a, b) => Date.parse(a.slot.endTime ?? '') - Date.parse(b.slot.endTime ?? ''))
  const ready = slots.filter((item) => item.slot.state === 'ready')
  const multipleAccounts = accounts.length > 1
  const autoOn = accounts.filter((account) => configs[account.value]?.enabled).length

  return (
    <>
      {failed.length > 0 && (
        <Callout title="Some expedition boards could not be loaded" tone="warning">
          <ul className="space-y-0.5">
            {failed.map((entry) => (
              <li key={entry.accountId}>
                {names[entry.accountId] ?? entry.accountId}: {entry.errorMessage}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <StatRow>
        <StatTile label="Back" tone={ready.length > 0 ? 'success' : 'default'} value={ready.length} />
        <StatTile label="Out" value={running.length} />
        <StatTile label="To send" value={available.length} />
        <StatTile
          label="Auto-expeditions"
          tone={autoOn > 0 ? 'primary' : 'default'}
          value={multipleAccounts ? `${autoOn} / ${accounts.length}` : autoOn > 0 ? 'On' : 'Off'}
        />
      </StatRow>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <StatusColumn
          empty="No expeditions are waiting to be sent."
          icon={PackageOpen}
          items={available}
          title="To send"
        >
          {(item) => <AvailableRow item={item} multipleAccounts={multipleAccounts} now={now} update={update} />}
        </StatusColumn>
        <StatusColumn
          empty="No expeditions are out right now."
          icon={Clock3}
          items={running}
          title="Out"
        >
          {(item) => <RunningRow item={item} multipleAccounts={multipleAccounts} now={now} />}
        </StatusColumn>
        <StatusColumn
          empty="Nothing has come back yet."
          icon={CheckCheck}
          items={ready}
          title="Back"
        >
          {(item) => <ReadyRow item={item} multipleAccounts={multipleAccounts} />}
        </StatusColumn>
      </div>
    </>
  )
}

function StatusColumn({
  children,
  empty,
  icon,
  items,
  title,
}: {
  children: (item: StatusItem) => ReactNode
  empty: string
  icon: typeof Compass
  items: Array<StatusItem>
  title: string
}) {
  return (
    <Panel>
      <PanelHeader
        actions={<span className="figure text-ui font-semibold text-muted-foreground">{items.length}</span>}
        compact
        icon={icon}
        title={title}
      />
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => (
            <li className="flex gap-3 px-4 py-2.5" key={`${item.accountId}-${item.slot.itemId}`}>
              {children(item)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** "2 Epic heroes", "Soldier, Ninja" — what the team has to be. */
function criteriaText(slot: ExpeditionSlot) {
  if (slot.criteria.length === 0) return null
  const counts = new Map<string, number>()
  for (const { rarity, type } of slot.criteria) {
    const key = [rarity !== 'Any' && rarity, type || 'hero'].filter(Boolean).join(' ')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([key, n]) => (n > 1 ? `${n} × ${key}` : key)).join(', ')
}

function SlotRow({ caption, children, item, multipleAccounts, trailing }: { caption: Array<string | false | null | undefined>; children?: ReactNode; item: StatusItem; multipleAccounts: boolean; trailing?: ReactNode }) {
  return (
    <>
      <ExpeditionArt className="self-start" size="large" templateId={item.slot.templateId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-ui font-semibold leading-tight">{item.slot.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[
                // Only worth naming the account when the board mixes several.
                multipleAccounts && item.accountName,
                ...caption,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {trailing && <div className="shrink-0 text-right">{trailing}</div>}
        </div>
        {children}
      </div>
    </>
  )
}

function AvailableRow({ item, multipleAccounts, now, update }: { item: StatusItem; multipleAccounts: boolean; now: number; update: UpdateConfig }) {
  const { config, slot } = item
  const category = expeditionKind(slot.templateId).category
  const covered = config.enabled && config.rewardTypes.includes(category)
  const expiresIn = slot.expiresAt ? Date.parse(slot.expiresAt) - now : null

  return (
    <SlotRow
      caption={[`Tier ${slot.tier || '—'}`, slot.duration !== 'Unknown' && slot.duration, criteriaText(slot)]}
      item={item}
      multipleAccounts={multipleAccounts}
    >
      <div className="mt-2 flex items-center gap-2">
        {covered ? (
          <Chip tone="success">Auto-sends</Chip>
        ) : category ? (
          <Button
            className="h-6 px-2 text-xs"
            onClick={() =>
              void update(item.accountId, {
                enabled: true,
                rewardTypes: config.rewardTypes.includes(category) ? config.rewardTypes : [...config.rewardTypes, category],
              })
            }
            size="sm"
            title={`Turn on auto-expeditions for ${category.toLowerCase()} on ${item.accountName}`}
            variant="outline"
          >
            Auto-send {category.toLowerCase()}
          </Button>
        ) : null}
        {expiresIn !== null && expiresIn > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            Leaves in <span className="figure text-foreground">{formatCountdown(expiresIn)}</span>
          </span>
        )}
      </div>
    </SlotRow>
  )
}

function RunningRow({ item, multipleAccounts, now }: { item: StatusItem; multipleAccounts: boolean; now: number }) {
  const { slot } = item
  const end = slot.endTime ? Date.parse(slot.endTime) : null
  const total = slot.durationMinutes * 60_000
  const elapsed = end && total > 0 ? Math.max(0, total - (end - now)) : 0
  const chance = Math.round(slot.successChance * 100)

  return (
    <SlotRow
      caption={[`Tier ${slot.tier || '—'}`]}
      item={item}
      multipleAccounts={multipleAccounts}
      trailing={
        <>
          <p className="figure text-sm font-bold leading-tight">{end ? formatCountdown(end - now) : '—'}</p>
          {chance > 0 && (
            <p className={cn('figure mt-0.5 text-2xs font-semibold', chance >= 90 ? 'text-success' : chance < 60 ? 'text-warning' : 'text-muted-foreground')}>
              {chance}% success
            </p>
          )}
        </>
      }
    >
      {total > 0 && end && <ProgressBar className="mt-2" total={total} value={elapsed} />}
    </SlotRow>
  )
}

function ReadyRow({ item, multipleAccounts }: { item: StatusItem; multipleAccounts: boolean }) {
  const { config, slot } = item
  const chance = Math.round(slot.successChance * 100)

  return (
    <SlotRow
      caption={[`Tier ${slot.tier || '—'}`, chance > 0 && `${chance}% success`]}
      item={item}
      multipleAccounts={multipleAccounts}
      trailing={config.enabled ? <Chip tone="success">Collecting</Chip> : <Chip tone="warning">Auto off</Chip>}
    />
  )
}
