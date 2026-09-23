import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader, Panel, SearchField } from '../../../components/page'
import { Checkbox } from '../../../components/ui/checkbox'
import { Switch } from '../../../components/ui/switch'
import { Button } from '../../../components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'
import type {
  DailyRerollPreferences,
  DailyRerollStatus,
} from '../../../features/daily-reroll/policy'

/**
 * Daily quests: the automatic quest update at reset and the optional reroll
 * that depends on it. One page for both — they are one setting with a
 * dependency, and splitting them made people hunt for the other half.
 */
export function RouteComponent() {
  const { parsedSelectedAccounts } = useAccountSelectorData()
  const [status, setStatus] = useState<DailyRerollStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (busy) return
    let active = true
    const refresh = () =>
      window.electronAPI
        .getAutoDailyRerollStatus()
        .then((value) => {
          if (active) {
            setStatus(value)
            setError('')
          }
        })
        .catch(() => {
          if (active)
            setError(
              'Could not load reroll settings or quest data. Please try again.',
            )
        })
    void refresh()
    const timer = setInterval(() => {
      if (!busy) void refresh()
    }, 30_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [busy])

  const update = async (
    accountId: string,
    settings: DailyRerollPreferences,
  ) => {
    setBusy(true)
    setError('')
    try {
      setStatus(
        await window.electronAPI.updateAutoDailyReroll(accountId, settings),
      )
    } catch {
      setError(
        'Could not save settings. Refresh to check the saved state before trying again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        icon={RefreshCw}
        section="Automate"
        title="Daily quests"
        description="Update daily quests at reset, with an optional automatic reroll."
      />
      <TooltipProvider delayDuration={250}>
        <Panel className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Daily quest updates run after 00:01 UTC while Penny is open, or
            catch up when you reopen it. Rerolls run after 00:04 UTC, only after
            a successful quest update. Enabling reroll also enables daily quest
            updates. You can keep updates on without rerolling. Reroll uses your
            available daily allowance. Quests over 50% complete and quests with
            unknown progress targets are kept automatically. Checked quests
            below are always kept; unchecked quests may be rerolled. Enabling
            can use today's reroll on the next check.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!status && !error && <p role="status">Loading quest preferences…</p>}
          {parsedSelectedAccounts.length === 0 && (
            <p>Select an account to configure daily quest automations.</p>
          )}
          {status && (
            <SearchField
              label="Find quests"
              onChange={setSearch}
              placeholder="Search daily quests…"
              value={search}
            />
          )}
          {status?.questDataUnavailable && (
            <p role="status" className="text-sm text-muted-foreground">
              Quest choices are unavailable. Daily quest updates can still run;
              rerolls wait for quest data.
            </p>
          )}
          {status &&
            parsedSelectedAccounts.map((account) => {
              const config = status.accounts[account.value] ?? {
                enabled: false,
                updateQuests: false,
                keep: [],
              }
              const save = (partial: Partial<DailyRerollPreferences>) =>
                update(account.value, {
                  enabled: config.enabled,
                  updateQuests: config.updateQuests ?? config.enabled,
                  keep: config.keep,
                  ...partial,
                })
              return (
                <section
                  key={account.value}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <h2 className="font-semibold">{account.label}</h2>
                  <div className="flex items-center gap-3">
                    <Switch
                      aria-label={`Auto update daily quests for ${account.label}`}
                      checked={config.updateQuests || config.enabled}
                      disabled={busy || config.enabled}
                      onCheckedChange={(updateQuests) =>
                        void save({ updateQuests })
                      }
                    />
                    <span>Auto update daily quests</span>
                    <span className="text-xs text-muted-foreground">
                      {config.enabled
                        ? 'Required by auto daily reroll'
                        : config.updateQuests
                          ? 'Enabled'
                          : 'Off'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground" role="status">
                    {config.lastUpdateResult ??
                      'No automatic quest updates yet.'}
                    {config.lastUpdateActivity &&
                      ` · ${new Date(config.lastUpdateActivity).toLocaleString()}`}
                  </p>
                  <>
                      <div className="flex items-center gap-3">
                        <Switch
                          aria-label={`Auto daily reroll for ${account.label}`}
                          checked={config.enabled}
                          disabled={
                            busy ||
                            (!config.enabled && status.quests.length === 0)
                          }
                          onCheckedChange={(enabled) =>
                            void save({
                              enabled,
                              updateQuests: enabled || config.updateQuests,
                            })
                          }
                        />
                        <span>Auto daily reroll</span>
                        <span className="text-xs text-muted-foreground">
                          {config.enabled ? 'Enabled' : 'Off'}
                        </span>
                      </div>
                      <p
                        className="text-sm text-muted-foreground"
                        role="status"
                      >
                        {config.lastResult ?? 'No automatic reroll checks yet.'}
                        {config.lastActivity &&
                          ` · ${new Date(config.lastActivity).toLocaleString()}`}
                      </p>
                      <details>
                        <summary className="cursor-pointer text-sm">
                          Quests to keep ({config.keep.length})
                        </summary>
                        <div className="my-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void save({
                                keep: status.quests.map(
                                  (quest) => quest.templateId,
                                ),
                              })
                            }
                          >
                            Keep all
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void save({ keep: [] })}
                          >
                            Clear selection
                          </Button>
                        </div>
                        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                          {status.quests
                            .filter((quest) =>
                              quest.name
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                            )
                            .map((quest) => (
                              <label
                                key={quest.templateId}
                                className="flex items-start gap-2 text-sm"
                              >
                                <Checkbox
                                  aria-label={`Keep ${quest.name}`}
                                  className="mt-0.5"
                                  checked={config.keep.includes(
                                    quest.templateId,
                                  )}
                                  disabled={busy}
                                  onCheckedChange={(checked) =>
                                    void save({
                                      keep: checked === true
                                        ? [...config.keep, quest.templateId]
                                        : config.keep.filter(
                                            (id) => id !== quest.templateId,
                                          ),
                                    })
                                  }
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      className="cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline focus-visible:outline-2"
                                    >
                                      {quest.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="start"
                                    collisionPadding={16}
                                    className="max-w-sm space-y-2 p-3"
                                  >
                                    <p className="font-semibold">
                                      {quest.name}
                                    </p>
                                    {quest.objectives?.length ? (
                                      <ul className="space-y-1">
                                        {quest.objectives.map(
                                          (objective, index) => (
                                            <li key={index}>
                                              {objective.description ||
                                                `Complete objective (${objective.count.toLocaleString()} required).`}
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    ) : (
                                      <p>
                                        {quest.description ||
                                          'Quest objective information is unavailable.'}
                                      </p>
                                    )}
                                    <div className="border-t border-border pt-2">
                                      <p className="font-medium">
                                        Currency reward
                                      </p>
                                      <QuestCurrencyRewards
                                        rewards={quest.rewards ?? []}
                                      />
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </label>
                            ))}
                        </div>
                      </details>
                  </>
                </section>
              )
            })}
        </Panel>
      </TooltipProvider>
    </>
  )
}

function QuestCurrencyRewards({
  rewards,
}: {
  rewards: Array<{ item: string; quantity: number }>
}) {
  const currency = rewards.filter(
    (reward) =>
      Number.isFinite(reward.quantity) &&
      reward.quantity > 0 &&
      [
        'accountresource:currency_mtxswap',
        'accountresource:currency_hybrid_mtx_xrayllama',
        'accountresource:currency_xrayllama',
        'currency:mtxgiveaway',
      ].includes(reward.item.toLowerCase()),
  )
  if (!currency.length)
    return (
      <p className="text-muted-foreground">
        Currency reward information is unavailable.
      </p>
    )
  return (
    <>
      {currency.map((reward, index) => {
        const item = reward.item.toLowerCase()
        const amount = reward.quantity.toLocaleString()
        if (item === 'accountresource:currency_xrayllama')
          return <p key={index}>{amount} X-Ray Tickets</p>
        if (item === 'currency:mtxgiveaway')
          return <p key={index}>{amount} V-Bucks</p>
        return (
          <div key={index}>
            <p>
              {amount} V-Bucks{' '}
              <span className="text-muted-foreground">(Founders)</span>
            </p>
            <p>
              {amount} X-Ray Tickets{' '}
              <span className="text-muted-foreground">(non-Founders)</span>
            </p>
          </div>
        )
      })}
    </>
  )
}
