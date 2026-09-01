import type { BrowserWindowConstructorOptions } from 'electron'
import type {
  OverlayPlayer,
  OverlayQuest,
  OverlayQuestGroup,
  OverlaySnapshot,
} from '../../../types/overlay'
import type { PennyDBProfileResponse } from '../../../services/endpoints/pennydb'

import path from 'node:path'
import {
  BrowserWindow,
  globalShortcut,
  screen,
} from 'electron'

import { ElectronAPIEventKeys } from '../../../config/constants/main-process'
import { getPennyDBProfile } from '../../../services/endpoints/pennydb'
import { RuntimeLog } from '../../runtime-log'

const toggleShortcut = 'Control+Shift+Q'
const refreshInterval = 5 * 60_000
const maximumPlayers = 4
const maximumQuestsPerPlayer = 18

type AccountScope = {
  primary: string | null
  members: Array<string>
}

type QuestSource = {
  group: OverlayQuestGroup
  value: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const optionalNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const readableQuestName = (value: string) =>
  value
    .replace(/^quest:/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

function questEntries(source: QuestSource): Array<OverlayQuest> {
  if (!isRecord(source.value)) return []

  return Object.entries(source.value).flatMap(([id, raw]) => {
    if (!isRecord(raw)) return []

    const completion = isRecord(raw.completion_data)
      ? Object.values(raw.completion_data)
          .map(optionalNumber)
          .filter((value): value is number => value !== undefined)
      : []
    const current =
      optionalNumber(raw.current_total) ??
      optionalNumber(raw.current) ??
      (completion.length > 0
        ? completion.reduce((total, value) => total + value, 0)
        : undefined)
    const total =
      optionalNumber(raw.total_required) ?? optionalNumber(raw.total)

    return [
      {
        id,
        name:
          optionalString(raw.name) ??
          optionalString(raw.display_name) ??
          readableQuestName(id),
        description: optionalString(raw.description),
        group: source.group,
        current,
        total,
      },
    ]
  })
}

function questsFromProfile(data: PennyDBProfileResponse) {
  const sources: Array<QuestSource> = [
    { group: 'daily', value: data.daily_mission_data },
    { group: 'ventures', value: data.live_ventures_quests },
    { group: 'weekly', value: data.live_weekly_quests },
    { group: 'storm-shield', value: data.live_stormshield_quests },
    { group: 'wargames', value: data.live_wargames_quests },
    { group: 'dungeons', value: data.live_dungeons_quests },
    { group: 'endurance', value: data.live_endurance_daily_quest },
    { group: 'active', value: data.active_quests },
  ]
  const seen = new Set<string>()

  return sources
    .flatMap(questEntries)
    .filter((quest) => {
      const key = quest.name.toLocaleLowerCase()

      if (seen.has(key)) return false
      seen.add(key)

      return true
    })
    .slice(0, maximumQuestsPerPlayer)
}

function missionPlayers(data: PennyDBProfileResponse) {
  const players = data.what_mission_data?.players

  if (!isRecord(players)) return []

  return Object.values(players)
    .map(optionalString)
    .filter((value): value is string => value !== undefined)
}

function toOverlayPlayer(
  requestedName: string,
  data: PennyDBProfileResponse
): OverlayPlayer {
  const mission = data.what_mission_data
  const details = [mission?.zone, mission?.difficulty && `PL ${mission.difficulty}`]
    .filter(Boolean)
    .join(' · ')

  return {
    displayName: data.profile_summary?.display_name ?? requestedName,
    mission: mission?.mission_playing,
    missionDetails: details || undefined,
    quests: questsFromProfile(data),
    ventureLevel:
      data.ventures_data?.current_venture_level === undefined
        ? undefined
        : String(data.ventures_data.current_venture_level),
    venturePowerLevel: data.ventures_data?.venture_power_level,
  }
}

export class OverlayWindow {
  private static value: BrowserWindow | null = null
  private static scope: AccountScope = { primary: null, members: [] }
  private static timer: NodeJS.Timeout | null = null
  private static refreshing: Promise<void> | null = null

  static async start() {
    if (process.platform !== 'win32' || OverlayWindow.value) return

    const options: BrowserWindowConstructorOptions = {
      width: 430,
      height: 760,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      focusable: false,
      fullscreenable: false,
      hasShadow: false,
      resizable: false,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: true,
        devTools: false,
        nodeIntegration: false,
        preload: path.join(__dirname, 'overlay-preload.js'),
        sandbox: true,
        spellcheck: false,
        webSecurity: true,
        additionalArguments: ['--penny-overlay=1', '--penny-theme=dark'],
      },
    }
    const window = new BrowserWindow(options)

    OverlayWindow.value = window
    window.setIgnoreMouseEvents(true, { forward: true })
    window.setAlwaysOnTop(true, 'pop-up-menu')
    window.setContentProtection(true)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    window.on('closed', () => {
      if (OverlayWindow.value === window) OverlayWindow.value = null
    })

    const rendererFilePath = path.join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    )

    try {
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
        url.searchParams.set('penny-overlay', '1')
        await window.loadURL(url.toString())
      } else {
        await window.loadFile(rendererFilePath, {
          query: { 'penny-overlay': '1' },
        })
      }
    } catch (error) {
      RuntimeLog.error('overlay:load', error)
      OverlayWindow.destroy()
      return
    }

    const registered = globalShortcut.register(toggleShortcut, () => {
      OverlayWindow.toggle()
    })

    if (!registered) {
      RuntimeLog.error(
        'overlay:shortcut',
        new Error(`Could not register ${toggleShortcut}.`)
      )
    }
  }

  static setAccountScope(scope: unknown) {
    if (!isRecord(scope)) return

    const primary =
      typeof scope.primary === 'string' ? scope.primary : null
    const members = Array.isArray(scope.members)
      ? scope.members.filter(
          (value): value is string => typeof value === 'string'
        )
      : []

    OverlayWindow.scope = { primary, members }

    if (OverlayWindow.value?.isVisible()) void OverlayWindow.refresh()
  }

  static toggle() {
    const window = OverlayWindow.value

    if (!window || window.isDestroyed()) return

    if (window.isVisible()) {
      window.hide()
      OverlayWindow.stopRefreshing()
      return
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const margin = 24

    window.setBounds({
      x: display.workArea.x + display.workArea.width - window.getBounds().width - margin,
      y: display.workArea.y + margin,
      width: window.getBounds().width,
      height: Math.min(760, display.workArea.height - margin * 2),
    })
    window.showInactive()
    void OverlayWindow.refresh()
    OverlayWindow.timer = setInterval(
      () => void OverlayWindow.refresh(),
      refreshInterval
    )
  }

  private static stopRefreshing() {
    if (OverlayWindow.timer) clearInterval(OverlayWindow.timer)
    OverlayWindow.timer = null
  }

  private static async displayNamesFromScope() {
    const { AccountsManager } = await import('../accounts')
    const accounts = AccountsManager.getAccounts()
    const ids = [
      OverlayWindow.scope.primary,
      ...OverlayWindow.scope.members,
    ].filter((value): value is string => Boolean(value))

    return [...new Set(ids)]
      .map((accountId) => accounts.get(accountId)?.displayName)
      .filter((value): value is string => Boolean(value))
      .slice(0, maximumPlayers)
  }

  private static async loadProfile(displayName: string) {
    try {
      const response = await getPennyDBProfile(displayName)

      return { data: response.data, displayName }
    } catch {
      return { data: null, displayName }
    }
  }

  private static refresh() {
    OverlayWindow.refreshing ??= OverlayWindow.performRefresh().finally(() => {
      OverlayWindow.refreshing = null
    })

    return OverlayWindow.refreshing
  }

  private static async performRefresh() {
    const requestedNames = await OverlayWindow.displayNamesFromScope()

    if (requestedNames.length === 0) {
      OverlayWindow.send({
        players: [],
        status: 'Select an account in Penny first.',
        updatedAt: new Date().toISOString(),
      })
      return
    }

    const initial = await Promise.all(
      requestedNames.map(OverlayWindow.loadProfile)
    )
    const teammates = initial.flatMap(({ data }) =>
      data ? missionPlayers(data) : []
    )
    const known = new Set(requestedNames.map((name) => name.toLocaleLowerCase()))
    const extraNames = [...new Set(teammates)]
      .filter((name) => !known.has(name.toLocaleLowerCase()))
      .slice(0, maximumPlayers - initial.length)
    const profiles = [
      ...initial,
      ...(await Promise.all(extraNames.map(OverlayWindow.loadProfile))),
    ]
    const players = profiles.map(({ data, displayName }) =>
      data
        ? toOverlayPlayer(displayName, data)
        : {
            displayName,
            errorMessage: 'Public profile unavailable',
            quests: [],
          }
    )

    OverlayWindow.send({
      players,
      updatedAt: new Date().toISOString(),
    })
  }

  private static send(snapshot: OverlaySnapshot) {
    const window = OverlayWindow.value

    if (!window || window.isDestroyed()) return
    window.webContents.send(ElectronAPIEventKeys.OverlaySnapshot, snapshot)
  }

  static destroy() {
    OverlayWindow.stopRefreshing()
    globalShortcut.unregister(toggleShortcut)

    if (OverlayWindow.value && !OverlayWindow.value.isDestroyed()) {
      OverlayWindow.value.destroy()
    }

    OverlayWindow.value = null
  }
}
