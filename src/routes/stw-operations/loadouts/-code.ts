import type { LoadoutCopy } from '../../../kernel/core/loadouts'

/**
 * Loadout share codes: a loadout as text someone can paste into their own
 * launcher. The payload is the same template-id copy used between accounts,
 * packed as `[commander, support, teamPerk, gadgets, defenders]`, deflated
 * and base64url'd behind a versioned prefix.
 */
const prefix = 'PENNY-LOADOUT-1:'

/* The game's own slot counts; a pasted code is never allowed past them. */
const maxSupport = 5
const maxGadgets = 2
const maxDefenders = 3

const templatePattern = /^[A-Za-z]+:[A-Za-z0-9_]+$/

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes]).stream().pipeThrough(stream)

  return new Uint8Array(await new Response(output).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string) {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function encodeLoadoutCode(copy: LoadoutCopy) {
  const packed = [
    copy.commander,
    copy.support,
    copy.teamPerk,
    copy.gadgets,
    copy.defenders.map((defender) => [defender.templateId, defender.weapon]),
  ]
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(packed)), new CompressionStream('deflate-raw'))

  return prefix + toBase64Url(bytes)
}

function template(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !templatePattern.test(value)) throw new Error('bad template')

  return value
}

function list(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) throw new Error('bad list')

  return value as Array<unknown>
}

/** The copy a share code describes, or null if it is not one. */
export async function decodeLoadoutCode(text: string): Promise<LoadoutCopy | null> {
  const trimmed = text.replace(/\s+/g, '')

  if (!trimmed.toUpperCase().startsWith(prefix)) return null

  try {
    const bytes = await pipe(fromBase64Url(trimmed.slice(prefix.length)), new DecompressionStream('deflate-raw'))
    const [commander, support, teamPerk, gadgets, defenders] = list(
      JSON.parse(new TextDecoder().decode(bytes)),
      5
    )

    return {
      commander: template(commander),
      defenders: list(defenders, maxDefenders).map((defender) => {
        const [templateId, weapon] = list(defender, 2)

        return { templateId: template(templateId), weapon: template(weapon) }
      }),
      gadgets: list(gadgets, maxGadgets).map(template),
      support: list(support, maxSupport).map(template),
      teamPerk: template(teamPerk),
    }
  } catch {
    return null
  }
}
