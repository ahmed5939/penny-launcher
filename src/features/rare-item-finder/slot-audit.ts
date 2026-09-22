import historicalPerks from './data/historical-perks.json'
import defenderPerks from './data/defender-perks.json'
import type { SlotAudit, SlotAuditStatus, SlotFinding, SlotRule, SlotRules } from './types'

type HistoricalException = {
  id: string
  perkId: string
  /** `null` when the original slot position was never independently verified. */
  slot: number | null
  itemTemplateIds: Array<string>
}

const historicalExceptions = historicalPerks.exceptions as Array<HistoricalException>
const defenderIds = new Set(Object.keys(defenderPerks))
const ranks = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Transcendent', 'Unattainable']
const allowedCache = new WeakMap<SlotRule, Set<string>>()
const knownCache = new WeakMap<SlotRules, Set<string>>()

const normalize = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value

/** Lower-case template id with crafted `RangedWeapon:`/`MeleeWeapon:` folded into `weapon:`. */
export function resolvedItemId(templateId: string) {
  return templateId.toLowerCase().replace(/^(rangedweapon|meleeweapon):/, 'weapon:')
}

/** The rules entry key for a template, following the schematic → crafted item alias. */
export function ruleItemId(templateId: string, rules: SlotRules) {
  const id = resolvedItemId(templateId)
  return rules.schematicToItem[id] || id
}

/**
 * Compares one copy's perk arrays against the extracted 42.10 slot rules.
 *
 * A mismatch is evidence for review, never proof: legacy copies cannot be
 * judged (their original tables were never recovered), and a handful of
 * user-evidenced historical rolls are recognised by exact perk, slot and item.
 */
export function auditSlots(
  templateId: string,
  attrs: Record<string, unknown> | null | undefined,
  hasLegacy: boolean,
  rules: SlotRules,
): SlotAudit {
  const findings: Array<SlotFinding> = []
  const result = (status: SlotAuditStatus): SlotAudit => ({
    status,
    findings,
    build: '42.10',
    candidate: status === 'outside_current_rules',
  })
  const a: Record<string, unknown> = attrs && typeof attrs === 'object' ? attrs : {}

  // Defender definitions are invalid on schematics even when legacy perks or flags coexist.
  if (templateId.toLowerCase().startsWith('schematic:')) {
    for (const field of ['alterations', 'alterationDefinitions']) {
      const values = a[field]
      if (!Array.isArray(values)) continue
      values.forEach((value, slot) => {
        const perkId = normalize(value)
        if (
          typeof perkId === 'string' &&
          defenderIds.has(perkId) &&
          !findings.some((f) => f.slot === slot && f.perkId === perkId)
        ) {
          findings.push({
            code: 'defender_on_schematic',
            slot,
            perkId,
            field,
            message: `Slot ${slot + 1}: defender-only perk on a schematic; classified as modded.`,
          })
        }
      })
    }
    if (findings.length) return result('outside_current_rules')
  }

  // No recovered historical slot tables: current-slot mismatches cannot adjudicate legacy copies.
  if (hasLegacy) {
    findings.push({
      code: 'historical',
      message:
        'Legacy/historical item: original slot rules are not available; modded status cannot be established.',
    })
    return result('historical_review')
  }

  const itemId = ruleItemId(templateId, rules)
  const item = rules.items[itemId]
  if (!item || item.coverage !== 'resolved') {
    findings.push({ code: 'unknown_template', message: 'No resolved slot rules for this exact item variant.' })
    return result('unknown')
  }

  const fields = ['alterations', 'alterationDefinitions'].filter((k) => a[k] !== undefined)
  // Epic omits perk arrays on normal items whose extracted definition has no slots.
  if (!fields.length && item.slots.length === 0) return result('matches_current_rules')
  if (
    !fields.length ||
    fields.some((k) => {
      const values = a[k]
      return !Array.isArray(values) || values.some((v) => v !== null && typeof v !== 'string')
    })
  ) {
    findings.push({ code: 'malformed', message: 'Missing or malformed perk slots; cannot compare slot positions.' })
    return result('unknown')
  }

  const values = (a[fields[0]] as Array<unknown>).map(normalize)
  if (
    fields.length === 2 &&
    JSON.stringify(values) !== JSON.stringify((a[fields[1]] as Array<unknown>).map(normalize))
  ) {
    findings.push({ code: 'conflicting_fields', message: 'The two perk arrays disagree; slot order needs review.' })
    return result('unknown')
  }

  if (!knownCache.has(rules)) knownCache.set(rules, new Set(rules.knownPerks))
  const known = knownCache.get(rules)!

  if (values.length > item.slots.length) {
    findings.push({
      code: 'extra_slots',
      message: `${values.length} stored slots; this item has ${item.slots.length} slots in the extracted rules.`,
    })
  }
  values.forEach((value, index) => {
    if (typeof value === 'string' && !known.has(value)) {
      findings.push({
        code: 'unknown_perk',
        slot: index,
        perkId: value,
        message: `Slot ${index + 1}: perk is absent from the game extraction.`,
      })
    }
  })

  for (const slot of item.slots) {
    const perk = values[slot.index]
    if (typeof perk === 'string' && known.has(perk)) {
      if (!allowedCache.has(slot)) allowedCache.set(slot, new Set(slot.allowed))
      if (!allowedCache.get(slot)!.has(perk)) {
        const exception = historicalExceptions.find(
          (e) =>
            e.perkId === perk &&
            (e.slot === slot.index || e.slot === null) &&
            e.itemTemplateIds.includes(itemId),
        )
        findings.push(
          exception
            ? {
                code: exception.slot === null ? 'historical_slot_unverified' : 'historical_perk',
                slot: slot.index,
                perkId: perk,
                exceptionId: exception.id,
                message:
                  exception.slot === null
                    ? `Slot ${slot.index + 1}: Reload Speed is a user-confirmed historical perk on the Plasmatic Discharger, no longer selectable. Its original slot positions have not been independently verified.`
                    : `Slot ${slot.index + 1}: historically legitimate perk, no longer selectable under the current rules (user-confirmed historical exception).`,
              }
            : {
                code: 'disallowed_slot',
                slot: slot.index,
                perkId: perk,
                message: `Slot ${slot.index + 1}: this perk is not allowed here by the extracted 42.10 rules.`,
              },
        )
      }
    } else if (!perk) {
      const rank = ranks.indexOf(item.rarity)
      const unlock = ranks.indexOf(slot.unlockRarity)
      const level = a.level
      const valid = Number.isInteger(level) && (level as number) >= 1 && rank >= 0 && unlock >= 0
      if (!valid || ((level as number) >= (slot.unlockLevel || 0) && rank >= unlock)) {
        findings.push({
          code: 'missing_slot',
          slot: slot.index,
          message: `Slot ${slot.index + 1}: ${valid ? 'unlocked perk is missing' : 'empty slot has incomplete unlock context'}.`,
        })
      }
    }
  }

  if (findings.some((f) => f.code === 'disallowed_slot' || f.code === 'extra_slots')) return result('outside_current_rules')
  if (findings.some((f) => f.code === 'unknown_perk')) return result('unknown')
  if (findings.some((f) => f.code === 'missing_slot')) return result('incomplete')
  if (findings.some((f) => f.code === 'historical_slot_unverified')) return result('historical_review')
  if (findings.some((f) => f.code === 'historical_perk')) return result('historical_perk')
  return result('matches_current_rules')
}
