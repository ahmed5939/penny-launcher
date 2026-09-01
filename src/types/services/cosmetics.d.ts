/**
 * fortnite-api.com's cosmetics catalogues, narrowed to the fields the locker
 * reads.
 *
 * Everything is optional on purpose. This is a third-party mirror of game
 * data that gains and loses fields every season, and a missing `images.icon`
 * should cost one item its picture, not fail the whole request.
 */

export type FortniteApiImages = {
  smallIcon?: string
  icon?: string
  featured?: string
  small?: string
  large?: string
  background?: string
}

export type FortniteApiRarity = {
  value?: string
  displayValue?: string
  backendValue?: string
}

export type FortniteApiSeries = {
  value?: string
  colors?: Array<string>
  backendValue?: string
}

export type FortniteApiType = {
  value?: string
  displayValue?: string
  backendValue?: string
}

/** `/v2/cosmetics/br`, `/v2/cosmetics/instruments`, `/v2/cosmetics/cars`. */
export type FortniteApiCosmetic = {
  id?: string
  /** Cars are keyed by `id` but equipped by `vehicleId`. */
  vehicleId?: string
  name?: string
  description?: string
  type?: FortniteApiType
  rarity?: FortniteApiRarity
  series?: FortniteApiSeries
  introduction?: {
    chapter?: string
    season?: string
  }
  images?: FortniteApiImages
  added?: string
}

/** `/v2/cosmetics/tracks` — jam tracks have their own, unrelated shape. */
export type FortniteApiTrack = {
  id?: string
  devName?: string
  title?: string
  artist?: string
  albumArt?: string
  added?: string
}

/** `/v1/banners`. */
export type FortniteApiBanner = {
  id?: string
  devName?: string
  name?: string
  category?: string
  images?: FortniteApiImages
}

/**
 * `/v1/banners/colors` — `color` is a *name*, not a hex value
 * (`RedH0`, `GreenH120Dark`, `Gray666666FF`).
 */
export type FortniteApiBannerColor = {
  id?: string
  color?: string
  category?: string
}

export type FortniteApiResponse<Data> = {
  status?: number
  data?: Data
}
