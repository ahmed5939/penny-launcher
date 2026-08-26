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
  action:
    | 'click'
    | 'click-repeat'
    | 'click-until'
    | 'key'
    | 'confirm'
    | 'scroll'
  key?: 'Tab' | 'I'
  /** Completion target for the reference macro's retry-until-success steps. */
  untilTemplate?: string
  scrollAmount?: number
  repeatCount?: number
  repeatEveryMs?: number
  timeoutMs?: number
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

const macroMatchThreshold = 0.88

const interrupts: Array<Interrupt> = [
  {
    id: 'reward-open',
    template: 'reward-open',
    searchRegion: { x: 0.2, y: 0.7, width: 0.6, height: 0.3 },
    threshold: macroMatchThreshold,
  },
  {
    id: 'reward-continue',
    template: 'reward-continue',
    searchRegion: { x: 0.25, y: 0.75, width: 0.5, height: 0.25 },
    threshold: macroMatchThreshold,
  },
]

const readyToReturn: Interrupt = {
  id: 'ready-to-return',
  template: 'ready-to-return',
  searchRegion: { x: 0.2, y: 0.7, width: 0.6, height: 0.3 },
  threshold: 0.94,
}

/**
 * The proven navigation states of the original macro, template-driven:
 * from a fresh lobby it clicks into Save the World first, then walks the
 * map to the selected zone's Storm Shield and starts Endurance.
 */
function buildSteps(config: EnduranceConfig): Array<VisionStep> {
  const zone = enduranceZones[config.zone]
  const zoneVerification: Array<VisionStep> = []

  if (config.zone === 'twine-peaks') {
    zoneVerification.push({
      id: 'zone-highlighted',
      name: 'Verify Twine Peaks is highlighted',
      template: 'macro-twine-peaks-highlighted',
      threshold: macroMatchThreshold,
      action: 'confirm',
      resumeEligible: true,
      afterMs: 1_000,
    })
  } else if (config.zone === 'stonewood' || config.zone === 'plankerton') {
    zoneVerification.push({
      id: 'zone-highlighted',
      name: `Verify ${zone.name} is highlighted`,
      template:
        config.zone === 'stonewood'
          ? 'stonewood-selected'
          : 'plankerton-selected',
      threshold: macroMatchThreshold,
      action: 'confirm',
      resumeEligible: true,
      afterMs: 1_000,
    })
  }

  return [
    {
      id: 'current-lobby',
      name: 'Save the World current lobby',
      template: 'macro-current-lobby',
      threshold: macroMatchThreshold,
      action: 'scroll',
      scrollAmount: 1,
      resumeEligible: true,
      longWait: true,
      timeoutMs: 15 * 60_000,
      afterMs: 3_000,
    },
    {
      id: 'enter-save-the-world',
      name: 'Enter Save the World',
      template: 'macro-save-the-world',
      untilTemplate: 'macro-hestia-loaded',
      threshold: macroMatchThreshold,
      action: 'click-until',
      timeoutMs: 15 * 60_000,
      repeatEveryMs: 8_000,
      afterMs: 2_000,
    },
    {
      id: 'hestia-loaded',
      name: 'Open the Save the World frontend',
      template: 'macro-hestia-loaded',
      threshold: macroMatchThreshold,
      action: 'key',
      key: 'Tab',
      resumeEligible: true,
      longWait: true,
      afterMs: 2_000,
    },
    {
      id: 'quests-tab',
      name: 'Wait for the Quests tab',
      template: 'macro-quests-tab',
      threshold: macroMatchThreshold,
      action: 'confirm',
      resumeEligible: true,
      afterMs: 1_000,
    },
    {
      id: 'map-tab',
      name: 'Open the map',
      template: 'macro-map-tab',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'map-tab',
      afterMs: 3_000,
    },
    ...(zone.rightClicks
      ? [
          {
            id: 'zone-nav',
            name: `Stonewood to ${zone.name}`,
            template: 'macro-world-arrow-right',
            threshold: macroMatchThreshold,
            action: 'click-repeat' as const,
            repeatCount: zone.rightClicks,
            repeatEveryMs: 1_500,
            overridePointId: 'zone-arrow-right',
            afterMs: 2_000,
          },
        ]
      : []),
    ...zoneVerification,
    {
      id: 'zone-select',
      name: `${zone.name} — SELECT`,
      template: 'macro-select-zone',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'zone-select',
      afterMs: 3_000,
    },
    {
      id: 'storm-shield-node',
      name: `${zone.name} Storm Shield node`,
      template: 'macro-storm-shield-node',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'homebase-tile',
      afterMs: 2_000,
    },
    {
      id: 'select-storm-shield',
      name: `Select ${zone.name} Storm Shield`,
      template: 'macro-select-storm-shield',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'homebase-select',
      afterMs: 3_000,
    },
    {
      id: 'launch-community-lookout',
      name: 'Launch My Storm Shield',
      template: 'macro-launch-community-lookout',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'storm-shield-launch',
      afterMs: 8_000,
    },
    {
      id: 'launch-lobby',
      name: 'Launch from the mission lobby',
      template: 'macro-launch-lobby',
      untilTemplate: 'macro-storm-shield-loaded',
      threshold: macroMatchThreshold,
      action: 'click-until',
      timeoutMs: 15 * 60_000,
      repeatEveryMs: 10_000,
      overridePointId: 'lobby-launch',
      afterMs: 3_000,
    },
    {
      id: 'storm-shield-loaded',
      name: 'Open inventory in the Storm Shield',
      template: 'macro-storm-shield-loaded',
      threshold: macroMatchThreshold,
      action: 'key',
      key: 'I',
      resumeEligible: true,
      longWait: true,
      afterMs: 3_000,
    },
    {
      id: 'storm-shield-tab',
      name: 'Open the Storm Shield tab',
      template: 'macro-storm-shield-tab',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'inv-storm-shield',
      afterMs: 2_000,
    },
    {
      id: 'storm-shield-endurance',
      name: 'Choose Storm Shield Endurance',
      template: 'macro-storm-shield-endurance',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'endurance-tile',
      afterMs: 3_000,
    },
    {
      id: 'start-endurance',
      name: 'Choose Start Endurance',
      template: 'macro-start-endurance',
      threshold: macroMatchThreshold,
      action: 'click',
      overridePointId: 'start-endurance',
      afterMs: 2_000,
    },
    {
      id: 'confirm-start',
      name: 'Confirm Start Endurance',
      template: 'macro-confirm-start',
      threshold: macroMatchThreshold,
      action: 'click',
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
  private static nextHealthCheckAt = 0

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
    EnduranceAutomation.nextHealthCheckAt = 0
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
        message: `Endurance running — expecting results around ${config.missionMinutes} minutes, then allowing a 45-minute results grace period. Press F8 to stop.`,
      })
      await EnduranceAutomation.waitForMissionEnd(config)

      EnduranceAutomation.setStatus({
        phase: 'returning',
        missionStartedAt: null,
      })
      await EnduranceAutomation.recoverFrontend()

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
      threshold: step.threshold ?? macroMatchThreshold,
    })
  }

  private static async waitForStep(
    config: EnduranceConfig,
    steps: Array<VisionStep>,
    index: number,
  ): Promise<MatchResult | { override: EndurancePoint }> {
    const step = steps[index]
    const timeoutMs =
      step.timeoutMs ?? (step.longWait ? 5 * 60_000 : 2 * 60_000)
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

    while (Date.now() < deadline) {
      EnduranceAutomation.throwIfAborted()
      await EnduranceAutomation.assertGameHealthy()

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

    if (step.action === 'click-until' && step.untilTemplate) {
      await EnduranceAutomation.clickUntilComplete(step, result)

      return
    }

    if (step.action === 'key' && step.key) {
      await EnduranceAutomation.input.key(step.key)
    } else if (step.action === 'scroll') {
      await EnduranceAutomation.input.scroll(step.scrollAmount ?? 1)
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
   * The reference macro does not trust a single click on loading controls.
   * It keeps checking the destination screen and retries the source button
   * at a slower interval until the destination is positively identified.
   */
  private static async clickUntilComplete(
    step: VisionStep,
    firstResult: MatchResult | { override: EndurancePoint },
  ) {
    const deadline = Date.now() + (step.timeoutMs ?? 15 * 60_000)
    let nextClickAt = 0
    let targetResult = firstResult
    let clicks = 0

    while (Date.now() < deadline) {
      EnduranceAutomation.throwIfAborted()
      await EnduranceAutomation.assertGameHealthy()

      const completed = await Vision.find(step.untilTemplate!, {
        threshold: step.threshold ?? macroMatchThreshold,
      })

      if (completed.found) {
        EnduranceAutomation.emit({
          type: 'log',
          message: `${step.name} succeeded after ${clicks} click${clicks === 1 ? '' : 's'}.`,
        })
        await EnduranceAutomation.delay(step.afterMs ?? 900)

        return
      }

      if (Date.now() >= nextClickAt) {
        if (!('override' in targetResult)) {
          targetResult = await EnduranceAutomation.findStep(step)
        }

        if ('override' in targetResult || targetResult.found) {
          const target =
            'override' in targetResult
              ? EnduranceAutomation.pointToPhysical(targetResult.override)
              : targetResult.clickTarget

          clicks += 1
          await EnduranceAutomation.input.click(target.x, target.y)
          nextClickAt = Date.now() + (step.repeatEveryMs ?? 8_000)
        }
      }

      await EnduranceAutomation.delay(900, false)
    }

    throw new StepJumpError('TIMEOUT')
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

  /** Watch for the reference macro's results screen, with the old
   * READY TO RETURN target retained as an early-exit helper. */
  private static async waitForMissionEnd(config: EnduranceConfig) {
    const expectedAt = Date.now() + config.missionMinutes * 60_000
    // The reference workflow keeps searching for the results screen after
    // the expected duration instead of immediately forcing an Esc-menu exit.
    const deadline = expectedAt + 45 * 60_000
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
        await EnduranceAutomation.assertGameHealthy()

        const results = await Vision.find('macro-continue', {
          threshold: macroMatchThreshold,
        })

        if (results.found) {
          EnduranceAutomation.emit({
            type: 'step',
            message: 'Endurance results detected — continuing.',
          })
          await EnduranceAutomation.focusGame()
          await EnduranceAutomation.input.click(
            results.clickTarget.x,
            results.clickTarget.y,
          )
          await EnduranceAutomation.delay(5_000)

          return
        }

        const ready = await Vision.find(readyToReturn.template, {
          searchRegion: readyToReturn.searchRegion,
          threshold: readyToReturn.threshold,
        })

        if (ready.found) {
          EnduranceAutomation.emit({
            type: 'step',
            message: 'READY TO RETURN is up — heading back.',
          })
          await EnduranceAutomation.focusGame()
          await EnduranceAutomation.input.click(
            ready.clickTarget.x,
            ready.clickTarget.y,
          )
          await EnduranceAutomation.delay(3_000)
        }

        if (completionSeen) {
          EnduranceAutomation.emit({
            type: 'step',
            message:
              'Completion marker seen in the log — waiting for results…',
          })
          completionSeen = false
        }

        await EnduranceAutomation.delay(
          Date.now() < expectedAt ? 120_000 : 1_000,
          false,
        )
      }
    } finally {
      unsubscribe?.()
    }

    EnduranceAutomation.emit({
      type: 'step',
      message:
        'Results did not appear during the 45-minute grace period — leaving through the pause menu.',
    })
    await EnduranceAutomation.escReturnFallback(config)
  }

  /** Blind Esc-menu exit, used only when READY TO RETURN never showed. */
  private static async escReturnFallback(config: EnduranceConfig) {
    await EnduranceAutomation.focusGame()
    await EnduranceAutomation.input.key('Escape')
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
   * Mirror the reference macro's post-Endurance state machine. It handles
   * reward cards, Battle Royale XP, the mode picker, and Hestia instead of
   * assuming one frontend log line means the UI is ready for another run.
   */
  private static async recoverFrontend() {
    const deadline = Date.now() + 30 * 60_000
    let lastState = ''
    let lastStateChange = Date.now()
    let rewardKeyPresses = 0

    const observe = (state: string) => {
      if (state === lastState) {
        return
      }

      lastState = state
      lastStateChange = Date.now()
      EnduranceAutomation.emit({
        type: 'log',
        message: `Post-Endurance recovery: ${state}.`,
      })
    }

    while (Date.now() < deadline) {
      EnduranceAutomation.throwIfAborted()
      await EnduranceAutomation.assertGameHealthy()

      if (Date.now() - lastStateChange >= 5 * 60_000) {
        throw new Error(
          'Post-Endurance recovery stopped making progress for 5 minutes.',
        )
      }

      const quests = await Vision.find('macro-quests-tab', {
        threshold: macroMatchThreshold,
      })

      if (quests.found) {
        observe('Hestia frontend')

        // The original macro deliberately sends a minimum number of reward
        // confirmations so stacked reward cards cannot survive into a loop.
        if (rewardKeyPresses < 14) {
          rewardKeyPresses += 1
          await EnduranceAutomation.input.key('C')
          await EnduranceAutomation.delay(1_500, false)
          continue
        }

        EnduranceAutomation.emit({
          type: 'step',
          message: 'Save the World frontend recovered.',
        })

        return
      }

      const reward = await Vision.find('macro-reward-open', {
        threshold: macroMatchThreshold,
      })

      if (reward.found) {
        observe('reward prompt')
        rewardKeyPresses += 1
        await EnduranceAutomation.input.key('C')
        await EnduranceAutomation.delay(1_500, false)
        continue
      }

      const xp = await Vision.find('macro-battle-royale-xp-claim', {
        threshold: macroMatchThreshold,
      })

      if (xp.found) {
        observe('Battle Royale XP popup')
        await EnduranceAutomation.input.click(
          xp.clickTarget.x,
          xp.clickTarget.y,
        )
        await EnduranceAutomation.delay(1_500, false)
        continue
      }

      const currentLobby = await Vision.find('macro-current-lobby', {
        threshold: macroMatchThreshold,
      })

      if (currentLobby.found) {
        observe('Battle Royale current lobby')
        await EnduranceAutomation.input.scroll(1)
        await EnduranceAutomation.delay(8_000, false)
        continue
      }

      const saveTheWorld = await Vision.find('macro-save-the-world', {
        threshold: macroMatchThreshold,
      })

      if (saveTheWorld.found) {
        observe('Save the World mode tile')
        await EnduranceAutomation.input.click(
          saveTheWorld.clickTarget.x,
          saveTheWorld.clickTarget.y,
        )
        await EnduranceAutomation.delay(8_000, false)
        continue
      }

      const hestia = await Vision.find('macro-hestia-loaded', {
        threshold: macroMatchThreshold,
      })

      if (hestia.found) {
        observe('Hestia loaded')
        await EnduranceAutomation.input.key('Tab')
        await EnduranceAutomation.delay(10_000, false)
        continue
      }

      observe('unrecognized screen')
      await EnduranceAutomation.delay(1_000, false)
    }

    throw new Error('Timed out recovering the Save the World frontend.')
  }

  /**
   * Primitives
   */

  /** Process and blocking-dialog checks from the reference controller. */
  private static async assertGameHealthy() {
    const now = Date.now()

    if (now < EnduranceAutomation.nextHealthCheckAt) {
      return
    }

    EnduranceAutomation.nextHealthCheckAt = now + 15_000

    if (
      !(await EnduranceAutomation.input.checkProcess(
        EnduranceAutomation.processName,
      ))
    ) {
      throw new Error('Fortnite closed while Endurance was running.')
    }

    for (const dialog of [
      { id: 'Roadblock', template: 'macro-roadblock' },
      { id: 'Network Connection Lost', template: 'macro-network-lost' },
    ]) {
      const result = await Vision.find(dialog.template, {
        searchRegion: { x: 0.15, y: 0.15, width: 0.7, height: 0.55 },
        threshold: 0.8,
      })

      if (result.found) {
        throw new Error(
          `${dialog.id} dialog detected (${Math.round(result.confidence * 100)}% match).`,
        )
      }
    }
  }

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
