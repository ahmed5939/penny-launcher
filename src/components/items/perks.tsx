import type { ItemRecordMap } from '../../kernel/core/item-database'

import { getItemRecord } from '../../state/items/database'
import legacyPerks from '../../features/rare-item-finder/data/legacy-perks.json'

import {
  accentByRarity,
  rarityStyle,
  rarityTypeFromName,
} from '../page/rarity'

import { cn } from '../../lib/utils'

/** Perk rarities, lowest first — how far a perk has been upgraded. */
export const perkRanks = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/**
 * The database spells a rarity as the word a player reads ("Legendary"); the
 * app's ladder is keyed by `RarityType`. `rarityTypeFromName` bridges the two
 * and the ladder does the rest: nothing below Rare has an entry, so a Common
 * perk gets a grey pip rather than a colour that says nothing.
 */
export function accentForRarityName(name: string | null | undefined) {
  const type = rarityTypeFromName(name)

  return type ? accentByRarity[type] ?? null : null
}

const alterationWords: Record<string, string> = {
  afflicted: 'afflicted',
  afflictedenemy: 'afflicted enemies',
  critdmg: 'critical damage',
  critrating: 'critical rating',
  damage: 'damage',
  headshotdamage: 'headshot damage',
  knockbackaoe: 'area knockback',
  ranged: 'ranged',
  weapon: 'weapon',
}

/**
 * Legacy perks were pulled from the game, so the item database has no record
 * for them; the legacy dictionary still holds the text the game printed.
 */
const legacyPerkNames = new Map(
  Object.entries(legacyPerks as Record<string, string>).map(([id, name]) => [id.toLowerCase(), name])
)

/** Human fallback for alteration ids missing from the extracted name table. */
function alterationName(templateId: string) {
  const raw = (templateId.split(':').pop() ?? templateId)
    .replace(/^aid_(?:att|g)_/i, '')
    .replace(/_alt\d+$/i, '')
  const words = raw
    .split('_')
    .filter((word) => word !== 'att' && word !== 'ondmg')
    .map((word) => alterationWords[word.toLowerCase()] ?? word)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return words
    ? words.charAt(0).toUpperCase() + words.slice(1)
    : 'Unknown perk'
}

/** A perk's name as the game prints it ("+42% Reload Speed"). */
export function displayAlteration(records: ItemRecordMap, templateId: string) {
  return (
    getItemRecord(records, templateId)?.name ??
    legacyPerkNames.get(templateId.toLowerCase()) ??
    alterationName(templateId)
  )
}

/** The site's rarity pips: one lit per step the perk has climbed. */
export function PerkRankPips({
  className,
  color,
  rarity,
}: {
  className?: string
  /** The lit pips' colour — the perk's rarity edge. */
  color: string
  rarity: string | null | undefined
}) {
  const rank = perkRanks.indexOf((rarity ?? '').toLowerCase()) + 1

  if (rank === 0) return null

  return (
    <span aria-label={`${rarity} perk`} className={cn('flex gap-1', className)} role="img">
      {perkRanks.map((name, index) => (
        <span
          className="h-0.5 flex-1 rounded-full"
          key={name}
          style={{
            background: index < rank ? color : 'hsl(var(--muted-foreground) / 0.2)',
          }}
        />
      ))}
    </span>
  )
}

/**
 * Every perk slot of one copy, for item cards: the item dialog's perk rows
 * (rarity edge, the name, the rarity pips) at a card's size. Slots keep
 * their order and a repeated perk keeps its own row, as the game lists them.
 * Spans with list roles, since an `ItemCard` can itself be a button.
 */
export function PerkList({
  alterations,
  className,
  records,
}: {
  /** `Alteration:` ids in slot order. */
  alterations: Array<string>
  className?: string
  records: ItemRecordMap
}) {
  if (alterations.length === 0) return null

  return (
    <span aria-label="Perks" className={cn('flex flex-col gap-1', className)} role="list">
      {alterations.map((alteration, index) => {
        const record = getItemRecord(records, alteration)
        const accent = accentForRarityName(record?.rarity)
        const edge = accent ?? 'hsl(var(--muted-foreground) / 0.5)'
        const name = displayAlteration(records, alteration)

        return (
          <span
            className="panel block border-l-2 px-2 py-1 text-left"
            key={`${alteration}-${index}`}
            role="listitem"
            style={{ ...rarityStyle(accent), borderLeftColor: edge }}
            title={name}
          >
            <span className="line-clamp-2 text-caption font-medium leading-snug text-foreground">
              {name}
            </span>
            <PerkRankPips className="mt-1" color={edge} rarity={record?.rarity} />
          </span>
        )
      })}
    </span>
  )
}
