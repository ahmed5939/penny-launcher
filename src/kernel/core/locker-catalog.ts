import type {
  FortniteApiBanner,
  FortniteApiBannerColor,
  FortniteApiCosmetic,
  FortniteApiTrack,
} from '../../types/services/cosmetics'

import { RuntimeLog } from '../runtime-log'

import {
  getBanners,
  getBannerColors,
  getBrCosmetics,
  getCarCosmetics,
  getInstrumentCosmetics,
  getTrackCosmetics,
} from '../../services/endpoints/cosmetics'

/**
 * Template id → what to draw for it.
 *
 * Epic's locker only ever hands back ids. Five separate public catalogues
 * hold the names, pictures and rarities behind them, and which one an id
 * belongs to is decided by its `templateId` prefix — a `SparksSong:` is a
 * jam track, a `VehicleCosmetics_Body:` is a car part, and neither is in the
 * BR catalogue everything else comes from.
 *
 * The lookup half of this module is pure: `buildCosmeticsCatalog` takes the
 * six raw documents and `resolveCosmetic` reads them, so both are testable
 * without a network. `getCosmeticsCatalog` is the cached fetch on top.
 */

export type CosmeticMeta = {
  /** `AthenaCharacter:cid_001_athena_commando_f`, as Epic spells it. */
  templateId: string
  /** The part before the colon. */
  backendType: string
  /** The part after it — what fortnite-api.com keys its catalogues by. */
  id: string
  name: string
  imageUrl: string | null
  /**
   * fortnite-api's rarity token. Already collapses the series tiers
   * (`marvel`, `icon`, `gaminglegends`, …) into the same field as the
   * ordinary `legendary`/`epic`/`rare` ladder, so it is the one key worth
   * colouring by.
   */
  rarity: string
  /** Human series name, when the item belongs to one. */
  series: string | null
  /** The series' own palette, `RRGGBBAA` — what the game tints its tile with. */
  seriesColors: Array<string> | null
  /** Banner colours have no picture; they *are* a colour. Hex, or null. */
  color: string | null
  /** Chapter the item was introduced in, when the catalogue records one. */
  chapter: number | null
  /** ISO date the item first appeared. */
  added: string | null
  /** False when nothing in any catalogue matched, so the name is a guess. */
  resolved: boolean
}

export type CosmeticsCatalog = {
  br: Map<string, FortniteApiCosmetic>
  instruments: Map<string, FortniteApiCosmetic>
  cars: Map<string, FortniteApiCosmetic>
  tracks: Map<string, FortniteApiTrack>
  banners: Map<string, FortniteApiBanner>
  bannerColors: Map<string, FortniteApiBannerColor>
}

const instrumentBackendTypes = new Set([
  'SparksGuitar',
  'SparksBass',
  'SparksDrums',
  'SparksKeyboard',
  'SparksMicrophone',
])

const vehicleBackendTypes = new Set([
  'VehicleCosmetics_Body',
  'VehicleCosmetics_Skin',
  'VehicleCosmetics_Wheel',
  'VehicleCosmetics_DriftTrail',
  'VehicleCosmetics_Booster',
])

export function splitTemplateId(templateId: string) {
  const separator = templateId.indexOf(':')

  if (separator < 0) {
    return { backendType: '', id: templateId }
  }

  return {
    backendType: templateId.slice(0, separator),
    id: templateId.slice(separator + 1),
  }
}

export function prettifyCosmeticId(id: string) {
  return (
    id
      .split(':')[0]
      .split(/[_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || id
  )
}

function indexById<T extends { id?: string }>(
  items: Array<T> | undefined,
  alias?: (item: T) => Array<string | undefined>
) {
  const map = new Map<string, T>()

  items?.forEach((item) => {
    const keys = [item.id, ...(alias?.(item) ?? [])]

    keys.forEach((key) => {
      if (!key) {
        return
      }

      const lower = key.toLowerCase()

      /*
       * First writer wins. Aliases are looser than ids — a track's `devName`
       * or a car's `vehicleId` can collide with another entry's real id —
       * and an id is always the better answer.
       */
      if (!map.has(lower)) {
        map.set(lower, item)
      }
    })
  })

  return map
}

export function buildCosmeticsCatalog(raw: {
  br?: Array<FortniteApiCosmetic>
  instruments?: Array<FortniteApiCosmetic>
  cars?: Array<FortniteApiCosmetic>
  tracks?: Array<FortniteApiTrack>
  banners?: Array<FortniteApiBanner>
  bannerColors?: Array<FortniteApiBannerColor>
}): CosmeticsCatalog {
  return {
    br: indexById(raw.br),
    /*
     * Instrument ids are sometimes published with their backend prefix
     * attached (`SparksGuitar:Sparks_Foo`), and the profile never carries
     * one, so the bare tail is indexed as well.
     */
    instruments: indexById(raw.instruments, (item) => [
      item.id?.split(':').pop(),
    ]),
    cars: indexById(raw.cars, (item) => [item.vehicleId]),
    tracks: indexById(raw.tracks, (item) => [item.devName]),
    banners: indexById(raw.banners),
    bannerColors: indexById(raw.bannerColors),
  }
}

function pickImage(cosmetic: FortniteApiCosmetic | undefined) {
  const images = cosmetic?.images

  if (!images) {
    return null
  }

  return (
    images.smallIcon ??
    images.icon ??
    images.small ??
    images.large ??
    images.featured ??
    images.background ??
    null
  )
}

function parseChapter(cosmetic: FortniteApiCosmetic | undefined) {
  const raw = cosmetic?.introduction?.chapter

  if (!raw) {
    return null
  }

  const digits = String(raw).match(/\d+/)

  return digits ? Number.parseInt(digits[0], 10) : null
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)

    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

/**
 * A banner colour's *name*, as an actual colour.
 *
 * Epic publishes these as design tokens rather than values — `RedH0`,
 * `GreenH120Dark`, `Gray666666FF` — so there are two forms to read: a hue
 * (`H<deg>`) turned into HSL at a fixed saturation, and an embedded ARGB hex
 * used only by the greys. `Dark` and `Light` suffixes shift both.
 */
export function parseBannerColor(name: string | undefined | null) {
  if (!name) {
    return null
  }

  let variant: 'normal' | 'dark' | 'light' = 'normal'
  let base = name

  if (base.endsWith('Light')) {
    variant = 'light'
    base = base.slice(0, -'Light'.length)
  } else if (base.endsWith('Dark')) {
    variant = 'dark'
    base = base.slice(0, -'Dark'.length)
  }

  const embedded = base.match(/([0-9a-fA-F]{6,8})$/)

  if (embedded) {
    const hex = embedded[1].slice(0, 6)
    const scale = variant === 'dark' ? 0.6 : variant === 'light' ? 1.4 : 1
    const channels = [0, 2, 4].map((offset) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16)

      return Math.min(255, Math.round(value * scale))
        .toString(16)
        .padStart(2, '0')
    })

    return `#${channels.join('')}`.toUpperCase()
  }

  const hue = base.match(/H(\d+)$/)

  if (hue) {
    if (variant === 'dark') {
      return hslToHex(Number.parseInt(hue[1], 10), 65, 32)
    }

    if (variant === 'light') {
      return hslToHex(Number.parseInt(hue[1], 10), 65, 72)
    }

    return hslToHex(Number.parseInt(hue[1], 10), 70, 50)
  }

  return null
}

function fromCosmetic(
  templateId: string,
  backendType: string,
  id: string,
  cosmetic: FortniteApiCosmetic
): CosmeticMeta {
  return {
    templateId,
    backendType,
    id,
    name: cosmetic.name || prettifyCosmeticId(id),
    imageUrl: pickImage(cosmetic),
    rarity: cosmetic.rarity?.value?.toLowerCase() ?? 'common',
    series: cosmetic.series?.value ?? null,
    seriesColors: cosmetic.series?.colors ?? null,
    color: null,
    chapter: parseChapter(cosmetic),
    added: cosmetic.added ?? null,
    resolved: true,
  }
}

function unresolved(
  templateId: string,
  backendType: string,
  id: string
): CosmeticMeta {
  return {
    templateId,
    backendType,
    id,
    name: prettifyCosmeticId(id),
    imageUrl: null,
    rarity: 'common',
    series: null,
    seriesColors: null,
    color: null,
    chapter: null,
    added: null,
    resolved: false,
  }
}

/**
 * One template id, fully decorated.
 *
 * Always returns something: an id no catalogue knows still gets a readable
 * name off its own slug, because a locker slot showing "Cid 028 Athena
 * Commando F" is a great deal more use than a blank tile.
 */
export function resolveCosmetic(
  catalog: CosmeticsCatalog,
  templateId: string
): CosmeticMeta {
  const { backendType, id } = splitTemplateId(templateId)
  const key = id.toLowerCase()

  if (backendType === 'HomebaseBannerIcon') {
    const banner = catalog.banners.get(key)

    return {
      templateId,
      backendType,
      id,
      name: banner?.name || prettifyCosmeticId(id),
      imageUrl: banner?.images?.smallIcon ?? banner?.images?.icon ?? null,
      rarity: 'common',
      series: null,
      seriesColors: null,
      color: null,
      chapter: null,
      added: null,
      resolved: Boolean(banner),
    }
  }

  if (backendType === 'HomebaseBannerColor') {
    const entry = catalog.bannerColors.get(key)

    return {
      templateId,
      backendType,
      id,
      name: entry?.color ? prettifyCosmeticId(entry.color) : prettifyCosmeticId(id),
      imageUrl: null,
      rarity: 'common',
      series: null,
      seriesColors: null,
      color: parseBannerColor(entry?.color),
      chapter: null,
      added: null,
      resolved: Boolean(entry),
    }
  }

  if (backendType === 'SparksSong') {
    const track = catalog.tracks.get(key)

    if (track) {
      return {
        templateId,
        backendType,
        id,
        name: track.title || track.devName || prettifyCosmeticId(id),
        imageUrl: track.albumArt ?? null,
        rarity: 'common',
        series: track.artist ?? null,
        seriesColors: null,
        color: null,
        chapter: null,
        added: track.added ?? null,
        resolved: true,
      }
    }

    return unresolved(templateId, backendType, id)
  }

  if (instrumentBackendTypes.has(backendType)) {
    const instrument = catalog.instruments.get(key)

    return instrument
      ? fromCosmetic(templateId, backendType, id, instrument)
      : unresolved(templateId, backendType, id)
  }

  if (vehicleBackendTypes.has(backendType)) {
    const car = catalog.cars.get(key)

    return car
      ? fromCosmetic(templateId, backendType, id, car)
      : unresolved(templateId, backendType, id)
  }

  const direct = catalog.br.get(key)

  if (direct) {
    return fromCosmetic(templateId, backendType, id, direct)
  }

  /*
   * Companions carry a variant on the id itself — `companion_flourcut:70c` —
   * which no catalogue indexes. The base id does resolve, and the variant
   * only changes the pose, so it is dropped rather than failing the lookup.
   */
  if (id.includes(':')) {
    const base = catalog.br.get(id.split(':')[0].toLowerCase())

    if (base) {
      return fromCosmetic(templateId, backendType, id, base)
    }
  }

  return unresolved(templateId, backendType, id)
}

/**
 * The catalogues are ~20 MB of JSON that only changes when Fortnite patches,
 * so they are fetched once a day and shared by the slot picker, the board and
 * the card generator.
 */
const catalogMaxAgeMs = 24 * 60 * 60 * 1000

let catalog: CosmeticsCatalog | null = null
let catalogFetchedAt = 0
let catalogRequest: Promise<CosmeticsCatalog> | null = null

async function settledData<T>(request: Promise<{ data?: { data?: T } }>) {
  try {
    return (await request).data?.data
  } catch (error) {
    /*
     * A catalogue that fails to load costs its own cosmetics their names,
     * not the whole locker: a missing tracks document still leaves every
     * outfit resolvable.
     */
    RuntimeLog.error('caught:core/locker-catalog.ts', error)

    return undefined
  }
}

export async function getCosmeticsCatalog(): Promise<CosmeticsCatalog> {
  if (catalog && Date.now() - catalogFetchedAt < catalogMaxAgeMs) {
    return catalog
  }

  if (!catalogRequest) {
    catalogRequest = (async () => {
      try {
        const [br, instruments, cars, tracks, banners, bannerColors] =
          await Promise.all([
            settledData(getBrCosmetics()),
            settledData(getInstrumentCosmetics()),
            settledData(getCarCosmetics()),
            settledData(getTrackCosmetics()),
            settledData(getBanners()),
            settledData(getBannerColors()),
          ])

        const next = buildCosmeticsCatalog({
          br,
          instruments,
          cars,
          tracks,
          banners,
          bannerColors,
        })

        /*
         * Only a run that actually resolved the main catalogue is worth
         * caching for a day; a total network failure should be retried on
         * the next request rather than pinned as "the catalogue is empty".
         */
        if (next.br.size > 0) {
          catalog = next
          catalogFetchedAt = Date.now()
        }

        return catalog ?? next
      } finally {
        catalogRequest = null
      }
    })()
  }

  return catalogRequest
}
