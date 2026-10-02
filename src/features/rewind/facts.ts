import { cardRarityLabels, cosmeticRarityWeight } from '../../config/fortnite/locker'

/**
 * The Rewind's game-profile facts for one account: Battle Royale's season
 * history and locker (`athena`), Save the World's grind (`campaign`), and
 * gifting (`common_core`). Each profile is megabytes of items; this keeps a
 * few dozen numbers and nothing that names anyone.
 *
 * Read as the game records them. `past_seasons` is Epic's own season log;
 * `matches_played`, `packs_granted` and `daily_rewards.totalDaysLoggedIn`
 * are the campaign profile's own counters.
 */

export type SeasonRecord = {
  season: number
  level: number
  wins: number
  /** Crowned Victory Royales, where the season tracked them. */
  crowns: number
  battlePass: boolean
}

export type LockerCounts = {
  outfits: number
  backBlings: number
  pickaxes: number
  gliders: number
  /** Emotes, sprays, emoticons and toys share one item type. */
  emotes: number
  wraps: number
  contrails: number
  loadingScreens: number
  total: number
}

/** One cosmetic as the Rewind draws it: art, name and tile colours. */
export type CosmeticShowcase = {
  /** fortnite-api's id, lower case. */
  id: string
  name: string
  rarity: string
  series: string | null
  seriesColors: Array<string> | null
  icon: string | null
  /** A full-body render, when fortnite-api has one. */
  featured: string | null
  /** The absolute season it was introduced in. */
  introduced: number | null
}

/** What the cosmetics catalogue knows about one template id, or null when nothing. */
export type CosmeticLookup = (templateId: string) => Omit<CosmeticShowcase, 'id'> | null

export type CosmeticFacts = {
  /** Starred in the locker: outfits first, best tier first. */
  favourites: Array<CosmeticShowcase>
  favouriteCount: number
  /** Outfits from the earliest seasons. */
  oldest: Array<CosmeticShowcase>
  /** Outfits from the best tiers and series. */
  rarest: Array<CosmeticShowcase>
  /** Outfits by rarity or series, best tier first. */
  byRarity: Array<{ rarity: string; label: string; count: number }>
  /** Outfits introduced in Chapter 1. */
  chapterOne: number
  outfits: number
}

/** A Save the World item as the Rewind draws it, from PegLeg's item database. */
export type StwShowcase = {
  templateId: string
  name: string
  /** The database's display rarity: "Mythic", "Legendary"… */
  rarity: string | null
  /** PegLeg's art, a full URL; heroes get the large portrait. */
  image: string | null
  level: number
}

/** What the item database knows about one template id, or null when nothing. */
export type StwLookup = (templateId: string) => Pick<StwShowcase, 'image' | 'name' | 'rarity'> | null

/** The commander behind the counters: Power, the loadout, the mythics, the Storm Shields. */
export type CommanderFacts = {
  /** Squads plus research, as the Profile page reports it. */
  power: number | null
  /** The equipped loadout, commander first. Empty when the item database could not be read. */
  loadout: Array<StwShowcase>
  collection: { heroes: number; survivors: number; schematics: number; defenders: number }
  /** One of each mythic owned: heroes, then weapons and traps, then survivors. */
  mythics: Array<StwShowcase>
  /** Storm Shield Defenses beaten per zone; `finishedAt` is when the tenth fell. */
  shields: Array<{ zone: string; completed: number; finishedAt: string | null }>
  /** The name the player gave their homebase, from `common_public`. */
  homebase: string | null
}

export type AccountRewindFacts = {
  status: 'ok' | 'unknown'
  battleRoyale: {
    accountLevel: number | null
    lifetimeWins: number | null
    seasons: Array<SeasonRecord>
    /** Passes beyond Battle Royale's own that the account has levelled: LEGO, Festival, OG… */
    otherPasses: number
    locker: LockerCounts
  } | null
  saveTheWorld: {
    /** When the account first played Save the World. */
    startedAt: string | null
    commanderLevel: number | null
    /** Rewards claimed after commander level 310. */
    pastMaxRewards: number
    matches: number
    missions: number
    cardPacks: number
    daysLoggedIn: number
    collectionBookLevel: number | null
    researchMaxed: boolean
  } | null
  gifts: { sent: number; received: number } | null
  /** Null when the cosmetics catalogue could not be read. */
  cosmetics?: CosmeticFacts | null
  /** Null when the account has no campaign profile. */
  commander?: CommanderFacts | null
  checkedAt: string
  errorMessage?: string
}

export type RewindFactsPayload = {
  accounts: Record<string, AccountRewindFacts>
  complete: boolean
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function count(value: unknown) {
  const number = Number(value)

  return value !== null && value !== undefined && Number.isFinite(number) && number >= 0 ? number : null
}

function isoDate(value: unknown) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN

  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** The profile object inside a QueryProfile reply. */
function profileOf(reply: unknown) {
  const changes = record(reply)?.profileChanges

  return Array.isArray(changes) ? record(record(changes[0])?.profile) : null
}

function attributesOf(profile: Record<string, unknown> | null) {
  return record(record(profile?.stats)?.attributes)
}

const lockerTypes: Record<string, keyof Omit<LockerCounts, 'total'>> = {
  athenacharacter: 'outfits',
  athenabackpack: 'backBlings',
  athenapickaxe: 'pickaxes',
  athenaglider: 'gliders',
  athenadance: 'emotes',
  athenaitemwrap: 'wraps',
  athenaskydivecontrail: 'contrails',
  athenaloadingscreen: 'loadingScreens',
}

export function parseBattleRoyale(reply: unknown): AccountRewindFacts['battleRoyale'] {
  const profile = profileOf(reply)
  const attributes = attributesOf(profile)

  if (!profile || !attributes) {
    return null
  }

  const locker: LockerCounts = {
    outfits: 0,
    backBlings: 0,
    pickaxes: 0,
    gliders: 0,
    emotes: 0,
    wraps: 0,
    contrails: 0,
    loadingScreens: 0,
    total: 0,
  }

  for (const item of Object.values(record(profile.items) ?? {})) {
    const type = String(record(item)?.templateId ?? '').split(':')[0].toLowerCase()
    const slot = lockerTypes[type]

    if (slot) {
      locker[slot] += 1
      locker.total += 1
    }
  }

  const seasons = (Array.isArray(attributes.past_seasons) ? attributes.past_seasons : []).flatMap(
    (entry): Array<SeasonRecord> => {
      const season = record(entry)
      const number = count(season?.seasonNumber)

      return season && number ? [{
        season: number,
        level: count(season.seasonLevel) ?? 0,
        wins: count(season.numWins) ?? 0,
        crowns: count(season.numRoyalRoyales) ?? 0,
        battlePass: season.purchasedVIP === true,
      }] : []
    }
  )

  return {
    accountLevel: count(attributes.accountLevel),
    lifetimeWins: count(attributes.lifetime_wins),
    seasons: seasons.sort((a, b) => a.season - b.season),
    otherPasses: (Array.isArray(attributes.past_season_passes) ? attributes.past_season_passes : []).filter(
      (pass) => !/^athenaseason:athenaseason\d+$/i.test(String(record(pass)?.seasonTemplateId ?? ''))
    ).length,
    locker,
  }
}

export function parseSaveTheWorld(reply: unknown): AccountRewindFacts['saveTheWorld'] {
  const profile = profileOf(reply)
  const attributes = attributesOf(profile)

  if (!profile || !attributes) {
    return null
  }

  const stats = Array.isArray(attributes.gameplay_stats) ? attributes.gameplay_stats : []
  const missions = stats.map(record).find((stat) => stat?.statName === 'zonescompleted')
  const research = record(attributes.research_levels)
  const researchValues = research ? Object.values(research).map(count) : []

  return {
    startedAt: isoDate(profile.created),
    commanderLevel: count(attributes.level),
    pastMaxRewards: count(attributes.rewards_claimed_post_max_level) ?? 0,
    matches: count(attributes.matches_played) ?? 0,
    missions: count(missions?.statValue) ?? 0,
    cardPacks: count(attributes.packs_granted) ?? 0,
    daysLoggedIn: count(record(attributes.daily_rewards)?.totalDaysLoggedIn) ?? 0,
    collectionBookLevel: count(record(attributes.collection_book)?.maxBookXpLevelAchieved),
    researchMaxed: researchValues.length === 4 && researchValues.every((level) => level !== null && level >= 120),
  }
}

export function parseGifts(reply: unknown): AccountRewindFacts['gifts'] {
  const history = record(attributesOf(profileOf(reply))?.gift_history)

  if (!history) {
    return null
  }

  return {
    sent: count(history.num_sent) ?? Object.keys(record(history.sentTo) ?? {}).length,
    received: count(history.num_received) ?? Object.keys(record(history.receivedFrom) ?? {}).length,
  }
}

const showcaseOrder = ['athenacharacter', 'athenapickaxe', 'athenabackpack', 'athenaglider', 'athenadance', 'athenaitemwrap']

/** Defaults every account starts with, not worth a showcase. */
function isDefault(showcase: Pick<CosmeticShowcase, 'name'>) {
  return /^(recruit|default)/i.test(showcase.name)
}

function byTier(a: CosmeticShowcase, b: CosmeticShowcase) {
  return cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity) || (a.introduced ?? 999) - (b.introduced ?? 999) || a.name.localeCompare(b.name)
}

/**
 * The locker as pictures: favourites, the oldest outfits and the rarest,
 * plus a count by tier. `lookup` resolves template ids against the
 * cosmetics catalogue; anything it does not know is left out of the
 * pictures but still counted.
 */
export function cosmeticFacts(reply: unknown, lookup: CosmeticLookup): CosmeticFacts | null {
  const profile = profileOf(reply)

  if (!profile) {
    return null
  }

  const outfits: Array<CosmeticShowcase> = []
  const favourites: Array<{ order: number; showcase: CosmeticShowcase }> = []
  const tiers = new Map<string, number>()
  let favouriteCount = 0
  let outfitCount = 0

  for (const item of Object.values(record(profile.items) ?? {})) {
    const entry = record(item)
    const templateId = String(entry?.templateId ?? '')
    const [type, id = ''] = templateId.split(':')
    const kind = type.toLowerCase()
    const favourite = record(entry?.attributes)?.favorite === true
    const order = showcaseOrder.indexOf(kind)

    if (order < 0) {
      continue
    }

    if (favourite) favouriteCount += 1
    if (kind === 'athenacharacter') outfitCount += 1

    const known = lookup(templateId)

    if (!known) {
      continue
    }

    const showcase = { id: id.toLowerCase(), ...known, name: known.name.trim() }

    if (kind === 'athenacharacter' && !isDefault(showcase)) {
      outfits.push(showcase)
      tiers.set(showcase.rarity, (tiers.get(showcase.rarity) ?? 0) + 1)
    }

    if (favourite && showcase.icon) {
      favourites.push({ order, showcase })
    }
  }

  const pictured = outfits.filter((outfit) => outfit.icon)

  return {
    favourites: favourites
      .sort((a, b) => a.order - b.order || byTier(a.showcase, b.showcase))
      .slice(0, 12)
      .map((entry) => entry.showcase),
    favouriteCount,
    oldest: pictured
      .filter((outfit) => outfit.introduced !== null)
      .sort((a, b) => (a.introduced ?? 0) - (b.introduced ?? 0) || byTier(a, b))
      .slice(0, 8),
    rarest: [...pictured].sort(byTier).slice(0, 8),
    byRarity: [...tiers]
      .map(([rarity, count]) => ({ rarity, label: cardRarityLabels[rarity] ?? rarity, count }))
      .sort((a, b) => cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity)),
    chapterOne: outfits.filter((outfit) => outfit.introduced !== null && outfit.introduced <= 10).length,
    outfits: outfitCount,
  }
}

/** Seasons as players say them: "Chapter 2 Season 4". Past Chapter 5 the absolute number. */
export function seasonName(season: number) {
  const chapters: Array<[number, number, number]> = [
    // [first season number, last, chapter]
    [1, 10, 1],
    [11, 18, 2],
    [19, 22, 3],
    [23, 27, 4],
    [28, 32, 5],
  ]
  const chapter = chapters.find(([first, last]) => season >= first && season <= last)

  return chapter ? `Chapter ${chapter[2]} Season ${season - chapter[0] + 1}` : `Season ${season}`
}
