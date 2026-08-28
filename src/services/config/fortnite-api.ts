import { create as createAxios } from 'axios'

/**
 * fortnite-api.com
 *
 * The public cosmetics catalogue. Epic's own endpoints hand back template
 * ids and nothing else — no name, no rarity, no picture — so every screen
 * that shows a locker item needs this to turn `AthenaCharacter:cid_001…`
 * into "Renegade Raider" and an image URL.
 *
 * Deliberately no Epic user-agent interceptor: this is not an Epic service.
 * The timeout is generous because `/v2/cosmetics/br` is a ~16 MB document.
 */
export const fortniteApiService = createAxios({
  baseURL: 'https://fortnite-api.com',
  timeout: 40_000,
  decompress: true,
})
