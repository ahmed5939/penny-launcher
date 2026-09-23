import { ExpeditionHistory } from '../../../features/expeditions/history'
import { RecycleCeilingPicker } from '../../../features/automation-rewards/view'
import { rewardTypes } from '../../../features/expeditions/model'
import type {
  AutoExpeditionConfig,
  AutoExpeditionsData,
} from '../../../kernel/startup/auto-expeditions'
import type {
  ExpeditionsPayload,
  ExpeditionSlot,
} from '../../../kernel/core/expeditions'

import { CheckCheck, Clock3, Compass, PackageOpen, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import { Switch } from '../../../components/ui/switch'
import { Button } from '../../../components/ui/button'
import { PageHeader, Panel } from '../../../components/page'
import { useAccountSelectorData } from '../../../components/selectors/accounts/hooks'


export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Compass}
        section={t('groups.automate')}
        title={t('stw-operations.options.expeditions')}
        description="Automatically select, launch, confirm, and collect expeditions."
      />
      <AutoExpeditionSettings />
      <ReadOnlyExpeditionStatus />
    </>
  )
}

function AutoExpeditionSettings() {
  const { parsedSelectedAccounts } = useAccountSelectorData()
  const [configs, setConfigs] = useState<AutoExpeditionsData>({})

  useEffect(() => {
    let active = true
    const refresh = () => window.electronAPI.getAutoExpeditionsStatus().then((data) => { if (active) setConfigs(data) }).catch(() => undefined)
    void refresh()
    const timer = setInterval(refresh, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const update = async (
    accountId: string,
    partial: Partial<AutoExpeditionConfig>
  ) => {
    const next = await window.electronAPI.updateAutoExpeditions(
      accountId,
      partial
    )
    setConfigs(next)
  }

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <WandSparkles className="size-4" /> Auto-expeditions
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Runs when rewards return, otherwise hourly. Teams preserve occupied
          heroes and must meet vehicle, criteria, and power requirements. Keep Penny Launcher running for automation to work.
        </p>
      </div>

      {parsedSelectedAccounts.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Select at least one account to configure auto-expeditions.
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {parsedSelectedAccounts.map((account) => {
            const config = configs[account.value] ?? {
              enabled: false,
              rewardTypes: [],
            }

            return (
              <li className="space-y-3 p-4" key={account.value}>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) =>
                      update(account.value, { enabled })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {account.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config.lastActivity
                        ? `Last automatic run ${dayjs(config.lastActivity).fromNow()} · collected ${config.lastCollected ?? 0}, sent ${config.lastSent ?? 0}`
                        : 'No automatic runs yet'}
                    </p>
                    {config.lastCollectedRewards?.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last collected: {config.lastCollectedRewards.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Notify</span>
                    <Switch
                      checked={config.notificationsEnabled !== false}
                      onCheckedChange={(notificationsEnabled) =>
                        update(account.value, { notificationsEnabled })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {rewardTypes.map((type) => {
                    const selected = config.rewardTypes.includes(type)

                    return (
                      <Button
                        key={type}
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        onClick={() =>
                          update(account.value, {
                            rewardTypes: selected
                              ? config.rewardTypes.filter(
                                  (item) => item !== type
                                )
                              : [...config.rewardTypes, type],
                          })
                        }
                      >
                        {type}
                      </Button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Survivors includes lead survivors and people runs. Materials includes supplies, crafting materials, wood, stone, and metal. Select every category for all expedition types.</p>
                <Button size="sm" variant="outline" onClick={() => update(account.value, { rewardTypes: [...rewardTypes] })}>Select all expedition types</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recycle new rewards</span>
                  <RecycleCeilingPicker onChange={(recycleBelow) => update(account.value, { recycleBelow })} value={config.recycleBelow ?? 'off'} />
                </div>
                {config.nextRunAt ? (
                  <p className="text-xs text-muted-foreground">
                    Next check {dayjs(config.nextRunAt).fromNow()}
                    {config.lastError ? ` · Last error: ${config.lastError}` : ''}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">Recycles only confirmed new Hero, Survivor, Defender, and Schematic rewards up to the selected rarity. Favorites, assigned items, Legendary and Mythic items are kept. Weapons, traps, and material stacks are tracked and kept.</p>
                <ExpeditionHistory history={config.history ?? []} />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function ReadOnlyExpeditionStatus() {
  const { getAccounts, parsedSelectedAccounts } = useAccountSelectorData()
  const [data, setData] = useState<ExpeditionsPayload>({})
  const scopeKey = parsedSelectedAccounts.map((account) => account.value).join(',')

  useEffect(() => {
    const listener = window.electronAPI.responseExpeditions(async (response) => {
      setData((current) => ({ ...current, ...response }))
    })
    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    if (!scopeKey) {
      setData({})
      return
    }

    const accounts = getAccounts()
    const load = () => window.electronAPI.requestExpeditions(accounts)
    setData({})
    window.electronAPI
      .ensureAutoExpeditionsStarted(accounts.map((account) => account.accountId))
      .finally(load)
    const interval = window.setInterval(load, 60_000)
    return () => window.clearInterval(interval)
  }, [scopeKey])

  const names = Object.fromEntries(
    parsedSelectedAccounts.map((account) => [account.value, account.label])
  )
  const slots = Object.values(data).flatMap((entry) =>
    entry.slots.map((slot) => ({
      accountId: entry.accountId,
      accountName: names[entry.accountId] ?? entry.accountId,
      slot,
    }))
  )

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <StatusColumn
        icon={PackageOpen}
        items={slots.filter((item) => item.slot.state === 'available')}
        title="Available"
      />
      <StatusColumn
        icon={Clock3}
        items={slots.filter((item) => item.slot.state === 'in-flight')}
        title="Currently running"
      />
      <StatusColumn
        icon={CheckCheck}
        items={slots.filter((item) => item.slot.state === 'ready')}
        title="Waiting for automatic collection"
      />
    </div>
  )
}

function StatusColumn({
  icon: Icon,
  items,
  title,
}: {
  icon: typeof Compass
  items: Array<{ accountId: string; accountName: string; slot: ExpeditionSlot }>
  title: string
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 p-4">
        <Icon className="size-4" />
        <p className="text-sm font-semibold">{title}</p>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map(({ accountId, accountName, slot }) => (
            <li className="space-y-1 p-4" key={`${accountId}-${slot.itemId}`}>
              <p className="text-sm font-medium">{slot.name}</p>
              <p className="text-xs text-muted-foreground">
                {accountName} · {slot.vehicle} · Tier {slot.tier || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Reward category: {slot.name}
                {slot.state === 'in-flight' && slot.endTime
                  ? ` · completes ${dayjs(slot.endTime).fromNow()}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
