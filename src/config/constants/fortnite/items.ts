/**
 * Reading inventory item template ids.
 *
 * Epic ships the marketing names ("Hydraulic Sword", "Ranger") in game data
 * we do not have, so — exactly as the expeditions reader does — everything
 * here is decoded from the template id itself. Rarity, tier and category are
 * encoded reliably; display names are best-effort, which is why every item
 * row also carries its raw template id.
 *
 * Template shapes:
 *   Hero:hid_commando_srdarkviking_vr_t05
 *   Schematic:sid_edged_sword_medium_r_ore_t04
 *   Defender:did_pistol_sr_t05
 *   Worker:workerbasic_sr_t02 · Worker:managerengineer_sr_t04
 */

export type ItemKind = 'hero' | 'schematic' | 'defender' | 'survivor'

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'

/** Weakest first — the order the recycle filters count in. */
export const rarityOrder: Array<Rarity> = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
]

export const rarityLabels: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

/**
 * Chip colours. These are the in-game rarity colours rather than the brand
 * palette: a legendary needs to read as orange to anyone who has played the
 * game, and no amount of pink is going to say "legendary".
 */
export const rarityChipClasses: Record<Rarity, string> = {
  common: 'border-zinc-400/40 bg-zinc-400/10 text-zinc-300',
  uncommon: 'border-lime-400/40 bg-lime-400/10 text-lime-300',
  rare: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  epic: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
  legendary: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
  mythic: 'border-yellow-300/45 bg-yellow-300/10 text-yellow-200',
}

/**
 * The word the item database prints, back to a rarity.
 *
 * Template ids are not the last word on rarity: a mythic hero ships as
 * `hid_constructor_basebig_sr_t05` — the `sr` that everywhere else means
 * Legendary — and only the game's own data knows it is Mythic. Wherever the
 * database has an opinion, it outranks the id.
 */
export function rarityFromLabel(
  label: string | null | undefined
): Rarity | null {
  if (!label) {
    return null
  }

  const wanted = label.toLowerCase()

  return (
    rarityOrder.find((rarity) => rarityLabels[rarity].toLowerCase() === wanted) ??
    null
  )
}

/** `_vr_` is Epic and `_sr_` is Legendary — the ids predate the renaming. */
const rarityByToken: Record<string, Rarity> = {
  c: 'common',
  uc: 'uncommon',
  r: 'rare',
  vr: 'epic',
  sr: 'legendary',
  ur: 'mythic',
}

const rarityPattern = /_(ur|sr|vr|uc|r|c)_/

export const itemKindLabels: Record<ItemKind, string> = {
  hero: 'Heroes',
  schematic: 'Schematics',
  defender: 'Defenders',
  survivor: 'Survivors',
}

const kindByPrefix: Record<string, ItemKind> = {
  'Hero:': 'hero',
  'Schematic:': 'schematic',
  'Defender:': 'defender',
  'Worker:': 'survivor',
}

/** `commando` is the internal name for the Soldier class. */
const heroClassLabels: Record<string, string> = {
  commando: 'Soldier',
  constructor: 'Constructor',
  ninja: 'Ninja',
  outlander: 'Outlander',
}

function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Hero name tokens carry the rarity twice — `srdarkviking` is the legendary
 * "Dark Viking". Drop the prefix when what is left still looks like a name.
 */
function stripRarityPrefix(value: string) {
  const match = /^(ur|sr|vr|uc|r|c)(.+)$/.exec(value)

  return match && match[2].length >= 4 ? match[2] : value
}

export type DecodedItem = {
  kind: ItemKind
  /** Best-effort display name. */
  name: string
  /** Class, material, or job — whatever the id also told us. */
  subtitle: string | null
  rarity: Rarity
  /** 1–5, or 0 when the id carries no tier. */
  tier: number
}

export function decodeItemTemplate(templateId: string): DecodedItem | null {
  const prefix = Object.keys(kindByPrefix).find((value) =>
    templateId.startsWith(value)
  )

  if (!prefix) {
    return null
  }

  const kind = kindByPrefix[prefix]
  const body = templateId.slice(prefix.length).toLowerCase()

  const rarityMatch = rarityPattern.exec(body)
  const rarity = rarityMatch
    ? (rarityByToken[rarityMatch[1]] ?? 'common')
    : 'common'

  const tierMatch = /_t(\d+)/.exec(body)
  const tier = tierMatch ? Number(tierMatch[1]) : 0

  /** Everything before the rarity token is the item's own name. */
  const head = rarityMatch ? body.slice(0, rarityMatch.index) : body
  const tail = rarityMatch
    ? body.slice(rarityMatch.index + rarityMatch[0].length)
    : ''

  const decoded: DecodedItem = {
    kind,
    name: titleCase(head) || 'Unknown',
    subtitle: null,
    rarity,
    tier,
  }

  if (kind === 'hero') {
    const [heroClass, ...rest] = head.replace(/^hid_/, '').split('_')

    decoded.name = titleCase(
      rest.map(stripRarityPrefix).join(' ') || heroClass
    )
    decoded.subtitle = heroClassLabels[heroClass] ?? titleCase(heroClass)

    return decoded
  }

  if (kind === 'schematic') {
    decoded.name = titleCase(head.replace(/^sid_/, ''))

    /** The token after the rarity is the crafting material. */
    const material = tail.split('_').find((token) => token.length > 0)

    decoded.subtitle =
      material && !/^t\d+$/.test(material) ? titleCase(material) : null

    return decoded
  }

  if (kind === 'defender') {
    decoded.name = `${titleCase(head.replace(/^did_/, ''))} Defender`

    return decoded
  }

  /** Survivors: `workerbasic` are the rank and file, `manager*` are leads. */
  const worker = head.replace(/_$/, '')

  if (worker.startsWith('manager')) {
    decoded.name = 'Lead Survivor'
    decoded.subtitle = titleCase(worker.replace(/^manager/, '')) || null

    return decoded
  }

  if (worker.startsWith('workerbasic')) {
    decoded.name = 'Survivor'
    decoded.subtitle = null

    return decoded
  }

  decoded.name = titleCase(worker.replace(/^worker_?/, '')) || 'Survivor'
  decoded.subtitle = 'Unique'

  return decoded
}

/**
 * `Homebase.Worker.Personality.IsAnalytical` → `Analytical`. Used for both
 * personality and set bonus, which share the shape.
 */
export function prettifyWorkerTrait(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const leaf = value.split('.').pop() ?? value

  return (
    leaf
      .replace(/^Is/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim() || null
  )
}
