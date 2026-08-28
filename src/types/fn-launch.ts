export type FnLaunchFileData = FnLaunchSettings & {
  /** Cached absolute path to the game's GameUserSettings.ini. */
  iniPath?: string
}

export type FnLaunchProcessKillMode = 'always' | 'startup'

export type ProcessKillEntry = {
  /** Image name, e.g. `RtkAudUService64.exe`. */
  name: string
  /**
   * `startup` = killed every 15s for the first 3 minutes of the session,
   * `always` = killed every 30s for as long as the game is running.
   */
  mode: FnLaunchProcessKillMode
}

export type FnLaunchSettings = {
  /** Custom launch arguments appended to the game's command line. */
  launchArgs: string
  processKiller: {
    enabled: boolean
    processes: Array<ProcessKillEntry>
  }
}

export type GameSettings = {
  // Display
  resolutionX: number
  resolutionY: number
  /** 0 = fullscreen, 1 = windowed fullscreen, 2 = windowed. */
  fullscreenMode: number
  vsync: boolean
  frameRateLimit: number
  /** `dx11`, `dx12` or `performance`. */
  renderingMode: string

  // Graphics
  displayGamma: number
  userInterfaceContrast: number
  motionBlur: boolean
  uiParallax: boolean
  showFps: boolean

  // Graphics quality (ScalabilityGroups, 0-3)
  viewDistance: number
  shadows: number
  antiAliasingQuality: number
  textures: number
  effects: number
  postProcess: number
  globalIllumination: number
  reflections: number
  foliage: number
  /** 3D resolution percentage, 25-100. */
  resolutionQuality: number

  // Advanced graphics quality
  antiAliasingMethod: string
  tsrQuality: string
  dynamicResolution: boolean
  nanite: boolean
  /** 0 = disabled, 1 = ambient occlusion, 2 = Lumen. */
  desiredGIQuality: number
  /** 0 = disabled, 1 = screen space, 2 = Lumen. */
  desiredReflectionQuality: number
  rayTracing: boolean
  showGrass: boolean
}

/**
 * The copy Penny takes of `GameUserSettings.ini` immediately before it writes
 * to it. One rolling file, so "undo my last change" always works.
 */
export type GameSettingsBackup = {
  exists: boolean
  path: string
  /** Epoch ms of the backup's last write, or `null` when there is none yet. */
  savedAt: number | null
}

export type GameSettingsResult =
  | {
      success: true
      settings: GameSettings
      iniPath: string
      backup: GameSettingsBackup
      /**
       * Fortnite rewrites this file when it exits, so edits made mid-session
       * are lost. The UI warns instead of silently wasting the write.
       */
      gameRunning: boolean
    }
  | {
      success: false
      settings?: undefined
      iniPath?: undefined
      backup?: undefined
      gameRunning?: undefined
      error: string
    }

export type GameSettingsSaveResult = {
  success: boolean
  backup?: GameSettingsBackup
  error?: string
}
