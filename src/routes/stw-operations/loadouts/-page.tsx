import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type {
  LoadoutEntry,
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
  Shield,
  Star,
  UserX,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
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
        <div className="grid gap-3 xl:grid-cols-2">
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
 * Defenders are the one band the game has and this does not: the profile's
 * loadout item carries a commander, five crew members, a team perk and
 * gadgets, and nothing about defenders at all.
 */
function LoadoutCard({
  isEditing,
  loadout,
  onActivate,
  onClear,
  onInspect,
  onPickSlot,
  ratings,
  records,
}: {
  isEditing: boolean
  loadout: LoadoutEntry
  onActivate: () => void
  onClear: () => void
  onInspect: (subject: ItemDetailSubject) => void
  onPickSlot: (slot: string) => void
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
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
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
          onPick={() => onPickSlot('commanderslot')}
          perk={
            commanderRecord?.commanderPerk ?? commanderRecord?.perk ?? null
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
          <div className="flex items-start gap-3 px-2.5 py-2">
            <ItemIcon
              records={records}
              size="large"
              templateId={loadout.teamPerk as string}
            />
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-semibold leading-tight">
                {teamPerk.name}
              </p>
              {teamPerk.description && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
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
              onPick={() => onPickSlot(member.slot)}
              perk={
                member.templateId
                  ? getItemRecord(records, member.templateId)?.perk ?? null
                  : null
              }
              power={memberPower(member)}
              records={records}
            />
          ))}
        </div>
      </Band>

      {loadout.gadgets.length > 0 && (
        <Band
          icon={Rocket}
          title="Gadgets"
        >
          <div className="flex flex-wrap gap-2 px-2.5 py-1">
            {loadout.gadgets.map((gadget) => (
              <span
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/50 py-1 pl-1 pr-2.5 text-xs"
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
        </Band>
      )}
    </Panel>
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
    <section className="border-b border-border/60 px-2.5 py-2.5 last:border-b-0">
      <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
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
  power: number | null
  records: ItemRecordMap
}) {
  if (!member?.templateId) {
    return (
      <button
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-border/60',
          'px-2.5 py-2 text-left text-muted-foreground transition-colors',
          'hover:border-primary/50 hover:text-primary'
        )}
        onClick={onPick}
        type="button"
      >
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-lg bg-muted/30',
            isLead ? 'size-16' : 'size-12'
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
  const caption = [
    record?.rarity,
    record?.subType,
    member.level > 0 && `Level ${member.level}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const row = (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
        'transition-colors hover:bg-accent/40'
      )}
      onClick={onPick}
      title="Click to change · right-click for more"
      type="button"
    >
      <ItemIcon
        records={records}
        size={isLead ? 'xl' : 'large'}
        templateId={member.templateId}
      />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-semibold leading-tight',
            isLead ? 'text-sm' : 'text-[0.8125rem]'
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
            className="mt-1 flex items-start gap-1.5"
            title={perk.description ?? undefined}
          >
            <Star className="mt-0.5 size-3 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground/90">
                {perk.name}
              </span>
              {isLead && perk.description && (
                <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {perk.description}
                </span>
              )}
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
