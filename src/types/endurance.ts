export type EnduranceZone =
  | 'stonewood'
  | 'plankerton'
  | 'canny-valley'
  | 'twine-peaks'

export type EndurancePoint = {
  x: number
  y: number
}

export type EndurancePhase =
  | 'idle'
  | 'launching'
  | 'waiting-for-process'
  | 'waiting-for-frontend'
  | 'navigating'
  | 'in-mission'
  | 'returning'
  | 'claiming'
  | 'stopped'
  | 'error'

export type EnduranceConfig = {
  version: 1
  zone: EnduranceZone
  /** Keep starting a new run after each completed one. */
  loop: boolean
  /** Launch Fortnite with the scoped account when the process is missing. */
  autoLaunch: boolean
  /** Claim account rewards (MCP) after every completed run. */
  claimAfterRun: boolean
  /**
   * Endurance has no reliable end-of-run log line on every install, so the
   * runner leaves the zone after this many minutes. A full 30-wave clear
   * fits comfortably; rewards are granted on the waves that finished.
   */
  missionMinutes: number
  /** Multiplier applied to every between-click delay. 1 = default pacing. */
  delayScale: number
  /** Regex (optional) that marks the run as finished when seen in the log. */
  completionPattern: string
  /** Normalized screen points, shared across zones. */
  points: Record<string, EndurancePoint>
  /** Normalized screen points that differ per zone (e.g. the Homebase tile). */
  zonePoints: Partial<Record<EnduranceZone, Record<string, EndurancePoint>>>
}

export type EndurancePointDefinition = {
  id: string
  name: string
  description: string
  /** Point differs between zones and is stored per zone. */
  perZone: boolean
  /** The shipped default is a rough guess — calibrate before first run. */
  needsCalibration: boolean
}

export type EnduranceStatus = {
  phase: EndurancePhase
  running: boolean
  cycle: number
  stepId: string | null
  processRunning: boolean
  accountId: string | null
  /** Unix ms when the current mission phase started, if any. */
  missionStartedAt: number | null
  calibratingPointId: string | null
  lastError: string | null
}

export type EnduranceEvent = {
  at: number
  type:
    | 'status'
    | 'log'
    | 'step'
    | 'calibration-saved'
    | 'calibration-cancelled'
  message?: string
  status?: EnduranceStatus
  pointId?: string
  point?: EndurancePoint
}
