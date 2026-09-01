import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type {
  LoadoutEntry,
  LoadoutDefender,
  LoadoutMember,
} from '../../../kernel/core/loadouts'
import type {
  ItemRecordMap,
  ItemRecordPerk,
} from '../../../kernel/core/item-database'
import type { InventoryItem } from '../../../kernel/core/inventory'
import type { RatingTables } from '../../../config/constants/fortnite/power'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  CheckCheck,
  Crown,
  Eraser,
  Info,
  Plus,
  Repeat,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldHalf,
  Star,
  UserX,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { GoToTop } from '../../../components/go-to-top'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemIcon } from '../../../components/items/item-icon'
import { ItemTile } from '../../../components/items/item-tile'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../../components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
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
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

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

/**
 * What to call a loadout.
 *
 * `loadout_name` is not a name. The game generates a token per loadout —
 * `DtufXHAHun` — and never shows it; its own picker numbers the slots. So a
 * value that could have come out of that generator (one run of letters and
 * digits, no spaces, no punctuation) is treated as the machine string it is
 * and the loadout takes its number instead. Anything a person could have
 * typed is still printed, in case Epic ever hands the naming over.
 */
function loadoutTitle(loadout: LoadoutEntry) {
  const name = loadout.name?.trim() ?? ''
  const generated = name.length < 1 || /^[A-Za-z0-9]{6,}$/.test(name)

  return generated ? `Loadout ${loadout.position}` : name
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Users}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.loadouts')}
        description="Every loadout the account has saved, in the game's own order. Click a seat to change who is in it, right-click one to inspect them."
      />
      <Content />
    </>
  )
}

function Content() {
  useRequestItemDatabase()

  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  const [loadouts, setLoadouts] = useState<Array<LoadoutEntry>>([])
  const [heroes, setHeroes] = useState<Array<InventoryItem>>([])
  const [availableGadgets, setAvailableGadgets] = useState<Array<string>>([])
  const [defenders, setDefenders] = useState<Array<InventoryItem>>([])
  const [schematics, setSchematics] = useState<Array<InventoryItem>>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isEditing, setEditing] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  /** The slot waiting for a hero to be picked for it. */
  const [pendingSlot, setPendingSlot] = useState<{
    loadoutId: string
    slot: string
    kind: 'hero' | 'defender'
  } | null>(null)
  const [pendingWeapon, setPendingWeapon] = useState<{
    loadoutId: string
    defenderId: string
    defenderTemplateId: string
  } | null>(null)
  const [pendingGadget, setPendingGadget] = useState<{
    loadoutId: string
    slotIndex: number
  } | null>(null)
  const [heroClass, setHeroClass] = useState('All')
  const [heroSearch, setHeroSearch] = useState('')

  useEffect(() => {
    const listener = window.electronAPI.responseLoadouts(
      async (response) => {
        setLoading(false)
        setHasLoaded(true)
        setLoadouts(response.loadouts)
        setAvailableGadgets(response.availableGadgets)
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
          setDefenders(entry.items.filter((item) => item.kind === 'defender'))
          setSchematics(entry.items.filter((item) => item.kind === 'schematic'))
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
        setPendingWeapon(null)
        setPendingGadget(null)

        toast(
          response.errorMessage
            ? `Epic rejected that: ${response.errorMessage}`
            : response.kind === 'activate'
              ? 'Loadout equipped'
              : response.kind === 'clear'
                ? 'Loadout cleared'
                : response.kind === 'assign-defender'
                  ? 'Defender assigned'
                  : response.kind === 'assign-defender-weapon'
                    ? 'Defender weapon assigned'
                    : response.kind === 'assign-gadget'
                      ? 'Gadget assigned'
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
  const visibleHeroCandidates = useMemo(() => {
    const search = heroSearch.trim().toLowerCase()

    return candidates.filter((hero) => {
      const record = getItemRecord(records, hero.templateId)
      return (
        (heroClass === 'All' || record?.subType === heroClass) &&
        (search.length === 0 ||
          hero.displayName.toLowerCase().includes(search) ||
          record?.perk?.name.toLowerCase().includes(search) ||
          record?.commanderPerk?.name.toLowerCase().includes(search))
      )
    })
  }, [candidates, heroClass, heroSearch, records])

  const rankItems = (items: Array<InventoryItem>) =>
    items
      .map((item) => ({
        ...item,
        displayName: getItemRecord(records, item.templateId)?.name ?? item.name,
        power: computeItemPower({
          level: item.level,
          tables: ratings,
          templateId: item.templateId,
        }),
      }))
      .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
  const defenderCandidates = useMemo(
    () => rankItems(defenders),
    [defenders, ratings, records]
  )
  const schematicCandidates = useMemo(
    () => {
      const defenderType = pendingWeapon
        ? getItemRecord(records, pendingWeapon.defenderTemplateId)?.subType
        : null
      const allowed =
        defenderType === 'Assault Defender'
          ? ['Assault', 'SMG']
          : defenderType === 'Pistol Defender'
            ? ['Pistol', 'SMG']
            : defenderType === 'Shotgun Defender'
              ? ['Shotgun']
              : defenderType === 'Sniper Defender'
                ? ['Sniper']
                : null

      return rankItems(schematics).filter((item) => {
        const record = getItemRecord(records, item.templateId)

        if (defenderType === 'Melee Defender') {
          return record?.category === 'Melee'
        }

        return Boolean(record?.subType && allowed?.includes(record.subType))
      })
    },
    [pendingWeapon, schematics, ratings, records]
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

  const pickerHeroPerk = (templateId: string) => {
    const record = getItemRecord(records, templateId)
    return pendingSlot?.slot === 'commanderslot'
      ? record?.commanderPerk ?? record?.perk ?? null
      : record?.perk ?? null
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
        <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {loadouts.map((loadout) => (
            <LoadoutCard
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
              onPickSlot={(slot, kind) =>
                setPendingSlot({ loadoutId: loadout.itemId, slot, kind })
              }
              onPickWeapon={(defenderId, defenderTemplateId) =>
                setPendingWeapon({
                  loadoutId: loadout.itemId,
                  defenderId,
                  defenderTemplateId,
                })
              }
              onPickGadget={(slotIndex) =>
                setPendingGadget({ loadoutId: loadout.itemId, slotIndex })
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
              Pick {pendingSlot?.kind === 'defender' ? 'a defender' : 'a hero'}
              {pendingSlot?.kind === 'hero' &&
                ` for ${slotLabel(pendingSlot.slot)}`}
            </DialogTitle>
            <DialogDescription>
              Highest power first. Epic moves the hero if it is already in
              another slot of this loadout.
            </DialogDescription>
          </DialogHeader>

          {pendingSlot?.kind === 'hero' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {['All', 'Soldier', 'Constructor', 'Ninja', 'Outlander'].map(
                  (value) => (
                    <Button
                      key={value}
                      onClick={() => setHeroClass(value)}
                      size="sm"
                      variant={heroClass === value ? 'secondary' : 'ghost'}
                    >
                      {value}
                    </Button>
                  )
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setHeroSearch(event.target.value)}
                  placeholder="Search heroes or perks"
                  value={heroSearch}
                />
              </div>
            </div>
          )}

          {(pendingSlot?.kind === 'defender'
            ? defenderCandidates
            : visibleHeroCandidates
          ).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(pendingSlot?.kind === 'defender'
                ? defenderCandidates
                : visibleHeroCandidates
              ).map((hero) => (
                <PerkTooltip
                  alterations={hero.alterations}
                  key={hero.itemId}
                  namedPerks={
                    pickerHeroPerk(hero.templateId)
                      ? [pickerHeroPerk(hero.templateId) as ItemRecordPerk]
                      : []
                  }
                  records={records}
                  title={hero.displayName}
                >
                  <ItemTile
                    disabled={isEditing}
                    footer={
                      pickerHeroPerk(hero.templateId)?.name ?? hero.subtitle
                    }
                    name={hero.displayName}
                    onClick={() =>
                      pendingSlot &&
                      edit(
                        pendingSlot.kind === 'defender'
                          ? {
                              kind: 'assign-defender',
                              loadoutId: pendingSlot.loadoutId,
                              defenderId: hero.itemId,
                              slotName: `DefenderSlot${pendingSlot.slot.replace('defenderslot', '')}`,
                            }
                          : {
                              kind: 'assign',
                              loadoutId: pendingSlot.loadoutId,
                              heroId: hero.itemId,
                              slotName: slotName(pendingSlot.slot),
                            }
                      )
                    }
                    power={hero.power}
                    records={records}
                    size="small"
                    templateId={hero.templateId}
                  />
                </PerkTooltip>
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

      <Dialog
        onOpenChange={(open) => !open && setPendingGadget(null)}
        open={pendingGadget !== null}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pick a gadget</DialogTitle>
            <DialogDescription>
              Select a gadget for this loadout slot.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {availableGadgets.map((templateId) => (
              <ItemTile
                key={templateId}
                name={getItemRecord(records, templateId)?.name}
                onClick={() =>
                  pendingGadget &&
                  edit({
                    kind: 'assign-gadget',
                    loadoutId: pendingGadget.loadoutId,
                    gadgetId: templateId,
                    slotIndex: pendingGadget.slotIndex,
                  })
                }
                records={records}
                size="small"
                templateId={templateId}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setPendingWeapon(null)}
        open={pendingWeapon !== null}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pick a defender weapon</DialogTitle>
            <DialogDescription>
              Epic validates that the ranged weapon class matches this defender.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() =>
              pendingWeapon &&
              edit({
                kind: 'assign-defender-weapon',
                loadoutId: pendingWeapon.loadoutId,
                defenderId: pendingWeapon.defenderId,
                schematicId: '',
              })
            }
            variant="secondary"
          >
            Use default weapon
          </Button>
          <div className="flex flex-wrap gap-2">
            {schematicCandidates.map((item) => (
              <PerkTooltip
                alterations={item.alterations}
                key={item.itemId}
                records={records}
                title={item.displayName}
              >
                <ItemTile
                  disabled={isEditing}
                  footer={item.subtitle}
                  name={item.displayName}
                  onClick={() =>
                    pendingWeapon &&
                    edit({
                      kind: 'assign-defender-weapon',
                      loadoutId: pendingWeapon.loadoutId,
                      defenderId: pendingWeapon.defenderId,
                      schematicId: item.itemId,
                    })
                  }
                  power={item.power}
                  records={records}
                  size="small"
                  templateId={item.templateId}
                />
              </PerkTooltip>
            ))}
          </div>
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

/**
 * One loadout, in the shape the game lays it out.
 *
 * In game a loadout slot is a vertical stack of labelled bands — commander,
 * team perk, support, gadgets — read top to bottom, and that order is the one
 * people already know, so the card keeps it rather than inventing a
 * two-column arrangement of tiles nobody has seen before. Each band names
 * itself at the section rank and holds rows, so five support heroes read as a
 * list of five decisions rather than a shelf of anonymous portraits.
 *
 * What it does not keep is the game's chrome. The game fills the commander
 * band with its rarity colour and paints every support row a different
 * gradient; here rarity stays a hairline on the art the way `ItemIcon` draws
 * it everywhere else, which leaves the perk names as the loudest text in the
 * card — and a perk is what a hero is actually picked for.
 *
 * Defenders and their selected weapon schematics follow the gadget band.
 */
function LoadoutCard({
  isEditing,
  loadout,
  onActivate,
  onClear,
  onInspect,
  onPickSlot,
  onPickWeapon,
  onPickGadget,
  ratings,
  records,
}: {
  isEditing: boolean
  loadout: LoadoutEntry
  onActivate: () => void
  onClear: () => void
  onInspect: (subject: ItemDetailSubject) => void
  onPickSlot: (slot: string, kind: 'hero' | 'defender') => void
  onPickWeapon: (defenderId: string, defenderTemplateId: string) => void
  onPickGadget: (slotIndex: number) => void
  ratings: RatingTables
  records: ItemRecordMap
}) {
  const commander = loadout.commander
  const commanderRecord = commander?.templateId
    ? getItemRecord(records, commander.templateId)
    : null
  const teamPerk = loadout.teamPerk
    ? getItemRecord(records, loadout.teamPerk)
    : null
  const filled = loadout.team.filter((member) => member.templateId).length

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

  const inspect = (member: LoadoutMember) => () =>
    onInspect({
      templateId: member.templateId as string,
      itemId: member.itemId ?? undefined,
      level: member.level,
      tier: member.tier,
    })

  return (
    <Panel className={cn(loadout.active && 'border-primary/50')}>
      <header className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
        <p className="text-[0.8125rem] font-semibold">
          {loadoutTitle(loadout)}
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

      <Band
        icon={Crown}
        title="Commander"
      >
        {/*
          The commander's perk is its *commander* perk — the upgraded one it
          only grants from this seat — which is the whole reason a particular
          hero leads a loadout. A hero with no commander perk in the database
          still has its standard one, and showing that beats showing nothing.
        */}
        <HeroSlot
          isLead
          member={commander}
          onInspect={commander?.templateId ? inspect(commander) : undefined}
          onPick={() => onPickSlot('commanderslot', 'hero')}
          perk={
            commanderRecord?.commanderPerk ?? commanderRecord?.perk ?? null
          }
          perkTemplate={
            commanderRecord?.commanderPerkTemplate ??
            commanderRecord?.perkTemplate ??
            null
          }
          power={commander ? memberPower(commander) : null}
          records={records}
        />
      </Band>

      {teamPerk && (
        <Band
          icon={Shield}
          title="Team perk"
        >
          <div className="flex items-center gap-2 px-1.5 py-1">
            <ItemIcon
              records={records}
              size="small"
              templateId={loadout.teamPerk as string}
            />
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-semibold leading-tight">
                {teamPerk.name}
              </p>
              {teamPerk.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {teamPerk.description}
                </p>
              )}
            </div>
          </div>
        </Band>
      )}

      <Band
        count={`${filled}/${loadout.team.length}`}
        icon={Users}
        title="Support team"
      >
        <div className="space-y-0.5">
          {loadout.team.map((member) => (
            <HeroSlot
              key={member.slot}
              member={member}
              onInspect={member.templateId ? inspect(member) : undefined}
              onPick={() => onPickSlot(member.slot, 'hero')}
              perk={
                member.templateId
                  ? getItemRecord(records, member.templateId)?.perk ?? null
                  : null
              }
              perkTemplate={
                member.templateId
                  ? getItemRecord(records, member.templateId)?.perkTemplate ??
                    null
                  : null
              }
              power={memberPower(member)}
              records={records}
            />
          ))}
        </div>
      </Band>

      <Band icon={Rocket} title="Gadgets">
        <div className="grid grid-cols-2 gap-1 px-1.5">
          {loadout.gadgets.map((gadget, index) => (
            <button
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-surface/50 p-1 text-left text-xs transition-colors hover:border-primary/50"
              key={index}
              onClick={() => onPickGadget(index)}
              type="button"
            >
              {gadget ? (
                <ItemIcon
                  records={records}
                  size="small"
                  templateId={gadget}
                />
              ) : (
                <span className="grid size-8 place-items-center rounded bg-muted/40">
                  <Plus className="size-3.5" />
                </span>
              )}
              {gadget
                ? getItemRecord(records, gadget)?.name ??
                  gadget.split(':').pop()
                : `Empty gadget slot ${index + 1}`}
            </button>
          ))}
        </div>
      </Band>

      <Band
        count={`${loadout.defenders.filter((member) => member.templateId).length}/3`}
        icon={ShieldHalf}
        title="Defenders"
      >
        <div className="space-y-1">
          {loadout.defenders.map((defender) => (
            <DefenderSlot
              defender={defender}
              key={defender.slot}
              onPick={() => onPickSlot(defender.slot, 'defender')}
              onPickWeapon={() =>
                defender.itemId &&
                defender.templateId &&
                onPickWeapon(defender.itemId, defender.templateId)
              }
              records={records}
            />
          ))}
        </div>
      </Band>
    </Panel>
  )
}

function DefenderSlot({
  defender,
  onPick,
  onPickWeapon,
  records,
}: {
  defender: LoadoutDefender
  onPick: () => void
  onPickWeapon: () => void
  records: ItemRecordMap
}) {
  if (!defender.templateId) {
    return (
      <Button className="w-full justify-start" onClick={onPick} variant="ghost">
        <Plus className="size-4" /> Empty defender slot
      </Button>
    )
  }

  const defenderRecord = getItemRecord(records, defender.templateId)
  const weaponRecord = defender.schematicTemplateId
    ? getItemRecord(records, defender.schematicTemplateId)
    : null

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/60 p-1">
      <PerkTooltip
        alterations={defender.alterations}
        className="min-w-0 flex-1"
        records={records}
        title={defenderRecord?.name ?? 'Defender perks'}
      >
        <button
          className="flex w-full min-w-0 items-center gap-2 text-left"
          onClick={onPick}
          type="button"
        >
          <ItemIcon
            records={records}
            size="small"
            templateId={defender.templateId}
          />
          <span className="min-w-0 truncate text-xs font-semibold">
            {defenderRecord?.name ?? defender.templateId.split(':').pop()}
          </span>
        </button>
      </PerkTooltip>
      <PerkTooltip
        alterations={defender.schematicAlterations}
        records={records}
        title={weaponRecord?.name ?? 'Default weapon'}
      >
        <Button onClick={onPickWeapon} size="sm" variant="secondary">
          {defender.schematicTemplateId && (
            <ItemIcon
              records={records}
              size="small"
              templateId={defender.schematicTemplateId}
            />
          )}
          <span className="max-w-40 truncate">
            {weaponRecord?.name ?? 'Default weapon'}
          </span>
        </Button>
      </PerkTooltip>
    </div>
  )
}

function PerkTooltip({
  alterations,
  children,
  className,
  namedPerks = [],
  records,
  title,
}: {
  alterations: Array<string>
  children: ReactNode
  className?: string
  namedPerks?: Array<ItemRecordPerk>
  records: ItemRecordMap
  title: string
}) {
  const perks = [
    ...namedPerks,
    ...alterations.map((alteration) => ({
      name:
        getItemRecord(records, alteration)?.name ??
        (alteration.split(':').pop() ?? alteration)
          .replace(/^aid_att_/, '')
          .replace(/_t\d+$/i, '')
          .replaceAll('_', ' '),
      description: getItemRecord(records, alteration)?.description ?? null,
    })),
  ]

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 p-3" side="top">
          <p className="text-xs font-semibold">{title}</p>
          {perks.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {perks.map((perk, index) => (
                <li key={`${perk.name}-${index}`}>
                  <span className="font-medium text-foreground">
                    {perk.name}
                  </span>
                  {perk.description && (
                    <span className="mt-0.5 block">{perk.description}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No perk data available.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * One labelled band of the card.
 *
 * The game separates its bands with a full-width rule and a heading in the
 * corner, and that is what makes a loadout scannable — you find the support
 * team by looking for the word, not by counting portraits. Same rule here,
 * at the panel's own gutter, with the count on the right for the one band
 * where "how many are filled" is a question worth answering at a glance.
 */
function Band({
  children,
  count,
  icon: Icon,
  title,
}: {
  children: ReactNode
  /** Filled-of-total, when the band is a set of seats. */
  count?: string
  icon: LucideIcon
  title: string
}) {
  return (
    <section className="border-b border-border/60 px-2 py-1.5 last:border-b-0">
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <Icon className="size-3 shrink-0 text-muted-foreground/70" />
        <h3 className="section-label">{title}</h3>
        {count && (
          <span className="figure micro-label ml-auto">{count}</span>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * A hero in a seat: portrait, who they are, what they grant, what they are
 * worth.
 *
 * The perk is the second line rather than a hover-only detail because it is
 * the reason the seat is filled the way it is — swapping a support hero is a
 * choice between two perks, and a grid of portraits hides exactly that. The
 * lead seat takes the bigger portrait and gets its perk's description as
 * well; a support row keeps the perk to its name, or five descriptions would
 * bury the commander the card is built around.
 *
 * Everything inside is phrasing content — spans, never divs — because the row
 * itself is the button that opens the hero picker.
 */
function HeroSlot({
  isLead = false,
  member,
  onInspect,
  onPick,
  perk,
  perkTemplate,
  power,
  records,
}: {
  /** The commander seat: bigger art, and the perk's description with it. */
  isLead?: boolean
  member: LoadoutMember | null
  /** Absent while the seat is empty — there is nothing to inspect. */
  onInspect?: () => void
  onPick: () => void
  perk: ItemRecordPerk | null
  perkTemplate: string | null
  power: number | null
  records: ItemRecordMap
}) {
  if (!member?.templateId) {
    return (
      <button
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60',
          'px-2 py-1 text-left text-muted-foreground transition-colors',
          'hover:border-primary/50 hover:text-primary'
        )}
        onClick={onPick}
        type="button"
      >
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-lg bg-muted/30',
            isLead ? 'size-10' : 'size-8'
          )}
        >
          <Plus className="size-4" />
        </span>
        <span className="text-[0.8125rem]">
          {isLead ? 'No commander — pick one' : 'Empty support slot'}
        </span>
      </button>
    )
  }

  const record = getItemRecord(records, member.templateId)
  const caption = [record?.rarity, record?.subType]
    .filter(Boolean)
    .join(' · ')

  const row = (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left',
        'transition-colors hover:bg-accent/40'
      )}
      onClick={onPick}
      title="Click to change · right-click for more"
      type="button"
    >
      <ItemIcon
        records={records}
        size={isLead ? 'large' : 'small'}
        templateId={member.templateId}
      />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-semibold leading-tight',
            'text-[0.8125rem]'
          )}
        >
          {record?.name ?? member.templateId.split(':').pop()}
        </span>
        {caption && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {caption}
          </span>
        )}

        {perk && (
          <span
            className="mt-0.5 flex items-center gap-1.5"
            title={perk.description ?? undefined}
          >
            {perkTemplate ? (
              <ItemIcon
                records={records}
                size="small"
                templateId={perkTemplate}
              />
            ) : (
              <Star className="mt-0.5 size-3 shrink-0 text-muted-foreground/70" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground/90">
                {perk.name}
              </span>
            </span>
          </span>
        )}
      </span>

      {power !== null && power > 0 && (
        <span className="flex shrink-0 items-center gap-1">
          <Zap className="size-3 text-muted-foreground" />
          <span className="figure text-sm font-bold">{power}</span>
        </span>
      )}
    </button>
  )

  if (!onInspect) {
    return row
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onPick}>
          <Repeat className="mr-2 size-3.5" />
          Change hero
        </ContextMenuItem>
        <ContextMenuItem onSelect={onInspect}>
          <Info className="mr-2 size-3.5" />
          Inspect
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
