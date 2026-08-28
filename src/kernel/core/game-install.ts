import nodePath from 'node:path'

import {
  defaultFortniteBinariesPath,
  defaultFortniteInstallRoot,
  defaultXboxGamesRoots,
  eglLauncherInstalledPath,
  eglManifestsDirectory,
  fortniteAppName,
  fortniteBinariesRelativePath,
  fortniteCatalogItemId,
  fortniteCatalogNamespace,
  fortniteLauncherExecutable,
} from '../../config/fortnite/install'
import type {
  GameInstallPlatform,
  GameInstallSnapshot,
  GameInstallSource,
  GameUpdateMethod,
} from '../../types/game-install'

const path = nodePath.win32

export type GameInstallIo = {
  exists: (filePath: string) => Promise<boolean>
  readFile: (filePath: string) => Promise<Buffer>
  readdir: (directoryPath: string) => Promise<Array<string>>
  drives?: Array<string>
}

const binariesRelative = path.join(...fortniteBinariesRelativePath)

const sourceRank: Record<GameInstallSource, number> = {
  settings: 0,
  'egl-manifest': 1,
  'egl-installed': 2,
  'program-files': 3,
  xbox: 4,
  missing: 9,
}

export function missingInstallSnapshot(
  configuredPath?: string
): GameInstallSnapshot {
  const binariesPath = configuredPath ? path.normalize(configuredPath) : null

  return {
    found: false,
    source: 'missing',
    platform: 'unknown',
    binariesPath,
    installRoot: binariesPath
      ? guessInstallRoot(binariesPath)
      : defaultFortniteInstallRoot,
    launcherExe: binariesPath
      ? path.join(binariesPath, fortniteLauncherExecutable)
      : null,
    version: null,
    diskBytes: null,
    incomplete: false,
  }
}

export function guessInstallRoot(binariesPath: string) {
  const normalized = path.normalize(binariesPath)
  const marker = path.normalize(binariesRelative)

  if (normalized.toLowerCase().endsWith(marker.toLowerCase())) {
    return normalized.slice(0, normalized.length - marker.length - 1)
  }

  return normalized
}

export async function resolveFortniteBinariesDir(
  candidate: string,
  exists: GameInstallIo['exists']
) {
  const normalized = path.normalize(candidate)
  const checks = [
    normalized,
    path.join(normalized, binariesRelative),
    path.join(normalized, 'Fortnite', binariesRelative),
    path.join(normalized, 'Content', binariesRelative),
    path.join(normalized, 'Content', 'Fortnite', binariesRelative),
  ]

  for (const directory of checks) {
    if (await exists(path.join(directory, fortniteLauncherExecutable))) {
      return directory
    }
  }

  return null
}

export function parseBuildChangeList(version: string | null | undefined) {
  if (!version) {
    return null
  }

  const match = version.match(/CL-(\d+)/i)

  return match ? Number(match[1]) : null
}

export function isUpdateAvailable(
  localVersion: string | null | undefined,
  latestVersion: string | null | undefined
) {
  if (!latestVersion) {
    return false
  }

  if (!localVersion) {
    return true
  }

  if (localVersion === latestVersion) {
    return false
  }

  const localCl = parseBuildChangeList(localVersion)
  const latestCl = parseBuildChangeList(latestVersion)

  if (localCl !== null && latestCl !== null) {
    return latestCl > localCl
  }

  return localVersion !== latestVersion
}

export function updateMethodFor(
  platform: GameInstallPlatform,
  found: boolean
): GameUpdateMethod {
  if (!found) {
    return 'store'
  }

  return platform === 'xbox' ? 'xbox' : 'egl'
}

export function selectPreferredInstall(
  candidates: Array<GameInstallSnapshot>,
  settingsPathValid: boolean
) {
  const found = candidates.filter((candidate) => candidate.found)

  if (found.length === 0) {
    return missingInstallSnapshot()
  }

  if (settingsPathValid) {
    const configured = found.find((candidate) => candidate.source === 'settings')

    if (configured) {
      return configured
    }
  }

  return [...found].sort(
    (left, right) => sourceRank[left.source] - sourceRank[right.source]
  )[0]
}

type EglItemManifest = {
  AppName?: string
  AppVersionString?: string
  CatalogItemId?: string
  CatalogNamespace?: string
  DisplayName?: string
  InstallLocation?: string
  InstallSize?: number
  LaunchExecutable?: string
  bIsIncompleteInstall?: boolean
}

export function parseEglItemManifest(raw: unknown): GameInstallSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const file = raw as EglItemManifest
  const displayName = file.DisplayName?.trim().toLowerCase() ?? ''
  const appName = file.AppName?.trim().toLowerCase() ?? ''
  const namespace = file.CatalogNamespace?.trim().toLowerCase() ?? ''
  const catalogItemId = file.CatalogItemId?.trim().toLowerCase() ?? ''
  const isFortnite =
    displayName === 'fortnite' ||
    appName === fortniteAppName.toLowerCase() ||
    namespace === fortniteCatalogNamespace ||
    catalogItemId === fortniteCatalogItemId.toLowerCase()

  if (!isFortnite || typeof file.InstallLocation !== 'string') {
    return null
  }

  const installRoot = path.normalize(file.InstallLocation)
  const launchExecutable =
    typeof file.LaunchExecutable === 'string' && file.LaunchExecutable.length > 0
      ? file.LaunchExecutable
      : path.posix.join(...fortniteBinariesRelativePath, fortniteLauncherExecutable)
  const binariesPath = path.normalize(
    path.join(installRoot, path.dirname(launchExecutable.replaceAll('/', path.sep)))
  )

  return {
    found: true,
    source: 'egl-manifest',
    platform: 'egl',
    binariesPath,
    installRoot,
    launcherExe: path.join(binariesPath, fortniteLauncherExecutable),
    version: file.AppVersionString?.trim() || null,
    diskBytes: typeof file.InstallSize === 'number' ? file.InstallSize : null,
    incomplete: file.bIsIncompleteInstall === true,
  }
}

type LauncherInstalledFile = {
  InstallationList?: Array<{
    AppName?: string
    AppVersion?: string
    ArtifactId?: string
    InstallLocation?: string
    ItemId?: string
    NamespaceId?: string
  }>
}

export function parseLauncherInstalled(
  raw: unknown
): Array<GameInstallSnapshot> {
  if (!raw || typeof raw !== 'object') {
    return []
  }

  const file = raw as LauncherInstalledFile
  const list = Array.isArray(file.InstallationList) ? file.InstallationList : []

  return list
    .filter((item) => {
      const namespace = item.NamespaceId?.trim().toLowerCase() ?? ''
      const appName = item.AppName?.trim().toLowerCase() ?? ''
      const artifact = item.ArtifactId?.trim().toLowerCase() ?? ''
      const itemId = item.ItemId?.trim().toLowerCase() ?? ''

      return (
        namespace === fortniteCatalogNamespace ||
        appName === fortniteAppName.toLowerCase() ||
        artifact === fortniteAppName.toLowerCase() ||
        itemId === fortniteCatalogItemId.toLowerCase()
      )
    })
    .flatMap((item) => {
      if (typeof item.InstallLocation !== 'string') {
        return []
      }

      const installRoot = path.normalize(item.InstallLocation)
      const binariesPath = path.join(installRoot, binariesRelative)

      return [
        {
          found: true,
          source: 'egl-installed' as const,
          platform: 'egl' as const,
          binariesPath,
          installRoot,
          launcherExe: path.join(binariesPath, fortniteLauncherExecutable),
          version: item.AppVersion?.trim() || null,
          diskBytes: null,
          incomplete: false,
        },
      ]
    })
}

/**
 * Xbox PC `.GamingRoot` is either a tiny XML document or a UTF-16-LE blob
 * with a 4-byte version prefix. Both just name the games folder on that drive.
 */
export function parseGamingRoot(
  buffer: Buffer,
  driveRoot: string
): string | null {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '')
  const xmlMatch = utf8.match(/<OsRoot>\s*([^<]+?)\s*<\/OsRoot>/i)

  if (xmlMatch?.[1]) {
    return resolveGamingRootPath(xmlMatch[1].trim(), driveRoot)
  }

  const utf16 = buffer
    .toString('utf16le')
    .split('\0')
    .filter((part) => part.trim().length > 0)
    .join(' ')
    .replace(/^\uFEFF/, '')
  const absolute = utf16.match(/[A-Za-z]:\\[^<>:"|?*\n\r]+/)
  const relative = utf16.match(/XboxGames/i)

  if (absolute?.[0]) {
    return path.normalize(absolute[0].trim())
  }

  if (relative) {
    return path.join(driveRoot, 'XboxGames')
  }

  const stripped = utf16.replace(/[^\x20-\x7E\\/_:-]/g, '').trim()

  if (stripped.length > 2) {
    return resolveGamingRootPath(stripped, driveRoot)
  }

  return null
}

function resolveGamingRootPath(value: string, driveRoot: string) {
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return path.normalize(value)
  }

  return path.join(driveRoot, value.replace(/^\\+/, ''))
}

async function snapshotIfLauncherExists(
  candidate: Partial<GameInstallSnapshot> & {
    binariesPath: string
    source: GameInstallSource
    platform: GameInstallPlatform
  },
  io: GameInstallIo
): Promise<GameInstallSnapshot | null> {
  const binariesPath = path.normalize(candidate.binariesPath)
  const launcherExe = path.join(binariesPath, fortniteLauncherExecutable)

  if (!(await io.exists(launcherExe))) {
    return null
  }

  return {
    found: true,
    source: candidate.source,
    platform: candidate.platform,
    binariesPath,
    installRoot: candidate.installRoot ?? guessInstallRoot(binariesPath),
    launcherExe,
    version: candidate.version ?? null,
    diskBytes: candidate.diskBytes ?? null,
    incomplete: candidate.incomplete ?? false,
  }
}

async function readJsonFile(filePath: string, io: GameInstallIo) {
  try {
    return JSON.parse(await io.readFile(filePath).then((buffer) => buffer.toString('utf8')))
  } catch {
    return null
  }
}

async function collectEglManifests(io: GameInstallIo) {
  let filenames: Array<string>

  try {
    filenames = (await io.readdir(eglManifestsDirectory)).filter((filename) =>
      filename.toLowerCase().endsWith('.item')
    )
  } catch {
    return []
  }

  const snapshots: Array<GameInstallSnapshot> = []

  for (const filename of filenames) {
    const parsed = parseEglItemManifest(
      await readJsonFile(path.join(eglManifestsDirectory, filename), io)
    )

    if (!parsed?.installRoot) {
      continue
    }

    const binariesPath =
      (await resolveFortniteBinariesDir(parsed.binariesPath ?? parsed.installRoot, io.exists)) ??
      (await resolveFortniteBinariesDir(parsed.installRoot, io.exists))

    if (!binariesPath) {
      continue
    }

    const verified = await snapshotIfLauncherExists(
      {
        ...parsed,
        binariesPath,
      },
      io
    )

    if (verified) {
      snapshots.push({
        ...verified,
        version: verified.version ?? parsed.version,
        diskBytes: verified.diskBytes ?? parsed.diskBytes,
        incomplete: parsed.incomplete,
      })
    }
  }

  return snapshots
}

async function collectLauncherInstalled(io: GameInstallIo) {
  const parsed = parseLauncherInstalled(
    await readJsonFile(eglLauncherInstalledPath, io)
  )
  const snapshots: Array<GameInstallSnapshot> = []

  for (const candidate of parsed) {
    const binariesPath = candidate.binariesPath

    if (!binariesPath) {
      continue
    }

    const verified = await snapshotIfLauncherExists(
      {
        ...candidate,
        binariesPath,
      },
      io
    )

    if (verified) {
      snapshots.push({
        ...verified,
        version: verified.version ?? candidate.version,
      })
    }
  }

  return snapshots
}

async function collectXboxInstalls(io: GameInstallIo) {
  const roots = new Set<string>(defaultXboxGamesRoots)
  const drives = io.drives ?? []

  for (const drive of drives) {
    const driveRoot = drive.endsWith('\\') ? drive : `${drive}\\`
    roots.add(path.join(driveRoot, 'XboxGames'))
    roots.add(path.join(driveRoot, 'WindowsApps'))

    try {
      const gamingRoot = await io.readFile(path.join(driveRoot, '.GamingRoot'))
      const parsed = parseGamingRoot(gamingRoot, driveRoot)

      if (parsed) {
        roots.add(parsed)
      }
    } catch {
      // Drive has no Xbox layout; skip.
    }
  }

  const programFiles =
    process.env.ProgramFiles ?? process.env.PROGRAMFILES ?? 'C:\\Program Files'
  roots.add(path.join(programFiles, 'WindowsApps'))
  roots.add(path.join(programFiles, 'ModifiableWindowsApps'))

  const snapshots: Array<GameInstallSnapshot> = []

  for (const root of roots) {
    const direct = await resolveFortniteBinariesDir(root, io.exists)

    if (direct) {
      const verified = await snapshotIfLauncherExists(
        {
          binariesPath: direct,
          installRoot: guessInstallRoot(direct),
          source: 'xbox',
          platform: 'xbox',
        },
        io
      )

      if (verified) {
        snapshots.push(verified)
        continue
      }
    }

    let entries: Array<string>

    try {
      entries = await io.readdir(root)
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!/fortnite/i.test(entry)) {
        continue
      }

      const binariesPath = await resolveFortniteBinariesDir(
        path.join(root, entry),
        io.exists
      )

      if (!binariesPath) {
        continue
      }

      const verified = await snapshotIfLauncherExists(
        {
          binariesPath,
          installRoot: guessInstallRoot(binariesPath),
          source: 'xbox',
          platform: 'xbox',
        },
        io
      )

      if (verified) {
        snapshots.push(verified)
      }
    }
  }

  return snapshots
}

export async function scanGameInstalls(
  io: GameInstallIo,
  options: { settingsPath?: string }
) {
  // Custom path wins if FortniteLauncher.exe is there. Otherwise EGL manifests,
  // LauncherInstalled.dat, Program Files, then Xbox/WindowsApps.
  const candidates: Array<GameInstallSnapshot> = []
  const settingsPath = options.settingsPath?.trim()

  if (settingsPath) {
    const binariesPath = await resolveFortniteBinariesDir(
      settingsPath,
      io.exists
    )

    if (binariesPath) {
      const verified = await snapshotIfLauncherExists(
        {
          binariesPath,
          installRoot: guessInstallRoot(binariesPath),
          source: 'settings',
          platform: 'unknown',
        },
        io
      )

      if (verified) {
        candidates.push(verified)
      }
    }
  }

  const [manifests, installed, xbox] = await Promise.all([
    collectEglManifests(io),
    collectLauncherInstalled(io),
    collectXboxInstalls(io),
  ])

  candidates.push(...manifests, ...installed, ...xbox)

  const defaultBinaries = await resolveFortniteBinariesDir(
    defaultFortniteBinariesPath,
    io.exists
  )

  if (defaultBinaries) {
    const verified = await snapshotIfLauncherExists(
      {
        binariesPath: defaultBinaries,
        installRoot: defaultFortniteInstallRoot,
        source: 'program-files',
        platform: 'egl',
      },
      io
    )

    if (verified) {
      candidates.push(verified)
    }
  }

  const seen = new Set<string>()
  const unique = candidates.filter((candidate) => {
    const key = candidate.binariesPath?.toLowerCase()

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })

  const settingsValid = unique.some((candidate) => candidate.source === 'settings')

  return {
    candidates: unique,
    settingsPathValid: settingsValid,
    preferred: selectPreferredInstall(unique, settingsValid),
  }
}

export function decorateInstallPlatform(
  install: GameInstallSnapshot
): GameInstallSnapshot {
  if (install.platform !== 'unknown') {
    return install
  }

  const haystack = `${install.binariesPath ?? ''} ${install.installRoot ?? ''}`.toLowerCase()

  if (haystack.includes('xboxgames') || haystack.includes('windowsapps')) {
    return { ...install, platform: 'xbox' }
  }

  return { ...install, platform: 'egl' }
}
