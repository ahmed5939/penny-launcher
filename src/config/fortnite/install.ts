/**
 * Official Fortnite install / store locations. Detection uses these as
 * hints; launch still requires FortniteLauncher.exe on disk.
 */
export const fortniteLauncherExecutable = 'FortniteLauncher.exe'

export const fortniteBinariesRelativePath = [
  'FortniteGame',
  'Binaries',
  'Win64',
] as const

export const fortniteCatalogNamespace = 'fn'

export const fortniteCatalogItemId = '4fe75bbc5a674f4f9b356b5c90567da5'

export const fortniteAppName = 'Fortnite'

export const defaultFortniteBinariesPath =
  'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64'

export const defaultFortniteInstallRoot =
  'C:\\Program Files\\Epic Games\\Fortnite'

export const eglManifestsDirectory =
  'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests'

export const eglLauncherInstalledPath =
  'C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat'

export const eglLauncherExecutables = [
  'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
  'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe',
  'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
] as const

/**
 * EGL protocol that opens Fortnite in the official launcher. If the build
 * is behind Live, EGL updates it; Penny never fetches game chunks itself.
 */
export const eglFortniteAppUri =
  `com.epicgames.launcher://apps/fn%3A${fortniteCatalogItemId}%3AFortnite?action=launch`

export const eglFortniteStoreUrl = 'https://store.epicgames.com/p/fortnite'

/** Xbox / Microsoft Store product id for Fortnite (Play Anywhere, Nov 2025+). */
export const xboxFortniteProductId = 'BT5P2X999VH2'

export const xboxFortniteStoreUri = `ms-windows-store://pdp/?productid=${xboxFortniteProductId}`

export const xboxFortniteStoreUrl = `https://www.xbox.com/games/store/fortnite/${xboxFortniteProductId}`

export const defaultXboxGamesRoots = [
  'C:\\XboxGames',
  'D:\\XboxGames',
  'E:\\XboxGames',
] as const
