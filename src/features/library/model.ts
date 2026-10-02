import type { GrantGroup, LibraryGame, LibraryRecord, ProfileAccess, SaveTheWorldStatus } from './account'

import { grantGroup, islandOverride, libraryGames, modeAppIds, rewardSource, saveTheWorldStatus } from './account'

/**
 * The Library page's model.
 *
 * Four Epic services answer for it and none of them knows about the others:
 * entitlements say what an account holds (ids only), the catalogue says what
 * an id *is* (title, art, categories), the store says what is on sale and for
 * how much, and the save-sync datastore lists cloud saves. Everything here is
 * the join, kept pure so it can be tested without any of them — and every
 * reader is defensive, because only the catalogue and the store shapes have
 * been seen first-hand.
 */

export const fortniteNamespace = 'fn'

/** Fortnite's main catalogue item. Its `dlcItemList` is the list of modes. */
export const fortniteMainItemId = '4fe75bbc5a674f4f9b356b5c90567da5'

/**
 * Save the World's own items: the launchable mode and the hidden content
 * item behind it. Matched by title and launch argument as well (see
 * `isSaveTheWorldItem`); these ids are the fallback for when the catalogue
 * could not be read.
 */
export const saveTheWorldItemIds = [
  'f205453fa3384a61a9b40ff76279bef2',
  '0b41f0192f7f4f2691684581aedc0778',
]

/** Store and catalogue art is only drawn from these — they are in the CSP. */
export const artHosts = ['cdn1.epicgames.com', 'cdn2.unrealengine.com']

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type CatalogKeyImage = { type?: string; url?: string }

/** A catalogue item, as much of it as this page reads (and caches). */
export type CatalogItem = {
  id: string
  title?: string
  description?: string
  keyImages?: Array<CatalogKeyImage>
  categories?: Array<{ path?: string }>
  namespace?: string
  status?: string
  entitlementName?: string
  entitlementType?: string
  itemType?: string
  customAttributes?: Record<string, { type?: string; value?: string }>
  releaseInfo?: Array<{ appId?: string }>
  dlcItemList?: Array<CatalogItem>
}

export type Entitlement = {
  id: string
  entitlementName: string
  namespace: string
  catalogItemId: string
  entitlementType: string
  grantDate: string | null
  active: boolean
  consumable: boolean
}

export type LibraryArt = { tall: string | null; wide: string | null }

/** What a purchase or an offer is, from its categories, title and offer type. */
export type ItemKind = 'vbucks' | 'pack' | 'subscription' | 'access' | 'other'

/** The store tab's three groups. */
export type OfferKind = 'vbucks' | 'pack' | 'other'

export type LibraryMode = {
  catalogItemId: string
  title: string
  art: LibraryArt
  /** Launcher app ids Epic records this mode's playtime under. */
  appIds: Array<string>
  saveTheWorld: boolean
  /** The island Fortnite opens for it (`-IslandOverride=`), for launching straight in. */
  island: string | null
}

export type LibraryPurchase = {
  catalogItemId: string
  entitlementName: string
  title: string
  description: string | null
  art: LibraryArt
  /** When the account first received it. */
  grantDate: string | null
  /** When it last received it — differs from `grantDate` only when `count` > 1. */
  lastGrantDate: string | null
  /** Entitlements for this item; V-Bucks packs bought twice are one row of two. */
  count: number
  entitlementType: string
  categories: Array<string>
  kind: ItemKind
  /** False when every entitlement for it has been revoked or used up. */
  active: boolean
  /** False when the catalogue did not know the id; the title is then a guess. */
  resolved: boolean
  /** Access flag, real purchase, or a promotional reward. */
  group: GrantGroup
  /** Where a reward came from, when its name says so: "Refer a Friend". */
  source: string | null
  /** Epic's own name for it, when the title shown is a better one. */
  internalName: string | null
}

export type LibraryResponse = {
  accountId: string
  fortnite: {
    /** Fortnite's own box art, for the whole-game tile ahead of the modes. */
    art: LibraryArt
    modes: Array<LibraryMode>
    purchases: Array<LibraryPurchase>
    /** `art` is Save the World's own store art, for the access line. */
    saveTheWorld: SaveTheWorldStatus
    /** Every active `fn` catalogue item id, for marking store offers as owned. */
    ownedItemIds: Array<string>
  }
  /**
   * The account's Epic library outside Fortnite: its games, and the names
   * of the engines and plugins in it. Null when the library could not be read.
   */
  games: { list: Array<LibraryGame>; tools: Array<string> } | null
  /** Set when part of the page could not be read; the rest is still drawn. */
  errorMessage?: string
}

export type OfferPrice = {
  /** Minor units (cents, pence). */
  original: number
  discount: number
  currencyCode: string
  decimals: number
  formattedOriginal: string
  formattedDiscount: string
  free: boolean
  discounted: boolean
}

export type LibraryOffer = {
  id: string
  title: string
  description: string | null
  offerType: string | null
  kind: OfferKind
  art: LibraryArt
  itemIds: Array<string>
  /** Null when the store has no price for this region. */
  price: OfferPrice | null
  effectiveDate: string | null
  expiryDate: string | null
  /**
   * Has store art. The namespace also carries years of internal offers —
   * audiences, comp V-Bucks, test bundles — with none; they are hidden by
   * default rather than dropped.
   */
  listed: boolean
}

export type LibraryStoreResponse = {
  /** ISO 3166 country the prices are for. */
  country: string
  offers: Array<LibraryOffer>
  fetchedAt: string
  errorMessage?: string
}

export type CloudSaveFile = {
  /** Relative to the game's folder in the save store. */
  path: string
  size: number | null
  lastModified: string | null
}

export type CloudSaveGame = {
  appName: string
  /** Only when it could be named without another request. */
  title: string | null
  files: Array<CloudSaveFile>
  totalSize: number
  lastModified: string | null
  /** Epic handed out download links for its files. */
  downloadable: boolean
}

export type CloudSavesResponse = {
  accountId: string
  games: Array<CloudSaveGame>
  limits: { maxFileSizeBytes: number | null; maxFolderSizeBytes: number | null }
  /** Epic is limiting uploads to this account's save folder. */
  folderThrottled: boolean
  errorMessage?: string
}

/** A download link, which stays in the main process. */
export type CloudSaveDownload = {
  path: string
  readLink: string
  size: number | null
}

export type CloudSavesDownloadStatus = 'running' | 'saved' | 'cancelled' | 'failed'

export type CloudSavesDownloadProgress = {
  requestId: string
  accountId: string
  appName: string
  status: CloudSavesDownloadStatus
  done: number
  total: number
  bytes: number
  /** Files whose names could not be written safely and were left out. */
  skipped: number
  /** Where the copy went, once there is one. */
  directory: string | null
  errorMessage?: string
}

/** Every Library reply: the request it answers, and a result or a reason. */
export type LibraryReply<T> = {
  requestId: string
  result?: T
  error?: string
}

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function count(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value

  return typeof number === 'number' && Number.isFinite(number) && number >= 0 ? number : null
}

function isoDate(value: unknown): string | null {
  const raw = text(value)

  if (!raw) {
    return null
  }

  const time = Date.parse(raw)

  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function earliest(dates: Array<string | null>) {
  return dates.filter((date): date is string => date !== null).sort()[0] ?? null
}

function latest(dates: Array<string | null>) {
  return dates.filter((date): date is string => date !== null).sort().pop() ?? null
}

function categoryPaths(value: unknown): Array<string> {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const path = text(record(entry)?.path)

        return path ? [path] : []
      })
    : []
}

// ---------------------------------------------------------------------------
// Art
// ---------------------------------------------------------------------------

const tallArt = ['DieselGameBoxTall', 'OfferImageTall', 'DieselStoreFrontTall', 'Thumbnail', 'CodeRedemption_340x440']
const wideArt = ['OfferImageWide', 'DieselGameBox', 'DieselStoreFrontWide', 'featuredMedia']

function artUrl(value: unknown): string | null {
  const raw = text(value)

  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)

    return url.protocol === 'https:' && artHosts.includes(url.hostname) ? raw : null
  } catch {
    return null
  }
}

/** The tall (box) and wide (banner) art from a `keyImages` list, either may be missing. */
export function pickArt(keyImages: unknown): LibraryArt {
  const images = Array.isArray(keyImages)
    ? keyImages.flatMap((entry) => {
        const image = record(entry)
        const url = artUrl(image?.url)
        const type = text(image?.type)

        return url && type ? [{ type, url }] : []
      })
    : []
  const first = (types: Array<string>) =>
    types.map((type) => images.find((image) => image.type === type)?.url).find(Boolean) ?? null

  return { tall: first(tallArt), wide: first(wideArt) }
}

/**
 * Asks the image CDN for a resized copy. Both hosts serve the key art at
 * 2560px, a third of a megabyte each; a 40-tile grid of those is a lot to
 * decode for 200px cards.
 */
export function sizedArt(url: string | null, width: number, height: number) {
  if (!url || url.includes('?')) {
    return url
  }

  return `${url}?w=${width}&h=${height}&resize=1&quality=medium`
}

// ---------------------------------------------------------------------------
// Entitlements ↔ catalogue
// ---------------------------------------------------------------------------

/** Entitlement pages, read defensively. Entries without an item id or name are dropped. */
export function parseEntitlements(raw: unknown): Array<Entitlement> {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((entry) => {
    const e = record(entry)
    const catalogItemId = text(e?.catalogItemId)
    const entitlementName = text(e?.entitlementName)

    if (!e || (!catalogItemId && !entitlementName)) {
      return []
    }

    const status = text(e.status)
    const namespace = text(e.namespace) ?? ''

    return [
      {
        id: text(e.id) ?? `${namespace}:${catalogItemId ?? entitlementName}`,
        entitlementName: entitlementName ?? '',
        namespace,
        catalogItemId: catalogItemId ?? '',
        entitlementType: text(e.entitlementType) ?? '',
        grantDate: isoDate(e.grantDate) ?? isoDate(e.created),
        active: e.active !== false && (status === null || status.toUpperCase() === 'ACTIVE'),
        consumable: e.consumable === true,
      },
    ]
  })
}

/** An entitlement for this catalogue item, by item id or by entitlement name. */
function grants(entitlement: Entitlement, item: Pick<CatalogItem, 'id' | 'entitlementName'>) {
  return (
    (entitlement.catalogItemId !== '' && entitlement.catalogItemId === item.id) ||
    (entitlement.entitlementName !== '' &&
      (entitlement.entitlementName === item.entitlementName || entitlement.entitlementName === item.id))
  )
}

function launchArguments(item: CatalogItem) {
  return item.customAttributes?.AdditionalCommandLine?.value ?? ''
}

/** Save the World's mode or its hidden content item. */
export function isSaveTheWorldItem(item: CatalogItem) {
  return (
    saveTheWorldItemIds.includes(item.id) ||
    /save the world/i.test(item.title ?? '') ||
    /IslandOverride=campaign\b/.test(launchArguments(item))
  )
}

/**
 * The modes Fortnite lists as its own: the main item's DLC that the
 * launcher can start. The hidden "content" items alongside them are what a
 * mode installs, not modes, and are left out.
 */
export function fortniteModes(mainItem: CatalogItem | null): Array<CatalogItem> {
  return (mainItem?.dlcItemList ?? []).filter((item) => {
    const paths = categoryPaths(item.categories)

    return paths.includes('addons/launchable') && !paths.includes('hidden')
  })
}

/** Catalogue ids to look up for the purchases list: every `fn` entitlement that is not a mode. */
export function purchaseItemIds(entitlements: Array<Entitlement>, mainItem: CatalogItem | null) {
  const excluded = excludedItems(mainItem)

  return [
    ...new Set(
      entitlements
        .filter((e) => e.namespace === fortniteNamespace && e.catalogItemId !== '' && !isExcluded(e, excluded))
        .map((e) => e.catalogItemId)
    ),
  ]
}

function excludedItems(mainItem: CatalogItem | null): Array<Pick<CatalogItem, 'id' | 'entitlementName'>> {
  return [
    { id: fortniteMainItemId, entitlementName: mainItem?.entitlementName },
    ...(mainItem?.dlcItemList ?? []),
    ...saveTheWorldItemIds.map((id) => ({ id })),
  ]
}

function isExcluded(entitlement: Entitlement, excluded: Array<Pick<CatalogItem, 'id' | 'entitlementName'>>) {
  return excluded.some((item) => grants(entitlement, item))
}

/** What a purchase or offer is. Subscription first: the Crew is also a durable add-on. */
export function itemKind(categories: Array<string>, title: string, offerType: string | null = null): ItemKind {
  const has = (path: string) => categories.some((category) => category === path || category.startsWith(`${path}/`))

  if (offerType === 'SUBSCRIPTION' || has('subscription')) return 'subscription'
  if (offerType === 'VIRTUAL_CURRENCY' || has('points') || /v-bucks/i.test(title)) return 'vbucks'
  if (offerType === 'ADD_ON' || offerType === 'BUNDLE' || has('bundles') || categories.includes('addons/durable') || /\b(pack|bundle)\b/i.test(title)) return 'pack'
  if (offerType === 'EXPERIENCE' || has('games') || /\b(audience|access)\b/i.test(title)) return 'access'

  return 'other'
}

/** A readable stand-in when the catalogue does not know an item. */
function fallbackTitle(entitlementName: string) {
  if (!entitlementName || /^[0-9a-f]{32}$/i.test(entitlementName)) {
    return 'Unlisted item'
  }

  return entitlementName.replace(/[_-]+/g, ' ').trim()
}

/** Fortnite's launchable modes, with the app ids their time is under and the island each starts. */
export function libraryModes(mainItem: CatalogItem | null): Array<LibraryMode> {
  const siblings = mainItem?.dlcItemList ?? []

  return fortniteModes(mainItem).map((item) => ({
    catalogItemId: item.id,
    title: item.title ?? 'Untitled mode',
    art: pickArt(item.keyImages),
    appIds: modeAppIds(item, siblings),
    saveTheWorld: isSaveTheWorldItem(item),
    island: islandOverride(item),
  }))
}

/** Access flags that read better by what they open than by Epic's name. */
const accessTitles: Record<string, string> = {
  '48ff3f41680e403bb2717737f68731c5': 'Fortnite',
  '4217759881dd43209da2e89a9552a9a6': "Founder's access",
  '045a89e535a1419ba1f790b7e1954af8': 'Unreal Editor for Fortnite',
}

/**
 * The store's offer for an item, preferring one with art and a real offer
 * type — the namespace also has art-less internal offers for the same items.
 */
function offerIndex(offers: Array<LibraryOffer>) {
  const index = new Map<string, LibraryOffer>()
  const score = (offer: LibraryOffer) =>
    Number(offer.listed) * 2 + Number(Boolean(offer.offerType) && offer.offerType !== 'OTHERS')

  for (const offer of offers) {
    for (const id of offer.itemIds) {
      const known = index.get(id)

      if (!known || score(offer) > score(known)) {
        index.set(id, offer)
      }
    }
  }

  return index
}

/**
 * The join. Save the World's access comes from the game profile when it
 * could be read (see `saveTheWorldStatus`); modes carry the app ids their
 * playtime is under; every other Fortnite entitlement is one row per
 * catalogue item, grouped into access, purchases and rewards and named
 * from the store's offer where there is one. `catalog` holds whatever the
 * catalogue returned for `purchaseItemIds` — a missing or null entry is
 * drawn from the entitlement alone.
 */
export function buildLibrary(
  accountId: string,
  entitlements: Array<Entitlement>,
  mainItem: CatalogItem | null,
  catalog: Record<string, CatalogItem | null | undefined>,
  {
    offers = [],
    profile = null,
    records = null,
  }: {
    offers?: Array<LibraryOffer>
    profile?: ProfileAccess | null
    records?: Array<LibraryRecord> | null
  } = {}
): Omit<LibraryResponse, 'errorMessage'> {
  const fortnite = entitlements.filter((e) => e.namespace === fortniteNamespace)
  const active = fortnite.filter((e) => e.active)
  const siblings = mainItem?.dlcItemList ?? []
  const modes = libraryModes(mainItem)

  const saveTheWorldItems: Array<Pick<CatalogItem, 'id' | 'entitlementName'>> = [
    ...siblings.filter(isSaveTheWorldItem),
    ...saveTheWorldItemIds.map((id) => ({ id })),
  ]

  const offersByItem = offerIndex(offers)
  const excluded = excludedItems(mainItem)
  const groups = new Map<string, Array<Entitlement>>()

  fortnite
    .filter((e) => !isExcluded(e, excluded))
    .forEach((e) => {
      const key = e.catalogItemId || `name:${e.entitlementName}`

      groups.set(key, [...(groups.get(key) ?? []), e])
    })

  const purchases = [...groups.values()]
    .map((held): LibraryPurchase => {
      const first = held[0]
      const item = first.catalogItemId ? catalog[first.catalogItemId] ?? null : null
      const offer = first.catalogItemId ? offersByItem.get(first.catalogItemId) ?? null : null
      // Internal offers (type OTHERS, no art) name nothing better than the catalogue does.
      const realOffer = offer && (offer.listed || (offer.offerType && offer.offerType !== 'OTHERS')) ? offer : null
      const catalogTitle = text(item?.title) ?? fallbackTitle(first.entitlementName)
      const categories = categoryPaths(item?.categories)
      const entitlementType = first.entitlementType || text(item?.entitlementType) || ''
      const group = grantGroup({
        categories,
        entitlementType,
        offerType: realOffer?.offerType ?? null,
        title: catalogTitle,
      })
      const kind = group === 'access' ? 'access' : itemKind(categories, realOffer?.title ?? catalogTitle, realOffer?.offerType ?? null)
      let title = accessTitles[first.catalogItemId] ?? realOffer?.title ?? catalogTitle

      // V-Bucks packs often carry only a codename ("Seasalt").
      if (kind === 'vbucks' && !/v-?bucks/i.test(title)) {
        title = 'V-Bucks pack'
      }

      const art = realOffer && (realOffer.art.tall || realOffer.art.wide) ? realOffer.art : pickArt(item?.keyImages)

      return {
        catalogItemId: first.catalogItemId,
        entitlementName: first.entitlementName,
        title,
        description: text(item?.description) && item?.description !== title ? item?.description ?? null : null,
        art,
        grantDate: earliest(held.map((e) => e.grantDate)),
        lastGrantDate: latest(held.map((e) => e.grantDate)),
        count: held.length,
        entitlementType,
        categories,
        kind,
        active: held.some((e) => e.active),
        resolved: item !== null,
        group,
        source: group === 'reward' ? rewardSource(first.entitlementName, categories) : null,
        internalName: title !== catalogTitle ? catalogTitle : null,
      }
    })
    .sort((a, b) => (b.lastGrantDate ?? '').localeCompare(a.lastGrantDate ?? '') || a.title.localeCompare(b.title))

  const saveTheWorld = saveTheWorldStatus({
    art: pickArt(fortniteModes(mainItem).find(isSaveTheWorldItem)?.keyImages),
    entitlementGrants: active.filter((e) => saveTheWorldItems.some((item) => grants(e, item))),
    fortnite: active,
    profile,
  })

  return {
    accountId,
    fortnite: {
      art: pickArt(mainItem?.keyImages),
      modes,
      purchases,
      saveTheWorld,
      /*
       * Save the World's own items count as held when the account has access
       * — no Founder holds an entitlement for them, so the store's Save the
       * World offer would otherwise never read as owned.
       */
      ownedItemIds: [
        ...new Set([
          ...active.map((e) => e.catalogItemId).filter(Boolean),
          ...(saveTheWorld.access === true ? saveTheWorldItemIds : []),
        ]),
      ],
    },
    games: records ? (({ games, tools }) => ({ list: games, tools }))(libraryGames(records)) : null,
  }
}

/** Launcher app names this catalogue item answers to, for naming cloud saves. */
export function appTitles(mainItem: CatalogItem | null): Record<string, string> {
  const titles: Record<string, string> = {}

  for (const item of [...(mainItem ? [mainItem] : []), ...(mainItem?.dlcItemList ?? [])]) {
    for (const release of item.releaseInfo ?? []) {
      if (release.appId && item.title && !titles[release.appId]) {
        titles[release.appId] = item.title
      }
    }
  }

  return titles
}

/**
 * What is worth keeping of a catalogue item on disk. The full item carries
 * long descriptions, EULA ids and a copy of the main game inside every DLC;
 * the page reads none of that.
 */
export function trimCatalogItem(item: CatalogItem): CatalogItem {
  const command = item.customAttributes?.AdditionalCommandLine

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    keyImages: (item.keyImages ?? []).filter(
      (image) => image.type && [...tallArt, ...wideArt].includes(image.type)
    ),
    categories: item.categories,
    namespace: item.namespace,
    status: item.status,
    entitlementName: item.entitlementName,
    entitlementType: item.entitlementType,
    itemType: item.itemType,
    customAttributes: command ? { AdditionalCommandLine: command } : undefined,
    releaseInfo: item.releaseInfo?.map((release) => ({ appId: release.appId })),
    dlcItemList: item.dlcItemList?.map(trimCatalogItem),
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Country and price locale from the OS, falling back to the US store. */
export function storeRegion(countryCode: string | null | undefined, systemLocale: string | null | undefined) {
  const country = /^[a-z]{2}$/i.test(countryCode ?? '') ? countryCode!.toUpperCase() : 'US'
  const match = /^([a-z]{2,3})(?:[-_]([a-z]{2}))?$/i.exec((systemLocale ?? '').trim())
  const locale = match ? (match[2] ? `${match[1].toLowerCase()}-${match[2].toUpperCase()}` : match[1].toLowerCase()) : 'en-US'

  return { country, locale }
}

function offerPrice(value: unknown): OfferPrice | null {
  const total = record(record(value)?.totalPrice)
  const original = count(total?.originalPrice)
  const discount = count(total?.discountPrice)
  const currencyCode = text(total?.currencyCode)

  if (!total || original === null || discount === null || !currencyCode) {
    return null
  }

  const decimals = count(record(total.currencyInfo)?.decimals) ?? 2
  const formatted = record(total.fmtPrice)
  const format = (minor: number) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(minor / 10 ** decimals)
    } catch {
      return `${(minor / 10 ** decimals).toFixed(decimals)} ${currencyCode}`
    }
  }
  /* The store prints a free price as a bare "0"; that is not worth showing. */
  const printed = (raw: unknown, minor: number) => {
    const value = text(raw)

    return value && value !== '0' ? value : format(minor)
  }

  return {
    original,
    discount,
    currencyCode,
    decimals,
    formattedOriginal: printed(formatted?.originalPrice, original),
    formattedDiscount: printed(formatted?.discountPrice, discount),
    free: discount === 0,
    discounted: discount < original,
  }
}

/** The store's `catalogOffers` answer as a list of offers, listed ones first. */
export function normaliseStoreOffers(raw: unknown): Array<LibraryOffer> {
  const elements = record(record(record(record(raw)?.data)?.Catalog)?.catalogOffers)?.elements
  const offers = (Array.isArray(elements) ? elements : []).flatMap((entry): Array<LibraryOffer> => {
    const offer = record(entry)
    const id = text(offer?.id)

    if (!offer || !id) {
      return []
    }

    const title = text(offer.title) ?? 'Untitled offer'
    const offerType = text(offer.offerType)
    const categories = categoryPaths(offer.categories)
    const kind = itemKind(categories, title, offerType)
    const art = pickArt(offer.keyImages)

    return [
      {
        id,
        title,
        description: text(offer.description) && offer.description !== title ? (offer.description as string) : null,
        offerType,
        kind: kind === 'vbucks' || kind === 'pack' ? kind : 'other',
        art,
        itemIds: Array.isArray(offer.items)
          ? offer.items.flatMap((item) => {
              const itemId = text(record(item)?.id)

              return itemId ? [itemId] : []
            })
          : [],
        price: offerPrice(offer.price),
        effectiveDate: isoDate(offer.effectiveDate),
        expiryDate: isoDate(offer.expiryDate),
        listed: art.tall !== null || art.wide !== null,
      },
    ]
  })

  return [...offers.filter((offer) => offer.listed), ...offers.filter((offer) => !offer.listed)]
}

/** True when the account holds an entitlement for any item the offer grants. */
export function offerOwned(offer: Pick<LibraryOffer, 'itemIds'>, ownedItemIds: ReadonlySet<string>) {
  return offer.itemIds.some((id) => ownedItemIds.has(id))
}

// ---------------------------------------------------------------------------
// Cloud saves
// ---------------------------------------------------------------------------

/**
 * Splits a save-store key into the game and the file. Keys are paths under
 * the account — `{accountId}/{appName}/…` — though tools that read them
 * index from a leading segment as well, so the account id is looked for
 * rather than assumed to come first.
 */
export function splitSaveKey(key: string, accountId: string) {
  const segments = key.split('/').filter((segment) => segment.length > 0)
  const at = segments.findIndex((segment) => segment.toLowerCase() === accountId.toLowerCase())
  const rest = at >= 0 ? segments.slice(at + 1) : segments

  return rest.length >= 2 ? { appName: rest[0], path: rest.slice(1).join('/') } : null
}

type SaveEntry = { appName: string; path: string; size: number | null; lastModified: string | null; readLink: string | null }

function saveEntries(raw: unknown, accountId: string): Array<SaveEntry> {
  const files = record(record(raw)?.files)

  if (!files) {
    return []
  }

  return Object.entries(files).flatMap(([key, value]) => {
    const where = splitSaveKey(key, accountId)
    const meta = record(value) ?? {}
    const readLink = text(meta.readLink)

    return where
      ? [
          {
            ...where,
            size: count(meta.size) ?? count(meta.length) ?? count(meta.fileSize),
            lastModified: isoDate(meta.lastModified) ?? isoDate(meta.lastModifiedDate) ?? isoDate(meta.uploaded),
            readLink: readLink?.startsWith('https://') ? readLink : null,
          },
        ]
      : []
  })
}

/** The save-store listing, one entry per game, most recently synced first. */
export function parseCloudSaves(
  raw: unknown,
  accountId: string,
  titles: Record<string, string> = {}
): Omit<CloudSavesResponse, 'accountId'> {
  const listing = record(raw)
  const byApp = new Map<string, Array<SaveEntry>>()

  saveEntries(raw, accountId).forEach((entry) => {
    byApp.set(entry.appName, [...(byApp.get(entry.appName) ?? []), entry])
  })

  const games = [...byApp.entries()]
    .map(([appName, entries]): CloudSaveGame => ({
      appName,
      title: titles[appName] ?? null,
      files: entries
        .map(({ path, size, lastModified }) => ({ path, size, lastModified }))
        .sort((a, b) => a.path.localeCompare(b.path)),
      totalSize: entries.reduce((sum, entry) => sum + (entry.size ?? 0), 0),
      lastModified: latest(entries.map((entry) => entry.lastModified)),
      downloadable: entries.some((entry) => entry.readLink !== null),
    }))
    .sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? '') || a.appName.localeCompare(b.appName))

  return {
    games,
    limits: {
      maxFileSizeBytes: count(listing?.maxFileSizeBytes),
      maxFolderSizeBytes: count(listing?.maxFolderSizeBytes),
    },
    folderThrottled: listing?.folderThrottled === true,
  }
}

/** One game's files that came with a download link. */
export function cloudSaveDownloads(raw: unknown, accountId: string, appName: string): Array<CloudSaveDownload> {
  return saveEntries(raw, accountId)
    .filter((entry) => entry.appName === appName && entry.readLink !== null)
    .map((entry) => ({ path: entry.path, readLink: entry.readLink!, size: entry.size }))
}

const windowsReserved = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

/**
 * A save-store path as folder names that are safe to create under the chosen
 * folder, or null. The keys come from Epic, but they are written to the
 * user's disk, so anything that could climb out of the folder (`..`, an
 * absolute path, a drive letter) or that Windows cannot name is refused
 * rather than cleaned up.
 */
export function safeSaveSegments(relativePath: string): Array<string> | null {
  if (!relativePath || /^[a-z]:/i.test(relativePath) || /^[\\/]/.test(relativePath)) {
    return null
  }

  const segments = relativePath.split(/[\\/]/)
  const unsafe = segments.some(
    (segment) =>
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      // eslint-disable-next-line no-control-regex
      /[<>:"|?*\u0000-\u001f]/.test(segment) ||
      /[. ]$/.test(segment) ||
      windowsReserved.test(segment)
  )

  return unsafe ? null : segments
}

/** A link with its signature cut off, for the log. */
export function withoutQuery(url: string) {
  const at = url.search(/[?#]/)

  return at >= 0 ? `${url.slice(0, at)}?…` : url
}

/**
 * A few listing entries for the runtime log, with every signed link cut
 * down to its path. The per-file fields have not been seen on a live
 * account; this line is the evidence for correcting `parseCloudSaves`.
 */
export function cloudSaveLogSample(raw: unknown, limit = 4) {
  const listing = record(raw)
  const files = record(listing?.files) ?? {}
  const sample = Object.entries(files)
    .slice(0, limit)
    .map(([key, value]) => {
      const meta = record(value) ?? {}

      return [
        key,
        Object.fromEntries(
          Object.entries(meta).map(([field, fieldValue]) => [
            field,
            typeof fieldValue === 'string' && /^https?:/i.test(fieldValue) ? withoutQuery(fieldValue) : fieldValue,
          ])
        ),
      ]
    })

  return JSON.stringify({
    fields: Object.keys(listing ?? {}),
    files: Object.keys(files).length,
    sample: Object.fromEntries(sample),
  }).slice(0, 4000)
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
