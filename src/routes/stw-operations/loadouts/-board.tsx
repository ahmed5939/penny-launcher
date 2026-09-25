import type { ReactNode } from 'react'
import type { ItemDetailSubject } from '../../../components/items/item-detail'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { LoadoutDefender, LoadoutEntry, LoadoutMember } from '../../../kernel/core/loadouts'
import type { RatingTables } from '../../../config/constants/fortnite/power'

import { CheckCheck, Eraser, Info, Plus, Repeat, Shield, ShieldHalf, Users } from 'lucide-react'

import { Artboard, BadgeMark, itemBadgeMarks } from '../../../components/items/artboard'
import { itemBadge, resolveItemArt } from '../../../components/items/item-icon'
import { StatusPill } from '../../../components/page'
import { Button } from '../../../components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../../components/ui/context-menu'

import { getItemRecord } from '../../../state/items/database'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import { raritiesColor, RarityType } from '../../../config/constants/resources'

import { cn } from '../../../lib/utils'

import { ShareMenu } from './-share'
import { LoadoutShareCard } from './-share-card'

export type BoardActions = {
  isEditing: boolean
  onActivate: (loadoutId: string) => void
  onClear: (loadoutId: string) => void
  onCopyToAccount: (loadout: LoadoutEntry, title: string) => void
  onInspect: (subject: ItemDetailSubject) => void
  onPickGadget: (loadoutId: string, slotIndex: number) => void
  onPickTeamPerk: (loadoutId: string) => void
  onPickSlot: (loadoutId: string, slot: string, kind: 'hero' | 'defender') => void
  onPickWeapon: (loadoutId: string, defenderId: string, defenderTemplateId: string) => void
}

/**
 * Every loadout at once, the way the Penny database profile lays them out —
 * and the place you change them. A card per loadout: the commander large on
 * the rarity artboard, the support team under it, the team perk, the two
 * gadgets and the three defenders with their weapons. Every seat is its own
 * button (click to change, right-click to inspect), so reading and editing
 * are one view rather than two.
 */
export function LoadoutBoard({
  actions,
  highlighted,
  loadouts,
  ratings,
  records,
  sharedBy,
  titleOf,
}: {
  actions: BoardActions
  sharedBy?: string
  /** A loadout linked to by id, ringed so it can be found. */
  highlighted?: string
  loadouts: Array<LoadoutEntry>
  ratings: RatingTables
  records: ItemRecordMap
  titleOf: (loadout: LoadoutEntry) => string
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-4">
      {loadouts.map((loadout) => (
        <LoadoutCard
          actions={actions}
          highlighted={loadout.itemId === highlighted}
          key={loadout.itemId}
          loadout={loadout}
          ratings={ratings}
          records={records}
          sharedBy={sharedBy}
          title={titleOf(loadout)}
        />
      ))}
    </div>
  )
}

function power(member: LoadoutMember | null, ratings: RatingTables) {
  return member?.templateId
    ? computeItemPower({ level: member.level, tables: ratings, templateId: member.templateId })
    : null
}

function inspectSubject(member: LoadoutMember | LoadoutDefender): ItemDetailSubject {
  return {
    alterations: 'alterations' in member ? member.alterations : undefined,
    itemId: member.itemId ?? undefined,
    level: member.level,
    templateId: member.templateId as string,
    tier: member.tier,
  }
}

function LoadoutCard({
  actions,
  highlighted,
  loadout,
  ratings,
  records,
  sharedBy,
  title,
}: {
  actions: BoardActions
  highlighted: boolean
  /** The account's display name, printed on a shared image. */
  sharedBy?: string
  loadout: LoadoutEntry
  ratings: RatingTables
  records: ItemRecordMap
  title: string
}) {
  const commander = loadout.commander?.templateId ? loadout.commander : null
  const record = commander ? getItemRecord(records, commander.templateId as string) : null
  const art = commander ? resolveItemArt(commander.templateId as string, records) : null
  const marks = commander ? itemBadgeMarks({ record, templateId: commander.templateId as string }) : []
  const commanderPower = power(commander, ratings)
  const commanderPerk = record?.commanderPerk ?? record?.perk ?? null
  const teamPerk = loadout.teamPerk ? getItemRecord(records, loadout.teamPerk) : null
  const accent = art ? (raritiesColor[art.rarity as RarityType] ?? raritiesColor[RarityType.Common]) : null
  const filledDefenders = loadout.defenders.filter((defender) => defender.templateId).length

  return (
    <section
      aria-label={title}
      className={cn(
        'relative flex min-w-0 flex-col rounded-xl bg-card p-3 ring-1 ring-inset ring-border/60',
        loadout.active && 'ring-primary/50',
        highlighted && 'ring-2 ring-primary'
      )}
      id={`loadout-${loadout.itemId}`}
      style={{ borderLeft: `3px solid ${loadout.active ? 'hsl(var(--primary))' : (accent ?? 'hsl(var(--border))')}` }}
    >
      {/* Header: number, commander, class, and the loadout's own actions. */}
      <div className="flex items-start gap-2.5">
        <span className="figure mt-px w-5 shrink-0 text-title font-bold text-muted-foreground">{loadout.position}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-title font-semibold leading-tight">{record?.name ?? title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {marks[0] && <BadgeMark className="size-4" mark={marks[0]} />}
            {record?.subType ?? 'No commander'}
          </p>
        </div>
        {loadout.active ? (
          <StatusPill tone="active">Equipped</StatusPill>
        ) : (
          <Button
            className="h-7 px-2 text-xs"
            data-share-hide
            disabled={actions.isEditing}
            onClick={() => actions.onActivate(loadout.itemId)}
            size="sm"
            variant="secondary"
          >
            <CheckCheck className="size-3.5" />
            Equip
          </Button>
        )}
        <Button
          aria-label={`Clear ${title}`}
          className="size-7 p-0"
          data-share-hide
          disabled={actions.isEditing}
          onClick={() => actions.onClear(loadout.itemId)}
          size="sm"
          title="Empty every slot in this loadout"
          variant="ghost"
        >
          <Eraser className="size-3.5" />
        </Button>
        <ShareMenu
          card={() => (
            <LoadoutShareCard loadout={loadout} ratings={ratings} records={records} sharedBy={sharedBy} title={title} />
          )}
          fileName={`${(sharedBy ?? 'penny').replace(/[^\w-]+/g, '-')}-loadout-${loadout.position}`}
          onCopyToAccount={() => actions.onCopyToAccount(loadout, title)}
        />
      </div>

      <span className="my-3 h-px bg-border/60" />

      {/* Commander. */}
      <Seat
        actions={actions}
        disabled={actions.isEditing}
        label={commander ? `Change the commander, ${art?.name}` : 'Pick a commander'}
        member={commander}
        onPick={() => actions.onPickSlot(loadout.itemId, 'commanderslot', 'hero')}
      >
        <Artboard className="aspect-[1/0.9] w-full rounded-lg" rarity={art?.rarity}>
          {art?.imgUrl ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              decoding="async"
              loading="lazy"
              src={art.largeImgUrl ?? art.imgUrl}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Plus className="size-6" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-1.5 pt-6 text-center">
            <span className="block text-xs font-semibold text-white">
              Commander{commanderPower ? <span className="figure"> · {commanderPower}</span> : null}
            </span>
            {commanderPerk && (
              <span
                className="mt-1 flex min-w-0 items-center justify-center gap-1.5"
                title={commanderPerk.description ? `${commanderPerk.name} — ${commanderPerk.description}` : commanderPerk.name}
              >
                <PerkMark
                  className="size-6"
                  records={records}
                  templateId={record?.commanderPerkTemplate ?? record?.perkTemplate ?? null}
                />
                <span className="truncate text-2xs font-medium text-white/90">{commanderPerk.name}</span>
              </span>
            )}
          </span>
        </Artboard>
      </Seat>

      {/* Support team. */}
      <Heading icon={Users}>Support team</Heading>
      <div className="grid grid-cols-5 gap-1">
        {loadout.team.map((member) => {
          const memberArt = member.templateId ? resolveItemArt(member.templateId, records) : null
          const memberPower = power(member, ratings)
          const perk = member.templateId ? getItemRecord(records, member.templateId)?.perk : null

          return (
            <Seat
              actions={actions}
              disabled={actions.isEditing}
              key={member.slot}
              label={memberArt ? `Change ${memberArt.name}${perk ? ` — ${perk.name}` : ''}` : 'Fill this support slot'}
              member={member.templateId ? member : null}
              onPick={() => actions.onPickSlot(loadout.itemId, member.slot, 'hero')}
            >
              <Artboard className="aspect-square w-full rounded-md" rarity={memberArt?.rarity}>
                {memberArt?.imgUrl ? (
                  <img alt="" className="absolute inset-0 size-full object-cover object-top" decoding="async" loading="lazy" src={memberArt.imgUrl} />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <Plus className="size-3" />
                  </span>
                )}
                {memberPower ? (
                  <span className={cn(itemBadge, 'figure bottom-0.5 right-0.5 rounded px-0.5 text-3xs')}>{memberPower}</span>
                ) : null}
                {member.templateId && (
                  <PerkMark
                    className="absolute left-0.5 top-0.5 size-5"
                    records={records}
                    templateId={getItemRecord(records, member.templateId)?.perkTemplate ?? null}
                  />
                )}
              </Artboard>
            </Seat>
          )
        })}
      </div>

      {/* Team perk. */}
      <Heading icon={Shield}>Team perk</Heading>
      <button
        className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-left transition-colors hover:bg-accent/40 disabled:opacity-60"
        disabled={actions.isEditing}
        onClick={() => actions.onPickTeamPerk(loadout.itemId)}
        title={teamPerk?.description ? `${teamPerk.name} — ${teamPerk.description}` : 'Change the team perk'}
        type="button"
      >
        {loadout.teamPerk && teamPerk ? (
          <>
            <Glyph records={records} templateId={loadout.teamPerk} />
            <span className="min-w-0">
              <span className="block truncate text-ui font-medium">{teamPerk.name}</span>
              {teamPerk.description && (
                <span className="block truncate text-2xs text-muted-foreground">{teamPerk.description}</span>
              )}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-ui text-muted-foreground">
            <Plus className="size-3.5" />
            Pick a team perk
          </span>
        )}
      </button>

      {/* Gadgets. */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {loadout.gadgets.map((gadget, index) => (
          <button
            className="flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/40 px-1.5 py-1 text-left transition-colors hover:bg-accent/40 disabled:opacity-60"
            disabled={actions.isEditing}
            key={index}
            onClick={() => actions.onPickGadget(loadout.itemId, index)}
            title="Change this gadget"
            type="button"
          >
            {gadget ? (
              <>
                <Glyph records={records} templateId={gadget} />
                <span className="line-clamp-2 text-2xs leading-tight">
                  {getItemRecord(records, gadget)?.name ?? gadget.split(':').pop()}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                <Plus className="size-3" />
                Gadget {index + 1}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Defenders. */}
      <Heading count={`${filledDefenders}/${loadout.defenders.length}`} icon={ShieldHalf}>
        Defenders
      </Heading>
      <div className="space-y-1">
        {loadout.defenders.map((defender) => (
          <DefenderRow
            actions={actions}
            defender={defender}
            key={defender.slot}
            loadoutId={loadout.itemId}
            ratings={ratings}
            records={records}
          />
        ))}
      </div>
    </section>
  )
}

function Heading({ children, count, icon: Icon }: { children: ReactNode; count?: string; icon: typeof Users }) {
  return (
    <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Icon className="size-3" />
      {children}
      {count && <span className="figure ml-auto font-normal">{count}</span>}
    </p>
  )
}

/**
 * One seat: a button that picks who sits in it, with Inspect on right-click
 * when someone does.
 */
function Seat({
  actions,
  children,
  disabled,
  label,
  member,
  onPick,
}: {
  actions: BoardActions
  children: ReactNode
  disabled: boolean
  label: string
  member: LoadoutMember | LoadoutDefender | null
  onPick: () => void
}) {
  const button = (
    <button
      aria-label={label}
      className="group block w-full rounded-lg text-left transition-transform duration-150 ease-out hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
      disabled={disabled}
      onClick={onPick}
      title={`${label} · right-click for more`}
      type="button"
    >
      {children}
    </button>
  )

  if (!member?.templateId) return button

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onPick}>
          <Repeat className="mr-2 size-3.5" />
          Change
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onInspect(inspectSubject(member))}>
          <Info className="mr-2 size-3.5" />
          Inspect
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * "Legendary Assault Defender" → "Assault Defender": the rarity is already
 * the artboard's colour, and the full name does not fit beside a weapon.
 */
function defenderName(name: string) {
  return name.replace(/^(Common|Uncommon|Rare|Epic|Legendary|Mythic)\s+/i, '')
}

function DefenderRow({
  actions,
  defender,
  loadoutId,
  ratings,
  records,
}: {
  actions: BoardActions
  defender: LoadoutDefender
  loadoutId: string
  ratings: RatingTables
  records: ItemRecordMap
}) {
  const art = defender.templateId ? resolveItemArt(defender.templateId, records) : null
  const weapon = defender.schematicTemplateId ? resolveItemArt(defender.schematicTemplateId, records) : null
  const defenderPower = power(defender, ratings)

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 p-1">
      <div className="w-9 shrink-0">
        <Seat
          actions={actions}
          disabled={actions.isEditing}
          label={art ? `Change ${art.name}` : 'Pick a defender'}
          member={defender.templateId ? defender : null}
          onPick={() => actions.onPickSlot(loadoutId, defender.slot, 'defender')}
        >
          <Artboard className="size-9 rounded" rarity={art?.rarity}>
            {art?.imgUrl ? (
              <img alt="" className="absolute inset-0 size-full object-cover object-top" decoding="async" loading="lazy" src={art.imgUrl} />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Plus className="size-3" />
              </span>
            )}
            {defenderPower ? (
              <span className={cn(itemBadge, 'figure bottom-0 right-0 rounded px-0.5 text-3xs')}>{defenderPower}</span>
            ) : null}
          </Artboard>
        </Seat>
      </div>

      <div className="min-w-0 flex-1">
        <button
          className="block w-full truncate text-left text-xs font-medium hover:text-primary disabled:opacity-60"
          disabled={actions.isEditing}
          onClick={() => actions.onPickSlot(loadoutId, defender.slot, 'defender')}
          title={art ? `Change ${art.name}` : 'Pick a defender'}
          type="button"
        >
          {art ? defenderName(art.name) : 'Empty defender slot'}
        </button>
        {defender.itemId && defender.templateId && (
          <button
            className="mt-0.5 flex w-full min-w-0 items-center gap-1 text-left text-2xs text-muted-foreground hover:text-primary disabled:opacity-60"
            disabled={actions.isEditing}
            onClick={() => actions.onPickWeapon(loadoutId, defender.itemId as string, defender.templateId as string)}
            title="Change this defender's weapon"
            type="button"
          >
            {weapon?.imgUrl && <img alt="" className="size-4 shrink-0 object-contain" src={weapon.imgUrl} />}
            <span className="truncate">{weapon?.name ?? 'Default weapon'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A hero perk's icon. The game draws its perk glyphs white on a dark disc,
 * so they get one here too — on a bright rarity artboard a bare white glyph
 * disappears.
 */
function PerkMark({
  className,
  records,
  templateId,
}: {
  className?: string
  records: ItemRecordMap
  templateId: string | null
}) {
  if (!templateId) return null

  const art = resolveItemArt(templateId, records)

  if (!art.imgUrl) return null

  return (
    <span
      className={cn(
        'z-10 grid shrink-0 place-items-center rounded-full bg-black/70 p-0.5 shadow-[0_1px_3px_rgb(0_0_0/0.5)] ring-1 ring-white/25',
        className
      )}
      title={art.name}
    >
      <img alt={art.name} className="size-full object-contain" decoding="async" loading="lazy" src={art.imgUrl} />
    </span>
  )
}

/** A perk or gadget icon, as the site draws them. */
function Glyph({ records, templateId }: { records: ItemRecordMap; templateId: string }) {
  const art = resolveItemArt(templateId, records)

  return art.imgUrl ? (
    <img alt="" className="size-6 shrink-0 object-contain" decoding="async" loading="lazy" src={art.imgUrl} />
  ) : (
    <span className="size-6 shrink-0" />
  )
}
