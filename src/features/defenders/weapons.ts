import type { InventoryItem } from '../../kernel/core/inventory'
import type { DefenderAssessment, DefenderCatalog, WeaponMatch } from './types'

/** Transparent fit ordering. This is not a damage formula or a claim of measured DPS. */
export function matchWeapons(defender: DefenderAssessment, items: InventoryItem[], catalog: DefenderCatalog): WeaponMatch[] {
  if (!defender.className) return []
  const ids = defender.item.alterations.join(' ').toLowerCase()
  const rate = ids.includes('def_firerate')
  const reload = ids.includes('def_reload')
  const magazine = ids.includes('def_clipsize')
  const critRating = ids.includes('def_critchance')
  const critDamage = ids.includes('def_critdamage')
  const matches: WeaponMatch[] = []
  for (const item of items) {
    if (item.kind !== 'schematic') continue
    const definition = catalog.schematics[item.templateId.toLowerCase()]
    if (!definition?.classes.includes(defender.className)) continue
    const perks = (item.alterationSlots ?? item.alterations).map(id => id ? catalog.weaponPerks[id.toLowerCase()] ?? `Unrecognised perk: ${id}` : 'Empty perk slot')
    const inactivePerks = perks.filter(p => /headshot|durability|lifespan|not consume ammo|ammo recovery/i.test(p))
    const active = perks.filter(p => !inactivePerks.includes(p))
    const text = active.join(' ').toLowerCase()
    const reasons: string[] = []
    const limits: string[] = []
    let relevance = 1
    const roles: string[] = []
    const suppliedAffliction = definition.innateAffliction || /causes affliction damage/.test(text)
    const afflictedAOE = /hitting an afflicted target/.test(text) && /aoe/.test(text)
    const aoe = /explosion|explodes|exploding projectiles|roman candle|ring of damage|cloud of steam|chain lightning|bullets chain|knockback aoe/.test(text)
    const onCrit = /critical hits.*(?:explosion|projectiles)/.test(text)
    const hasWeaponCR = /\+\d+(?:\.\d+)? crit(?:ical rating| chance)|grants.*critical rating/.test(text)
    const hasWeaponCD = /crit damage/.test(text)
    const sixth = perks[5] && perks[5] !== 'Empty perk slot' ? perks[5] : null
    if (defender.subtypes.length) {
      if (definition.subtype && defender.subtypes.includes(definition.subtype)) {
        relevance += 4
        reasons.push(`Matches the defender’s ${definition.subtype} damage perks.`)
      } else limits.push('This weapon does not receive the defender’s best melee subtype bonus.')
    }
    if (aoe) { relevance += 3; roles.push('Crowd damage'); reasons.push('Area effects can damage several enemies, giving this roll value beyond single-target damage.') }
    if (afflictedAOE) {
      if (suppliedAffliction) {
        relevance += rate ? 5 : 3
        reasons.push(definition.innateAffliction ? 'Dragon’s Roar supplies its own 3-second affliction, enabling its afflicted-target AOE and conditional perks.' : 'This roll applies affliction itself, then benefits from hits against afflicted enemies.')
        if (rate) reasons.push('The defender’s fire-rate perks create more opportunities for the afflicted-target AOE.')
      } else limits.push('The afflicted-target AOE needs another verified affliction source.')
      limits.push('The legacy afflicted-target AOE may occupy a different slot. Its own cooldown bypass needs separate confirmation.')
    }
    if (critRating && onCrit) { relevance += 4; reasons.push('Critical rating supports more critical-hit AOE triggers. Separate proc damage is not assumed to inherit critical damage.') }
    if (critRating && hasWeaponCD) { relevance += hasWeaponCR ? 1 : 3; reasons.push('Defender critical rating complements the weapon’s critical-damage perks.'); if (hasWeaponCR) limits.push('The weapon already has critical chance/rating; extra rating has diminishing returns.') }
    if (critDamage && hasWeaponCR) { relevance += 2; reasons.push('The weapon’s critical chance/rating supports the defender’s critical-damage perks.') }
    if (rate && /landing \d+ hits|after \d+ hits|each shot fired|critical hits|hitting an afflicted/.test(text)) {
      relevance += 2; reasons.push('Faster firing helps build hit stacks or creates more trigger opportunities.')
    }
    if (reload) {
      relevance += 1; reasons.push('Reload speed helps maintain firing uptime.')
      if (/upon reload/.test(text)) { relevance += 3; reasons.push('Reloading also triggers the weapon’s marked-target explosions.') }
    }
    if (magazine && /reloading removes/.test(text)) { relevance += 3; reasons.push('More magazine capacity lets damage stacks persist longer before a reload resets them.') }
    if (magazine && /upon reload/.test(text)) limits.push('A larger magazine may delay the reload-triggered explosion.')
    if (suppliedAffliction && /damage to afflicted/.test(text)) { relevance += 2; reasons.push('Affliction supplies the condition for this roll’s bonus damage.') }
    if (/snares the target/.test(text) && /damage to slowed and snared/.test(text)) { relevance += 2; reasons.push('The snare supplies the condition for this roll’s slowed/snared damage bonus.') }
    const knockbackAOE = /knockback aoe/.test(text)
    if (knockbackAOE || /freez|frozen|snares the target|stack of slow|dance/.test(text)) roles.push('Crowd control')
    if (knockbackAOE) {
      relevance += 3
      reasons.push('The knockback AOE stalls nearby husks as well as dealing area damage, giving this roll crowd-control value.')
      if (afflictedAOE) reasons.push('Player-observed interaction: this afflicted-target knockback AOE also affects minibosses. This is specific to this perk, not a general rule for crowd control.')
    }
    if (!roles.length) roles.push('Body-hit damage')
    if (/standing in place/.test(text)) limits.push('Standing still and stack buildup remain required; moving removes the bonus.')
    if (/on kill|eliminating|eliminations/.test(text)) limits.push('On-kill effects require an elimination; they do not trigger on every hit.')
    if (/hits in a row|after \d+ hits|every \d+th hit|\d+ times/.test(text)) limits.push('Hit counts and any same-target requirements still apply.')
    if (/recently|does not affect|immune/.test(text)) limits.push('Target immunities and boss/Mist Monster exclusions still apply.')
    if (sixth && !/headshot/i.test(sixth) && /cooldown|only occur every/i.test(sixth)) reasons.push('The printed sixth-perk cooldown is ignored under the defender mechanics used by this helper.')
    if (inactivePerks.length) limits.push(`${inactivePerks.length} inactive perk${inactivePerks.length === 1 ? '' : 's'}: the rest of this weapon is still evaluated.`)
    if (perks.some(p => p.startsWith('Unrecognised'))) { limits.push('Some perks are unknown. This recommendation is incomplete.'); relevance = 0 }
    if (!reasons.length) reasons.push('Compatible weapon type; no special interaction was established for this exact roll.')
    matches.push({ item, name: definition.name, roles, relevance, reasons: [...new Set(reasons)], limits: [...new Set(limits)], perks, sixth, inactivePerks })
  }
  return matches.sort((a,b) => b.relevance-a.relevance || b.item.level-a.item.level || a.name.localeCompare(b.name) || a.item.itemId.localeCompare(b.item.itemId))
}
