import nodePath from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  decorateInstallPlatform,
  isUpdateAvailable,
  parseBuildChangeList,
  parseEglItemManifest,
  parseGamingRoot,
  parseLauncherInstalled,
  resolveFortniteBinariesDir,
  scanGameInstalls,
  selectPreferredInstall,
  type GameInstallIo,
} from './game-install'
import type { GameInstallSnapshot } from '../../types/game-install'

const path = nodePath.win32
const launcher = 'FortniteLauncher.exe'

function snapshot(
  partial: Partial<GameInstallSnapshot> & Pick<GameInstallSnapshot, 'source'>
): GameInstallSnapshot {
  return {
    found: true,
    platform: 'egl',
    binariesPath: 'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64',
    installRoot: 'C:\\Program Files\\Epic Games\\Fortnite',
    launcherExe:
      'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe',
    version: '++Fortnite+Release-38.00-CL-100-Windows',
    diskBytes: null,
    incomplete: false,
    ...partial,
  }
}

function memoryIo(files: Record<string, string | Buffer>): GameInstallIo {
  const store = new Map(
    Object.entries(files).map(([filePath, value]) => [
      path.normalize(filePath).toLowerCase(),
      value,
    ])
  )

  return {
    exists: async (filePath) => store.has(path.normalize(filePath).toLowerCase()),
    readFile: async (filePath) => {
      const value = store.get(path.normalize(filePath).toLowerCase())

      if (value === undefined) {
        throw new Error(`missing ${filePath}`)
      }

      return Buffer.isBuffer(value) ? value : Buffer.from(value)
    },
    readdir: async (directoryPath) => {
      const prefix = `${path.normalize(directoryPath)}${path.sep}`.toLowerCase()
      const names = new Set<string>()

      for (const filePath of store.keys()) {
        if (!filePath.startsWith(prefix)) {
          continue
        }

        const rest = filePath.slice(prefix.length)
        const [name] = rest.split(/[\\/]/)

        if (name) {
          names.add(name)
        }
      }

      if (names.size === 0) {
        throw new Error(`missing dir ${directoryPath}`)
      }

      return [...names]
    },
    drives: ['C:', 'D:'],
  }
}

describe('resolveFortniteBinariesDir', () => {
  it('accepts the Win64 folder, the Fortnite root, or an Xbox Content folder', async () => {
    const binaries =
      'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
    const exists = async (filePath: string) =>
      filePath === path.join(binaries, launcher)

    expect(await resolveFortniteBinariesDir(binaries, exists)).toBe(
      path.normalize(binaries)
    )
    expect(
      await resolveFortniteBinariesDir(
        'C:\\Program Files\\Epic Games\\Fortnite',
        exists
      )
    ).toBe(path.normalize(binaries))
    expect(
      await resolveFortniteBinariesDir(
        'C:\\XboxGames\\Fortnite\\Content',
        async (filePath) =>
          filePath ===
          path.join(
            'C:\\XboxGames\\Fortnite\\Content',
            'FortniteGame',
            'Binaries',
            'Win64',
            launcher
          )
      )
    ).toBe(
      path.normalize(
        'C:\\XboxGames\\Fortnite\\Content\\FortniteGame\\Binaries\\Win64'
      )
    )
    expect(await resolveFortniteBinariesDir('C:\\Games', exists)).toBeNull()
  })
})

describe('build version comparison', () => {
  it('reads the changelist and treats a higher Live CL as an update', () => {
    expect(
      parseBuildChangeList('++Fortnite+Release-38.00-CL-47722112-Windows')
    ).toBe(47722112)
    expect(isUpdateAvailable('CL-100', 'CL-200')).toBe(true)
    expect(isUpdateAvailable('CL-200', 'CL-200')).toBe(false)
    expect(isUpdateAvailable('CL-300', 'CL-200')).toBe(false)
    expect(isUpdateAvailable(null, 'CL-200')).toBe(false)
    expect(isUpdateAvailable('CL-200', null)).toBe(false)
  })

  it('does not claim an update when either version cannot be compared', () => {
    expect(isUpdateAvailable(undefined, 'not-a-changelist')).toBe(false)
    expect(isUpdateAvailable('CL-200', undefined)).toBe(false)
  })
})

describe('EGL parsers', () => {
  it('reads InstallLocation, version, and size from an .item manifest', () => {
    const parsed = parseEglItemManifest({
      DisplayName: 'Fortnite',
      AppName: 'Fortnite',
      CatalogNamespace: 'fn',
      CatalogItemId: '4fe75bbc5a674f4f9b356b5c90567da5',
      InstallLocation: 'D:\\Epic Games\\Fortnite',
      AppVersionString: '++Fortnite+Release-38.00-CL-47722112-Windows',
      LaunchExecutable: 'FortniteGame/Binaries/Win64/FortniteLauncher.exe',
      InstallSize: 120_000_000_000,
      bIsIncompleteInstall: false,
    })

    expect(parsed?.source).toBe('egl-manifest')
    expect(parsed?.binariesPath).toBe(
      path.normalize(
        'D:\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
      )
    )
    expect(parsed?.version).toContain('CL-47722112')
    expect(parsed?.diskBytes).toBe(120_000_000_000)
  })

  it('ignores non-Fortnite EGL items', () => {
    expect(
      parseEglItemManifest({
        DisplayName: 'Rocket League',
        InstallLocation: 'C:\\Program Files\\Epic Games\\RocketLeague',
      })
    ).toBeNull()
  })

  it('reads Fortnite from LauncherInstalled.dat', () => {
    const parsed = parseLauncherInstalled({
      InstallationList: [
        {
          InstallLocation: 'C:\\Program Files\\Epic Games\\Fortnite',
          NamespaceId: 'fn',
          ItemId: '4fe75bbc5a674f4f9b356b5c90567da5',
          AppVersion: '++Fortnite+Release-37.50-CL-1-Windows',
          AppName: 'Fortnite',
        },
        {
          InstallLocation: 'C:\\Program Files\\Epic Games\\Other',
          NamespaceId: 'ue',
        },
      ],
    })

    expect(parsed).toHaveLength(1)
    expect(parsed[0].source).toBe('egl-installed')
    expect(parsed[0].binariesPath).toContain('Win64')
  })
})

describe('Xbox GamingRoot', () => {
  it('parses XML and UTF-16-LE Xbox games folders', () => {
    expect(
      parseGamingRoot(
        Buffer.from('<GamingRoot><OsRoot>D:\\XboxGames</OsRoot></GamingRoot>'),
        'D:\\'
      )
    ).toBe(path.normalize('D:\\XboxGames'))

    const utf16 = Buffer.from(`\u0001\u0000C:\\XboxGames\u0000`, 'utf16le')

    expect(parseGamingRoot(utf16, 'C:\\')?.toLowerCase()).toContain('xboxgames')
  })
})

describe('selectPreferredInstall', () => {
  it('keeps a valid custom path ahead of EGL and Xbox copies', () => {
    const settings = snapshot({
      source: 'settings',
      binariesPath: 'E:\\Custom\\Fortnite\\FortniteGame\\Binaries\\Win64',
    })
    const egl = snapshot({ source: 'egl-manifest' })
    const xbox = snapshot({
      source: 'xbox',
      platform: 'xbox',
      binariesPath: 'C:\\XboxGames\\Fortnite\\Content\\FortniteGame\\Binaries\\Win64',
    })

    expect(selectPreferredInstall([settings, egl, xbox], true).source).toBe(
      'settings'
    )
    expect(selectPreferredInstall([egl, xbox], false).source).toBe(
      'egl-manifest'
    )
    expect(selectPreferredInstall([xbox], false).source).toBe('xbox')
    expect(selectPreferredInstall([], false).found).toBe(false)
  })
})

describe('scanGameInstalls', () => {
  it('finds Fortnite from EGL manifests, Program Files, and Xbox folders', async () => {
    const eglBinaries =
      'D:\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
    const xboxBinaries =
      'C:\\XboxGames\\Fortnite\\Content\\FortniteGame\\Binaries\\Win64'
    const defaultBinaries =
      'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
    const io = memoryIo({
      [`${eglBinaries}\\${launcher}`]: '',
      [`${xboxBinaries}\\${launcher}`]: '',
      [`${defaultBinaries}\\${launcher}`]: '',
      'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests\\fortnite.item':
        JSON.stringify({
          DisplayName: 'Fortnite',
          AppName: 'Fortnite',
          CatalogNamespace: 'fn',
          InstallLocation: 'D:\\Epic Games\\Fortnite',
          AppVersionString: '++Fortnite+Release-38.00-CL-9-Windows',
          LaunchExecutable: 'FortniteGame/Binaries/Win64/FortniteLauncher.exe',
          InstallSize: 80,
        }),
      'C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat':
        JSON.stringify({
          InstallationList: [
            {
              InstallLocation: 'D:\\Epic Games\\Fortnite',
              NamespaceId: 'fn',
              AppVersion: '++Fortnite+Release-38.00-CL-9-Windows',
            },
          ],
        }),
    })

    const scan = await scanGameInstalls(io, {})

    expect(scan.preferred.source).toBe('egl-manifest')
    expect(scan.preferred.diskBytes).toBe(80)
    expect(scan.candidates.map((item) => item.source)).toEqual(
      expect.arrayContaining(['egl-manifest', 'xbox', 'program-files'])
    )
  })

  it('uses the configured folder when FortniteLauncher.exe is there', async () => {
    const custom =
      'E:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
    const io = memoryIo({
      [`${custom}\\${launcher}`]: '',
      'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe':
        '',
    })
    const scan = await scanGameInstalls(io, { settingsPath: custom })

    expect(scan.settingsPathValid).toBe(true)
    expect(scan.preferred.source).toBe('settings')
    expect(scan.preferred.binariesPath).toBe(path.normalize(custom))
  })

  it('adds EGL version metadata to the matching configured folder', async () => {
    const custom = 'E:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64'
    const io = memoryIo({
      [`${custom}\\${launcher}`]: '',
      'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests\\fortnite.item':
        JSON.stringify({
          DisplayName: 'Fortnite',
          AppName: 'Fortnite',
          CatalogNamespace: 'fn',
          InstallLocation: 'E:\\Games\\Fortnite',
          AppVersionString: '++Fortnite+Release-38.00-CL-47722112-Windows',
          LaunchExecutable: 'FortniteGame/Binaries/Win64/FortniteLauncher.exe',
          InstallSize: 120_000_000_000,
        }),
    })

    const scan = await scanGameInstalls(io, { settingsPath: custom })

    expect(scan.preferred.source).toBe('settings')
    expect(scan.preferred.platform).toBe('egl')
    expect(scan.preferred.version).toContain('CL-47722112')
    expect(scan.preferred.diskBytes).toBe(120_000_000_000)
  })

  it('returns a missing snapshot when no launcher exists', async () => {
    const scan = await scanGameInstalls(memoryIo({}), {
      settingsPath: 'C:\\missing',
    })

    expect(scan.preferred.found).toBe(false)
    expect(scan.settingsPathValid).toBe(false)
  })
})

describe('decorateInstallPlatform', () => {
  it('labels Xbox and EGL paths from the folder they live in', () => {
    expect(
      decorateInstallPlatform(
        snapshot({
          source: 'settings',
          platform: 'unknown',
          binariesPath:
            'C:\\XboxGames\\Fortnite\\Content\\FortniteGame\\Binaries\\Win64',
        })
      ).platform
    ).toBe('xbox')
    expect(
      decorateInstallPlatform(
        snapshot({
          source: 'settings',
          platform: 'unknown',
        })
      ).platform
    ).toBe('egl')
  })
})
