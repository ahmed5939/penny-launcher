import type {
  IngredientData,
  ResourceData,
  SurvivorData,
  SurvivorUniqueLeadData,
  TrapData,
} from '../../types/data/resources'

import resources from '../../data/resources.json'
import survivors from '../../data/survivors.json'
import survivorsMythicLeads from '../../data/survivors-mythic-leads.json'
import ingredients from '../../data/ingredients.json'
import traps from '../../data/traps.json'

export enum RarityType {
  Common = 'c',
  Uncommon = 'uc',
  Rare = 'r',
  Epic = 'vr',
  Legendary = 'sr',
  Mythic = 'ur',
}

export enum RarityColor {
  Common = '#bfbaba',
  Uncommon = '#04c577',
  Rare = '#51a1db',
  Epic = '#d076f6',
  Legendary = '#ed7e39',
  Mythic = '#ffd93d',
}

export const rarities: Record<RarityType, string> = {
  [RarityType.Common]: 'Common',
  [RarityType.Uncommon]: 'Uncommon',
  [RarityType.Rare]: 'Rare',
  [RarityType.Epic]: 'Epic',
  [RarityType.Legendary]: 'Legendary',
  [RarityType.Mythic]: 'Mythic',
}

/**
 * The artboard wash behind item art, stop for stop the one the Penny
 * database site paints (`from-*` / `via-*` / `to-slate-950`), so an item looks
 * the same on the site and in the launcher. Each rarity sinks through a deep
 * cut of its own hue rather than through black — mixing yellow with black is
 * olive, not gold.
 */
export const raritiesArtboard: Record<
  RarityType,
  { from: string; via: string; ring: string }
> = {
  [RarityType.Common]: { from: 'rgb(100 116 139 / 0.45)', via: 'rgb(51 65 85 / 0.7)', ring: 'rgb(100 116 139 / 0.3)' },
  [RarityType.Uncommon]: { from: 'rgb(74 222 128 / 0.45)', via: 'rgb(21 128 61 / 0.7)', ring: 'rgb(74 222 128 / 0.35)' },
  [RarityType.Rare]: { from: 'rgb(96 165 250 / 0.45)', via: 'rgb(30 64 175 / 0.7)', ring: 'rgb(96 165 250 / 0.4)' },
  [RarityType.Epic]: { from: 'rgb(192 132 252 / 0.5)', via: 'rgb(88 28 135 / 0.75)', ring: 'rgb(192 132 252 / 0.4)' },
  [RarityType.Legendary]: { from: 'rgb(253 186 116 / 0.55)', via: 'rgb(194 65 12 / 0.75)', ring: 'rgb(251 146 60 / 0.45)' },
  [RarityType.Mythic]: { from: 'rgb(254 240 138 / 0.6)', via: 'rgb(217 119 6 / 0.75)', ring: 'rgb(253 224 71 / 0.48)' },
}

/** Where every artboard wash ends — the site's `slate-950`. */
export const artboardFloor = 'rgb(2 6 23)'

export const raritiesColor: Record<RarityType, string> = {
  [RarityType.Common]: RarityColor.Common,
  [RarityType.Uncommon]: RarityColor.Uncommon,
  [RarityType.Rare]: RarityColor.Rare,
  [RarityType.Epic]: RarityColor.Epic,
  [RarityType.Legendary]: RarityColor.Legendary,
  [RarityType.Mythic]: RarityColor.Mythic,
}

export const resourcesJson = resources as Record<string, ResourceData>
export const survivorsJson = survivors as Record<string, SurvivorData>
export const survivorsMythicLeadsJson = survivorsMythicLeads as Record<
  string,
  SurvivorUniqueLeadData
>
export const ingredientsJson = ingredients as Record<
  string,
  IngredientData
>
export const trapsJson = traps as Record<string, TrapData>
