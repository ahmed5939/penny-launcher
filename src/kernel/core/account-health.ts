import type { AccountData } from '../../types/accounts'
import type { PennyDBProfileResponse } from '../../services/endpoints/pennydb'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { survivorSquads } from '../../config/constants/fortnite/squads'

import {
  getPennyDBProfile,
  pennyDBAssetUrl,
} from '../../services/endpoints/pennydb'
import {
  getQueryProfile,
  getQueryProfileStorageProfile,
} from '../../services/endpoints/mcp'

export type ProfileHeroSummary = {
  heroClass: string
  imageUrl: string
  name: string
  powerLevel: number
  rarity: string
}

export type ProfileHeroLoadout = {
  index: number
  isActive: boolean
  commander: ProfileHeroSummary
  followers: Array<ProfileHeroSummary>
  teamPerk: string
  gadgets: Array<string>
}

export type ProfileSurvivorBonus = {
  /** Which F.O.R.T. stat it feeds, if any. */
  fortStat: string
  matched: number
  name: string
  /** How many copies of the bonus are switched on. */
  active: number
  totalPct: number
}

export type ProfileResource = {
  imageUrl: string
  name: string
  quantity: number
}

export type ProfileSquadSummary = {
  attribute: string
  filled: number
  id: string
  label: string
}

export type ProfileFort = {
  fortitude: number
  offense: number
  resistance: number
  technology: number
}

export type ProfileEntry = {
  accountId: string
  displayName: string
  errorMessage?: string
  /** True when PennyDB answered — otherwise everything below is MCP-only. */
  enriched: boolean
  /** Set when the account has no public PennyDB profile. */
  enrichmentNote?: string

  accountLevel: number
  collectionBookLevel: number
  commanderLevel: number
  daysLoggedIn: number
  llamasOpened: number
  matchesPlayed: number
  /** From PennyDB. 0 when not enriched — we do not guess. */
  powerLevel: number

  ventures: {
    availableZones: string
    level: number
    powerLevel: number
    progress: string
  } | null

  founderAccount: boolean
  profileViews: number
  userType: string

  fort: ProfileFort
  research: ProfileFort

  counts: {
    defenders: number
    heroes: number
    schematics: number
    survivors: number
    vaultItems: number
  }

  loadouts: Array<ProfileHeroLoadout>
  squads: Array<ProfileSquadSummary>
  /** Non-zero only; PennyDB returns every resource including empties. */
  llamas: Array<ProfileResource>
  resources: Array<ProfileResource>
  survivorBonuses: Array<ProfileSurvivorBonus>

  pending: {
    difficultyIncreaseRewards: number
    missionAlertRewards: number
  }
}

export type ProfilePayload = Record<string, ProfileEntry>

const emptyFort = (): ProfileFort => ({
  fortitude: 0,
  offense: 0,
  resistance: 0,
  technology: 0,
})

function emptyEntry(accountId: string, displayName: string): ProfileEntry {
  return {
    accountId,
    displayName,
    enriched: false,
    accountLevel: 0,
    collectionBookLevel: 0,
    commanderLevel: 0,
    daysLoggedIn: 0,
    llamasOpened: 0,
    matchesPlayed: 0,
    powerLevel: 0,
    ventures: null,
    founderAccount: false,
    profileViews: 0,
    userType: '',
    fort: emptyFort(),
    research: emptyFort(),
    counts: {
      defenders: 0,
      heroes: 0,
      schematics: 0,
      survivors: 0,
      vaultItems: 0,
    },
    loadouts: [],
    squads: [],
    llamas: [],
    resources: [],
    survivorBonuses: [],
    pending: {
      difficultyIncreaseRewards: 0,
      missionAlertRewards: 0,
    },
  }
}

function toHero(source: {
  name?: string
  hero_class?: string
  image_link?: string
  power_level_value?: number
  rarity?: string
}): ProfileHeroSummary {
  return {
    heroClass: source.hero_class ?? '',
    imageUrl: source.image_link ?? '',
    name: source.name ?? 'Unknown',
    powerLevel: source.power_level_value ?? 0,
    rarity: source.rarity ?? '',
  }
}

/**
 * A read-only roll-up of an account.
 *
 * Two sources, on purpose. Epic's MCP profile is authoritative for anything
 * private — unclaimed rewards, vault contents, days logged in. PennyDB fills
 * in what Epic only ships inside the game client: hero display names, class
 * art, and the computed power level. If PennyDB has never seen the account,
 * the MCP half still renders and power reads as unavailable rather than as a
 * number we made up.
 */
export class AccountHealth {
  static async request(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      AccountHealth.getInfo(account)
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.AccountHealthResponse,
            { [account.accountId]: entry } as ProfilePayload
          )
        })
        .catch(() => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.AccountHealthResponse,
            {
              [account.accountId]: {
                ...emptyEntry(account.accountId, account.displayName),
                errorMessage: 'Unknown Error',
              },
            } as ProfilePayload
          )
        })
    })
  }

  private static async getInfo(account: AccountData) {
    const entry = emptyEntry(account.accountId, account.displayName)
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    const { accountId } = account

    const [campaign, storage, pennydb] = await Promise.allSettled([
      getQueryProfile({ accessToken, accountId }),
      getQueryProfileStorageProfile({ accessToken, accountId }),
      getPennyDBProfile(account.displayName),
    ])

    if (campaign.status === 'rejected') {
      entry.errorMessage = 'Unknown Error'

      return entry
    }

    AccountHealth.applyCampaign(entry, campaign.value.data)

    if (storage.status === 'fulfilled') {
      entry.counts.vaultItems = Object.keys(
        storage.value.data.profileChanges[0]?.profile.items ?? {}
      ).length
    }

    if (pennydb.status === 'fulfilled' && pennydb.value.data?.has_stw) {
      AccountHealth.applyPennyDB(entry, pennydb.value.data)
    } else if (pennydb.status === 'fulfilled') {
      entry.enrichmentNote = 'This account has no Save the World profile'
    } else {
      /** 404 means "never indexed", which is not the same as being down. */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (pennydb.reason as any)?.response?.status

      entry.enrichmentNote =
        status === 404
          ? 'No public PennyDB profile for this account'
          : 'PennyDB could not be reached'
    }

    return entry
  }

  /** Everything Epic will tell us directly. */
  private static applyCampaign(
    entry: ProfileEntry,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
  ) {
    const profile = data.profileChanges?.[0]?.profile
    const attributes = profile?.stats?.attributes
    const items = profile?.items ?? {}

    if (attributes) {
      const research = attributes.research_levels

      entry.accountLevel = attributes.level ?? 0
      entry.collectionBookLevel =
        attributes.collection_book?.maxBookXpLevelAchieved ?? 0
      entry.daysLoggedIn = attributes.daily_rewards?.totalDaysLoggedIn ?? 0
      entry.matchesPlayed = attributes.matches_played ?? 0

      entry.research = {
        fortitude: research?.fortitude ?? 0,
        offense: research?.offense ?? 0,
        resistance: research?.resistance ?? 0,
        technology: research?.technology ?? 0,
      }

      entry.pending = {
        difficultyIncreaseRewards:
          attributes.difficulty_increase_rewards_record?.pendingRewards
            ?.length ?? 0,
        missionAlertRewards:
          attributes.mission_alert_redemption_record
            ?.pendingMissionAlertRewards?.items?.length ?? 0,
      }
    }

    const squadCounts: Record<string, number> = {}

    Object.values(items).forEach((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = item as any
      const templateId: string = current.templateId ?? ''
      const itemAttributes = current.attributes ?? {}

      if (templateId.startsWith('Worker:')) {
        entry.counts.survivors += 1

        const squadId: string | undefined = itemAttributes.squad_id

        if (squadId) {
          squadCounts[squadId] = (squadCounts[squadId] ?? 0) + 1
        }
      } else if (templateId.startsWith('Hero:')) {
        entry.counts.heroes += 1
      } else if (templateId.startsWith('Defender:')) {
        entry.counts.defenders += 1
      } else if (templateId.startsWith('Schematic:')) {
        entry.counts.schematics += 1
      }
    })

    entry.squads = survivorSquads.map((squad) => ({
      attribute: squad.attribute,
      filled: squadCounts[squad.id] ?? 0,
      id: squad.id,
      label: squad.label,
    }))
  }

  /** Everything only the tracker knows. Overrides where it is better. */
  private static applyPennyDB(
    entry: ProfileEntry,
    data: PennyDBProfileResponse
  ) {
    entry.enriched = true

    const summary = data.profile_summary

    if (summary) {
      entry.powerLevel = summary.power_level ?? 0
      entry.commanderLevel = summary.commander_level ?? 0
      entry.llamasOpened = summary.llamas_opened ?? 0
      entry.displayName = summary.display_name ?? entry.displayName

      /** Prefer the tracker's numbers — they match what the game shows. */
      entry.accountLevel = summary.account_stw_level ?? entry.accountLevel
      entry.collectionBookLevel =
        summary.stw_collectionbook_level ?? entry.collectionBookLevel
      entry.matchesPlayed =
        summary.stw_matches_played ?? entry.matchesPlayed
    }

    entry.founderAccount = data.founder_account ?? false
    entry.profileViews = data.profile_views ?? 0
    entry.userType = data.user_type ?? ''

    /** `fort_stats` is keyed by item guid; the template names the stat. */
    Object.values(data.fort_stats ?? {}).forEach((stat) => {
      const key = (stat.templateId ?? '').replace('Stat:', '')

      if (key in entry.fort) {
        entry.fort[key as keyof ProfileFort] = stat.quantity ?? 0
      }
    })

    const ventures = data.ventures_data

    if (ventures) {
      entry.ventures = {
        availableZones: ventures.available_zones ?? '0',
        level: ventures.current_venture_level ?? 0,
        powerLevel: ventures.venture_power_level ?? 0,
        progress: ventures.current_level_progress ?? '',
      }
    }

    const counts = entry.counts

    counts.heroes = Object.keys(data.heroes ?? {}).length || counts.heroes
    counts.survivors =
      Object.keys(data.survivors ?? {}).length || counts.survivors
    counts.defenders =
      Object.keys(data.defenders ?? {}).length || counts.defenders
    counts.schematics =
      Object.keys(data.schematics ?? {}).length || counts.schematics

    const toResources = (
      source: Record<string, { name?: string; image?: string; quantity?: number }> = {}
    ) =>
      Object.values(source)
        .filter((item) => (item.quantity ?? 0) > 0)
        .map((item) => ({
          imageUrl: item.image ? pennyDBAssetUrl(item.image) : '',
          name: item.name ?? '',
          quantity: item.quantity ?? 0,
        }))
        .toSorted((itemA, itemB) => itemB.quantity - itemA.quantity)

    entry.llamas = toResources(data.resources_summary?.llamas)
    entry.resources = toResources(data.resources_summary?.resources)

    /** Only bonuses actually contributing something are worth the space. */
    entry.survivorBonuses = Object.values(
      data.survivor_bonus_overview?.overall_totals ?? {}
    )
      .filter((bonus) => (bonus.total_bonus_pct ?? 0) > 0)
      .map((bonus) => ({
        active: bonus.active_bonuses ?? 0,
        fortStat: bonus.fort_equivalent?.startsWith('Not')
          ? ''
          : (bonus.fort_equivalent ?? ''),
        matched: bonus.matched_survivors ?? 0,
        name: (bonus.bonus_name ?? '').replace(/ Bonus$/, ''),
        totalPct: bonus.total_bonus_pct ?? 0,
      }))
      .toSorted((bonusA, bonusB) => bonusB.totalPct - bonusA.totalPct)

    const activeGuid = data.loadouts?.current_loadout_guid

    entry.loadouts = (data.loadouts?.loadouts ?? []).map(
      (loadout, index) => ({
        index: loadout.index ?? index,
        isActive: Boolean(loadout.guid && loadout.guid === activeGuid),
        commander: toHero(loadout.commander ?? {}),
        followers: (loadout.followers ?? []).map(toHero),
        teamPerk: loadout.team_perk ?? '',
        gadgets: [loadout.gadget_1, loadout.gadget_2].filter(
          (gadget): gadget is string => Boolean(gadget)
        ),
      })
    )
  }
}
