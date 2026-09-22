import type { InventoryItem } from '../../kernel/core/inventory'

export type DefenderClass = 'Assault' | 'Pistol' | 'Sniper' | 'Shotgun' | 'Melee'
export type Perk = { description: string; kind: 'weapon' | 'survival' | 'utility' | 'redundant'; subtype?: string }
export type WeaponDefinition = { name: string; classes: DefenderClass[]; subtype: string | null; innateAffliction: boolean; source: string }
export type DefenderCatalog = {
  build: string
  defenderPerks: Record<string, Perk>
  weaponPerks: Record<string, string>
  schematics: Record<string, WeaponDefinition>
}
export type DefenderAssessment = {
  item: InventoryItem
  className: DefenderClass | null
  weaponPerks: number
  effectiveWeaponPerks: number
  survivalPerks: number
  unknownPerks: number
  subtypes: string[]
  label: string
  band: number
  reasons: string[]
  perks: Array<{ id: string; description: string; kind: Perk['kind'] | 'unknown' }>
}
export type WeaponMatch = {
  item: InventoryItem
  name: string
  roles: string[]
  relevance: number
  reasons: string[]
  limits: string[]
  perks: string[]
  sixth: string | null
  inactivePerks: string[]
}
