import type { AccountLibraryOverview } from '../library/collection'
import type { SquadCareer } from '../playtime/stats'
import type { AccountRewindFacts, CosmeticShowcase, LockerCounts, StwShowcase } from './facts'
import type { LibraryArt } from '../library/model'
import type { AccountPlaytime } from '../playtime/model'

import { founderEdition, libraryGames, secondsByApp, timeFor } from '../library/account'
import { cosmeticRarityWeight } from '../../config/fortnite/locker'
import { fortniteSeconds } from '../playtime/model'

/**
 * Penny Rewind: every linked account's Fortnite, told as a story.
 *
 * Everything here is a fact read from Epic — launcher playtime, Fortnite's
 * own career stats, the game profiles, the Epic libraries and achievements —
 * added up across accounts. Nothing is estimated except the plain
 * arithmetic the story points out (hours as days, a win rate).
 */

export type RewindAccount = {
  id: string
  name: string
  /** Every platform when Fortnite's stats could be read, else PC only. */
  seconds: number
  pcSeconds: number | null
  everywhereSeconds: number | null
  wins: number
  kills: number
  saveTheWorld: string | null
  /** A favourite outfit to stand for the account, when one could be pictured. */
  signature: CosmeticShowcase | null
  /** The hero leading the account's equipped loadout, when one could be pictured. */
  commander: StwShowcase | null
  power: number | null
}

/** Save the World's commander level cap. */
export const commanderLevelCap = 310

export type Rewind = {
  accounts: number
  /** The earliest any account's game profile was made: its first Fortnite session. */
  since: { at: string; name: string } | null
  hours: {
    pc: number
    everywhere: number
    /** The larger of the two, as hours. */
    total: number
    days: number
  }
  input: { label: string; share: number } | null
  battleRoyale: {
    matches: number
    wins: number
    kills: number
    outlived: number
    /** Wins over matches, 0–100; null before any match. */
    winRate: number | null
    /** A Victory Royale every this many matches. */
    winEvery: number | null
    /** Eliminations over the matches not won. */
    kd: number | null
    killsPerMatch: number | null
    topMode: { label: string; hours: number } | null
    /** Every mode with time in it, most played first. */
    modes: Array<{ label: string; hours: number }>
    squads: Array<SquadCareer>
  } | null
  saveTheWorld: {
    founders: Array<{ name: string; edition: string | null }>
    withAccess: number
    hours: number
  }
  games: {
    owned: number
    top: { title: string; hours: number; art: LibraryArt } | null
    achievements: { unlocked: number; xp: number; games: number }
  }
  /** Battle Royale's season log across accounts; null before any profile was read. */
  seasons: {
    /** Distinct seasons any account played, oldest first, each at its best level. */
    timeline: Array<{ season: number; level: number; battlePass: boolean }>
    first: number | null
    battlePasses: number
    otherPasses: number
    crowns: number
    best: { season: number; level: number; name: string } | null
    accountLevel: { level: number; name: string } | null
  } | null
  /** Every account's locker added up. */
  locker: LockerCounts | null
  grind: {
    startedAt: string | null
    matches: number
    missions: number
    cardPacks: number
    daysLoggedIn: number
    pastMaxRewards: number
    researchMaxed: number
    book: { level: number; name: string } | null
  } | null
  gifts: { sent: number; received: number } | null
  /** The lockers as pictures, every account's together. */
  cosmetics: {
    favourites: Array<CosmeticShowcase>
    favouriteCount: number
    oldest: Array<CosmeticShowcase>
    rarest: Array<CosmeticShowcase>
    byRarity: Array<{ rarity: string; label: string; count: number }>
    chapterOne: number
    /** Full-body renders to stand behind the Battle Royale slides. */
    renders: Array<CosmeticShowcase>
  } | null
  /** Save the World's commanders across accounts; null before any campaign profile was read. */
  command: {
    power: { value: number; name: string } | null
    level: { level: number; name: string } | null
    /** Accounts at the commander level cap. */
    maxedLevel: number
    /** Every account with a campaign, most played first. */
    commanders: Array<{
      id: string
      name: string
      hero: StwShowcase | null
      support: Array<StwShowcase>
      power: number | null
      level: number | null
      homebase: string | null
    }>
    collection: { heroes: number; survivors: number; schematics: number; defenders: number }
    /** One of each mythic across accounts: heroes, then weapons and traps, then survivors. */
    mythics: Array<StwShowcase>
    /** Distinct Storm King weapons among them. */
    stormKing: number
    /** Per zone: the most defenses any account beat, how many cleared all ten, and when the first did. */
    shields: Array<{ zone: string; best: number; cleared: number; firstClearedAt: string | null }>
  } | null
  /** Most played first. */
  perAccount: Array<RewindAccount>
}

export type RewindInput = {
  accounts: Array<{ id: string; name: string }>
  overviews: Record<string, AccountLibraryOverview | undefined>
  playtime: Record<string, AccountPlaytime | undefined>
  /** The game profiles' facts; optional so a Rewind can play without them. */
  facts?: Record<string, AccountRewindFacts | undefined>
  /** Launcher app ids Save the World's time is under, from the catalogue. */
  saveTheWorldApps: Array<string>
}

/** Ready when every account has answered every read, whatever they said. */
export function rewindReady({ accounts, facts, overviews, playtime }: RewindInput) {
  return (
    accounts.length > 0 &&
    accounts.every(({ id }) => overviews[id] && playtime[id] && (!facts || facts[id]))
  )
}

export function buildRewind({ accounts, facts = {}, overviews, playtime, saveTheWorldApps }: RewindInput): Rewind {
  const perAccount: Array<RewindAccount> = []
  const battleRoyale = { matches: 0, wins: 0, kills: 0, outlived: 0, read: false }
  const squads = new Map<string, SquadCareer>()
  const inputs = new Map<string, number>()
  const modes = new Map<string, number>()
  const founders: Rewind['saveTheWorld']['founders'] = []
  let withAccess = 0
  let stwSeconds = 0
  let pc = 0
  let everywhere = 0
  let since: Rewind['since'] = null

  for (const { id, name } of accounts) {
    const timed = playtime[id]
    const access = overviews[id]?.access ?? null
    const ok = timed?.status === 'ok' ? timed : null
    const career = timed?.allPlatforms ?? null
    const pcSeconds = ok ? fortniteSeconds(ok.entries) : null
    const everywhereSeconds = career ? career.minutes * 60 : null

    pc += pcSeconds ?? 0
    everywhere += everywhereSeconds ?? 0

    if (career) {
      battleRoyale.read = true
      battleRoyale.matches += career.matches
      battleRoyale.wins += career.wins
      battleRoyale.kills += career.kills
      battleRoyale.outlived += career.outlived
      career.byInput.forEach((input) => inputs.set(input.label, (inputs.get(input.label) ?? 0) + input.minutes))
      career.modes.forEach((mode) => modes.set(mode.label, (modes.get(mode.label) ?? 0) + mode.minutes))
      ;(career.squads ?? []).forEach((squad) => {
        const known = squads.get(squad.size)

        squads.set(squad.size, known ? { ...known, matches: known.matches + squad.matches, wins: known.wins + squad.wins, kills: known.kills + squad.kills } : { ...squad })
      })
    }

    if (ok) {
      stwSeconds += timeFor(saveTheWorldApps, secondsByApp(ok.entries)) ?? 0
    }

    let saveTheWorld: string | null = null

    if (access?.campaignAccess) {
      withAccess += 1
      saveTheWorld = 'Save the World'

      if (access.founderTier !== null) {
        const edition = founderEdition(access.founderTier)

        founders.push({ name, edition })
        saveTheWorld = `${edition ?? ''} Founder`.trim()
      }
    }

    if (access?.created && (!since || access.created < since.at)) {
      since = { at: access.created, name }
    }

    perAccount.push({
      id,
      name,
      seconds: Math.max(pcSeconds ?? 0, everywhereSeconds ?? 0),
      pcSeconds,
      everywhereSeconds,
      wins: career?.wins ?? 0,
      kills: career?.kills ?? 0,
      saveTheWorld,
      signature: facts[id]?.cosmetics?.favourites.find((item) => item.icon) ?? facts[id]?.cosmetics?.rarest[0] ?? null,
      commander: facts[id]?.commander?.loadout[0] ?? null,
      power: facts[id]?.commander?.power ?? null,
    })
  }

  perAccount.sort((a, b) => b.seconds - a.seconds)

  const inputTotal = [...inputs.values()].reduce((sum, minutes) => sum + minutes, 0)
  const [topInput] = [...inputs].sort((a, b) => b[1] - a[1])
  const [topMode] = [...modes].sort((a, b) => b[1] - a[1])

  return {
    accounts: accounts.length,
    since,
    hours: {
      pc: pc / 3600,
      everywhere: everywhere / 3600,
      total: Math.max(pc, everywhere) / 3600,
      days: Math.max(pc, everywhere) / 86400,
    },
    input: topInput && inputTotal > 0 ? { label: topInput[0], share: (topInput[1] / inputTotal) * 100 } : null,
    battleRoyale: battleRoyale.read
      ? {
          matches: battleRoyale.matches,
          wins: battleRoyale.wins,
          kills: battleRoyale.kills,
          outlived: battleRoyale.outlived,
          winRate: battleRoyale.matches > 0 ? (battleRoyale.wins / battleRoyale.matches) * 100 : null,
          winEvery: battleRoyale.wins > 0 ? battleRoyale.matches / battleRoyale.wins : null,
          kd: battleRoyale.matches > battleRoyale.wins ? battleRoyale.kills / (battleRoyale.matches - battleRoyale.wins) : null,
          killsPerMatch: battleRoyale.matches > 0 ? battleRoyale.kills / battleRoyale.matches : null,
          topMode: topMode ? { label: topMode[0], hours: topMode[1] / 60 } : null,
          modes: [...modes]
            .filter(([, minutes]) => minutes >= 60)
            .sort((a, b) => b[1] - a[1])
            .map(([label, minutes]) => ({ label, hours: minutes / 60 })),
          squads: (['solo', 'duo', 'trio', 'squad'] as const).flatMap((size) => {
            const squad = squads.get(size)

            return squad ? [squad] : []
          }),
        }
      : null,
    saveTheWorld: { founders, withAccess, hours: stwSeconds / 3600 },
    games: gamesStory(accounts, overviews, playtime),
    ...profileStory(accounts, facts),
    command: commandStory(perAccount, facts),
    perAccount,
  }
}

function commandStory(perAccount: Array<RewindAccount>, facts: NonNullable<RewindInput['facts']>): Rewind['command'] {
  const commanders: NonNullable<Rewind['command']>['commanders'] = []
  const collection = { heroes: 0, survivors: 0, schematics: 0, defenders: 0 }
  const mythics = new Map<string, StwShowcase>()
  const shields = new Map<string, { zone: string; best: number; cleared: number; firstClearedAt: string | null }>()
  let power: NonNullable<Rewind['command']>['power'] = null
  let level: NonNullable<Rewind['command']>['level'] = null
  let maxedLevel = 0

  for (const { id, name } of perAccount) {
    const entry = facts[id]
    const command = entry?.status === 'ok' ? entry.commander : null

    if (!command) {
      continue
    }

    const commanderLevel = entry?.saveTheWorld?.commanderLevel ?? null
    const [hero = null, ...support] = command.loadout

    commanders.push({ id, name, hero, support, power: command.power, level: commanderLevel, homebase: command.homebase })

    if (command.power !== null && (!power || command.power > power.value)) {
      power = { value: command.power, name }
    }

    if (commanderLevel !== null && (!level || commanderLevel > level.level)) {
      level = { level: commanderLevel, name }
    }

    maxedLevel += commanderLevel !== null && commanderLevel >= commanderLevelCap ? 1 : 0

    for (const key of Object.keys(collection) as Array<keyof typeof collection>) {
      collection[key] += command.collection[key]
    }

    for (const item of command.mythics) {
      const key = `${item.templateId.split(':')[0].toLowerCase()}:${item.name}`

      if (!mythics.has(key)) {
        mythics.set(key, item)
      }
    }

    for (const shield of command.shields) {
      const known = shields.get(shield.zone) ?? { zone: shield.zone, best: 0, cleared: 0, firstClearedAt: null }
      const cleared = shield.completed >= 10

      shields.set(shield.zone, {
        zone: shield.zone,
        best: Math.max(known.best, shield.completed),
        cleared: known.cleared + (cleared ? 1 : 0),
        firstClearedAt:
          cleared && shield.finishedAt && (!known.firstClearedAt || shield.finishedAt < known.firstClearedAt)
            ? shield.finishedAt
            : known.firstClearedAt,
      })
    }
  }

  if (commanders.length === 0) {
    return null
  }

  const kinds = ['hero', 'schematic', 'worker', 'defender']
  const ordered = [...mythics.values()].sort(
    (a, b) =>
      kinds.indexOf(a.templateId.split(':')[0].toLowerCase()) - kinds.indexOf(b.templateId.split(':')[0].toLowerCase()) ||
      a.name.localeCompare(b.name)
  )

  return {
    power,
    level,
    maxedLevel,
    commanders,
    collection,
    mythics: ordered,
    stormKing: ordered.filter((item) => /^storm king's/i.test(item.name)).length,
    shields: [...shields.values()],
  }
}

function profileStory(
  accounts: RewindInput['accounts'],
  facts: NonNullable<RewindInput['facts']>
): Pick<Rewind, 'seasons' | 'locker' | 'grind' | 'gifts' | 'cosmetics'> {
  const timeline = new Map<number, { season: number; level: number; battlePass: boolean }>()
  let seasonsRead = false
  let battlePasses = 0
  let otherPasses = 0
  let crowns = 0
  let best: NonNullable<Rewind['seasons']>['best'] = null
  let accountLevel: NonNullable<Rewind['seasons']>['accountLevel'] = null
  let locker: LockerCounts | null = null
  let grind: Rewind['grind'] = null
  let gifts: Rewind['gifts'] = null

  for (const { id, name } of accounts) {
    const entry = facts[id]

    if (entry?.status !== 'ok') {
      continue
    }

    const br = entry.battleRoyale

    if (br) {
      seasonsRead = true
      otherPasses += br.otherPasses

      if (br.accountLevel !== null && (!accountLevel || br.accountLevel > accountLevel.level)) {
        accountLevel = { level: br.accountLevel, name }
      }

      for (const season of br.seasons) {
        battlePasses += season.battlePass ? 1 : 0
        crowns += season.crowns

        const known = timeline.get(season.season)

        timeline.set(season.season, {
          season: season.season,
          level: Math.max(known?.level ?? 0, season.level),
          battlePass: Boolean(known?.battlePass) || season.battlePass,
        })

        if (!best || season.level > best.level) {
          best = { season: season.season, level: season.level, name }
        }
      }

      const counts: LockerCounts = locker ?? { outfits: 0, backBlings: 0, pickaxes: 0, gliders: 0, emotes: 0, wraps: 0, contrails: 0, loadingScreens: 0, total: 0 }

      for (const key of Object.keys(counts) as Array<keyof LockerCounts>) {
        counts[key] += br.locker[key]
      }

      locker = counts
    }

    const stw = entry.saveTheWorld

    if (stw) {
      const current: NonNullable<Rewind['grind']> = grind ?? { startedAt: null, matches: 0, missions: 0, cardPacks: 0, daysLoggedIn: 0, pastMaxRewards: 0, researchMaxed: 0, book: null }

      grind = {
        startedAt: [current.startedAt, stw.startedAt].filter((date): date is string => date !== null).sort()[0] ?? null,
        matches: current.matches + stw.matches,
        missions: current.missions + stw.missions,
        cardPacks: current.cardPacks + stw.cardPacks,
        daysLoggedIn: current.daysLoggedIn + stw.daysLoggedIn,
        pastMaxRewards: current.pastMaxRewards + stw.pastMaxRewards,
        researchMaxed: current.researchMaxed + (stw.researchMaxed ? 1 : 0),
        book:
          stw.collectionBookLevel !== null && (!current.book || stw.collectionBookLevel > current.book.level)
            ? { level: stw.collectionBookLevel, name }
            : current.book,
      }
    }

    if (entry.gifts) {
      const before: NonNullable<Rewind['gifts']> = gifts ?? { sent: 0, received: 0 }

      gifts = { sent: before.sent + entry.gifts.sent, received: before.received + entry.gifts.received }
    }
  }

  const ordered = [...timeline.values()].sort((a, b) => a.season - b.season)
  const showcases = accounts.flatMap(({ id }) => {
    const entry = facts[id]

    return entry?.status === 'ok' && entry.cosmetics ? [entry.cosmetics] : []
  })

  return {
    seasons: seasonsRead
      ? { timeline: ordered, first: ordered[0]?.season ?? null, battlePasses, otherPasses, crowns, best, accountLevel }
      : null,
    locker,
    grind: grind && (grind.matches > 0 || grind.missions > 0) ? grind : null,
    gifts,
    cosmetics: showcases.length > 0 ? cosmeticsStory(showcases) : null,
  }
}

function unique(items: Array<CosmeticShowcase>) {
  const seen = new Set<string>()

  return items.filter((item) => !seen.has(item.id) && seen.add(item.id))
}

function byTier(a: CosmeticShowcase, b: CosmeticShowcase) {
  return cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity) || (a.introduced ?? 999) - (b.introduced ?? 999)
}

function cosmeticsStory(showcases: Array<NonNullable<AccountRewindFacts['cosmetics']>>): NonNullable<Rewind['cosmetics']> {
  const tiers = new Map<string, { rarity: string; label: string; count: number }>()

  for (const showcase of showcases) {
    for (const tier of showcase.byRarity) {
      const known = tiers.get(tier.rarity)

      tiers.set(tier.rarity, { ...tier, count: (known?.count ?? 0) + tier.count })
    }
  }

  const favourites = unique(showcases.flatMap((showcase) => showcase.favourites)).slice(0, 12)
  const oldest = unique(showcases.flatMap((showcase) => showcase.oldest))
    .sort((a, b) => (a.introduced ?? 999) - (b.introduced ?? 999) || byTier(a, b))
    .slice(0, 8)
  const rarest = unique(showcases.flatMap((showcase) => showcase.rarest)).sort(byTier).slice(0, 8)

  return {
    favourites,
    favouriteCount: showcases.reduce((sum, showcase) => sum + showcase.favouriteCount, 0),
    oldest,
    rarest,
    byRarity: [...tiers.values()].sort((a, b) => cosmeticRarityWeight(b.rarity) - cosmeticRarityWeight(a.rarity)),
    chapterOne: showcases.reduce((sum, showcase) => sum + showcase.chapterOne, 0),
    renders: unique([...favourites, ...rarest, ...oldest].filter((item) => item.featured)),
  }
}

function gamesStory(
  accounts: RewindInput['accounts'],
  overviews: RewindInput['overviews'],
  playtime: RewindInput['playtime']
): Rewind['games'] {
  const owned = new Set<string>()
  const played = new Map<string, { title: string; seconds: number; art: LibraryArt }>()
  const achievements = { unlocked: 0, xp: 0, games: 0 }

  for (const { id } of accounts) {
    const overview = overviews[id]
    const timed = playtime[id]?.status === 'ok' ? playtime[id] : null
    const seconds = timed ? secondsByApp(timed.entries) : null

    if (overview?.status === 'ok') {
      for (const game of libraryGames(overview.records).games) {
        owned.add(game.namespace)

        const time = seconds ? timeFor(game.appNames, seconds) : null

        if (time) {
          const known = played.get(game.namespace)

          played.set(game.namespace, { title: game.title, art: game.art, seconds: (known?.seconds ?? 0) + time })
        }
      }
    }

    for (const game of timed?.achievements ?? []) {
      if (game.unlocked > 0) {
        achievements.unlocked += game.unlocked
        achievements.xp += game.xp
        achievements.games += 1
      }
    }
  }

  const [top] = [...played.values()].sort((a, b) => b.seconds - a.seconds)

  return {
    owned: owned.size,
    top: top ? { title: top.title, hours: top.seconds / 3600, art: top.art } : null,
    achievements,
  }
}
