import { RuntimeLog } from '../runtime-log'

/**
 * Island code → what to call it and what to show for it.
 *
 * Shared by the Islands page and Discord presence. Three sources feed it:
 *
 * - Discover (`core/islands.ts`) knows the title *and* the key art of every
 *   island on a panel, and calls `remember` after each read.
 * - The links service — the game client's own source of titles and art —
 *   answers any code, but only for a signed-in account, so `lookup` asks it
 *   first whenever a linked account can be signed in.
 * - Epic's public ecosystem API answers any code with its title but no
 *   picture, anonymously, so `lookup` falls back to it for the title.
 *
 * Main-process only, in memory: an island renamed mid-session is corrected
 * the next time a panel lists it.
 */

export type IslandIdentity = {
  /** `1234-5678-9012`. */
  code: string
  title: string | null
  imageUrl: string | null
  /** The island's public page on fortnite.com. */
  url: string
}

type KnownIsland = {
  title: string | null
  imageUrl: string | null
  /** When the ecosystem API last failed for this code, to back off. */
  missedAt: number | null
}

const islandCodePattern = /^\d{4}-\d{4}-\d{4}$/

export const ecosystemApiBaseUrl = 'https://api.fortnite.com/ecosystem/v1'

export function isIslandCode(value: string) {
  return islandCodePattern.test(value)
}

export function islandPageUrl(code: string) {
  return `https://www.fortnite.com/creative/island-codes/${code}`
}

export class IslandDirectory {
  private static known = new Map<string, KnownIsland>()
  private static pending = new Map<string, Promise<IslandIdentity>>()

  /** Discovery panels list a few hundred islands; keep a few refreshes' worth. */
  private static maxEntries = 2_000

  private static missRetryMs = 10 * 60 * 1000

  static remember(
    entries: Array<{
      code: string
      title?: string | null
      imageUrl?: string | null
    }>
  ) {
    for (const entry of entries) {
      if (!isIslandCode(entry.code)) {
        continue
      }

      const previous = IslandDirectory.known.get(entry.code)

      // Re-insert so the Map's order doubles as least-recently-seen.
      IslandDirectory.known.delete(entry.code)
      IslandDirectory.known.set(entry.code, {
        title: entry.title || previous?.title || null,
        imageUrl: entry.imageUrl || previous?.imageUrl || null,
        missedAt: null,
      })
    }

    while (IslandDirectory.known.size > IslandDirectory.maxEntries) {
      const oldest = IslandDirectory.known.keys().next().value

      if (oldest === undefined) {
        break
      }

      IslandDirectory.known.delete(oldest)
    }
  }

  /** What is already known, without touching the network. */
  static peek(code: string): IslandIdentity | null {
    const known = IslandDirectory.known.get(code)

    if (!known) {
      return null
    }

    return {
      code,
      title: known.title,
      imageUrl: known.imageUrl,
      url: islandPageUrl(code),
    }
  }

  /**
   * Never throws: an island the API cannot name comes back with a null
   * title, and callers show the code instead.
   */
  static async lookup(code: string): Promise<IslandIdentity> {
    const fallback: IslandIdentity = IslandDirectory.peek(code) ?? {
      code,
      title: null,
      imageUrl: null,
      url: islandPageUrl(code),
    }

    if (!isIslandCode(code) || (fallback.title && fallback.imageUrl)) {
      return fallback
    }

    const known = IslandDirectory.known.get(code)

    if (
      known?.missedAt &&
      Date.now() - known.missedAt < IslandDirectory.missRetryMs
    ) {
      return fallback
    }

    const inFlight = IslandDirectory.pending.get(code)

    if (inFlight) {
      return inFlight
    }

    const request = IslandDirectory.fetchIdentity(code, Boolean(fallback.title))
      .then((found) => {
        if (found && (found.title || found.imageUrl)) {
          IslandDirectory.remember([{ code, ...found }])

          return IslandDirectory.peek(code) ?? { ...fallback, ...found }
        }

        // Nothing new (no account to ask, no art on file): back off as for a miss.
        IslandDirectory.known.set(code, {
          title: fallback.title,
          imageUrl: fallback.imageUrl,
          missedAt: Date.now(),
        })

        return fallback
      })
      .catch((error: unknown) => {
        RuntimeLog.error('caught:core/island-directory.ts', error)
        IslandDirectory.known.set(code, {
          title: known?.title ?? null,
          imageUrl: known?.imageUrl ?? null,
          missedAt: Date.now(),
        })

        return fallback
      })
      .finally(() => {
        IslandDirectory.pending.delete(code)
      })

    IslandDirectory.pending.set(code, request)

    return request
  }

  /**
   * The links service first — title and art, through whichever token the
   * Islands page's reads settled on — then, when the title is still missing,
   * the ecosystem API. Loaded on demand so Discord presence costs no
   * sign-in until an island actually needs naming.
   */
  private static async fetchIdentity(
    code: string,
    haveTitle: boolean
  ): Promise<{ title: string | null; imageUrl: string | null } | null> {
    try {
      const [{ linkedAccount }, { DiscoveryService }] = await Promise.all([
        import('./islands-account'),
        import('./islands-discovery'),
      ])
      const linked = await linkedAccount()

      if (linked) {
        const info = (await DiscoveryService.lookupLinks(linked, [code])).get(code)

        if (info?.title || info?.imageUrl) {
          return { title: info.title, imageUrl: info.imageUrl }
        }
      }
    } catch (error) {
      RuntimeLog.error('caught:core/island-directory.ts (links)', error)
    }

    if (haveTitle) {
      return null
    }

    return { title: await IslandDirectory.fetchTitle(code), imageUrl: null }
  }

  private static async fetchTitle(code: string) {
    const response = await fetch(`${ecosystemApiBaseUrl}/islands/${code}`, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw new Error(`Ecosystem API answered ${response.status} for ${code}`)
    }

    const data = (await response.json()) as { title?: unknown }

    return typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : null
  }
}
