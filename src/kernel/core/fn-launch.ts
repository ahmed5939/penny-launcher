import type {
  FnLaunchFileData,
  FnLaunchSettings,
  GameSettings,
  GameSettingsResult,
  ProcessKillEntry,
} from '../../types/fn-launch'

import { execFile } from 'node:child_process'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { DataDirectory } from '../startup/data-directory'
import { RuntimeLog } from '../runtime-log'

/**
 * FN Launch Settings — backend.
 *
 * Handles:
 *  - Auto-detecting & caching the GameUserSettings.ini path
 *  - Parsing/writing INI key=value pairs (section-aware)
 *  - Reading/writing Fortnite graphics + display settings
 *  - Launch arguments appended to the game's command line
 *  - The process killer (terminates chosen processes while the game runs)
 */

// ── INI parsing ───────────────────────────────────────────────

/** Parse an INI file into `section → key → value`. First occurrence wins. */
function parseIni(content: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>()
  let currentSection = ''
  sections.set(currentSection, new Map())

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith(';')) continue

    const sectionMatch = trimmed.match(/^\[(.+)\]$/)

    if (sectionMatch) {
      currentSection = sectionMatch[1]

      if (!sections.has(currentSection)) {
        sections.set(currentSection, new Map())
      }

      continue
    }

    const eqIndex = trimmed.indexOf('=')

    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex)
      const value = trimmed.substring(eqIndex + 1)
      const sectionMap = sections.get(currentSection)

      if (sectionMap && !sectionMap.has(key)) {
        sectionMap.set(key, value)
      }
    }
  }

  return sections
}

/**
 * Set a value in an INI file string. If the key exists under the section it
 * is replaced in place; otherwise it is appended to the section — or the
 * section is created at the end of the file.
 */
function setIniValue(
  content: string,
  section: string,
  key: string,
  value: string
): string {
  const lines = content.split('\n')
  let inSection = false
  let lastKeyLineInSection = -1
  let sectionStartLine = -1

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    const sectionMatch = trimmed.match(/^\[(.+)\]$/)

    if (sectionMatch) {
      if (inSection) {
        // Left the target section without meeting the key: insert here.
        break
      }

      if (sectionMatch[1] === section) {
        inSection = true
        sectionStartLine = index
      }

      continue
    }

    if (inSection && trimmed.startsWith(`${key}=`)) {
      lines[index] = `${key}=${value}`

      return lines.join('\n')
    }

    if (inSection && trimmed && !trimmed.startsWith(';')) {
      lastKeyLineInSection = index
    }
  }

  if (sectionStartLine >= 0 && lastKeyLineInSection >= 0) {
    lines.splice(lastKeyLineInSection + 1, 0, `${key}=${value}`)
  } else if (sectionStartLine >= 0) {
    lines.splice(sectionStartLine + 1, 0, `${key}=${value}`)
  } else {
    lines.push('', `[${section}]`, `${key}=${value}`)
  }

  return lines.join('\n')
}

function readValue(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback = ''
): string {
  return sections.get(section)?.get(key) ?? fallback
}

function readNumber(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback: number
): number {
  const parsed = Number.parseFloat(readValue(sections, section, key))

  return Number.isFinite(parsed) ? parsed : fallback
}

function readBool(
  sections: Map<string, Map<string, string>>,
  section: string,
  key: string,
  fallback = false
): boolean {
  const value = readValue(sections, section, key)

  return value === '' ? fallback : value.toLowerCase() === 'true'
}

// ── INI path discovery ────────────────────────────────────────

const iniRelativePath = path.join(
  'FortniteGame',
  'Saved',
  'Config',
  'WindowsClient',
  'GameUserSettings.ini'
)

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)

    return true
  } catch {
    return false
  }
}

async function localAppDataPath(): Promise<string | null> {
  try {
    return app.getPath('localAppData')
  } catch {
    return process.env.LOCALAPPDATA ?? null
  }
}

async function findIniPath(): Promise<string | null> {
  const stored = await DataDirectory.getFnLaunchFile()

  if (stored.iniPath && (await fileExists(stored.iniPath))) {
    return stored.iniPath
  }

  const localAppData = await localAppDataPath()

  if (!localAppData) {
    return null
  }

  const candidate = path.join(localAppData, iniRelativePath)

  if (await fileExists(candidate)) {
    const existing = await DataDirectory.getFnLaunchFile()

    await DataDirectory.updateFnLaunchFile({
      ...existing,
      iniPath: candidate,
    })

    return candidate
  }

  return null
}

// ── Game settings ─────────────────────────────────────────────

const fortSection = '/Script/FortniteGame.FortGameUserSettings'
const scalabilitySection = 'ScalabilityGroups'
const rhiSection = 'D3DRHIPreference'
const performanceSection = 'PerformanceMode'

export async function getGameSettings(): Promise<GameSettingsResult> {
  try {
    const iniPath = await findIniPath()

    if (!iniPath) {
      return {
        success: false,
        error:
          'GameUserSettings.ini not found. Launch Fortnite once and try again.',
      }
    }

    const content = await readFile(iniPath, 'utf-8')
    const sections = parseIni(content.replace(/\r\n/g, '\n'))

    // Performance mode is DX11 with `[PerformanceMode] MeshQuality` present.
    const meshQuality = readValue(sections, performanceSection, 'MeshQuality')
    const preferredRhi =
      readValue(sections, rhiSection, 'PreferredRHI', 'dx12') || 'dx12'
    const renderingMode = meshQuality !== '' ? 'performance' : preferredRhi

    const settings: GameSettings = {
      // Display
      resolutionX: Math.round(
        readNumber(sections, fortSection, 'ResolutionSizeX', 1920)
      ),
      resolutionY: Math.round(
        readNumber(sections, fortSection, 'ResolutionSizeY', 1080)
      ),
      windowMode: Math.round(
        readNumber(sections, fortSection, 'PreferredFullscreenMode', 1)
      ),
      vsync: readBool(sections, fortSection, 'bUseVSync'),
      frameRateLimit: readNumber(sections, fortSection, 'FrameRateLimit', 240),
      renderingMode,

      // Graphics
      displayGamma: readNumber(sections, fortSection, 'DisplayGamma', 2.2),
      userInterfaceContrast: readNumber(
        sections,
        fortSection,
        'UserInterfaceContrast',
        1.0
      ),
      motionBlur: readBool(sections, fortSection, 'bMotionBlur'),
      uiParallax: readBool(sections, fortSection, 'bAllowUIParallax'),
      showFps: readBool(sections, fortSection, 'bShowFPS'),

      // Graphics quality
      viewDistance: Math.round(
        readNumber(sections, scalabilitySection, 'sg.ViewDistanceQuality', 3)
      ),
      shadows: Math.round(
        readNumber(sections, scalabilitySection, 'sg.ShadowQuality', 3)
      ),
      antiAliasingQuality: Math.round(
        readNumber(sections, scalabilitySection, 'sg.AntiAliasingQuality', 3)
      ),
      textures: Math.round(
        readNumber(sections, scalabilitySection, 'sg.TextureQuality', 3)
      ),
      effects: Math.round(
        readNumber(sections, scalabilitySection, 'sg.EffectsQuality', 3)
      ),
      postProcess: Math.round(
        readNumber(sections, scalabilitySection, 'sg.PostProcessQuality', 3)
      ),
      globalIllumination: Math.round(
        readNumber(
          sections,
          scalabilitySection,
          'sg.GlobalIlluminationQuality',
          1
        )
      ),
      reflections: Math.round(
        readNumber(sections, scalabilitySection, 'sg.ReflectionQuality', 1)
      ),
      foliage: Math.round(
        readNumber(sections, scalabilitySection, 'sg.FoliageQuality', 3)
      ),
      resolutionQuality: Math.round(
        readNumber(sections, scalabilitySection, 'sg.ResolutionQuality', 100)
      ),

      // Advanced graphics quality
      antiAliasingMethod: readValue(
        sections,
        fortSection,
        'FortAntiAliasingMethod',
        'TSRMedium'
      ),
      tsrQuality: readValue(
        sections,
        fortSection,
        'TemporalSuperResolutionQuality',
        'Quality'
      ),
      dynamicResolution: readBool(
        sections,
        fortSection,
        'bUseDynamicResolution'
      ),
      nanite: readBool(sections, fortSection, 'bUseNanite'),
      desiredGIQuality: Math.round(
        readNumber(
          sections,
          fortSection,
          'DesiredGlobalIlluminationQuality',
          1
        )
      ),
      desiredReflectionQuality: Math.round(
        readNumber(sections, fortSection, 'DesiredReflectionQuality', 1)
      ),
      rayTracing: readBool(sections, fortSection, 'bRayTracing'),
      showGrass: readBool(sections, fortSection, 'bShowGrass', true),
    }

    return { success: true, settings, iniPath }
  } catch (error) {
    RuntimeLog.error('caught:core/fn-launch.ts', error)

    return { success: false, error: 'Failed to read the game settings file.' }
  }
}

export async function saveGameSettings(
  partial: Partial<GameSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const iniPath = await findIniPath()

    if (!iniPath) {
      return { success: false, error: 'GameUserSettings.ini not found.' }
    }

    let content = (await readFile(iniPath, 'utf-8')).replace(/\r\n/g, '\n')

    // Display
    if (partial.resolutionX !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'ResolutionSizeX',
        `${partial.resolutionX}`
      )
      content = setIniValue(
        content,
        fortSection,
        'LastUserConfirmedResolutionSizeX',
        `${partial.resolutionX}`
      )
    }

    if (partial.resolutionY !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'ResolutionSizeY',
        `${partial.resolutionY}`
      )
      content = setIniValue(
        content,
        fortSection,
        'LastUserConfirmedResolutionSizeY',
        `${partial.resolutionY}`
      )
    }

    if (partial.windowMode !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'PreferredFullscreenMode',
        `${partial.windowMode}`
      )
      content = setIniValue(
        content,
        fortSection,
        'LastConfirmedFullscreenMode',
        `${partial.windowMode}`
      )
    }

    if (partial.vsync !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bUseVSync',
        partial.vsync ? 'True' : 'False'
      )
    }

    if (partial.frameRateLimit !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'FrameRateLimit',
        partial.frameRateLimit.toFixed(6)
      )
    }

    if (partial.renderingMode !== undefined) {
      if (partial.renderingMode === 'performance') {
        content = setIniValue(content, rhiSection, 'PreferredRHI', 'dx11')
        content = setIniValue(content, performanceSection, 'MeshQuality', '0')
      } else {
        content = setIniValue(
          content,
          rhiSection,
          'PreferredRHI',
          partial.renderingMode
        )
        // Leave no stale MeshQuality behind: it is what marks performance mode.
        content = content.replace(
          /\[PerformanceMode\]\s*\nMeshQuality=\d+\s*\n?/,
          '[PerformanceMode]\n'
        )
      }
    }

    // Graphics
    if (partial.displayGamma !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'DisplayGamma',
        partial.displayGamma.toFixed(6)
      )
    }

    if (partial.userInterfaceContrast !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'UserInterfaceContrast',
        partial.userInterfaceContrast.toFixed(6)
      )
    }

    if (partial.motionBlur !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bMotionBlur',
        partial.motionBlur ? 'True' : 'False'
      )
    }

    if (partial.uiParallax !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bAllowUIParallax',
        partial.uiParallax ? 'True' : 'False'
      )
    }

    if (partial.showFps !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bShowFPS',
        partial.showFps ? 'True' : 'False'
      )
    }

    // Graphics quality
    if (partial.viewDistance !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.ViewDistanceQuality',
        `${partial.viewDistance}`
      )
    }

    if (partial.shadows !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.ShadowQuality',
        `${partial.shadows}`
      )
    }

    if (partial.antiAliasingQuality !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.AntiAliasingQuality',
        `${partial.antiAliasingQuality}`
      )
    }

    if (partial.textures !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.TextureQuality',
        `${partial.textures}`
      )
    }

    if (partial.effects !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.EffectsQuality',
        `${partial.effects}`
      )
    }

    if (partial.postProcess !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.PostProcessQuality',
        `${partial.postProcess}`
      )
    }

    if (partial.globalIllumination !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.GlobalIlluminationQuality',
        `${partial.globalIllumination}`
      )
    }

    if (partial.reflections !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.ReflectionQuality',
        `${partial.reflections}`
      )
    }

    if (partial.foliage !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.FoliageQuality',
        `${partial.foliage}`
      )
    }

    if (partial.resolutionQuality !== undefined) {
      content = setIniValue(
        content,
        scalabilitySection,
        'sg.ResolutionQuality',
        `${partial.resolutionQuality}`
      )
    }

    // Advanced graphics quality
    if (partial.antiAliasingMethod !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'FortAntiAliasingMethod',
        partial.antiAliasingMethod
      )
    }

    if (partial.tsrQuality !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'TemporalSuperResolutionQuality',
        partial.tsrQuality
      )
    }

    if (partial.dynamicResolution !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bUseDynamicResolution',
        partial.dynamicResolution ? 'True' : 'False'
      )
    }

    if (partial.nanite !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bUseNanite',
        partial.nanite ? 'True' : 'False'
      )
    }

    if (partial.desiredGIQuality !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'DesiredGlobalIlluminationQuality',
        `${partial.desiredGIQuality}`
      )
    }

    if (partial.desiredReflectionQuality !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'DesiredReflectionQuality',
        `${partial.desiredReflectionQuality}`
      )
    }

    if (partial.rayTracing !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bRayTracing',
        partial.rayTracing ? 'True' : 'False'
      )
    }

    if (partial.showGrass !== undefined) {
      content = setIniValue(
        content,
        fortSection,
        'bShowGrass',
        partial.showGrass ? 'True' : 'False'
      )
    }

    await writeFile(iniPath, content, 'utf-8')

    return { success: true }
  } catch (error) {
    RuntimeLog.error('caught:core/fn-launch.ts', error)

    return { success: false, error: 'Failed to save the game settings file.' }
  }
}

// ── Launch settings (args + process killer) ───────────────────

const defaultLaunchSettings: FnLaunchSettings = {
  launchArgs: '',
  processKiller: { enabled: false, processes: [] },
}

export async function getLaunchSettings(): Promise<FnLaunchSettings> {
  const data = await DataDirectory.getFnLaunchFile()

  return {
    launchArgs: data.launchArgs,
    processKiller: data.processKiller,
  }
}

export async function saveLaunchSettings(
  settings: FnLaunchSettings
): Promise<void> {
  const existing = await DataDirectory.getFnLaunchFile()

  await DataDirectory.updateFnLaunchFile({
    ...existing,
    launchArgs: settings.launchArgs,
    processKiller: settings.processKiller,
  })
}

// ── Process killer engine ─────────────────────────────────────

const startupKillWindowMs = 3 * 60 * 1000
const startupKillIntervalMs = 15 * 1000
const alwaysKillIntervalMs = 30 * 1000
const gameExecutable = 'FortniteClient-Win64-Shipping.exe'

let startupKillTimer: NodeJS.Timeout | null = null
let startupStopTimer: NodeJS.Timeout | null = null
let alwaysKillTimer: NodeJS.Timeout | null = null

function isWindows() {
  return process.platform === 'win32'
}

function isPlausibleProcessName(name: string): boolean {
  return /^[A-Za-z0-9_.\- ]{1,128}$/.test(name)
}

function killProcess(name: string): void {
  if (!isWindows() || !isPlausibleProcessName(name)) {
    return
  }

  execFile('taskkill', ['/F', '/IM', name, '/T'], (error) => {
    if (error && error.code !== 128) {
      // 128 = no matching process; anything else is worth a line in the log.
      RuntimeLog.error('fn-launch:taskkill', error)
    }
  })
}

function isGameRunning(): Promise<boolean> {
  if (!isWindows()) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', `IMAGENAME eq ${gameExecutable}`, '/NH'],
      (error, stdout) => {
        resolve(!error && stdout.includes(gameExecutable))
      }
    )
  })
}

/**
 * Begin killing the configured processes for this game session. Safe to call
 * on every launch — any previous schedule is stopped first.
 */
export async function startProcessKiller(): Promise<void> {
  stopProcessKiller()

  const { processKiller } = await getLaunchSettings()

  if (!processKiller.enabled || isWindows() === false) {
    return
  }

  const startupProcesses = processKiller.processes.filter(
    (entry: ProcessKillEntry) => entry.mode === 'startup'
  )
  const alwaysProcesses = processKiller.processes.filter(
    (entry: ProcessKillEntry) => entry.mode === 'always'
  )

  // Startup mode: kill immediately, then every 15s for the first 3 minutes.
  if (startupProcesses.length > 0) {
    const runStartupKills = () => {
      for (const entry of startupProcesses) {
        killProcess(entry.name)
      }
    }

    runStartupKills()

    startupKillTimer = setInterval(runStartupKills, startupKillIntervalMs)
    startupStopTimer = setTimeout(() => {
      if (startupKillTimer) {
        clearInterval(startupKillTimer)
        startupKillTimer = null
      }

      startupStopTimer = null
    }, startupKillWindowMs)
  }

  // Always mode: kill now and every 30s while the game is running; the
  // schedule ends itself once the game closes.
  if (alwaysProcesses.length > 0) {
    const runAlwaysKills = () => {
      for (const entry of alwaysProcesses) {
        killProcess(entry.name)
      }
    }

    runAlwaysKills()

    alwaysKillTimer = setInterval(async () => {
      if (await isGameRunning()) {
        runAlwaysKills()
      } else {
        stopProcessKiller()
      }
    }, alwaysKillIntervalMs)
  }
}

export function stopProcessKiller(): void {
  if (startupKillTimer) {
    clearInterval(startupKillTimer)
    startupKillTimer = null
  }

  if (startupStopTimer) {
    clearTimeout(startupStopTimer)
    startupStopTimer = null
  }

  if (alwaysKillTimer) {
    clearInterval(alwaysKillTimer)
    alwaysKillTimer = null
  }
}

// Re-exported so main.ts can treat this module as the single surface.
export type { FnLaunchFileData }
