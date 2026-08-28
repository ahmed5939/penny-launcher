import type {
  FortniteApiBanner,
  FortniteApiBannerColor,
  FortniteApiCosmetic,
  FortniteApiResponse,
  FortniteApiTrack,
} from '../../types/services/cosmetics'

import { fortniteApiService } from '../config/fortnite-api'

/**
 * The five catalogues a locker needs.
 *
 * They are separate documents because Epic files these cosmetics under
 * unrelated systems: a jam track is not a BR cosmetic, a car decal is not an
 * instrument, and a banner icon lives on the homebase profile. There is no
 * single endpoint that returns all of them.
 */

const language = 'en'

/** Outfits, emotes, wraps, music, loading screens, contrails, companions. */
export function getBrCosmetics() {
  return fortniteApiService.get<FortniteApiResponse<Array<FortniteApiCosmetic>>>(
    '/v2/cosmetics/br',
    { params: { language } }
  )
}

export function getInstrumentCosmetics() {
  return fortniteApiService.get<FortniteApiResponse<Array<FortniteApiCosmetic>>>(
    '/v2/cosmetics/instruments',
    { params: { language } }
  )
}

export function getCarCosmetics() {
  return fortniteApiService.get<FortniteApiResponse<Array<FortniteApiCosmetic>>>(
    '/v2/cosmetics/cars',
    { params: { language } }
  )
}

export function getTrackCosmetics() {
  return fortniteApiService.get<FortniteApiResponse<Array<FortniteApiTrack>>>(
    '/v2/cosmetics/tracks',
    { params: { language } }
  )
}

export function getBanners() {
  return fortniteApiService.get<FortniteApiResponse<Array<FortniteApiBanner>>>(
    '/v1/banners',
    { params: { language } }
  )
}

export function getBannerColors() {
  return fortniteApiService.get<
    FortniteApiResponse<Array<FortniteApiBannerColor>>
  >('/v1/banners/colors')
}
