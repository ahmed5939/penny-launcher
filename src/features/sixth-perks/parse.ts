import type { SchematicCopy } from './types'

/**
 * Profile items down to what matching needs: id, template id, level and the
 * alteration array. Kept apart from the catalog so the main process can parse
 * a profile without bundling the 1.4MB catalog.
 *
 * Null entries stay where they are — the gameplay slot is an index, and some
 * weapons use slot zero.
 */
export function parseItems(items: Record<string, {templateId?: unknown; attributes?: Record<string, unknown>}>): SchematicCopy[] {
  return Object.entries(items).flatMap(([id, raw]) => {
    if (typeof raw?.templateId !== 'string' || !/^schematic:/i.test(raw.templateId)) return []
    const a = raw.attributes ?? {}
    return [{ id, templateId: raw.templateId.toLowerCase(), level: Number.isInteger(a.level) ? a.level as number : null,
      alterations: Array.isArray(a.alterations) ? a.alterations.map(p => typeof p === 'string' && p ? p.toLowerCase() : null) : [] }]
  })
}
