export type GameInstallSource =
  | 'settings'
  | 'egl-manifest'
  | 'egl-installed'
  | 'program-files'
  | 'xbox'
  | 'missing'

export type GameInstallPlatform = 'egl' | 'xbox' | 'unknown'

export type GameInstallSnapshot = {
  found: boolean
  source: GameInstallSource
  platform: GameInstallPlatform
  binariesPath: string | null
  installRoot: string | null
  launcherExe: string | null
  version: string | null
  diskBytes: number | null
  incomplete: boolean
}

export type GameUpdateMethod = 'egl' | 'xbox' | 'store'

export type GameInstallStatus = {
  install: GameInstallSnapshot
  configuredPath: string
  configuredPathValid: boolean
  latestVersion: string | null
  updateAvailable: boolean
  lastCheckedAt: number | null
  updateMethod: GameUpdateMethod
}

export type GameUpdaterResult = {
  ok: boolean
  method: 'egl-exe' | 'egl-protocol' | 'xbox-store' | 'https-store' | 'none'
}

export type GameFolderPickResult = {
  ok: boolean
  path: string | null
  reason: 'canceled' | 'invalid' | 'applied' | null
}

export type GameInstallOpenTarget = 'updater' | 'egl' | 'xbox'
