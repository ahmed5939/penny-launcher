import type {
  FnLaunchFileData,
  FnLaunchSettings,
  GameSettings,
  GameSettingsBackup,
  GameSettingsResult,
  GameSettingsSaveResult,
  ProcessKillEntry,
} from '../../types/fn-launch'

import { execFile } from 'node:child_process'
import { access, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import {
  applyGameSettings,
  gameUserSettingsRelativePath,
  readGameSettings,
  sanitizeGameSettings,
} from './game-user-settings'
import { DataDirectory } from '../startup/data-directory'
import { RuntimeLog } from '../runtime-log'

/**
 * FN Launch Settings — backend.
 *
 * Handles:
 *  - Auto-detecting & caching the GameUserSettings.ini path
 *  - Reading/writing Fortnite graphics + display settings, always taking a
 *    backup of the file first (INI text handling lives in
 *    `./game-user-settings`)
 *  - Launch arguments appended to the game's command line
 *  - The process killer (terminates chosen processes while the game runs)
 */

// ── INI path discovery ────────────────────────────────────────

const iniRelativePath = path.join(...gameUserSettingsRelativePath)

/** One rolling copy of the file as it was before Penny's last write. */
const backupSuffix = '.penny.bak'

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)

    return true
  } catch {
    return false
  }
}

/**
 * `%LOCALAPPDATA%`. Electron has no `getPath` key for it — `appData` is
 * Roaming — so read the environment first and derive Local from Roaming's
 * sibling only if the variable is missing.
 */
function localAppDataPath(): string | null {
  if (process.env.LOCALAPPDATA) {
    return process.env.LOCALAPPDATA
  }

  try {
    const roaming = app.getPath('appData')

    return roaming.toLowerCase().endsWith(`${path.sep}roaming`)
      ? path.join(path.dirname(roaming), 'Local')
      : null
  } catch {
    return null
  }
}

async function findIniPath(): Promise<string | null> {
  const stored = await DataDirectory.getFnLaunchFile()

  if (stored.iniPath && (await fileExists(stored.iniPath))) {
    return stored.iniPath
  }

  const localAppData = localAppDataPath()

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

// ── Backups ───────────────────────────────────────────────────

function backupPathFor(iniPath: string): string {
  return `${iniPath}${backupSuffix}`
}

async function describeBackup(iniPath: string): Promise<GameSettingsBackup> {
  const backupPath = backupPathFor(iniPath)

  try {
    const { mtimeMs } = await stat(backupPath)

    return { exists: true, path: backupPath, savedAt: Math.round(mtimeMs) }
  } catch {
    return { exists: false, path: backupPath, savedAt: null }
  }
}

/**
 * Copy the file as it is right now, before anything is written over it.
 * A failed backup aborts the save — the point of the backup is that the
 * previous file is never the only copy.
 */
async function writeBackup(iniPath: string, content: string): Promise<void> {
  await writeFile(backupPathFor(iniPath), content, 'utf-8')
}

// ── Game settings ─────────────────────────────────────────────

/**
 * UE writes this file with CRLF. Editing happens on LF-normalised text, so
 * put the original line endings back rather than rewriting every line.
 */
function restoreLineEndings(content: string, usedCrlf: boolean): string {
  return usedCrlf ? content.replace(/\n/g, '\r\n') : content
}

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

    return {
      success: true,
      settings: readGameSettings(content),
      iniPath,
      backup: await describeBackup(iniPath),
      gameRunning: await isGameRunning(),
    }
  } catch (error) {
    RuntimeLog.error('caught:core/fn-launch.ts', error)

    return { success: false, error: 'Failed to read the game settings file.' }
  }
}

export async function saveGameSettings(
  partial: Partial<GameSettings>
): Promise<GameSettingsSaveResult> {
  try {
    const iniPath = await findIniPath()

    if (!iniPath) {
      return { success: false, error: 'GameUserSettings.ini not found.' }
    }

    const changes = sanitizeGameSettings(partial)

    if (Object.keys(changes).length === 0) {
      return { success: false, error: 'No valid settings to save.' }
    }

    const original = await readFile(iniPath, 'utf-8')

    await writeBackup(iniPath, original)

    const usedCrlf = original.includes('\r\n')
    const content = applyGameSettings(
      original.replace(/\r\n/g, '\n'),
      changes
    )

    await writeFile(iniPath, restoreLineEndings(content, usedCrlf), 'utf-8')

    return { success: true, backup: await describeBackup(iniPath) }
  } catch (error) {
    RuntimeLog.error('caught:core/fn-launch.ts', error)

    return { success: false, error: 'Failed to save the game settings file.' }
  }
}

/** Put back the copy taken before Penny's last write. */
export async function restoreGameSettingsBackup(): Promise<GameSettingsSaveResult> {
  try {
    const iniPath = await findIniPath()

    if (!iniPath) {
      return { success: false, error: 'GameUserSettings.ini not found.' }
    }

    const backupPath = backupPathFor(iniPath)

    if (!(await fileExists(backupPath))) {
      return { success: false, error: 'There is no backup to restore.' }
    }

    await writeFile(iniPath, await readFile(backupPath, 'utf-8'), 'utf-8')

    return { success: true, backup: await describeBackup(iniPath) }
  } catch (error) {
    RuntimeLog.error('caught:core/fn-launch.ts', error)

    return { success: false, error: 'Failed to restore the backup.' }
  }
}

// ── Launch settings (args + process killer) ───────────────────

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
