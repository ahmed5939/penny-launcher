import { RuntimeLog } from '../runtime-log'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import axios from 'axios'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { peglegResourcesBaseURL } from '../../config/constants/pegleg'

import { DataDirectory } from '../startup/data-directory'
import { MainWindow } from '../startup/windows/main'

const cacheVersion = 2

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
    const response = await axios.get<RawTimeline>(
      `${peglegResourcesBaseURL}/timeline.json`,
      { responseType: 'json', timeout: 60_000 }
    )

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
      } as TimelineSeason
    })

    return { currentIndex: -1, seasons } as TimelinePayload
  }
}
