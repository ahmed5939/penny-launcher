import type { CSSProperties, ReactNode } from 'react'
import type { ItemRecord } from '../../kernel/core/item-database'

import {
  artboardFloor,
  raritiesArtboard,
  RarityType,
} from '../../config/constants/resources'

import { cn } from '../../lib/utils'

/**
 * The artboard the Penny database site draws behind every item.
 *
 * The launcher used to put the art on the game's flat rarity plate — a
 * saturated square with the character spilling off its edges. The site
 * instead paints a diagonal wash: a pale cut of the rarity in the top left
 * corner, sinking through a deep cut of the same hue into near-black in the
 * bottom right, with a hairline ring in the rarity (`raritiesArtboard`).
 * Art sits on it the way it sits on the in-game card, and a shelf of forty
 * legendaries reads as one surface instead of forty orange stamps. Both places now draw the
 * same thing, so moving between the site and the launcher is seamless.
 */
function washFor(rarity: string | null | undefined) {
  return (
    raritiesArtboard[(rarity as RarityType) ?? RarityType.Common] ??
    raritiesArtboard[RarityType.Common]
  )
}

export function artboardBackground(rarity: string | null | undefined) {
  const wash = washFor(rarity)

  return `linear-gradient(to bottom right, ${wash.from}, ${wash.via}, ${artboardFloor})`
}

export function artboardRing(rarity: string | null | undefined) {
  return `inset 0 0 0 1px ${washFor(rarity).ring}`
}

export function artboardStyle(rarity: string | null | undefined): CSSProperties {
  return {
    backgroundImage: artboardBackground(rarity),
    boxShadow: artboardRing(rarity),
  }
}

/** The artboard as an element — art, badges and all go inside it. */
export function Artboard({
  children,
  className,
  rarity,
  style,
}: {
  children?: ReactNode
  className?: string
  rarity: string | null | undefined
  style?: CSSProperties
}) {
  return (
    <span
      className={cn('relative block overflow-hidden', className)}
      style={{ ...artboardStyle(rarity), ...style }}
    >
      {children}
    </span>
  )
}

/*
 * The small round class marks the site stamps in an artboard's top corners:
 * a hero's class, a weapon's family, a trap's placement, a survivor's
 * personality and set bonus. They are the site's own icons, bundled so the
 * launcher never waits on its CDN.
 */
const badgeFiles = import.meta.glob<string>('../../../assets/images/badges/*.png', {
  eager: true,
  import: 'default',
})

export function badgeUrl(name: string) {
  return badgeFiles[`../../../assets/images/badges/${name}.png`] ?? null
}

export type ItemBadgeMark = {
  label: string
  src: string
}

const heroClass: Record<string, string> = {
  constructor: 'heroes-constructor',
  ninja: 'heroes-ninja',
  outlander: 'heroes-outlander',
  soldier: 'heroes-soldier',
  commando: 'heroes-soldier',
}

const weaponClass: Record<string, string> = {
  assault: 'weapons-assault_class',
  axe: 'weapons-axe_class',
  club: 'weapons-club_class',
  explosive: 'weapons-launcher_class',
  hardware: 'weapons-tool_class',
  pistol: 'weapons-pistol_class',
  scythe: 'weapons-scythe_class',
  shotgun: 'weapons-shotgun_class',
  smg: 'weapons-smg_class',
  sniper: 'weapons-sniper_class',
  spear: 'weapons-spear_class',
  sword: 'weapons-sword_class',
}

const defenderClass: Record<string, string> = {
  assault: 'defenders-assault_class',
  melee: 'defenders-melee_class',
  pistol: 'defenders-pistol_class',
  shotgun: 'defenders-shotgun_class',
  sniper: 'defenders-sniper_class',
}

/** A lead's squad, by the job the game gives them. */
export const leadSquad: Record<string, { file: string; name: string }> = {
  doctor: { file: 'squads-emt_squad', name: 'EMT Squad' },
  engineer: { file: 'squads-engineering_squad', name: 'Corps of Engineering' },
  explorer: { file: 'squads-scouting_party_squad', name: 'Scouting Party' },
  gadgeteer: { file: 'squads-gadgeteers_squad', name: 'Gadgeteers' },
  inventor: { file: 'squads-think_tank_squad', name: 'The Think Tank' },
  'martial artist': { file: 'squads-close_assault_squad', name: 'Close Assault Squad' },
  marksman: { file: 'squads-fire_team_alpha_squad', name: 'Fire Team Alpha' },
  trainer: { file: 'squads-training_team_squad', name: 'Training Team' },
}

/**
 * A set bonus as the game names it on the survivor card. The profile spells
 * the stat behind it (`IsResistanceLow`), which is not what anyone sees.
 */
const setBonuses: Array<[RegExp, string, string]> = [
  [/trap ?durability/i, 'Trap Durability', 'survivors-trap_durability'],
  [/trap ?damage/i, 'Trap Damage', 'survivors-trap_damage'],
  [/shield ?regen/i, 'Shield Regeneration', 'survivors-shield_regeneration'],
  [/resistance|^shield/i, 'Shield', 'survivors-shield'],
  [/fortitude|health/i, 'Health', 'survivors-health'],
  [/melee/i, 'Melee Damage', 'survivors-melee_weapon_damage'],
  [/ranged/i, 'Ranged Damage', 'survivors-ranged_weapon_damage'],
  [/ability/i, 'Ability Damage', 'survivors-ability_damage'],
]

export function setBonusInfo(setBonus: string | null | undefined) {
  if (!setBonus) return null

  const match = setBonuses.find(([pattern]) => pattern.test(setBonus))

  return match ? { file: match[2], label: match[1] } : null
}

function mark(file: string | undefined, label: string): ItemBadgeMark | null {
  const src = file ? badgeUrl(file) : null

  return src ? { label, src } : null
}

/**
 * The marks for one item, primary first. Heroes, weapons and defenders get
 * one; traps get their family and placement; survivors their personality
 * and set bonus (a lead, which has no set bonus, its squad instead).
 */
export function itemBadgeMarks({
  personality,
  record,
  setBonus,
  templateId,
}: {
  personality?: string | null
  record?: ItemRecord | null
  setBonus?: string | null
  templateId: string
}): Array<ItemBadgeMark> {
  const id = templateId.toLowerCase()
  const subType = record?.subType?.toLowerCase() ?? ''
  const result: Array<ItemBadgeMark | null> = []

  if (id.startsWith('hero:')) {
    result.push(mark(heroClass[subType], record?.subType ?? 'Hero'))
  } else if (id.startsWith('defender:')) {
    const family = subType.replace(/ defender$/, '')

    result.push(mark(defenderClass[family], record?.subType ?? 'Defender'))
  } else if (id.startsWith('schematic:')) {
    if (record?.category === 'Trap' || /^schematic:sid_(floor|wall|ceiling)_/.test(id)) {
      const place = /sid_(floor|wall|ceiling)_/.exec(id)?.[1]

      result.push(mark('traps-trap_class', 'Trap'))
      if (place) {
        result.push(mark(`traps-${place}_trap`, `${place[0].toUpperCase()}${place.slice(1)} trap`))
      }
    } else {
      result.push(mark(weaponClass[subType], record?.subType ?? 'Weapon'))
    }
  } else if (id.startsWith('worker:')) {
    if (personality) {
      result.push(mark(`survivors-${personality.toLowerCase().replace(/\s+/g, '_')}`, personality))
    }

    const bonus = setBonusInfo(setBonus)
    const squad = leadSquad[subType]

    if (bonus) {
      result.push(mark(bonus.file, bonus.label))
    } else if (squad) {
      result.push(mark(squad.file, squad.name))
    }
  }

  return result.filter((entry): entry is ItemBadgeMark => entry !== null)
}

/**
 * A rarity colour as text. Mythic yellow is unreadable on a white page, so a
 * light theme darkens every tier a step (`--rarity-ink` in globals.css);
 * the dark theme prints the colour as it is.
 */
export function rarityInk(color: string) {
  return `color-mix(in srgb, ${color} var(--rarity-ink, 100%), black)`
}

/** One round mark, as the site draws it. The glyphs are white, so the well is always dark. */
export function BadgeMark({
  className,
  mark,
}: {
  className?: string
  mark: ItemBadgeMark
}) {
  return (
    <img
      alt={mark.label}
      className={cn(
        'size-5 rounded-full bg-black/55 object-contain p-0.5 ring-1 ring-black/40',
        className
      )}
      decoding="async"
      loading="lazy"
      src={mark.src}
      title={mark.label}
    />
  )
}
