import type {
  EnduranceConfig,
  EndurancePoint,
  EndurancePointDefinition,
  EnduranceZone,
} from '../../../types/endurance'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DataDirectory } from '../../startup/data-directory'

export const enduranceZones: Record<
  EnduranceZone,
  { name: string; rightClicks: number }
> = {
  stonewood: { name: 'Stonewood', rightClicks: 0 },
  plankerton: { name: 'Plankerton', rightClicks: 1 },
  'canny-valley': { name: 'Canny Valley', rightClicks: 2 },
  'twine-peaks': { name: 'Twine Peaks', rightClicks: 3 },
}

/**
 * Every screen position the runner clicks, as fractions of the Fortnite
 * display. Positions are stable in Windowed Fullscreen at a given UI scale,
 * which is what makes an image-free runner possible — but a few of them
 * (marked needsCalibration) vary enough between setups that they should be
 * captured once with hover + F9 before the first run.
 */
export const endurancePointDefinitions: Array<EndurancePointDefinition> = [
  {
    id: 'map-tab',
    name: 'Game menu — MAP tab',
    description: 'The inactive MAP tab at the top after pressing Tab.',
    perZone: false,
    needsCalibration: false,
  },
  {
    id: 'zone-stonewood',
    name: 'Zone selector — Stonewood',
    description:
      'The Stonewood entry in the top-left zone list on the map screen.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'zone-arrow-right',
    name: 'Zone selector — right arrow',
    description:
      'The right navigation arrow beside the selected zone. Clicked once per zone hop (Plankerton 1, Canny 2, Twine 3).',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'zone-select',
    name: 'Zone — SELECT button',
    description: 'The SELECT control shown after choosing a zone.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'homebase-tile',
    name: 'Homebase tile on the map',
    description:
      'Your Storm Shield tile on the zone map. Its map position is fixed per zone, so capture it once for each zone you run.',
    perZone: true,
    needsCalibration: true,
  },
  {
    id: 'homebase-select',
    name: 'Homebase — SELECT button',
    description: 'The SELECT control after clicking the Homebase tile.',
    perZone: true,
    needsCalibration: true,
  },
  {
    id: 'my-storm-shield',
    name: 'MY STORM SHIELD entry',
    description:
      'The MY STORM SHIELD row in the mission panel, guaranteeing your own Homebase.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'storm-shield-launch',
    name: 'Storm Shield — LAUNCH',
    description: 'The LAUNCH control after selecting My Storm Shield.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'lobby-launch',
    name: 'Mission lobby — LAUNCH',
    description: 'The yellow LAUNCH button in the mission lobby.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'inv-storm-shield',
    name: 'Inventory — Storm Shield',
    description:
      'The Storm Shield entry after pressing I inside your Storm Shield zone.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'endurance-tile',
    name: 'Storm Shield Endurance tile',
    description: 'The Endurance activity tile in the Storm Shield screen.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'start-endurance',
    name: 'START ENDURANCE button',
    description: 'The confirmation that actually starts the run.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'return-to-homebase',
    name: 'Pause menu — Return to Homebase',
    description:
      'The Return to Homebase entry in the Esc menu, used to leave the zone when the run is over.',
    perZone: false,
    needsCalibration: true,
  },
  {
    id: 'return-confirm',
    name: 'Return confirmation',
    description: 'The confirm button on the leave-zone dialog.',
    perZone: false,
    needsCalibration: true,
  },
]

/**
 * Rough shipped defaults for a 16:9 Windowed Fullscreen layout. They make
 * the sequence runnable out of the box; hover + F9 calibration replaces
 * them with exact positions.
 */
const defaultPoints: Record<string, EndurancePoint> = {
  'map-tab': { x: 0.457, y: 0.136 },
  'zone-stonewood': { x: 0.13, y: 0.21 },
  'zone-arrow-right': { x: 0.245, y: 0.21 },
  'zone-select': { x: 0.5, y: 0.78 },
  'homebase-tile': { x: 0.5, y: 0.5 },
  'homebase-select': { x: 0.5, y: 0.78 },
  'my-storm-shield': { x: 0.22, y: 0.24 },
  'storm-shield-launch': { x: 0.22, y: 0.9 },
  'lobby-launch': { x: 0.89, y: 0.92 },
  'inv-storm-shield': { x: 0.34, y: 0.32 },
  'endurance-tile': { x: 0.5, y: 0.5 },
  'start-endurance': { x: 0.5, y: 0.88 },
  'return-to-homebase': { x: 0.5, y: 0.45 },
  'return-confirm': { x: 0.42, y: 0.6 },
}

export const defaultEnduranceConfig = (): EnduranceConfig => ({
  version: 1,
  zone: 'twine-peaks',
  loop: true,
  autoLaunch: true,
  claimAfterRun: true,
  missionMinutes: 150,
  delayScale: 1,
  completionPattern: '',
  /**
   * Empty on purpose: vision finds every step on its own. An entry here
   * means the user explicitly calibrated that spot, which overrides vision
   * for the matching step.
   */
  points: {},
  zonePoints: {},
})

export class EnduranceConfigStore {
  private static filePath = path.join(
    DataDirectory.getDataDirectoryPath(),
    'endurance.json',
  )

  static async load(): Promise<EnduranceConfig> {
    const defaults = defaultEnduranceConfig()

    try {
      const raw = JSON.parse(
        await readFile(EnduranceConfigStore.filePath, {
          encoding: 'utf8',
        }),
      ) as Partial<EnduranceConfig>

      /**
       * An earlier build pre-filled every default point into the saved
       * config, which now would read as "user calibrated everything".
       * Points identical to the shipped defaults are not calibrations —
       * drop them.
       */
      const points: Record<string, EndurancePoint> = {}

      for (const [id, point] of Object.entries(raw.points ?? {})) {
        const shipped = defaultPoints[id]

        if (
          shipped &&
          Math.abs(shipped.x - point.x) < 0.0001 &&
          Math.abs(shipped.y - point.y) < 0.0001
        ) {
          continue
        }

        points[id] = point
      }

      return {
        ...defaults,
        ...raw,
        points,
        zonePoints: raw.zonePoints ?? {},
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return defaults
    }
  }

  static async save(config: EnduranceConfig) {
    await mkdir(path.dirname(EnduranceConfigStore.filePath), {
      recursive: true,
    }).catch(() => {})
    await writeFile(
      EnduranceConfigStore.filePath,
      JSON.stringify(config, null, 2),
      {
        encoding: 'utf8',
      },
    )
  }

  /**
   * A point the user explicitly calibrated, or null. Shipped defaults do
   * NOT count — those only back the blind fallbacks.
   */
  static explicitPoint(
    config: EnduranceConfig,
    pointId: string | undefined,
  ): EndurancePoint | null {
    if (!pointId) {
      return null
    }

    const definition = endurancePointDefinitions.find(
      (item) => item.id === pointId,
    )

    if (definition?.perZone) {
      return config.zonePoints[config.zone]?.[pointId] ?? null
    }

    return config.points[pointId] ?? null
  }

  /** The point the runner should click for a step, honouring zone overrides. */
  static resolvePoint(
    config: EnduranceConfig,
    pointId: string,
  ): EndurancePoint {
    const definition = endurancePointDefinitions.find(
      (item) => item.id === pointId,
    )

    if (definition?.perZone) {
      const zonePoint = config.zonePoints[config.zone]?.[pointId]

      if (zonePoint) {
        return zonePoint
      }
    }

    return (
      config.points[pointId] ??
      defaultPoints[pointId] ?? { x: 0.5, y: 0.5 }
    )
  }
}
