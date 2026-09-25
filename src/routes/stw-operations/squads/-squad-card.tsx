import type { SquadView } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { Crown, Plus, Users, X, Zap } from 'lucide-react'

import {
  Artboard,
  BadgeMark,
  badgeUrl,
  itemBadgeMarks,
  setBonusInfo,
} from '../../../components/items/artboard'
import { itemBadge, resolveItemArt } from '../../../components/items/item-icon'
import { Panel, PanelBody, PanelHeader, StatusPill } from '../../../components/page'

import { getItemRecord } from '../../../state/items/database'

import { fortStats, type FortStatKey } from '../../../config/constants/fortnite/fort'
import { squadAttributeStats } from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

const attributeStats: Record<string, FortStatKey> = squadAttributeStats

const fortStatByKey = new Map(fortStats.map((stat) => [stat.key, stat]))

/** The squad's own emblem, as the game and the site draw it. */
const squadEmblems: Record<string, string> = {
  Squad_Attribute_Arms_CloseAssaultSquad: 'squads-close_assault_squad',
  Squad_Attribute_Arms_FireTeamAlpha: 'squads-fire_team_alpha_squad',
  Squad_Attribute_Medicine_EMTSquad: 'squads-emt_squad',
  Squad_Attribute_Medicine_TrainingTeam: 'squads-training_team_squad',
  Squad_Attribute_Scavenging_Gadgeteers: 'squads-gadgeteers_squad',
  Squad_Attribute_Scavenging_ScoutingParty: 'squads-scouting_party_squad',
  Squad_Attribute_Synthesis_CorpsofEngineering: 'squads-engineering_squad',
  Squad_Attribute_Synthesis_TheThinkTank: 'squads-think_tank_squad',
}

/**
 * How many survivors of one set bonus it takes to switch it on, and what one
 * activation is worth — the table PennyDB publishes with every profile
 * (`survivor_bonus_overview`), so the launcher and the site agree.
 */
const setRules: Record<string, { need: number; pct: number }> = {
  'Ability Damage': { need: 3, pct: 5 },
  Health: { need: 2, pct: 5 },
  'Melee Damage': { need: 3, pct: 5 },
  'Ranged Damage': { need: 3, pct: 5 },
  Shield: { need: 2, pct: 5 },
  'Shield Regeneration': { need: 2, pct: 5 },
  'Trap Damage': { need: 3, pct: 5 },
  'Trap Durability': { need: 2, pct: 8 },
}

export type SetBonusTally = {
  count: number
  file: string
  label: string
  need: number
  pct: number
}

/** The set bonuses a squad's survivors carry, most complete first. */
export function squadSetBonuses(squad: SquadView): Array<SetBonusTally> {
  const tally = new Map<string, SetBonusTally>()

  squad.slots.forEach((slot) => {
    if (!slot.survivor || slot.slotIndex === 0) return

    const info = setBonusInfo(slot.survivor.setBonus)

    if (!info) return

    const rule = setRules[info.label] ?? { need: 3, pct: 5 }
    const entry = tally.get(info.label) ?? {
      count: 0,
      file: info.file,
      label: info.label,
      need: rule.need,
      pct: rule.pct,
    }

    entry.count += 1
    tally.set(info.label, entry)
  })

  return [...tally.values()].sort(
    (a, b) => Math.floor(b.count / b.need) - Math.floor(a.count / a.need) || b.count - a.count
  )
}

/**
 * Every set bonus on the account and what it adds up to across the eight
 * squads — the site's "Bonuses" board.
 */
export function SetBonusBoard({ squads }: { squads: Array<SquadView> }) {
  const totals = new Map<string, SetBonusTally & { active: number }>()

  squads.forEach((squad) =>
    squadSetBonuses(squad).forEach((entry) => {
      const total = totals.get(entry.label) ?? { ...entry, active: 0, count: 0 }

      total.count += entry.count
      total.active += Math.floor(entry.count / entry.need)
      totals.set(entry.label, total)
    })
  )

  const all: Array<[string, string]> = [
    ['Melee Damage', 'survivors-melee_weapon_damage'],
    ['Ability Damage', 'survivors-ability_damage'],
    ['Ranged Damage', 'survivors-ranged_weapon_damage'],
    ['Trap Damage', 'survivors-trap_damage'],
    ['Health', 'survivors-health'],
    ['Shield', 'survivors-shield'],
    ['Shield Regeneration', 'survivors-shield_regeneration'],
    ['Trap Durability', 'survivors-trap_durability'],
  ]

  return (
    <Panel>
      <PanelHeader as="div" compact title="Set bonuses" />
      <PanelBody className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {all.map(([label, file]) => {
          const total = totals.get(label)
          const active = total?.active ?? 0
          const src = badgeUrl(file)

          return (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5',
                active === 0 && 'opacity-60'
              )}
              key={label}
            >
              {src && <img alt="" className="size-7 shrink-0 object-contain" src={src} />}
              <span className="min-w-0">
                <span className="block truncate text-ui text-muted-foreground">{label}</span>
                <span className="figure block text-lg font-bold leading-tight text-primary">
                  +{active * (setRules[label]?.pct ?? 5)}%
                  {active > 0 && (
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                      ×{active} active
                    </span>
                  )}
                </span>
              </span>
            </div>
          )
        })}
      </PanelBody>
    </Panel>
  )
}

export function SquadCard({
  isAssigning,
  onClear,
  onPick,
  records,
  squad,
}: {
  isAssigning: boolean
  onClear: (squadId: string, slotIndex: number) => void
  onPick: (slotIndex: number) => void
  records: ItemRecordMap
  squad: SquadView
}) {
  const stat = fortStatByKey.get(attributeStats[squad.attribute])
  const emblem = badgeUrl(squadEmblems[squad.id] ?? '')
  const bonuses = squadSetBonuses(squad)

  return (
    <Panel
      className="relative flex flex-col overflow-hidden p-3"
      style={{ borderLeft: `3px solid ${stat?.color ?? 'hsl(var(--border))'}` }}
    >
      {/* Header: emblem, name, members, power. */}
      <div className="flex items-center gap-3">
        {emblem ? (
          <img alt="" className="size-9 shrink-0 object-contain" src={emblem} />
        ) : (
          <Users className="size-6 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title font-semibold leading-tight">{squad.label}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium">
            <span style={stat ? { color: stat.color } : undefined}>
              {stat?.label ?? squad.attribute}
            </span>
            <span className="text-muted-foreground">
              <span className="figure">{squad.filled}</span>/8 members
            </span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-ui font-semibold">
          <Zap className="size-3.5 text-muted-foreground" />
          <span className="figure">{squad.power.toLocaleString()}</span>
        </span>
      </div>

      {/* Set bonuses the squad's survivors carry. */}
      <div className="mt-3 space-y-1 rounded-lg bg-background/40 p-1.5">
        {bonuses.length > 0 ? (
          bonuses.map((entry) => {
            const active = Math.floor(entry.count / entry.need)
            const src = badgeUrl(entry.file)

            return (
              <div
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                key={entry.label}
              >
                {src && <img alt="" className="size-4 object-contain" src={src} />}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-xs font-medium', active > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                    {entry.label}
                  </span>
                  <span className="block text-2xs text-muted-foreground">
                    <span className="figure">{entry.count}</span>/
                    <span className="figure">{entry.need}</span> survivors
                  </span>
                </span>
                {active > 0 ? (
                  <StatusPill tone="active">+{active * entry.pct}%</StatusPill>
                ) : (
                  <StatusPill tone="idle">Inactive</StatusPill>
                )}
              </div>
            )
          })
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No set bonus yet.</p>
        )}
      </div>

      {/*
        The lead first, then the seven supports — the order the game's own
        squad screen gives them.
      */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {squad.slots.map((slot) => (
          <SquadMember
            isAssigning={isAssigning}
            key={slot.slotIndex}
            onClear={() => onClear(squad.id, slot.slotIndex)}
            onPick={() => onPick(slot.slotIndex)}
            records={records}
            slot={slot}
            squadLabel={squad.label}
          />
        ))}
      </div>
    </Panel>
  )
}

function SquadMember({
  isAssigning,
  onClear,
  onPick,
  records,
  slot,
  squadLabel,
}: {
  isAssigning: boolean
  onClear: () => void
  onPick: () => void
  records: ItemRecordMap
  slot: SquadView['slots'][number]
  squadLabel: string
}) {
  const isLead = slot.slotIndex === 0

  if (!slot.survivor) {
    return (
      <button
        aria-label={isLead ? `Pick a lead for ${squadLabel}` : `Fill slot ${slot.slotIndex} of ${squadLabel}`}
        className="grid aspect-square w-full place-items-center content-center gap-0.5 rounded-md border border-dashed border-border/70 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        onClick={onPick}
        type="button"
      >
        {isLead ? <Crown className="size-4" /> : <Plus className="size-4" />}
        <span className="text-2xs">{isLead ? 'Lead' : 'Empty'}</span>
      </button>
    )
  }

  const survivor = slot.survivor
  const art = resolveItemArt(survivor.templateId, records, survivor.portrait)
  const marks = itemBadgeMarks({
    personality: survivor.personality,
    record: getItemRecord(records, survivor.templateId),
    setBonus: survivor.setBonus,
    templateId: survivor.templateId,
  })
  const match =
    slot.matchesLead === true
      ? ' · personality matches the lead'
      : slot.matchesLead === false
        ? ' · personality does not match the lead'
        : ''

  return (
    <div className="group relative">
      <button
        className={cn(
          'block w-full overflow-hidden rounded-md transition-transform duration-150 ease-out hover:-translate-y-0.5',
          isLead && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-card',
          slot.matchesLead === false && 'ring-1 ring-warning/70'
        )}
        onClick={onPick}
        title={`${survivor.name}${survivor.caption ? ` · ${survivor.caption}` : ''}${match}`}
        type="button"
      >
        <Artboard className="aspect-square w-full" rarity={art.rarity}>
          {art.imgUrl && (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover object-top"
              decoding="async"
              loading="lazy"
              src={art.imgUrl}
            />
          )}
          {marks.length > 0 && (
            <span className="absolute left-0.5 top-0.5 flex gap-0.5">
              {marks.map((entry) => (
                <BadgeMark className="size-4" key={entry.src} mark={entry} />
              ))}
            </span>
          )}
          {typeof survivor.power === 'number' && survivor.power > 0 && (
            <span className={cn(itemBadge, 'bottom-0.5 right-0.5 gap-0.5 rounded px-1 py-0.5')}>
              <span className="text-muted-foreground">PL</span>
              <span className="figure">{survivor.power}</span>
            </span>
          )}
        </Artboard>
      </button>
      <button
        aria-label={`Remove ${survivor.name} from the squad`}
        className="absolute -right-1 -top-1 z-20 grid size-5 place-items-center rounded-full bg-background text-muted-foreground opacity-0 shadow ring-1 ring-border transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        disabled={isAssigning}
        onClick={onClear}
        type="button"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
