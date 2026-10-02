/**
 * The Armory's weapon and trap families, for filtering schematics the way
 * the game does: ranged, melee or traps, then pistols, swords, floor traps.
 *
 * Ranged and melee families are the item database's `subType`. Traps carry
 * none, so floor, wall and ceiling are read from the template id
 * (`Schematic:sid_floor_spikes_…`).
 */

export type SchematicCategory = 'Ranged' | 'Melee' | 'Trap'

/** `all`, a whole category, or `Category:Family`. */
export type SchematicType = 'all' | SchematicCategory | `${SchematicCategory}:${string}`

const families: Array<{ category: SchematicCategory; heading: string; all: string; members: Array<[string, string]> }> = [
  {
    category: 'Ranged',
    heading: 'Ranged',
    all: 'All ranged',
    members: [
      ['Assault', 'Assault rifles'],
      ['Pistol', 'Pistols'],
      ['SMG', 'SMGs'],
      ['Shotgun', 'Shotguns'],
      ['Sniper', 'Sniper rifles'],
      ['Explosive', 'Explosives'],
    ],
  },
  {
    category: 'Melee',
    heading: 'Melee',
    all: 'All melee',
    members: [
      ['Axe', 'Axes'],
      ['Club', 'Clubs'],
      ['Hardware', 'Hardware'],
      ['Scythe', 'Scythes'],
      ['Spear', 'Spears'],
      ['Sword', 'Swords'],
    ],
  },
  {
    category: 'Trap',
    heading: 'Traps',
    all: 'All traps',
    members: [
      ['Floor', 'Floor traps'],
      ['Wall', 'Wall traps'],
      ['Ceiling', 'Ceiling traps'],
    ],
  },
]

/** Picker options, grouped under Ranged, Melee and Traps. */
export const schematicTypeOptions: Array<{ value: SchematicType; label: string; group?: string }> = [
  { value: 'all', label: 'All types' },
  ...families.flatMap(({ all, category, heading, members }) => [
    { value: category as SchematicType, label: all, group: heading },
    ...members.map(([family, label]) => ({ value: `${category}:${family}` as SchematicType, label, group: heading })),
  ]),
]

const trapFamily = /^schematic:sid_(floor|wall|ceiling)_/i

/** Category and family of a schematic, or null for anything that is not a weapon or trap. */
export function schematicFamily(
  templateId: string,
  record: { category?: string | null; subType?: string | null } | null | undefined
): { category: SchematicCategory; family: string | null } | null {
  const category = record?.category
  if (category !== 'Ranged' && category !== 'Melee' && category !== 'Trap') return null
  if (category === 'Trap') {
    const match = trapFamily.exec(templateId)?.[1]
    return { category, family: match ? match[0].toUpperCase() + match.slice(1).toLowerCase() : null }
  }
  return { category, family: record?.subType ?? null }
}

export function matchesSchematicType(
  filter: SchematicType,
  templateId: string,
  record: { category?: string | null; subType?: string | null } | null | undefined
) {
  if (filter === 'all') return true
  const type = schematicFamily(templateId, record)
  if (!type) return false
  const [category, family] = filter.split(':')
  return type.category === category && (family === undefined || type.family?.toLowerCase() === family.toLowerCase())
}
