import { pennydbService } from '../config/pennydb'

export type PennyDBCommander = {
  name?: string
  image_link?: string
  hero_class?: string
  hero_class_image_link?: string
  power_level_value?: number
  rarity?: string
}

export type PennyDBLoadout = {
  index?: number
  guid?: string
  commander?: PennyDBCommander
  team_perk?: string
  gadget_1?: string
  gadget_2?: string
  followers?: Array<PennyDBCommander>
}

export type PennyDBStatItem = {
  templateId?: string
  name?: string
  quantity?: number
}

/** A survivor set bonus and how much of it is actually switched on. */
export type PennyDBSurvivorBonus = {
  bonus_name?: string
  survivors_required?: number
  matched_survivors?: number
  active_bonuses?: number
  bonus_per_activation_pct?: number
  total_bonus_pct?: number
  /** Which F.O.R.T. stat it feeds, or "Not a F.O.R.T. stat". */
  fort_equivalent?: string
}

export type PennyDBResource = {
  name?: string
  /** Site-relative, e.g. `/images/resources/gold.png`. */
  image?: string
  quantity?: number
}

/** Site-relative asset path -> absolute URL. */
export function pennyDBAssetUrl(imagePath: string) {
  return imagePath.startsWith('http')
    ? imagePath
    : `https://pennydb.net${imagePath}`
}

/**
 * Only the parts we read are typed. The live response is ~2.5MB and carries
 * every survivor, schematic and completed quest; the main process narrows it
 * before anything crosses to the renderer.
 */
export type PennyDBProfileResponse = {
  has_stw?: boolean
  founder_account?: boolean
  created?: string
  last_modified?: string
  profile_views?: number
  user_type?: string
  profile_summary?: {
    account_id?: string
    display_name?: string
    account_stw_level?: number
    stw_collectionbook_level?: number
    stw_matches_played?: number
    llamas_opened?: number
    power_level?: number
    commander_level?: number
  }
  ventures_data?: {
    venture_power_level?: number
    current_venture_level?: number
    available_zones?: string
    current_level_progress?: string
  }
  fort_stats?: Record<string, PennyDBStatItem>
  survivor_bonus_overview?: {
    overall_totals?: Record<string, PennyDBSurvivorBonus>
  }
  resources_summary?: {
    llamas?: Record<string, PennyDBResource>
    resources?: Record<string, PennyDBResource>
  }
  loadouts?: {
    loadouts?: Array<PennyDBLoadout>
    current_loadout_guid?: string
  }
  heroes?: Record<string, unknown>
  survivors?: Record<string, unknown>
  defenders?: Record<string, unknown>
  schematics?: Record<string, unknown>
  expeditions_data?: Record<string, unknown>
}

/**
 * Looks a public STW profile up by Epic display name.
 *
 * Returns 404 for names PennyDB has never indexed, and `has_stw: false` for
 * accounts with no Save the World profile — callers must handle both.
 */
export function getPennyDBProfile(displayName: string) {
  return pennydbService.get<PennyDBProfileResponse>(
    `/search-profiles/${encodeURIComponent(displayName)}`
  )
}

/** The public page a profile lives on, for "open in browser" links. */
export function pennyDBProfileUrl(displayName: string) {
  return `https://pennydb.net/profile/${encodeURIComponent(displayName)}`
}
