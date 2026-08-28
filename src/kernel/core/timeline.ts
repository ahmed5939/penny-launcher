import { RuntimeLog } from '../runtime-log'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import axios from 'axios'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { peglegResourcesBaseURL } from '../../config/constants/pegleg'
import { bugListTimelineCardsURL } from '../../config/constants/trello'

import { DataDirectory } from '../startup/data-directory'
import { MainWindow } from '../startup/windows/main'

const cacheVersion = 3

/** The schedule shifts when Epic re-orders a season; check weekly. */
const cacheMaxAgeMs = 7 * 24 * 60 * 60 * 1000

export type TimelineQuestline = {
  name: string | null
  description: string | null
  eventFlag: string | null
  color: string | null
  keyItems: Array<string>
  startWeek: number | null
  endWeek: number | null
}

export type TimelineEvent = TimelineQuestline & {
  style: string | null
}

/**
 * Community knowledge about a season, parsed out of its card on The Bug
 * List's "Yearly Content Timeline" — facts the PegLeg feed never carries.
 * The whole block is best-effort: any field a card doesn't state stays
 * null/empty, and a season without a card carries `null` for all of it.
 */
export type TimelineSeasonExtras = {
  /** "Miniboss" or "Mutant" — which alert roster the season runs. */
  kind: string | null
  /** Elements whose mission alerts appear: "Fire", "Water", "Nature". */
  alertElements: Array<string>
  /** True when the card says rewards are "better overall". */
  improvedRewards: boolean | null
  /** The season-wide Ventures modifier, by name — e.g. "Escalation". */
  modifier: string | null
  /** The seasonal llama's plain name, e.g. "Lunar Llama". */
  llamaName: string | null
  /** The seasonal event mode, e.g. "Frostnite", "Dungeons". */
  eventMode: string | null
  /** Other events that occur during the season, e.g. "Cram Session". */
  concurrentEvents: Array<string>
  /** The card's "Available this season" entries: name plus item class. */
  availableItems: Array<{ name: string; type: string | null }>
  /**
   * The card's cover screenshot. A stable trello.com URL that redirects to
   * a freshly-signed files.trello.com one, so it must not be resolved and
   * stored — the signature dies within hours.
   */
  imageUrl: string | null
  imageCredit: string | null
}

export type TimelineSeason = {
  name: string
  /** Length in weeks. */
  duration: number
  /** ISO dates, derived from the anchor and every prior season. */
  startsAt: string
  endsAt: string
  color: string | null
  style: string | null
  llamaType: string | null
  /** One entry per week — the items that week's event shop stocks. */
  eventShop: Array<Array<string>>
  questlines: Array<TimelineQuestline>
  events: Array<TimelineEvent>
  venturesModifiers: Array<string>
  extras: TimelineSeasonExtras | null
}

export type TimelinePayload = {
  errorMessage?: string
  /** Index into `seasons` that is live now, or -1. */
  currentIndex: number
  seasons: Array<TimelineSeason>
}

type RawTimeline = {
  anchor?: string
  seasons?: Array<{
    color?: string
    displayName?: string
    duration?: number
    eventShop?: Array<Array<string>>
    events?: Array<{
      color?: string
      description?: string
      displayName?: string
      endWeek?: number
      eventFlag?: string
      keyItems?: Array<string>
      startWeek?: number
      style?: string
    }>
    llamaType?: string
    questlines?: Array<{
      color?: string
      description?: string
      displayName?: string
      endWeek?: number
      eventFlag?: string
      keyItems?: Array<string>
      startWeek?: number
    }>
    style?: string
    venturesModifiers?: Array<string>
  }>
}

type RawTrelloCard = {
  name?: string
  desc?: string
  attachments?: Array<{ name?: string; url?: string }>
}

const weekMs = 7 * 24 * 60 * 60 * 1000

export class Timeline {
  private static cache: TimelinePayload | null = null

  private static get filePath() {
    return path.join(
      DataDirectory.getDataDirectoryPath(),
      'pegleg-timeline.json'
    )
  }

  static async request(force = false) {
    try {
      const payload = await Timeline.load(force)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TimelineResponse,
        Timeline.withCurrentIndex(payload)
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.TimelineResponse,
        {
          errorMessage: error?.message ?? 'Unknown Error',
          currentIndex: -1,
          seasons: [],
        } as TimelinePayload
      )
    }
  }

  /** Recomputed on every send — the cache outlives the season it was in. */
  private static withCurrentIndex(payload: TimelinePayload) {
    const now = Date.now()

    return {
      ...payload,
      currentIndex: payload.seasons.findIndex(
        (season) =>
          new Date(season.startsAt).getTime() <= now &&
          now < new Date(season.endsAt).getTime()
      ),
    }
  }

  private static async load(force: boolean) {
    if (!force && Timeline.cache) {
      return Timeline.cache
    }

    if (!force) {
      const cached = await Timeline.readCache()

      if (cached) {
        Timeline.cache = cached

        return cached
      }
    }

    const payload = await Timeline.download()

    Timeline.cache = payload

    await Timeline.writeCache(payload)

    return payload
  }

  private static async readCache() {
    try {
      const parsed = JSON.parse(
        await readFile(Timeline.filePath, 'utf8')
      ) as {
        fetchedAt?: string
        seasons?: Array<TimelineSeason>
        version?: number
      }

      if (
        parsed.version !== cacheVersion ||
        !parsed.seasons ||
        !parsed.fetchedAt
      ) {
        return null
      }

      const age = Date.now() - new Date(parsed.fetchedAt).getTime()

      if (Number.isNaN(age) || age > cacheMaxAgeMs) {
        return null
      }

      return { currentIndex: -1, seasons: parsed.seasons } as TimelinePayload

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null
    }
  }

  private static async writeCache(payload: TimelinePayload) {
    try {
      await mkdir(DataDirectory.getDataDirectoryPath(), { recursive: true })
      await writeFile(
        Timeline.filePath,
        JSON.stringify({
          version: cacheVersion,
          fetchedAt: new Date().toISOString(),
          seasons: payload.seasons,
        }),
        { encoding: 'utf8' }
      )

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/timeline.ts', error)
    }
  }

  /**
   * Seasons are stored as a running order rather than with dates: each one
   * starts where the previous ended, counting from a single anchor. The
   * per-week event shop rotation lines up with `duration`.
   */
  private static async download() {
    const [response, extrasByName] = await Promise.all([
      axios.get<RawTimeline>(`${peglegResourcesBaseURL}/timeline.json`, {
        responseType: 'json',
        timeout: 60_000,
      }),
      Timeline.downloadExtras(),
    ])

    const anchor = response.data.anchor
      ? new Date(response.data.anchor).getTime()
      : Number.NaN

    if (Number.isNaN(anchor) || !Array.isArray(response.data.seasons)) {
      throw new Error('Could not read the event timeline')
    }

    let cursor = anchor

    const seasons = response.data.seasons.map((season) => {
      const duration = season.duration ?? 0
      const startsAt = cursor

      cursor += duration * weekMs

      return {
        name: season.displayName ?? 'Season',
        duration,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(cursor).toISOString(),
        color: season.color ?? null,
        style: season.style ?? null,
        llamaType: season.llamaType ?? null,
        eventShop: season.eventShop ?? [],
        questlines: (season.questlines ?? []).map((questline) => ({
          name: questline.displayName ?? null,
          description: questline.description ?? null,
          eventFlag: questline.eventFlag ?? null,
          color: questline.color ?? null,
          keyItems: questline.keyItems ?? [],
          startWeek: questline.startWeek ?? null,
          endWeek: questline.endWeek ?? null,
        })),
        events: (season.events ?? []).map((event) => ({
          name: event.displayName ?? null,
          description: event.description ?? null,
          eventFlag: event.eventFlag ?? null,
          color: event.color ?? null,
          keyItems: event.keyItems ?? [],
          startWeek: event.startWeek ?? null,
          endWeek: event.endWeek ?? null,
          style: event.style ?? null,
        })),
        venturesModifiers: season.venturesModifiers ?? [],
        extras:
          extrasByName.get(
            (season.displayName ?? '').trim().toLowerCase()
          ) ?? null,
      } as TimelineSeason
    })

    return { currentIndex: -1, seasons } as TimelinePayload
  }

  /**
   * Cards keyed by name, lowercased — the join key against `displayName`.
   * The list also holds a pinned index card; it simply never matches a
   * season, so nothing filters it explicitly. This source is enrichment
   * only, so a dead Trello never takes the timeline down with it.
   */
  private static async downloadExtras() {
    const byName = new Map<string, TimelineSeasonExtras>()

    try {
      const response = await axios.get<Array<RawTrelloCard>>(
        bugListTimelineCardsURL,
        { responseType: 'json', timeout: 60_000 }
      )

      if (Array.isArray(response.data)) {
        for (const card of response.data) {
          const name = card.name?.trim().toLowerCase()

          if (!name) {
            continue
          }

          byName.set(
            name,
            Timeline.parseExtras(card.desc ?? '', card.attachments ?? [])
          )
        }
      }
    } catch (error) {
      RuntimeLog.error('caught:core/timeline.ts', error)
    }

    return byName
  }

  /**
   * The cards are prose written to a strong house pattern — "X Ventures
   * season is a Miniboss season, meaning Fire, Water, and Nature mission
   * alerts are available and rewards are better overall." — so each fact is
   * lifted by its surrounding phrase. Matches are deliberately loose (one
   * card spells it "Mininboss") and a miss just leaves the field null.
   */
  private static parseExtras(
    desc: string,
    attachments: Array<{ name?: string; url?: string }>
  ): TimelineSeasonExtras {
    const kindMatch = desc.match(/is a (mini\w*boss|mutant) season/i)
    const kind = kindMatch
      ? /mutant/i.test(kindMatch[1])
        ? 'Mutant'
        : 'Miniboss'
      : null

    const alertsSentence =
      desc.match(/meaning[^.]*mission alerts[^.]*\./i)?.[0] ?? ''
    const alertElements = ['Fire', 'Water', 'Nature'].filter((element) =>
      alertsSentence.includes(element)
    )

    const improvedRewards = /rewards are better/i.test(alertsSentence)
      ? true
      : /rewards are standard/i.test(alertsSentence)
        ? false
        : null

    // `[ \t]`, not `\s` — `\s*` would cross the blank line above a heading
    // and let `.+?` swallow the `###` marks into the captured name.
    const concurrentEvents = Array.from(
      desc.matchAll(/^#*[ \t]*(.+?)(?: event)? occurs during this season/gim)
    ).map((match) => match[1].trim())

    const availableItems: Array<{ name: string; type: string | null }> = []
    const listStart = desc.search(/available this season/i)

    if (listStart >= 0) {
      for (const match of desc
        .slice(listStart)
        .matchAll(/^-\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/gm)) {
        availableItems.push({
          name: match[1].trim(),
          type: match[2]?.trim() ?? null,
        })
      }
    }

    const image = attachments.find((attachment) =>
      /\.(png|jpe?g|webp)$/i.test(attachment.url ?? '')
    )

    return {
      kind,
      alertElements,
      improvedRewards,
      modifier: desc.match(/has the (.+?) modifier/i)?.[1] ?? null,
      llamaName:
        desc.match(/seasonal llama is the (.+?)[.\n]/i)?.[1] ?? null,
      eventMode:
        desc.match(/has the (.+?) seasonal event mode/i)?.[1] ?? null,
      concurrentEvents,
      availableItems,
      imageUrl: image?.url ?? null,
      imageCredit:
        desc.match(/credit for the image goes to (.+?)[.\n]/i)?.[1] ?? null,
    }
  }
}
