import type { AccountData } from '../../../types/accounts'
import type {
  EnduranceConfig,
  EnduranceEvent,
  EndurancePoint,
  EnduranceStatus,
} from '../../../types/endurance'
import type { MatchResult, Region } from './vision'

import path from 'node:path'

import { screen } from 'electron'
import { node_process_watcher } from 'node-process-watcher'

import { ElectronAPIEventKeys } from '../../../config/constants/main-process'

import { MainWindow } from '../../startup/windows/main'
import { DataDirectory } from '../../startup/data-directory'
import { SettingsManager } from '../../startup/settings'
import { ClaimRewards } from '../claim-rewards'
import { FortniteLauncher } from '../launcher'

import {
  EnduranceConfigStore,
  endurancePointDefinitions,
  enduranceZones,
} from './config'
import { InputWorker } from './input'
import { LogWatcher } from './log-watcher'
import { Vision } from './vision'

class AbortedError extends Error {
  constructor() {
    super('ABORTED')
  }
}

class StepJumpError extends Error {
  constructor(
    public code: 'ADVANCED' | 'BEGINNING' | 'TIMEOUT',
    public toIndex = 0,
  ) {
    super(code)
  }
}

/**
 * uiohook-napi is a native module; load it on first use so a broken binary
 * degrades to an error message instead of taking the whole app down.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let uiohookModule: any = null

function uiohook() {
  if (!uiohookModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    uiohookModule = require('uiohook-napi')
  }

  return uiohookModule as {
    uIOhook: {
      start: () => void
      stop: () => void
      keyTap: (keycode: number) => void
      on: (
        event: 'keydown',
        listener: (payload: { keycode: number }) => void,
      ) => void
    }
    UiohookKey: Record<string, number>
  }
}

const logMarkers = {
  loadMap: /LogLoad: LoadMap:|LoadingScreen.*(shown|hidden)|Travel/i,
  frontend: /LoadMap:.*Frontend/i,
  zone: /LoadMap:(?!.*Frontend).*\/Game\//i,
}

type VisionStep = {
  id: string
  name: string
  template: string
  referenceRegion?: Region
  searchRegion?: Region
  threshold?: number
  target?: EndurancePoint
  action: 'click' | 'click-repeat' | 'key' | 'confirm'
  key?: 'Tab' | 'I'
  repeatCount?: number
  repeatEveryMs?: number
  /** If this later step is already visible, skip forward to it. */
  advanceIfVisible?: string
  /** Steps the resume scan may land on. */
  resumeEligible?: boolean
  /** Loading transitions get the long timeout. */
  longWait?: boolean
  /** Optional calibrated-point override id (clicks it instead of vision). */
  overridePointId?: string
  afterMs?: number
  confirmScans?: number
}

type Interrupt = {
  id: string
  template: string
  searchRegion: Region
  threshold: number
}

const interrupts: Array<Interrupt> = [
  {
    id: 'reward-open',
    template: 'reward-open',
    searchRegion: { x: 0.2, y: 0.7, width: 0.6, height: 0.3 },
    threshold: 0.94,
  },
  {
    id: 'reward-continue',
    template: 'reward-continue',
    searchRegion: { x: 0.25, y: 0.75, width: 0.5, height: 0.25 },
    threshold: 0.94,
  },
]

const readyToReturn: Interrupt = {
  id: 'ready-to-return',
  template: 'ready-to-return',
  searchRegion: { x: 0.2, y: 0.7, width: 0.6, height: 0.3 },
  threshold: 0.94,
}

const zoneHomebaseConfigs: Record<
  EnduranceConfig['zone'],
  { searchRegion: Region; target: EndurancePoint }
> = {
  stonewood: {
    searchRegion: { x: 0.32, y: 0.15, width: 0.38, height: 0.45 },
    // The banner identifies the tile; the clickable Storm Shield structure
    // sits below the match, hence targets outside 0..1.
    target: { x: 0.42, y: 3.4 },
  },
  plankerton: {
    searchRegion: { x: 0.3, y: 0.55, width: 0.45, height: 0.45 },
    target: { x: 0.5, y: 3 },
  },
  'canny-valley': {
    searchRegion: { x: 0.3, y: 0.55, width: 0.45, height: 0.45 },
    target: { x: 0.5, y: 3 },
  },
  'twine-peaks': {
    searchRegion: { x: 0.15, y: 0.2, width: 0.85, height: 0.8 },
    target: { x: 0.5, y: 3 },
  },
}

/**
 * The proven navigation states of the original macro, template-driven:
 * from a fresh lobby it clicks into Save the World first, then walks the
 * map to the selected zone's Storm Shield and starts Endurance.
 */
function buildSteps(config: EnduranceConfig): Array<VisionStep> {
  const zone = enduranceZones[config.zone]
  const homebase = zoneHomebaseConfigs[config.zone]

  return [
    {
      id: 'save-the-world-tile',
      name: 'Save the World tile',
      template: 'save-the-world-tile',
      action: 'click',
      resumeEligible: true,
      longWait: true,
    },
    {
      id: 'save-the-world-play',
      name: 'Save the World — PLAY',
      template: 'save-the-world-play',
      target: { x: 0.5, y: 0.82 },
      action: 'click',
      afterMs: 2_000,
    },
    {
      id: 'homebase-loaded',
      name: 'Homebase loaded',
      template: 'homebase-loaded',
      action: 'key',
      key: 'Tab',
      advanceIfVisible: 'game-menu-map',
      resumeEligible: true,
      longWait: true,
      afterMs: 1_800,
    },
    {
      id: 'game-menu-map',
      name: 'Game menu — MAP tab',
      template: 'game-menu-map',
      referenceRegion: { x: 0.418, y: 0.11, width: 0.078, height: 0.052 },
      searchRegion: { x: 0.15, y: 0, width: 0.55, height: 0.25 },
      action: 'click',
      resumeEligible: true,
      afterMs: 1_500,
    },
    {
      id: 'zone-nav',
      name: `Stonewood to ${zone.name}`,
      template: 'stonewood-selected',
      searchRegion: { x: 0, y: 0.1, width: 0.4, height: 0.22 },
      threshold: 0.9,
      confirmScans: 2,
      target: { x: 0.185, y: 0.5 },
      action: zone.rightClicks ? 'click-repeat' : 'confirm',
      repeatCount: zone.rightClicks,
      repeatEveryMs: 350,
      resumeEligible: true,
      overridePointId: 'zone-arrow-right',
      afterMs: 900,
    },
    {
      id: 'zone-select',
      name: `${zone.name} — SELECT`,
      template: 'twine-peaks-select',
      action: 'click',
      overridePointId: 'zone-select',
      afterMs: 2_200,
    },
    {
      id: 'map-play-with-others',
      name: 'Zone map opened',
      template: 'map-play-with-others',
      referenceRegion: { x: 0.43, y: 0.3, width: 0.16, height: 0.25 },
      searchRegion: { x: 0.15, y: 0.25, width: 0.85, height: 0.75 },
      threshold: 0.9,
      confirmScans: 2,
      action: 'confirm',
      resumeEligible: true,
    },
    {
      id: 'homebase-tile',
      name: 'Homebase tile',
      template: 'homebase-tile',
      searchRegion: homebase.searchRegion,
      threshold: 0.72,
      confirmScans: 2,
      target: homebase.target,
      action: 'click',
      overridePointId: 'homebase-tile',
      afterMs: 1_200,
    },
    {
      id: 'homebase-select',
      name: 'Homebase — SELECT',
      template: 'homebase-select',
      action: 'click',
      overridePointId: 'homebase-select',
      afterMs: 1_800,
    },
    {
      id: 'my-storm-shield',
      name: 'MY STORM SHIELD',
      template: 'my-storm-shield',
      referenceRegion: { x: 0.03, y: 0.2, width: 0.42, height: 0.065 },
      searchRegion: { x: 0, y: 0.12, width: 0.6, height: 0.35 },
      threshold: 0.8,
      confirmScans: 2,
      action: 'click',
      overridePointId: 'my-storm-shield',
      afterMs: 1_200,
    },
    {
      id: 'storm-shield-launch',
      name: 'Storm Shield — LAUNCH',
      template: 'storm-shield-launch',
      action: 'click',
      overridePointId: 'storm-shield-launch',
      afterMs: 2_500,
    },
    {
      id: 'mission-lobby-launch',
      name: 'Mission lobby — LAUNCH',
      template: 'mission-lobby-launch',
      action: 'click',
      overridePointId: 'lobby-launch',
      afterMs: 2_000,
    },
    {
      id: 'storm-shield-mission-loaded',
      name: 'Storm Shield zone loaded',
      template: 'storm-shield-mission-loaded',
      action: 'key',
      key: 'I',
      resumeEligible: true,
      longWait: true,
      afterMs: 1_800,
    },
    {
      id: 'inventory-storm-shield',
      name: 'Inventory — Storm Shield',
      template: 'inventory-storm-shield',
      action: 'click',
      overridePointId: 'inv-storm-shield',
      afterMs: 1_500,
    },
    {
      id: 'storm-shield-endurance',
      name: 'Storm Shield Endurance',
      template: 'storm-shield-endurance',
      action: 'click',
      overridePointId: 'endurance-tile',
      afterMs: 1_500,
    },
    {
      id: 'start-endurance',
      name: 'START ENDURANCE',
      template: 'start-endurance',
      action: 'click',
      overridePointId: 'start-endurance',
      afterMs: 2_000,
    },
  ]
}

/**
 * The endurance runner: vision-driven like the original macro (bundled,
 * generic reference images — nothing for the user to capture), but native:
 * Electron screen capture, a persistent input worker, Fortnite log gates
 * for the slow transitions, launcher-integrated game start and reward
 * claiming, and optional calibrated-point overrides per step.
 */
export class EnduranceAutomation {
  private static config: EnduranceConfig | null = null
  private static input = new InputWorker(
    path.join(DataDirectory.getDataDirectoryPath(), 'endurance'),
  )
  private static logWatcher = new LogWatcher()
  private static abortFlag = { aborted: false }
  private static hookActive = false
  private static hookListenerAttached = false
  private static processWatcherActive = false
  private static processRunning = false
  private static processName = 'FortniteClient-Win64-Shipping.exe'

  private static status: EnduranceStatus = {
    phase: 'idle',
    running: false,
    cycle: 0,
    stepId: null,
    processRunning: false,
    accountId: null,
    missionStartedAt: null,
    calibratingPointId: null,
    lastError: null,
  }

  /**
   * Config
   */

  static async getConfig(): Promise<EnduranceConfig> {
    EnduranceAutomation.config ??= await EnduranceConfigStore.load()

    return EnduranceAutomation.config
  }

  static async updateConfig(partial: Partial<EnduranceConfig>) {
    const current = await EnduranceAutomation.getConfig()

    EnduranceAutomation.config = {
      ...current,
      ...partial,
      points: { ...current.points, ...(partial.points ?? {}) },
      zonePoints: { ...current.zonePoints, ...(partial.zonePoints ?? {}) },
    }
    await EnduranceConfigStore.save(EnduranceAutomation.config)

    return EnduranceAutomation.config
  }

  /**
   * Status + events
   */

  static getStatus(): EnduranceStatus {
    return { ...EnduranceAutomation.status }
  }

  private static emit(event: Omit<EnduranceEvent, 'at'>) {
    const window = MainWindow.instance

    if (!window || window.isDestroyed()) {
      return
    }

    window.webContents.send(ElectronAPIEventKeys.EnduranceNotification, {
      at: Date.now(),
      ...event,
    } satisfies EnduranceEvent)
  }

  private static setStatus(patch: Partial<EnduranceStatus>) {
    EnduranceAutomation.status = {
      ...EnduranceAutomation.status,
      ...patch,
    }
    EnduranceAutomation.emit({
      type: 'status',
      status: EnduranceAutomation.getStatus(),
    })
  }

  private static step(stepId: string | null, message?: string) {
    EnduranceAutomation.setStatus({ stepId })

    if (message) {
      EnduranceAutomation.emit({ type: 'step', message })
    }
  }

  /**
   * Global keyboard hook — F8 stops everything, F9 captures a calibration
   * point. Started only while the runner or the calibrator needs it.
   */

  private static ensureHook() {
    const { uIOhook, UiohookKey } = uiohook()

    if (!EnduranceAutomation.hookListenerAttached) {
      EnduranceAutomation.hookListenerAttached = true

      uIOhook.on('keydown', (payload) => {
        if (payload.keycode === UiohookKey.F8) {
          if (EnduranceAutomation.status.calibratingPointId) {
            EnduranceAutomation.cancelCalibration()
          } else if (EnduranceAutomation.status.running) {
            EnduranceAutomation.stop()
          }
        } else if (payload.keycode === UiohookKey.F9) {
          EnduranceAutomation.captureCalibrationPoint().catch(() => {})
        }
      })
    }

    if (!EnduranceAutomation.hookActive) {
      uIOhook.start()
      EnduranceAutomation.hookActive = true
    }
  }

  private static releaseHook() {
    if (
      !EnduranceAutomation.hookActive ||
      EnduranceAutomation.status.running ||
      EnduranceAutomation.status.calibratingPointId
    ) {
      return
    }

    uiohook().uIOhook.stop()
    EnduranceAutomation.hookActive = false
  }

  /**
   * Calibration: hover the target in Fortnite, press F9. Purely optional —
   * a calibrated point overrides vision for that step.
   */

  static async startCalibration(pointId: string) {
    const definition = endurancePointDefinitions.find(
      (item) => item.id === pointId,
    )

    if (!definition) {
      return
    }

    EnduranceAutomation.setStatus({ calibratingPointId: pointId })
    EnduranceAutomation.ensureHook()
  }

  static cancelCalibration() {
    if (!EnduranceAutomation.status.calibratingPointId) {
      return
    }

    EnduranceAutomation.setStatus({ calibratingPointId: null })
    EnduranceAutomation.emit({ type: 'calibration-cancelled' })
    EnduranceAutomation.releaseHook()
  }

  private static async captureCalibrationPoint() {
    const pointId = EnduranceAutomation.status.calibratingPointId

    if (!pointId) {
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const point: EndurancePoint = {
      x: (cursor.x - display.bounds.x) / display.bounds.width,
      y: (cursor.y - display.bounds.y) / display.bounds.height,
    }

    const config = await EnduranceAutomation.getConfig()
    const definition = endurancePointDefinitions.find(
      (item) => item.id === pointId,
    )

    if (definition?.perZone) {
      await EnduranceAutomation.updateConfig({
        zonePoints: {
          ...config.zonePoints,
          [config.zone]: {
            ...(config.zonePoints[config.zone] ?? {}),
            [pointId]: point,
          },
        },
      })
    } else {
      await EnduranceAutomation.updateConfig({
        points: { ...config.points, [pointId]: point },
      })
    }

    EnduranceAutomation.setStatus({ calibratingPointId: null })
    EnduranceAutomation.emit({
      type: 'calibration-saved',
      pointId,
      point,
    })
    EnduranceAutomation.releaseHook()
  }

  /**
   * Process watching (live pill in the UI; run decisions use direct checks)
   */

  private static ensureProcessWatcher() {
    if (EnduranceAutomation.processWatcherActive) {
      return
    }

    EnduranceAutomation.processWatcherActive = true
    node_process_watcher.on('endurance', (list) => {
      const running = list.some(
        (item) => item.name === EnduranceAutomation.processName,
      )

      if (running !== EnduranceAutomation.processRunning) {
        EnduranceAutomation.processRunning = running
        EnduranceAutomation.setStatus({ processRunning: running })
      }
    })
  }

  private static releaseProcessWatcher() {
    if (!EnduranceAutomation.processWatcherActive) {
      return
    }

    EnduranceAutomation.processWatcherActive = false
    node_process_watcher.close('endurance')
  }

  /**
   * Run control
   */

  static async start(account: AccountData) {
    if (EnduranceAutomation.status.running) {
      return
    }

    const settings = await SettingsManager.getData()

    if (settings.customProcess?.trim()) {
      EnduranceAutomation.processName = settings.customProcess.trim()
    }

    EnduranceAutomation.abortFlag = { aborted: false }
    EnduranceAutomation.setStatus({
      phase: 'waiting-for-process',
      running: true,
      cycle: 0,
      accountId: account.accountId,
      missionStartedAt: null,
      lastError: null,
    })

    EnduranceAutomation.ensureHook()
    EnduranceAutomation.ensureProcessWatcher()
    await EnduranceAutomation.logWatcher.start()

    const forwardLogs = EnduranceAutomation.logWatcher.onLine((line) => {
      if (logMarkers.loadMap.test(line)) {
        EnduranceAutomation.emit({
          type: 'log',
          message: line.length > 220 ? `${line.slice(0, 220)}…` : line,
        })
      }
    })

    try {
      await EnduranceAutomation.run(account)
      EnduranceAutomation.setStatus({
        phase: 'stopped',
        running: false,
        stepId: null,
        missionStartedAt: null,
      })
    } catch (error) {
      if (error instanceof AbortedError) {
        EnduranceAutomation.emit({ type: 'step', message: 'Stopped.' })
        EnduranceAutomation.setStatus({
          phase: 'stopped',
          running: false,
          stepId: null,
          missionStartedAt: null,
        })
      } else {
        EnduranceAutomation.setStatus({
          phase: 'error',
          running: false,
          stepId: null,
          missionStartedAt: null,
          lastError:
            error instanceof Error ? error.message : `${error}`,
        })
      }
    } finally {
      forwardLogs()
      EnduranceAutomation.logWatcher.stop()
      EnduranceAutomation.releaseProcessWatcher()
      EnduranceAutomation.input.stop()
      EnduranceAutomation.releaseHook()
    }
  }

  static stop() {
    if (!EnduranceAutomation.status.running) {
      return
    }

    EnduranceAutomation.abortFlag.aborted = true
    EnduranceAutomation.emit({ type: 'step', message: 'Stopping…' })
  }

  /**
   * Top-level sequence
   */

  private static async run(account: AccountData) {
    const abort = EnduranceAutomation.abortFlag

    /**
     * Phase 0 — make sure Fortnite is up, launching it with the scoped
     * account through the launcher's own exchange-code flow if needed.
     * The decision comes from a direct process query, never from the
     * background watcher.
     */
    EnduranceAutomation.setStatus({ phase: 'waiting-for-process' })

    const alreadyRunning = await EnduranceAutomation.input.checkProcess(
      EnduranceAutomation.processName,
    )

    EnduranceAutomation.processRunning = alreadyRunning
    EnduranceAutomation.setStatus({ processRunning: alreadyRunning })

    if (alreadyRunning) {
      EnduranceAutomation.emit({
        type: 'step',
        message:
          'Fortnite is already running — scanning the screen to find where it is.',
      })
    } else {
      const config = await EnduranceAutomation.getConfig()

      if (!config.autoLaunch) {
        throw new Error(
          'Fortnite is not running and auto-launch is turned off.',
        )
      }

      EnduranceAutomation.setStatus({ phase: 'launching' })
      EnduranceAutomation.emit({
        type: 'step',
        message: `Launching Fortnite as ${account.displayName}…`,
      })
      await FortniteLauncher.start(account)

      EnduranceAutomation.setStatus({ phase: 'waiting-for-process' })
      EnduranceAutomation.emit({
        type: 'step',
        message: 'Waiting for the Fortnite process to appear…',
      })
      await EnduranceAutomation.waitUntilAsync(
        () =>
          EnduranceAutomation.input.checkProcess(
            EnduranceAutomation.processName,
          ),
        3_000,
        5 * 60_000,
        'Fortnite did not start within 5 minutes — check the game path and the account in Settings.',
      )
      EnduranceAutomation.processRunning = true
      EnduranceAutomation.setStatus({ processRunning: true })

      // The lobby announces itself in the log; vision handles the rest
      // (mode tile, PLAY) from there, so this wait is just a head start.
      EnduranceAutomation.setStatus({ phase: 'waiting-for-frontend' })
      EnduranceAutomation.emit({
        type: 'step',
        message: 'Waiting for the game to finish loading…',
      })
      await EnduranceAutomation.logWatcher.waitFor(
        logMarkers.frontend,
        10 * 60_000,
        abort,
      )
      EnduranceAutomation.throwIfAborted()
      await EnduranceAutomation.delay(10_000)
    }

    let cycle = 1

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const config = await EnduranceAutomation.getConfig()

      EnduranceAutomation.setStatus({ phase: 'navigating', cycle })
      EnduranceAutomation.emit({
        type: 'step',
        message: `Cycle ${cycle}: starting ${enduranceZones[config.zone].name} Endurance.`,
      })

      await EnduranceAutomation.navigate(config)

      EnduranceAutomation.setStatus({
        phase: 'in-mission',
        missionStartedAt: Date.now(),
      })
      EnduranceAutomation.emit({
        type: 'step',
        message: `Endurance running — watching for READY TO RETURN (up to ${config.missionMinutes} minutes). Press F8 to stop.`,
      })
      await EnduranceAutomation.waitForMissionEnd(config)

      EnduranceAutomation.setStatus({
        phase: 'returning',
        missionStartedAt: null,
      })
      await EnduranceAutomation.logWatcher.waitFor(
        logMarkers.frontend,
        5 * 60_000,
        abort,
      )
      EnduranceAutomation.throwIfAborted()
      await EnduranceAutomation.delay(10_000)
      // Login/return reward popups may sit over the frontend.
      await EnduranceAutomation.sweepInterrupts()

      if (config.claimAfterRun) {
        EnduranceAutomation.setStatus({ phase: 'claiming' })
        EnduranceAutomation.emit({
          type: 'step',
          message: 'Claiming rewards…',
        })
        ClaimRewards.start([account], true)
        await EnduranceAutomation.delay(5_000)
      }

      if (!config.loop) {
        break
      }

      cycle += 1
    }
  }

  /**
   * Vision-driven navigation with the original macro's recovery semantics:
   * resume from whatever screen is visible, jump forward when a later
   * state is already on screen, restart when the flow fell back to the
   * beginning, rescan on timeouts.
   */
  private static async navigate(config: EnduranceConfig) {
    const steps = buildSteps(config)

    await EnduranceAutomation.focusGame()
    await EnduranceAutomation.sweepInterrupts()

    let index = await EnduranceAutomation.findCurrentStep(steps)
    let recoveries = 0

    while (index < steps.length) {
      const step = steps[index]

      try {
        const result = await EnduranceAutomation.waitForStep(
          config,
          steps,
          index,
        )

        await EnduranceAutomation.performStep(config, step, result)
        index += 1
      } catch (error) {
        if (!(error instanceof StepJumpError)) {
          throw error
        }

        recoveries += 1

        if (recoveries > 12) {
          throw new Error(
            `Navigation kept failing around "${step.name}" — check that Fortnite is in Windowed Fullscreen on the primary display.`,
          )
        }

        if (error.code === 'ADVANCED') {
          EnduranceAutomation.emit({
            type: 'step',
            message: `${steps[error.toIndex].name} is already visible — skipping ahead.`,
          })
          index = error.toIndex
        } else if (error.code === 'BEGINNING') {
          EnduranceAutomation.emit({
            type: 'step',
            message:
              'The game went back to the beginning — restarting the flow.',
          })
          await EnduranceAutomation.sweepInterrupts()
          index = 0
        } else {
          EnduranceAutomation.emit({
            type: 'step',
            message: `Timed out waiting for ${step.name} — rescanning the screen.`,
          })
          await EnduranceAutomation.sweepInterrupts()
          index = await EnduranceAutomation.findCurrentStep(steps)
        }
      }
    }
  }

  /** Which known screen is visible right now? Defaults to the beginning. */
  private static async findCurrentStep(steps: Array<VisionStep>) {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index]

      if (!step.resumeEligible) {
        continue
      }

      EnduranceAutomation.throwIfAborted()

      const result = await EnduranceAutomation.findStep(step)

      if (result.found) {
        EnduranceAutomation.emit({
          type: 'step',
          message: `Resuming from: ${step.name} (${Math.round(result.confidence * 100)}%).`,
        })

        return index
      }
    }

    return 0
  }

  private static findStep(step: VisionStep): Promise<MatchResult> {
    return Vision.find(step.template, {
      referenceRegion: step.referenceRegion,
      searchRegion: step.searchRegion,
      target: step.target,
      threshold: step.threshold ?? 0.9,
    })
  }

  private static async waitForStep(
    config: EnduranceConfig,
    steps: Array<VisionStep>,
    index: number,
  ): Promise<MatchResult | { override: EndurancePoint }> {
    const step = steps[index]
    const timeoutMs = step.longWait ? 5 * 60_000 : 2 * 60_000
    const deadline = Date.now() + timeoutMs
    const advanceIndex = step.advanceIfVisible
      ? steps.findIndex((item) => item.id === step.advanceIfVisible)
      : -1
    let confirmed = 0
    let bestConfidence = 0
    let lastProgressAt = 0
    let lastBeginningCheckAt = Date.now()

    // A calibrated point wins over vision for this step.
    const override = EnduranceConfigStore.explicitPoint(
      config,
      step.overridePointId,
    )

    EnduranceAutomation.step(step.id, `Waiting for: ${step.name}…`)

    if (override && step.action !== 'confirm' && step.action !== 'key') {
      return { override }
    }

    // Zone loads dominate this wait; let the log skip the scanning.
    if (step.longWait) {
      await EnduranceAutomation.logWatcher.waitFor(
        logMarkers.loadMap,
        15_000,
        EnduranceAutomation.abortFlag,
      )
    }

    while (Date.now() < deadline) {
      EnduranceAutomation.throwIfAborted()

      if (step.id === 'homebase-loaded') {
        await EnduranceAutomation.sweepInterrupts(3)
      }

      const result = await EnduranceAutomation.findStep(step)

      bestConfidence = Math.max(bestConfidence, result.confidence)

      if (result.found) {
        confirmed += 1

        if (confirmed >= (step.confirmScans ?? 1)) {
          return result
        }
      } else {
        confirmed = 0
      }

      if (!result.found && advanceIndex >= 0) {
        const advanceResult = await EnduranceAutomation.findStep(
          steps[advanceIndex],
        )

        if (advanceResult.found) {
          throw new StepJumpError('ADVANCED', advanceIndex)
        }
      }

      if (
        !result.found &&
        index > 0 &&
        Date.now() - lastBeginningCheckAt >= 15_000
      ) {
        lastBeginningCheckAt = Date.now()

        const beginning = await EnduranceAutomation.findStep(steps[0])

        if (beginning.found) {
          throw new StepJumpError('BEGINNING')
        }
      }

      if (Date.now() - lastProgressAt >= 20_000) {
        lastProgressAt = Date.now()
        EnduranceAutomation.emit({
          type: 'log',
          message: `Still looking for ${step.name} (best match ${Math.round(bestConfidence * 100)}%).`,
        })
      }

      await EnduranceAutomation.delay(result.found ? 350 : 900, false)
    }

    throw new StepJumpError('TIMEOUT')
  }

  private static async performStep(
    config: EnduranceConfig,
    step: VisionStep,
    result: MatchResult | { override: EndurancePoint },
  ) {
    EnduranceAutomation.throwIfAborted()
    EnduranceAutomation.step(step.id, step.name)

    if (step.action === 'key' && step.key) {
      const { uIOhook, UiohookKey } = uiohook()

      uIOhook.keyTap(UiohookKey[step.key])
    } else if (step.action !== 'confirm') {
      const target =
        'override' in result
          ? EnduranceAutomation.pointToPhysical(result.override)
          : result.clickTarget
      const clicks =
        step.action === 'click-repeat' ? (step.repeatCount ?? 1) : 1

      for (let click = 0; click < clicks; click += 1) {
        await EnduranceAutomation.input.click(target.x, target.y)

        if (click < clicks - 1) {
          await EnduranceAutomation.delay(step.repeatEveryMs ?? 350, false)
        }
      }
    }

    await EnduranceAutomation.delay(step.afterMs ?? 900)
  }

  /**
   * Reward/notification popups appear over the frontend after missions and
   * logins; click through them until none are visible.
   */
  private static async sweepInterrupts(maxActions = 12) {
    let actions = 0

    while (actions < maxActions) {
      EnduranceAutomation.throwIfAborted()

      let handled = false

      for (const interrupt of interrupts) {
        const result = await Vision.find(interrupt.template, {
          searchRegion: interrupt.searchRegion,
          threshold: interrupt.threshold,
        })

        if (!result.found) {
          continue
        }

        actions += 1
        handled = true
        EnduranceAutomation.emit({
          type: 'step',
          message: `Clearing popup: ${interrupt.id}.`,
        })
        await EnduranceAutomation.input.click(
          result.clickTarget.x,
          result.clickTarget.y,
        )
        await EnduranceAutomation.delay(1_200)
        break
      }

      if (!handled) {
        return actions
      }
    }

    return actions
  }

  /**
   * Endurance end: watch for READY TO RETURN (visual, like the original),
   * with the timer and the optional log marker as backstops. Then click it
   * and clear the reward screens.
   */
  private static async waitForMissionEnd(config: EnduranceConfig) {
    const deadline = Date.now() + config.missionMinutes * 60_000
    let completionSeen = false
    let unsubscribe: (() => void) | null = null

    if (config.completionPattern.trim()) {
      try {
        const pattern = new RegExp(config.completionPattern.trim(), 'i')

        unsubscribe = EnduranceAutomation.logWatcher.onLine((line) => {
          if (pattern.test(line)) {
            completionSeen = true
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        EnduranceAutomation.emit({
          type: 'step',
          message:
            'The completion marker is not a valid regular expression — ignoring it.',
        })
      }
    }

    try {
      while (Date.now() < deadline) {
        EnduranceAutomation.throwIfAborted()

        const result = await Vision.find(readyToReturn.template, {
          searchRegion: readyToReturn.searchRegion,
          threshold: readyToReturn.threshold,
        })

        if (result.found) {
          EnduranceAutomation.emit({
            type: 'step',
            message: 'READY TO RETURN is up — heading back.',
          })
          await EnduranceAutomation.focusGame()
          await EnduranceAutomation.input.click(
            result.clickTarget.x,
            result.clickTarget.y,
          )
          await EnduranceAutomation.delay(3_000)
          await EnduranceAutomation.sweepInterrupts()

          return
        }

        if (completionSeen) {
          EnduranceAutomation.emit({
            type: 'step',
            message:
              'Completion marker seen in the log — waiting for READY TO RETURN…',
          })
          completionSeen = false
        }

        await EnduranceAutomation.delay(10_000, false)
      }
    } finally {
      unsubscribe?.()
    }

    EnduranceAutomation.emit({
      type: 'step',
      message:
        'Run timer elapsed without READY TO RETURN — leaving through the pause menu.',
    })
    await EnduranceAutomation.escReturnFallback(config)
  }

  /** Blind Esc-menu exit, used only when READY TO RETURN never showed. */
  private static async escReturnFallback(config: EnduranceConfig) {
    const { uIOhook, UiohookKey } = uiohook()

    await EnduranceAutomation.focusGame()
    uIOhook.keyTap(UiohookKey.Escape)
    await EnduranceAutomation.delay(1_200)

    for (const pointId of ['return-to-homebase', 'return-confirm']) {
      const point = EnduranceConfigStore.resolvePoint(config, pointId)
      const target = EnduranceAutomation.pointToPhysical(point)

      await EnduranceAutomation.input.click(target.x, target.y)
      await EnduranceAutomation.delay(1_200)
    }

    await EnduranceAutomation.sweepInterrupts()
  }

  /**
   * Primitives
   */

  private static pointToPhysical(point: EndurancePoint) {
    const display = screen.getPrimaryDisplay()

    return {
      x:
        (display.bounds.x + point.x * display.bounds.width) *
        display.scaleFactor,
      y:
        (display.bounds.y + point.y * display.bounds.height) *
        display.scaleFactor,
    }
  }

  /**
   * A running Fortnite process has no window during its early startup and
   * loading screens, so focusing retries instead of failing on the first
   * attempt.
   */
  private static async focusGame(patienceMs = 120_000) {
    const deadline = Date.now() + patienceMs
    let lastError: unknown = null

    // eslint-disable-next-line no-constant-condition
    while (true) {
      EnduranceAutomation.throwIfAborted()

      try {
        await EnduranceAutomation.input.focus(
          EnduranceAutomation.processName,
        )
        await EnduranceAutomation.delay(800)

        return
      } catch (error) {
        lastError = error
      }

      if (Date.now() > deadline) {
        throw new Error(
          `Could not focus the Fortnite window: ${
            lastError instanceof Error ? lastError.message : lastError
          }`,
        )
      }

      await EnduranceAutomation.delay(3_000, false)
    }
  }

  private static async delay(ms: number, scaled = true) {
    EnduranceAutomation.throwIfAborted()

    const config = await EnduranceAutomation.getConfig()
    const total = scaled ? Math.round(ms * (config.delayScale || 1)) : ms
    const deadline = Date.now() + total

    while (Date.now() < deadline) {
      EnduranceAutomation.throwIfAborted()
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250, deadline - Date.now())),
      )
    }
  }

  private static async waitUntilAsync(
    check: () => Promise<boolean>,
    pollMs: number,
    timeoutMs: number,
    timeoutMessage: string,
  ) {
    const deadline = Date.now() + timeoutMs

    // eslint-disable-next-line no-constant-condition
    while (true) {
      EnduranceAutomation.throwIfAborted()

      if (await check()) {
        return
      }

      if (Date.now() > deadline) {
        throw new Error(timeoutMessage)
      }

      await EnduranceAutomation.delay(pollMs, false)
    }
  }

  private static throwIfAborted() {
    if (EnduranceAutomation.abortFlag.aborted) {
      throw new AbortedError()
    }
  }
}
