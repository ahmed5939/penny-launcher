import type { ItemRecordMap } from '../../../state/items/database'
import type {
  DailyRerollConfig,
  DailyRerollPreferences,
  DailyRerollStatus,
} from '../../../features/daily-reroll/policy'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, RefreshCw, ScrollText } from 'lucide-react'

import {
  Callout,
  Chip,
  EmptyState,
  FieldGroup,
  FieldRow,
  FilterBar,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RefreshButton,
  SearchField,
} from '../../../components/page'
import { ItemIcon } from '../../../components/items/item-icon'
import { Switch } from '../../../components/ui/switch'
import { Button } from '../../../components/ui/button'
import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { useItemDatabaseStore } from '../../../state/items/database'
import { questRewardAmount } from '../../../config/constants/fortnite/accolade-xp'
import { dailyResetLocalTime } from '../../-index/-home/-dashboard-model'
import { cn } from '../../../lib/utils'

type Quest = DailyRerollStatus['quests'][number]

/**
 * Daily quests: the automatic quest update at reset and the optional reroll
 * that depends on it. One page for both — they are one setting with a
 * dependency, and splitting them made people hunt for the other half.
 */
export function RouteComponent() {
  useRequestItemDatabase()
  const records = useItemDatabaseStore((state) => state.records)
  const { parsedSelectedAccounts } = useAccountSelectorData()
  const [status, setStatus] = useState<DailyRerollStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)

  const load = useCallback(() => {
    const started = generation.current
    setLoading(true)
    return window.electronAPI
      .getAutoDailyRerollStatus()
      .then((value) => {
        if (started !== generation.current) return
        setStatus(value)
        setError('')
      })
      .catch(() => {
        if (started !== generation.current) return
        setError('Could not load daily quest settings. Try Refresh.')
      })
      .finally(() => {
        if (started === generation.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (busy) return
    void load()
    const timer = setInterval(() => void load(), 30_000)
    return () => clearInterval(timer)
  }, [busy, load])

  const update = async (
    accountId: string,
    settings: DailyRerollPreferences,
  ) => {
    generation.current += 1
    setLoading(false)
    setBusy(true)
    setError('')
    try {
      setStatus(
        await window.electronAPI.updateAutoDailyReroll(accountId, settings),
      )
    } catch {
      setError('Could not save the setting. Try Refresh to see what was saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <RefreshButton
            disabled={busy}
            loading={loading}
            onClick={load}
          />
        }
        icon={RefreshCw}
        section="Automate"
        title="Daily quests"
        description={`Pull new dailies and reroll the one you don't want. Runs at daily reset (${dailyResetLocalTime(Date.now())}) while Penny is open.`}
      />

      {error && (
        <div role="alert">
          <Callout tone="danger">{error}</Callout>
        </div>
      )}

      {parsedSelectedAccounts.length === 0 ? (
        <EmptyState
          description="Select an account in the title bar to set up daily quests."
          icon={RefreshCw}
          title="Choose an account"
        />
      ) : !status ? (
        !error && (
          <div role="status">
            <EmptyState icon={ScrollText} title="Loading quest preferences…" />
          </div>
        )
      ) : (
        <>
          {status.questDataUnavailable && (
            <div role="status">
              <Callout tone="warning">
                Quest choices are unavailable. Daily quest updates can still
                run; rerolls wait for quest data.
              </Callout>
            </div>
          )}
          {parsedSelectedAccounts.map((account) => (
            <AccountDailies
              busy={busy}
              config={
                status.accounts[account.value] ?? {
                  enabled: false,
                  updateQuests: false,
                  keep: [],
                }
              }
              key={account.value}
              label={account.label}
              onSave={(settings) => void update(account.value, settings)}
              quests={status.quests}
              records={records}
            />
          ))}
        </>
      )}
    </div>
  )
}

function lastRun(result: string | undefined, at: string | undefined, fallback: string) {
  return `${result ?? fallback}${at ? ` · ${new Date(at).toLocaleString()}` : ''}`
}

function AccountDailies({
  busy,
  config,
  label,
  onSave,
  quests,
  records,
}: {
  busy: boolean
  config: DailyRerollConfig
  label: string
  onSave: (settings: DailyRerollPreferences) => void
  quests: Array<Quest>
  records: ItemRecordMap
}) {
  const [search, setSearch] = useState('')
  const updating = config.updateQuests || config.enabled
  const awaitingQuests = !config.enabled && quests.length === 0
  const save = (partial: Partial<DailyRerollPreferences>) =>
    onSave({
      enabled: config.enabled,
      updateQuests: config.updateQuests ?? config.enabled,
      keep: config.keep,
      ...partial,
    })
  const shown = quests.filter((quest) =>
    quest.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Panel>
      <PanelHeader
        actions={
          config.enabled ? (
            <Chip tone="success">Rerolling</Chip>
          ) : updating ? (
            <Chip tone="accent">Updating only</Chip>
          ) : (
            <Chip>Off</Chip>
          )
        }
        compact
        icon={ScrollText}
        title={label}
      />

      <PanelBody className="py-3">
        <FieldGroup>
          <FieldRow
            className="py-3"
            hint={
              <span role="status">
                {config.enabled
                  ? 'Required while auto reroll is on.'
                  : lastRun(config.lastUpdateResult, config.lastUpdateActivity, 'No automatic updates yet.')}
              </span>
            }
            label="Update daily quests at reset"
          >
            <Switch
              aria-label={`Auto update daily quests for ${label}`}
              checked={updating}
              disabled={busy || config.enabled}
              onCheckedChange={(updateQuests) => save({ updateQuests })}
            />
          </FieldRow>
          <FieldRow
            className="py-3"
            hint={
              <span role="status">
                {awaitingQuests
                  ? 'Waiting for quest data.'
                  : lastRun(config.lastResult, config.lastActivity, 'No automatic rerolls yet.')}
              </span>
            }
            label="Reroll a daily I don't keep"
          >
            <Switch
              aria-label={`Auto daily reroll for ${label}`}
              checked={config.enabled}
              disabled={busy || awaitingQuests}
              onCheckedChange={(enabled) =>
                save({ enabled, updateQuests: enabled || config.updateQuests })
              }
            />
          </FieldRow>
        </FieldGroup>
      </PanelBody>

      {quests.length > 0 && (
        <>
          <FilterBar>
            <SearchField
              label="Find quests"
              onChange={setSearch}
              placeholder="Search daily quests…"
              value={search}
            />
            <span className="text-xs text-muted-foreground">
              Keeping <span className="figure text-foreground">{config.keep.length}</span> of{' '}
              <span className="figure text-foreground">{quests.length}</span>
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                disabled={busy}
                onClick={() => save({ keep: quests.map((quest) => quest.templateId) })}
                size="sm"
                variant="ghost"
              >
                Keep all
              </Button>
              <Button
                disabled={busy || config.keep.length === 0}
                onClick={() => save({ keep: [] })}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </FilterBar>

          <ul className="grid max-h-[28rem] gap-px overflow-y-auto bg-border/40 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((quest) => {
              const kept = config.keep.includes(quest.templateId)

              return (
                <li className="bg-card" key={quest.templateId}>
                  <button
                    aria-label={`${kept ? 'Stop keeping' : 'Keep'} ${quest.name}`}
                    aria-pressed={kept}
                    className={cn(
                      'flex h-full w-full items-start gap-3 p-3 text-left transition-colors disabled:opacity-60',
                      kept ? 'bg-primary/10' : 'hover:bg-accent/30',
                    )}
                    disabled={busy}
                    onClick={() =>
                      save({
                        keep: kept
                          ? config.keep.filter((id) => id !== quest.templateId)
                          : [...config.keep, quest.templateId],
                      })
                    }
                    type="button"
                  >
                    <ItemIcon records={records} size="large" templateId={quest.templateId} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-ui font-semibold leading-snug">{quest.name}</span>
                        {kept && (
                          <Chip tone="accent">
                            <Lock aria-hidden className="size-3" />
                            Kept
                          </Chip>
                        )}
                      </span>
                      {(quest.objectives?.[0]?.description || quest.description) && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {quest.objectives?.[0]?.description || quest.description}
                        </span>
                      )}
                      {quest.rewards?.length ? (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {quest.rewards.slice(0, 3).map((reward) => (
                            <span
                              className="figure flex items-center gap-1 rounded-md bg-muted/50 py-0.5 pl-0.5 pr-2 text-xs"
                              key={reward.item}
                            >
                              <ItemIcon records={records} size="small" templateId={reward.item} />
                              {questRewardAmount(reward.item, reward.quantity).toLocaleString()}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && (
            <EmptyState
              className="border-0 bg-transparent py-8"
              title={`No daily quest matches “${search}”.`}
            />
          )}
          <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            Kept quests are never rerolled. Quests over half done, or with unknown targets, are always kept.
          </p>
        </>
      )}
    </Panel>
  )
}
