import { create as createAxios } from 'axios'

/**
 * PennyDB
 *
 * A third-party Fortnite tracker. It indexes *public* STW profiles, so it
 * resolves things Epic's own endpoints do not hand out — hero display names,
 * class icons, and the computed homebase power level — without us having to
 * ship a copy of the game's data tables.
 *
 * Deliberately no Epic user-agent interceptor: this is not an Epic service.
 */
export const pennydbService = createAxios({
  baseURL: 'https://pennydb.net/api',
  timeout: 20000,
})
