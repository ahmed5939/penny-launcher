import type { LucideIcon } from 'lucide-react'
import type { PennyDBLeaderboardMetric } from '../services/endpoints/pennydb'

import { BookOpen, CircleUserRound, MapPin, Zap } from 'lucide-react'

const assetRoot = 'https://pennydb.plingindigo.org/images'

export type LeaderboardDefinition = {
  /** Either a PennyDB image URL or a lucide icon component. */
  icon: string | LucideIcon
  label: string
  metric: PennyDBLeaderboardMetric
}

export type LeaderboardGroup = {
  label: string
  metrics: Array<LeaderboardDefinition>
}

const resource = (file: string) => `${assetRoot}/resources/${file}`
const llama = (file: string) => `${assetRoot}/llamas/${file}`

export const leaderboardGroups: Array<LeaderboardGroup> = [
  {
    label: 'Resources',
    metrics: [
      { metric: 'gold', label: 'Gold', icon: resource('gold.png') },
      { metric: 're_perk', label: 'Re-Perk', icon: resource('re-perk!.png') },
      { metric: 'core_re_perk', label: 'Core Re-Perk', icon: resource('core_re-perk!.png') },
    ],
  },
  {
    label: 'Evolution materials',
    metrics: [
      { metric: 'pure_drops', label: 'Pure Drops of Rain', icon: resource('pure_drops_of_rain.png') },
      { metric: 'lightning', label: 'Lightning in a Bottle', icon: resource('lightning_in_a_bottle.png') },
      { metric: 'eyes', label: 'Eye of the Storm', icon: resource('eye_of_the_storm.png') },
      { metric: 'storm_shard', label: 'Storm Shard', icon: resource('storm_shard.png') },
    ],
  },
  {
    label: 'Superchargers',
    metrics: [
      { metric: 'hero_sc', label: 'Hero Supercharger', icon: resource('hero_supercharger.png') },
      { metric: 'weapon_sc', label: 'Weapon Supercharger', icon: resource('weapon_supercharger.png') },
      { metric: 'trap_sc', label: 'Trap Supercharger', icon: resource('trap_supercharger.png') },
      { metric: 'survivor_sc', label: 'Survivor Supercharger', icon: resource('survivor_supercharger.png') },
    ],
  },
  {
    label: 'Flux',
    metrics: [
      { metric: 'rare_flux', label: 'Rare Flux', icon: resource('rare_flux.png') },
      { metric: 'epic_flux', label: 'Epic Flux', icon: resource('epic_flux.png') },
      { metric: 'legendary_flux', label: 'Legendary Flux', icon: resource('legendary_flux.png') },
    ],
  },
  {
    label: 'Perk Up',
    metrics: [
      { metric: 'common_pu', label: 'Common Perk Up', icon: resource('uncommon_perk-up!.png') },
      { metric: 'rare_pu', label: 'Rare Perk Up', icon: resource('rare_perk-up!.png') },
      { metric: 'epic_pu', label: 'Epic Perk Up', icon: resource('epic_perk-up!.png') },
      { metric: 'legendary_pu', label: 'Legendary Perk Up', icon: resource('legendary_perk-up!.png') },
    ],
  },
  {
    label: 'Element Perk Up',
    metrics: [
      { metric: 'fire_up', label: 'Fire Up', icon: resource('fire-up!.png') },
      { metric: 'amp_up', label: 'Amp Up', icon: resource('amp-up!.png') },
      { metric: 'frost_up', label: 'Frost Up', icon: resource('frost-up!.png') },
    ],
  },
  {
    label: 'XP',
    metrics: [
      { metric: 'schematic_xp', label: 'Schematic XP', icon: resource('schematic_xp.png') },
      { metric: 'survivor_xp', label: 'Survivor XP', icon: resource('survivor_xp.png') },
      { metric: 'hero_xp', label: 'Hero XP', icon: resource('hero_xp.png') },
      { metric: 'ventures_xp', label: 'Ventures XP', icon: resource('venture_xp.png') },
    ],
  },
  {
    label: 'Designs & manuals',
    metrics: [
      { metric: 'weapon_designs', label: 'Weapon Designs', icon: resource('weapon_designs.png') },
      { metric: 'trap_designs', label: 'Trap Designs', icon: resource('trap_designs.png') },
      { metric: 'training_manuals', label: 'Training Manuals', icon: resource('training_manual.png') },
    ],
  },
  {
    label: 'Llamas & tickets',
    metrics: [
      { metric: 'llama_tokens', label: 'Upgrade Llama Token', icon: llama('upgrade_llama.png') },
      { metric: 'tickets', label: 'Tickets', icon: resource('tickets.png') },
      { metric: 'xray_tickets', label: 'X-Ray Tickets', icon: resource('x-ray_tickets.png') },
      { metric: 'mini_llamas', label: 'Mini Llamas', icon: llama('mini_llama.png') },
      { metric: 'unopened_llamas', label: 'Unopened Llamas', icon: llama('upgrade_llama.png') },
      { metric: 'upgrade_llamas', label: 'Upgrade Llamas', icon: llama('upgrade_llama.png') },
      { metric: 'llamas_opened', label: 'Llamas Opened', icon: llama('upgrade_llama.png') },
    ],
  },
  {
    label: 'Account stats',
    metrics: [
      { metric: 'account_stw_level', label: 'Commander Level', icon: CircleUserRound },
      { metric: 'stw_collectionbook_level', label: 'Collection Book', icon: BookOpen },
      { metric: 'stw_matches_played', label: 'Zones Completed', icon: MapPin },
      { metric: 'power_level', label: 'Power Level', icon: Zap },
    ],
  },
  {
    label: 'Vouchers & events',
    metrics: [
      { metric: 'weapon_vouchers', label: 'Weapon Vouchers', icon: resource('weapon_research_voucher.png') },
      { metric: 'hero_voucher', label: 'Hero Vouchers', icon: resource('hero_recruitment_voucher.png') },
      { metric: 'frostnite_2025', label: 'Frostnite', icon: `${assetRoot}/base/burner.png` },
      { metric: 'frostnite_2024', label: 'Frostnite 2024', icon: `${assetRoot}/base/burner.png` },
    ],
  },
]

export const leaderboardDefinitions = leaderboardGroups.flatMap(
  (group) => group.metrics
)

export const leaderboardDefinitionByMetric = new Map(
  leaderboardDefinitions.map((definition) => [definition.metric, definition])
)
