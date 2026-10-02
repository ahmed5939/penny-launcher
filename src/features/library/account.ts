import type { CatalogItem, Entitlement, LibraryArt } from './model'

import { pickArt } from './model'

/**
 * What the account really has, beyond its bare entitlements.
 *
 * Three facts the entitlements get wrong or cannot say:
 *
 * - **Save the World access** lives in the game's own `common_core`
 *   profile as `Token:campaignaccess`. No account this was checked against
 *   (three, 2026-10-02) had an entitlement for Save the World's catalogue
 *   item, Founders included — an entitlement check called every one of
 *   them "not owned". `Token:founderspack_N` says which Founder's Pack.
 * - **The account's Epic library** — its games — is the launcher's own
 *   `Library.libraryItems` list, named and with art, rather than a count
 *   of entitlements in other namespaces.
 * - **Which playtime records belong to a mode**: each launchable mode has a
 *   launcher app id of its own, and its hidden "content" item (the one Epic
 *   records Save the World's hours under) shares its `IslandOverride`.
 */

export type ProfileAccess = {
  campaignAccess: boolean
  /** When the account's `common_core` was made — its first Fortnite session. */
  created: string | null
  /** Highest `Token:founderspack_N`, 1–5; null for a non-Founder. */
  founderTier: number | null
  tutorialComplete: boolean
}

export type SaveTheWorldStatus = {
  /** Null when neither the profile nor the entitlements could say. */
  access: boolean | null
  /** Where `access` came from: the game profile is the authority. */
  source: 'profile' | 'entitlements' | null
  founder: { edition: string | null } | null
  /** When the Founder entitlement was granted. */
  founderSince: string | null
  tutorialComplete: boolean
  art: LibraryArt
}

export type LibraryRecord = {
  appName: string
  namespace: string
  catalogItemId: string | null
  title: string | null
  art: LibraryArt
  categories: Array<string>
  acquiredAt: string | null
  sandboxName: string | null
}

export type LibraryGame = {
  namespace: string
  title: string
  art: LibraryArt
  /** Every launcher app of the game — its playtime records are under these. */
  appNames: Array<string>
  acquiredAt: string | null
}

export type GrantGroup = 'purchase' | 'reward' | 'access'

/** The Founder's Pack editions, by token number. */
const founderEditions = ['Standard', 'Deluxe', 'Super Deluxe', 'Limited', 'Ultimate']

/** The Founder audience entitlement — Save the World's Founders hold it. */
export const founderEntitlementIds = ['4217759881dd43209da2e89a9552a9a6']

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function isoDate(value: unknown) {
  const raw = text(value)
  const time = raw ? Date.parse(raw) : NaN

  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function paths(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const path = text(record(entry)?.path)

        return path ? [path] : []
      })
    : []
}

// ---------------------------------------------------------------------------
// Save the World
// ---------------------------------------------------------------------------

/** The access tokens in a `common_core` QueryProfile reply, or null without a profile. */
export function parseProfileAccess(reply: unknown): ProfileAccess | null {
  const changes = record(reply)?.profileChanges
  const profile = Array.isArray(changes) ? record(record(changes[0])?.profile) : null
  const items = record(profile?.items)

  if (!items) {
    return null
  }

  const templates = Object.values(items).flatMap((item) => {
    const id = text(record(item)?.templateId)

    return id ? [id.toLowerCase()] : []
  })
  const tiers = templates.flatMap((id) => {
    const match = /^token:founderspack_(\d+)$/.exec(id)

    return match ? [Number(match[1])] : []
  })

  return {
    campaignAccess: templates.includes('token:campaignaccess'),
    created: isoDate(profile?.created),
    founderTier: tiers.length > 0 ? Math.max(...tiers) : null,
    tutorialComplete: templates.includes('token:campaigntutorialcomplete'),
  }
}

export function founderEdition(tier: number | null) {
  return tier !== null && tier >= 1 ? (founderEditions[tier - 1] ?? null) : null
}

/**
 * Save the World, decided. The profile's token wins; without the profile,
 * an entitlement can still show access (a Founder's, or the mode's own) but
 * never its absence — so no entitlement is "unknown", not "no".
 */
export function saveTheWorldStatus({
  art,
  entitlementGrants,
  fortnite,
  profile,
}: {
  art: LibraryArt
  /** Active entitlements for Save the World's own catalogue items. */
  entitlementGrants: Array<Entitlement>
  /** Every active `fn` entitlement. */
  fortnite: Array<Entitlement>
  profile: ProfileAccess | null
}): SaveTheWorldStatus {
  const founderGrants = fortnite.filter(
    (entitlement) =>
      founderEntitlementIds.includes(entitlement.catalogItemId) ||
      entitlement.entitlementName === 'Fortnite_Founder'
  )
  const founderSince =
    founderGrants
      .map((entitlement) => entitlement.grantDate)
      .filter((date): date is string => date !== null)
      .sort()[0] ?? null
  const isFounder = (profile?.founderTier ?? null) !== null || founderGrants.length > 0
  const entitled = entitlementGrants.length > 0 || founderGrants.length > 0

  return {
    access: profile ? profile.campaignAccess : entitled ? true : null,
    source: profile ? 'profile' : entitled ? 'entitlements' : null,
    founder: isFounder ? { edition: founderEdition(profile?.founderTier ?? null) } : null,
    founderSince,
    tutorialComplete: profile?.tutorialComplete ?? false,
    art,
  }
}

// ---------------------------------------------------------------------------
// The Epic library
// ---------------------------------------------------------------------------

/** One page of `Library.libraryItems`: its records and the next cursor. */
export function parseLibraryPage(body: unknown) {
  const items = record(record(record(record(body)?.data)?.Library)?.libraryItems)
  const records = Array.isArray(items?.records) ? items.records : []
  const parsed = records.flatMap((entry): Array<LibraryRecord> => {
    const row = record(entry)
    const appName = text(row?.appName)
    const namespace = text(row?.namespace)

    if (!row || !appName || !namespace) {
      return []
    }

    const item = record(row.catalogItem)

    return [
      {
        appName,
        namespace,
        catalogItemId: text(row.catalogItemId),
        title: text(item?.title),
        art: pickArt(item?.keyImages),
        categories: paths(item?.categories),
        acquiredAt: isoDate(row.acquisitionDate),
        sandboxName: text(row.sandboxName),
      },
    ]
  })

  return {
    records: parsed,
    nextCursor: text(record(items?.responseMetadata)?.nextCursor),
  }
}

function isTool(categories: Array<string>) {
  return categories.some(
    (path) => path === 'engines' || path.startsWith('engines/') || path === 'plugins' || path.startsWith('plugins/')
  )
}

/**
 * The account's games outside Fortnite, one per game (namespace), newest
 * first. Engines and plugins are not games; they are only named, in
 * `tools`, so the page can say they are there.
 */
export function libraryGames(records: Array<LibraryRecord>) {
  const byNamespace = new Map<string, Array<LibraryRecord>>()
  const tools = new Map<string, number>()

  for (const entry of records) {
    if (entry.namespace === 'fn') {
      continue
    }

    if (isTool(entry.categories)) {
      const name = entry.title ?? entry.sandboxName ?? entry.appName

      tools.set(name, (tools.get(name) ?? 0) + 1)

      continue
    }

    byNamespace.set(entry.namespace, [...(byNamespace.get(entry.namespace) ?? []), entry])
  }

  const games = [...byNamespace.values()].map((entries): LibraryGame => {
    const main = entries.find((entry) => entry.categories.includes('games')) ?? entries[0]

    return {
      namespace: main.namespace,
      title: main.title ?? main.sandboxName ?? main.appName,
      art: entries.find((entry) => entry.art.tall)?.art ?? main.art,
      appNames: entries.map((entry) => entry.appName),
      acquiredAt:
        entries
          .map((entry) => entry.acquiredAt)
          .filter((date): date is string => date !== null)
          .sort()[0] ?? null,
    }
  })

  games.sort(
    (a, b) => (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? '') || a.title.localeCompare(b.title)
  )

  return {
    games,
    tools: [...tools.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name),
  }
}

/** Launcher app name → title, for naming cloud saves and playtime. */
export function recordTitles(records: Array<LibraryRecord>) {
  const titles: Record<string, string> = {}

  for (const entry of records) {
    if (entry.title && !titles[entry.appName]) {
      titles[entry.appName] = entry.title
    }
  }

  return titles
}

// ---------------------------------------------------------------------------
// Fortnite's modes and grants
// ---------------------------------------------------------------------------

/** The island a catalogue item starts: `campaign`, `playlist_juno`… */
export function islandOverride(item: CatalogItem) {
  const line = item.customAttributes?.AdditionalCommandLine?.value ?? ''

  return /-IslandOverride=(\S+)/.exec(line)?.[1] ?? null
}

function releaseApps(item: CatalogItem) {
  return (item.releaseInfo ?? []).flatMap((release) => (release.appId ? [release.appId] : []))
}

/**
 * The launcher app ids a mode's playtime is recorded under: its own, and
 * those of any hidden content item that starts the same island.
 */
export function modeAppIds(mode: CatalogItem, siblings: Array<CatalogItem>) {
  const island = islandOverride(mode)
  const content = island
    ? siblings.filter(
        (item) =>
          item.id !== mode.id &&
          islandOverride(item) === island &&
          paths(item.categories).includes('hidden')
      )
    : []

  return [...new Set([...releaseApps(mode), ...content.flatMap(releaseApps)])]
}

/**
 * Every app id the Fortnite catalogue knows, with its title and art — the
 * names for playtime records `appBuilds` cannot name (Battle Royale's has
 * no build of its own).
 */
export function fortniteAppInfo(mainItem: CatalogItem | null) {
  const apps: Record<string, { title: string; art: LibraryArt }> = {}

  for (const item of mainItem?.dlcItemList ?? []) {
    for (const appId of releaseApps(item)) {
      if (item.title && !apps[appId]) {
        apps[appId] = { title: item.title, art: pickArt(item.keyImages) }
      }
    }
  }

  return apps
}

/**
 * Where a Fortnite entitlement belongs. Access: audience flags and the
 * entitlements behind a mode or app. Purchase: V-Bucks, packs and bundles,
 * by the store's offer or the catalogue. Reward: the rest — refer-a-friend
 * tiers, drops, cross-promotions — which Epic files under internal names.
 */
export function grantGroup({
  categories,
  entitlementType,
  offerType,
  title,
}: {
  categories: Array<string>
  entitlementType: string
  offerType: string | null
  title: string
}): GrantGroup {
  if (
    entitlementType === 'AUDIENCE' ||
    categories.includes('audience') ||
    /\baudience\b/i.test(title) ||
    offerType === 'EXPERIENCE' ||
    offerType === 'DLC'
  ) {
    return 'access'
  }

  if (
    offerType === 'BUNDLE' ||
    offerType === 'ADD_ON' ||
    offerType === 'VIRTUAL_CURRENCY' ||
    categories.some((path) => path === 'points' || path.startsWith('points/') || path === 'bundles') ||
    /\b(pack|bundle|v-bucks)\b/i.test(title)
  ) {
    return 'purchase'
  }

  return 'reward'
}

/** Where a reward came from, when its entitlement name says so plainly. */
export function rewardSource(entitlementName: string, categories: Array<string>) {
  if (/^FN_Sugar/i.test(entitlementName)) return 'Rocket League'
  if (/^BB_/i.test(entitlementName)) return 'Battle Breakers'
  if (/^(FN_)?RaF/i.test(entitlementName)) return 'Refer a Friend'
  if (categories.includes('cross_promo')) return 'Cross-promotion'

  return null
}

// ---------------------------------------------------------------------------
// Playtime, joined in
// ---------------------------------------------------------------------------

/** Seconds by launcher app id, from the playtime entries. */
export function secondsByApp(entries: Array<{ artifactId: string; seconds: number }>) {
  return new Map(entries.map((entry) => [entry.artifactId, entry.seconds]))
}

/**
 * A mode's or game's time: the largest of its apps' records, never their
 * sum — Epic does not say whether one session can count under two apps, and
 * a figure that might be doubled is worse than one that might be short.
 * Null when none of its apps has a record.
 */
export function timeFor(appIds: Array<string>, seconds: Map<string, number>) {
  const found = appIds.flatMap((id) => (seconds.has(id) ? [seconds.get(id) ?? 0] : []))

  return found.length > 0 ? Math.max(...found) : null
}
