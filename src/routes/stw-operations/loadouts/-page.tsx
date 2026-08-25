import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { LoadoutEntry } from '../../../kernel/core/loadouts'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { InventoryItem } from '../../../kernel/core/inventory'
import type { RatingTables } from '../../../config/constants/fortnite/power'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  CheckCheck,
  Eraser,
  Info,
  Repeat,
  RefreshCw,
  Shield,
  Swords,
  UserX,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemIcon } from '../../../components/items/item-icon'
import { ItemTile } from '../../../components/items/item-tile'
import { ContextMenuItem } from '../../../components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  StatusPill,
} from '../../../components/page'

import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { computeItemPower } from '../../../config/constants/fortnite/power'

import { toast } from '../../../lib/notifications'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

/** Profile keys are lowercase; `AssignHeroToLoadout` wants them cased. */
function slotName(slot: string) {
  if (slot === 'commanderslot') {
    return 'CommanderSlot'
  }

  const match = /^followerslot(\d)$/.exec(slot)

  return match ? `FollowerSlot${match[1]}` : slot
}

function slotLabel(slot: string) {
  return slot === 'commanderslot'
    ? 'the commander slot'
    : `support slot ${slot.replace('followerslot', '')}`
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Users}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.loadouts')}
            <BetaBadge />
          </span>
        }
        description="Build and switch hero loadouts — commander, support team, team perk and gadgets."
      />
      <Content />
    </>
  )
}

function Content() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  const [loadouts, setLoadouts] = useState<Array<LoadoutEntry>>([])
  const [heroes, setHeroes] = useState<Array<InventoryItem>>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isEditing, setEditing] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  /** The slot waiting for a hero to be picked for it. */
  const [pendingSlot, setPendingSlot] = useState<{
    loadoutId: string
    slot: string
  } | null>(null)

  useEffect(() => {
    const listener = window.electronAPI.responseLoadouts(
      async (response) => {
        setLoading(false)
        setHasLoaded(true)
        setLoadouts(response.loadouts)
        setErrorMessage(response.errorMessage ?? null)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  /** The vault feed doubles as the pool of heroes to slot. */
  useEffect(() => {
    const listener = window.electronAPI.responseInventory(
      async (response) => {
        const entry = accountId ? response[accountId] : undefined

        if (entry) {
          setHeroes(entry.items.filter((item) => item.kind === 'hero'))
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [accountId])

  useEffect(() => {
    const listener = window.electronAPI.notificationLoadoutEdit(
      async (response) => {
        setEditing(false)
        setPendingSlot(null)

        toast(
          response.errorMessage
            ? `Epic rejected that: ${response.errorMessage}`
            : response.kind === 'activate'
              ? 'Loadout equipped'
              : response.kind === 'clear'
                ? 'Loadout cleared'
                : 'Hero assigned'
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleLoad = () => {
    if (!selected) {
      return
    }

    setLoading(true)
    window.electronAPI.requestLoadouts(selected)
    window.electronAPI.requestInventory([selected])
  }

  useEffect(() => {
    if (accountId) {
      handleLoad()
    }
  }, [accountId])

  const candidates = useMemo(
    () =>
      heroes
        .map((hero) => ({
          ...hero,
          displayName:
            getItemRecord(records, hero.templateId)?.name ?? hero.name,
          power: computeItemPower({
            level: hero.level,
            tables: ratings,
            templateId: hero.templateId,
          }),
        }))
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0)),
    [heroes, ratings, records]
  )

  const edit = (
    request: Parameters<typeof window.electronAPI.editLoadout>[1]
  ) => {
    if (!selected || isEditing) {
      return
    }

    setEditing(true)
    window.electronAPI.editLoadout(selected, request)
  }

  if (!selected) {
    return (
      <EmptyState
        description="Pick one in the title bar and its loadouts load here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  return (
    <>
      <Panel id="loadouts-card">
        <PanelBody className="flex flex-wrap items-center gap-3">
          <span className="text-[0.8125rem] font-medium">
            {parseCustomDisplayName(selected)}
          </span>
          <Button
            className="ml-auto"
            disabled={isLoading}
            onClick={handleLoad}
            size="sm"
            variant="ghost"
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Refresh
              </>
            )}
          </Button>
        </PanelBody>
      </Panel>

      {errorMessage && (
        <Callout
          title="Could not read the loadouts"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {hasLoaded && !errorMessage && loadouts.length > 0 && (
        <div className="space-y-3">
          {loadouts.map((loadout, index) => (
            <LoadoutCard
              index={index}
              isEditing={isEditing}
              key={loadout.itemId}
              loadout={loadout}
              onActivate={() =>
                edit({ kind: 'activate', loadoutId: loadout.itemId })
              }
              onClear={() =>
                edit({ kind: 'clear', loadoutId: loadout.itemId })
              }
              onInspect={setDetail}
              onPickSlot={(slot) =>
                setPendingSlot({ loadoutId: loadout.itemId, slot })
              }
              ratings={ratings}
              records={records}
            />
          ))}
        </div>
      )}

      {hasLoaded && !errorMessage && loadouts.length <= 0 && (
        <EmptyState
          description="This account has no hero loadouts saved."
          icon={Users}
          title="No loadouts"
        />
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null)
          }
        }}
        open={pendingSlot !== null}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pick a hero for {pendingSlot && slotLabel(pendingSlot.slot)}
            </DialogTitle>
            <DialogDescription>
              Highest power first. Epic moves the hero if it is already in
              another slot of this loadout.
            </DialogDescription>
          </DialogHeader>

          {candidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {candidates.map((hero) => (
                <ItemTile
                  disabled={isEditing}
                  footer={hero.subtitle}
                  key={hero.itemId}
                  name={hero.displayName}
                  onClick={() =>
                    pendingSlot &&
                    edit({
                      kind: 'assign',
                      loadoutId: pendingSlot.loadoutId,
                      heroId: hero.itemId,
                      slotName: slotName(pendingSlot.slot),
                    })
                  }
                  power={hero.power}
                  records={records}
                  size="small"
                  templateId={hero.templateId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-6"
              description="No heroes were found on this account."
              icon={Users}
              title="Nothing to assign"
            />
          )}
        </DialogContent>
      </Dialog>

      <ItemDetailDialog
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
          }
        }}
        ratings={ratings}
        records={records}
        subject={detail}
      />

      <GoToTop containerId="loadouts-card" />
    </>
  )
}

function LoadoutCard({
  index,
  isEditing,
  loadout,
  onActivate,
  onClear,
  onInspect,
  onPickSlot,
  ratings,
  records,
}: {
  index: number
  isEditing: boolean
  loadout: LoadoutEntry
  onActivate: () => void
  onClear: () => void
  onInspect: (subject: ItemDetailSubject) => void
  onPickSlot: (slot: string) => void
  ratings: RatingTables
  records: ItemRecordMap
}) {
  const teamPerk = loadout.teamPerk
    ? getItemRecord(records, loadout.teamPerk)
    : null

  const memberPower = (member: {
    level: number
    templateId: string | null
  }) =>
    member.templateId
      ? computeItemPower({
          level: member.level,
          tables: ratings,
          templateId: member.templateId,
        })
      : null

  return (
    <Panel className={cn(loadout.active && 'border-primary/50')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
        <p className="text-[0.8125rem] font-semibold">
          {loadout.name ?? `Loadout ${index + 1}`}
        </p>
        {loadout.active && <StatusPill tone="active">Equipped</StatusPill>}

        <div className="ml-auto flex gap-1">
          {!loadout.active && (
            <Button
              disabled={isEditing}
              onClick={onActivate}
              size="sm"
              variant="secondary"
            >
              <CheckCheck className="size-3.5" />
              Equip
            </Button>
          )}
          <Button
            disabled={isEditing}
            onClick={onClear}
            size="sm"
            title="Empty every slot in this loadout"
            variant="ghost"
          >
            <Eraser className="size-3.5" />
          </Button>
        </div>
      </header>

      <PanelBody className="space-y-4">
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Swords className="size-3" />
              Commander
            </p>
            {loadout.commander?.templateId ? (
              <ItemTile
                level={loadout.commander.level}
                menu={
                  <SlotMenu
                    onInspect={() =>
                      onInspect({
                        templateId: loadout.commander
                          ?.templateId as string,
                        itemId: loadout.commander?.itemId ?? undefined,
                        level: loadout.commander?.level ?? 0,
                        tier: loadout.commander?.tier ?? 0,
                      })
                    }
                    onPick={() => onPickSlot('commanderslot')}
                  />
                }
                onClick={() => onPickSlot('commanderslot')}
                power={memberPower(loadout.commander)}
                records={records}
                size="large"
                templateId={loadout.commander.templateId}
                title="Click to change · right-click for more"
              />
            ) : (
              <EmptySlot onClick={() => onPickSlot('commanderslot')} />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Users className="size-3" />
              Support team
            </p>
            <div className="flex flex-wrap gap-2">
              {loadout.team.map((member) =>
                member.templateId ? (
                  <ItemTile
                    key={member.slot}
                    level={member.level}
                    menu={
                      <SlotMenu
                        onInspect={() =>
                          onInspect({
                            templateId: member.templateId as string,
                            itemId: member.itemId ?? undefined,
                            level: member.level,
                            tier: member.tier,
                          })
                        }
                        onPick={() => onPickSlot(member.slot)}
                      />
                    }
                    onClick={() => onPickSlot(member.slot)}
                    power={memberPower(member)}
                    records={records}
                    size="small"
                    templateId={member.templateId}
                    title="Click to change · right-click for more"
                  />
                ) : (
                  <EmptySlot
                    key={member.slot}
                    onClick={() => onPickSlot(member.slot)}
                    small
                  />
                )
              )}
            </div>
          </div>
        </div>

        {(teamPerk || loadout.gadgets.length > 0) && (
          <div className="flex flex-wrap gap-6">
            {teamPerk && (
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Shield className="size-3" />
                  Team perk
                </p>
                <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
                  <p className="text-xs font-semibold">{teamPerk.name}</p>
                  {teamPerk.description && (
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-muted-foreground">
                      {teamPerk.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {loadout.gadgets.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Gadgets
                </p>
                <div className="flex gap-2">
                  {loadout.gadgets.map((gadget) => (
                    <span
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/50 py-1 pl-1 pr-2.5 text-xs"
                      key={gadget}
                    >
                      <ItemIcon
                        records={records}
                        size="small"
                        templateId={gadget}
                      />
                      {getItemRecord(records, gadget)?.name ??
                        gadget.split(':').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loadout.commander?.templateId && (
          <p className="text-[0.65rem] text-muted-foreground">
            Click a slot to change who is in it, or{' '}
            <button
              className="text-primary underline-offset-4 hover:underline"
              onClick={() =>
                onInspect({
                  templateId: loadout.commander?.templateId as string,
                  itemId: loadout.commander?.itemId ?? undefined,
                  level: loadout.commander?.level ?? 0,
                  tier: loadout.commander?.tier ?? 0,
                })
              }
              type="button"
            >
              inspect the commander
            </button>{' '}
            to see its perks.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}

/** Right-click on a filled slot: swap who is in it, or read them. */
function SlotMenu({
  onInspect,
  onPick,
}: {
  onInspect: () => void
  onPick: () => void
}) {
  return (
    <>
      <ContextMenuItem onSelect={onPick}>
        <Repeat className="mr-2 size-3.5" />
        Change hero
      </ContextMenuItem>
      <ContextMenuItem onSelect={onInspect}>
        <Info className="mr-2 size-3.5" />
        Inspect
      </ContextMenuItem>
    </>
  )
}

function EmptySlot({
  onClick,
  small,
}: {
  onClick?: () => void
  small?: boolean
}) {
  return (
    <button
      className={cn(
        'grid shrink-0 place-items-center gap-0.5 rounded-lg border-2 border-dashed',
        'border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary',
        small ? 'size-16' : 'size-32'
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-lg leading-none">+</span>
      <span className="text-[0.6rem]">Empty</span>
    </button>
  )
}
