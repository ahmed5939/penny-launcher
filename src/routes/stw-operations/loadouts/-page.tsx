import { Route } from './route'
import type { ReactNode } from 'react'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type {
  LoadoutEntry,
  LoadoutsPayload,
} from '../../../kernel/core/loadouts'
import type {
  ItemRecordMap,
  ItemRecordPerk,
} from '../../../kernel/core/item-database'
import type { InventoryItem } from '../../../kernel/core/inventory'

import {
  ClipboardPaste,
  Gamepad2,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { ItemDetailDialog } from '../../../components/items/item-detail'
import { ItemIcon } from '../../../components/items/item-icon'
import { ItemTile } from '../../../components/items/item-tile'
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
  AccountResourceGate,
  EmptyState,
  PageHeader,
  RefreshButton,
  SearchField,
  Segmented,
  useAccountResource,
} from '../../../components/page'
import { loadInventory } from '../inventory/-hooks'
import { LoadoutBoard } from './-board'
import { CopyLoadoutDialog, ImportLoadoutDialog } from './-copy-dialog'
import { requestLoadouts } from './-requests'

import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { computeItemPower } from '../../../config/constants/fortnite/power'

import { toast } from '../../../lib/notifications'
import { cn } from '../../../lib/utils'

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
const heroClassOptions = [
  { label: 'All classes', value: 'All' },
  { label: 'Soldier', value: 'Soldier' },
  { label: 'Constructor', value: 'Constructor' },
  { label: 'Ninja', value: 'Ninja' },
  { label: 'Outlander', value: 'Outlander' },
]

function loadoutTitle(loadout: LoadoutEntry) {
  const name = loadout.name?.trim() ?? ''
  const generated = name.length < 1 || /^[A-Za-z0-9]{6,}$/.test(name)

  return generated ? `Loadout ${loadout.position}` : name
}

/** What the page reads: the loadouts, and the vault as the pool to fill them from. */
type LoadoutsData = {
  accountId: string
  availableGadgets: Array<string>
  availableTeamPerks: LoadoutsPayload['availableTeamPerks']
  defenders: Array<InventoryItem>
  heroes: Array<InventoryItem>
  loadouts: Array<LoadoutEntry>
  schematics: Array<InventoryItem>
}

async function loadLoadouts(accountId: string): Promise<LoadoutsData> {
  /*
   * The vault only feeds the pickers. If it fails the loadouts still show —
   * the pickers are just empty, as they always were in that case.
   */
  const [payload, inventory] = await Promise.all([
    requestLoadouts(accountId),
    loadInventory(accountId).catch(() => null),
  ])

  if (payload.errorMessage) {
    throw new Error(
      payload.errorMessage === 'Unknown Error'
        ? 'Epic did not return the loadouts. Try Refresh.'
        : payload.errorMessage
    )
  }

  const items = inventory?.errorMessage ? [] : inventory?.items ?? []

  return {
    accountId: payload.accountId,
    availableGadgets: payload.availableGadgets,
    availableTeamPerks: payload.availableTeamPerks ?? [],
    defenders: items.filter((item) => item.kind === 'defender'),
    heroes: items.filter((item) => item.kind === 'hero'),
    loadouts: payload.loadouts,
    schematics: items.filter((item) => item.kind === 'schematic'),
  }
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  const resource = useAccountResource(loadLoadouts, {
    cacheKey: 'loadouts',
    fallbackError: 'Could not read the loadouts. Try Refresh.',
    owner: (data) => data.accountId,
  })
  const [importing, setImporting] = useState(false)

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button
              disabled={!resource.accountId}
              onClick={() => setImporting(true)}
              variant="secondary"
            >
              <ClipboardPaste className="size-4" />
              Import code
            </Button>
            <RefreshButton
              disabled={!resource.accountId}
              loading={resource.loading}
              onClick={resource.refresh}
            />
          </>
        }
        icon={Gamepad2}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.loadouts')}
        description="Every loadout the account has saved, in the game's own order. Click any seat, gadget, defender or weapon to change it; right-click a hero to inspect them."
      />
      <AccountResourceGate
        icon={Gamepad2}
        loading={{
          title: 'Loading loadouts…',
          description: 'Reading the saved loadouts and the heroes, defenders and schematics to fill them with.',
        }}
        resource={resource}
        what="the loadouts"
      >
        {(data) => (
          <Content
            data={data}
            key={data.accountId}
            reload={resource.refresh}
          />
        )}
      </AccountResourceGate>
      <ImportLoadoutDialog onOpenChange={setImporting} open={importing} />
    </>
  )
}

function Content({
  data,
  reload,
}: {
  data: LoadoutsData
  reload: () => void
}) {
  const { loadout: requestedLoadout } = Route.useSearch()
  useRequestItemDatabase()

  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  const { availableGadgets, availableTeamPerks, defenders, heroes, loadouts, schematics } = data
  const [detail, setDetail] = useState<ItemDetailSubject | null>(null)
  /* A loadout linked to by id is scrolled to once the board has drawn. */
  useEffect(() => {
    if (requestedLoadout) {
      document.getElementById(`loadout-${requestedLoadout}`)?.scrollIntoView({ block: 'center' })
    }
  }, [requestedLoadout])
  const [isEditing, setEditing] = useState(false)
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
  /** The loadout being copied to another account. */
  const [copying, setCopying] = useState<{ loadout: LoadoutEntry; title: string } | null>(null)
  /** The loadout waiting for a team perk to be picked for it. */
  const [pendingTeamPerk, setPendingTeamPerk] = useState<string | null>(null)
  const [heroClass, setHeroClass] = useState('All')
  const [heroSearch, setHeroSearch] = useState('')

  useEffect(() => {
    const listener = window.electronAPI.notificationLoadoutEdit(
      async (response) => {
        if (response.accountId !== accountId) return

        /* A copy or import into this account reports through its own dialog. */
        if (response.kind === 'copy') {
          if (!response.errorMessage) reload()
          return
        }

        setEditing(false)
        setPendingSlot(null)
        setPendingWeapon(null)
        setPendingGadget(null)
        setPendingTeamPerk(null)

        toast[response.errorMessage ? 'error' : 'success'](
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
                    : response.kind === 'assign-team-perk'
                      ? 'Team perk changed'
                    : 'Hero assigned'
        )

        /* The loadouts stay on screen while the edited copy loads. */
        reload()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

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

  return (
    <>
      {/* What the go-to-top button watches: once this scrolls away, it shows. */}
      <div id="loadouts-card" />

      {loadouts.length > 0 && (
        <LoadoutBoard
          actions={{
            isEditing,
            onActivate: (loadoutId) => edit({ kind: 'activate', loadoutId }),
            onClear: (loadoutId) => edit({ kind: 'clear', loadoutId }),
            onCopyToAccount: (loadout, title) => setCopying({ loadout, title }),
            onInspect: setDetail,
            onPickGadget: (loadoutId, slotIndex) => setPendingGadget({ loadoutId, slotIndex }),
            onPickTeamPerk: setPendingTeamPerk,
            onPickSlot: (loadoutId, slot, kind) => setPendingSlot({ loadoutId, slot, kind }),
            onPickWeapon: (loadoutId, defenderId, defenderTemplateId) =>
              setPendingWeapon({ loadoutId, defenderId, defenderTemplateId }),
          }}
          highlighted={requestedLoadout}
          sharedBy={selected?.displayName}
          loadouts={loadouts}
          ratings={ratings}
          records={records}
          titleOf={loadoutTitle}
        />
      )}

      {loadouts.length <= 0 && (
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
              <Segmented
                onChange={setHeroClass}
                options={heroClassOptions}
                value={heroClass}
              />
              <SearchField
                className="block"
                label="Search heroes or perks"
                onChange={setHeroSearch}
                placeholder="Search heroes or perks"
                value={heroSearch}
              />
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
        onOpenChange={(open) => !open && setPendingTeamPerk(null)}
        open={pendingTeamPerk !== null}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pick a team perk</DialogTitle>
            <DialogDescription>
              The team perk works with the classes of the support team; it switches on in game once they match.
            </DialogDescription>
          </DialogHeader>
          {availableTeamPerks.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[...availableTeamPerks]
                .sort((a, b) =>
                  (getItemRecord(records, a.templateId)?.name ?? a.templateId).localeCompare(
                    getItemRecord(records, b.templateId)?.name ?? b.templateId
                  )
                )
                .map((perk) => {
                  const record = getItemRecord(records, perk.templateId)
                  const current = loadouts.find((loadout) => loadout.itemId === pendingTeamPerk)?.teamPerkId === perk.itemId

                  return (
                    <button
                      className={cn(
                        'flex min-w-0 items-start gap-2.5 rounded-lg bg-muted/40 p-2 text-left transition-colors hover:bg-accent/40 disabled:opacity-60',
                        current && 'ring-1 ring-inset ring-primary'
                      )}
                      disabled={isEditing || current}
                      key={perk.itemId}
                      onClick={() =>
                        pendingTeamPerk &&
                        edit({ kind: 'assign-team-perk', loadoutId: pendingTeamPerk, teamPerkId: perk.itemId })
                      }
                      type="button"
                    >
                      <ItemIcon records={records} templateId={perk.templateId} />
                      <span className="min-w-0">
                        <span className="block truncate text-ui font-semibold">
                          {record?.name ?? perk.templateId.split(':').pop()}
                          {current && <span className="ml-1.5 text-xs font-normal text-primary">Equipped</span>}
                        </span>
                        {record?.description && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{record.description}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
            </div>
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-6"
              description="This account owns no team perks."
              icon={Users}
              title="Nothing to pick"
            />
          )}
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

      <CopyLoadoutDialog
        fromAccountId={accountId}
        loadout={copying?.loadout ?? null}
        onOpenChange={(open) => !open && setCopying(null)}
        records={records}
        title={copying?.title ?? ''}
      />

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
