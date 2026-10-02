import { createConnection, type Socket } from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { discordApplicationId } from '../../config/discord'
import { LogWatcher } from './fortnite-log-watcher'
import {
  type IslandIdentity,
  IslandDirectory,
  isIslandCode,
  islandPageUrl,
} from './island-directory'
import { RuntimeLog } from '../runtime-log'

// Use byte views to bridge the Node 20 Buffer types and newer TS typed arrays.
const byteView = (buffer: Buffer) =>
  new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

export type DiscordPresenceMode = 'launcher' | 'stw' | 'br'

export type TrayLaunchSummary = {
  gameRunning: boolean
  primaryId: string | null
  primaryName: string | null
  running: Array<string>
  total: number
}

/**
 * One-click tray labels. Extracted so the copy can be unit-tested without
 * constructing an Electron Tray.
 */
export function trayLaunchLabels(summary: TrayLaunchSummary) {
  const hasAccount = Boolean(summary.primaryId)

  return {
    launchEnabled: hasAccount && !summary.gameRunning,
    launchLabel: !hasAccount
      ? 'Launch Fortnite'
      : summary.gameRunning
        ? 'Fortnite is running'
        : `Launch Fortnite — ${summary.primaryName ?? 'selected account'}`,
  }
}

const STW_PLAYLIST =
  /dungeon|campaign|theater|stw|outpost|venture|endurance|stormshield/i

const STW_LINE =
  /\/game\/world\/|zonetheme|savetheworld|stormshielddefense|endurance/i

const BR_LINE =
  /\blogathena\b|\/athena\/|playlist_(default|showdown|reload|habanero|limerick|blastberry|figment|papaya|playground|creative|mash|respawn|solidgold)/i

/**
 * Reads FortniteGame.log (not the game process) to tell STW from BR.
 * Returns null when the line is unrelated, so the last confident mode sticks.
 */
export function classifyFortniteLogLine(
  line: string,
): DiscordPresenceMode | null {
  const playlistMatch = line.match(
    /playlist[_-]?([a-z0-9]+(?:[_-][a-z0-9]+)*)/i,
  )

  if (playlistMatch) {
    const id = playlistMatch[1].toLowerCase()

    return STW_PLAYLIST.test(id) ? 'stw' : 'br'
  }

  if (STW_LINE.test(line)) {
    return 'stw'
  }

  if (BR_LINE.test(line)) {
    return 'br'
  }

  return null
}

// The local player's island, logged when the party's selection changes and
// again whenever the lobby re-reads it. Anchored to the start of the line so
// Discover art prefetches, Product.FNE lists, link-entry errors and the
// indented "has updated matchmaking info" blocks (party members, possibly
// someone else's pick) never count as a selection.
const SELECTION_LINES = [
  /^(?:\[[^\]]*\])*MatchmakingLog: (?:\[\w+\] )?Link id changing from .* to \[Mnemonic=\[([^\]]*)\]/,
  /^(?:\[[^\]]*\])*LogMatchmakingUtility: (?:\[\w+\] )?LinkId: 'Mnemonic=\[([^\]]*)\]/,
]

/**
 * Pulls the selected link mnemonic out of a FortniteGame.log line, or null
 * when the line is not one of the selection lines.
 */
export function extractIslandSelection(
  line: string,
): { mnemonic: string } | null {
  for (const pattern of SELECTION_LINES) {
    const match = line.match(pattern)

    if (match) {
      return { mnemonic: match[1].trim() }
    }
  }

  return null
}

export type FortniteSelection =
  | { kind: 'stw' }
  | { kind: 'island'; code: string }
  | { kind: 'playlist'; id: string }
  | { kind: 'none' }

/**
 * `campaign` is Save the World, a `1234-5678-9012` code is a creator island,
 * an empty mnemonic is a reset, and anything else (`playlist_*`) is one of
 * Epic's own modes.
 */
export function classifyLinkMnemonic(mnemonic: string): FortniteSelection {
  const value = mnemonic.trim().toLowerCase()

  if (!value || value === 'none') {
    return { kind: 'none' }
  }

  if (value === 'campaign') {
    return { kind: 'stw' }
  }

  if (isIslandCode(value)) {
    return { kind: 'island', code: value }
  }

  return { kind: 'playlist', id: value }
}

export type PresenceIsland = Pick<IslandIdentity, 'code' | 'title' | 'imageUrl'>

// Discord rejects an activity whose details are under 2 or over 128
// characters, so an odd title falls back to the code or gets clipped.
function islandDetails(island: Pick<PresenceIsland, 'code' | 'title'>) {
  const title = island.title?.trim() ?? ''

  if (title.length < 2) {
    return `Island ${island.code}`
  }

  return title.length > 128
    ? `${title.slice(0, 127).replace(/[\uD800-\uDBFF]$/, '')}…`
    : title
}

// Discord fetches external https art itself. Anything else would get the
// whole SET_ACTIVITY rejected, so the app icon stays instead.
function islandArtUrl(value: string | null) {
  if (!value || value.length > 256) {
    return null
  }

  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

export function discordActivityCopy(input: {
  accountName: string | null
  gameRunning: boolean
  island?: Pick<PresenceIsland, 'code' | 'title'> | null
  mode: DiscordPresenceMode
}) {
  if (!input.gameRunning) {
    return {
      details: 'In launcher',
      state: input.accountName ?? 'No account selected',
    }
  }

  if (input.island) {
    return {
      details: islandDetails(input.island),
      state: input.accountName ?? input.island.code,
    }
  }

  if (input.mode === 'stw') {
    return {
      details: 'In Save the World',
      state: input.accountName ?? 'Save the World',
    }
  }

  if (input.mode === 'br') {
    return {
      details: 'In Battle Royale',
      state: input.accountName ?? 'Battle Royale',
    }
  }

  return {
    details: 'In Fortnite',
    state: input.accountName ?? 'Fortnite',
  }
}

/**
 * The SET_ACTIVITY body. Only a creator island adds art and a button, and the
 * button links the island's public page — never anything about the account.
 */
export function discordActivity(input: {
  accountName: string | null
  gameRunning: boolean
  island: PresenceIsland | null
  mode: DiscordPresenceMode
  startedAt: number
}) {
  const island = input.gameRunning ? input.island : null
  const copy = discordActivityCopy({
    accountName: input.accountName,
    gameRunning: input.gameRunning,
    island,
    mode: input.gameRunning ? input.mode : 'launcher',
  })
  const art = island ? islandArtUrl(island.imageUrl) : null

  return {
    details: copy.details,
    state: copy.state,
    timestamps: { start: Math.floor(input.startedAt / 1000) },
    ...(island && art
      ? { assets: { large_image: art, large_text: island.code } }
      : {}),
    ...(island
      ? {
          buttons: [
            { label: 'View island', url: islandPageUrl(island.code) },
          ],
        }
      : {}),
    instance: false,
  }
}

/**
 * Discord Rich Presence, owned by the launcher process.
 *
 * Connects to the local Discord client over a named pipe / UNIX socket and
 * publishes Penny's activity. When Fortnite is running we only *read*
 * FortniteGame.log to distinguish STW from BR and to name the creator island
 * the player picked — we never inject, overlay, or write into the game.
 */
export class DiscordPresence {
  private static accountName: string | null = null
  private static enabled = true
  private static gameRunning = false
  private static incoming = Buffer.alloc(0)
  private static island: PresenceIsland | null = null
  private static logWatcher: LogWatcher | null = null
  private static mode: DiscordPresenceMode = 'launcher'
  /** Once the game has logged a selection, it outranks the line heuristics. */
  private static selectionSeen = false
  private static startedAt = Date.now()
  private static socket: Socket | null = null
  private static ready = false
  private static retryTimer: NodeJS.Timeout | null = null
  private static handshakeTimer: NodeJS.Timeout | null = null

  static setEnabled(value: boolean) {
    DiscordPresence.enabled = value

    if (!value) {
      DiscordPresence.disconnect()
      DiscordPresence.stopLogWatcher()

      return
    }

    if (DiscordPresence.gameRunning) DiscordPresence.startLogWatcher()
    DiscordPresence.connect()
    DiscordPresence.publish()
  }

  static setAccountName(name: string | null) {
    DiscordPresence.accountName = name
    DiscordPresence.publish()
  }

  static setGameRunning(isRunning: boolean) {
    if (DiscordPresence.gameRunning === isRunning) {
      return
    }

    DiscordPresence.gameRunning = isRunning

    if (isRunning) {
      DiscordPresence.mode = 'launcher'
      DiscordPresence.startedAt = Date.now()
      DiscordPresence.startLogWatcher()
    } else {
      DiscordPresence.mode = 'launcher'
      DiscordPresence.startedAt = Date.now()
      DiscordPresence.stopLogWatcher()
    }

    DiscordPresence.publish()
  }

  static init(enabled: boolean) {
    DiscordPresence.setEnabled(enabled)
  }

  static destroy() {
    DiscordPresence.enabled = false
    DiscordPresence.stopLogWatcher()
    DiscordPresence.disconnect()
  }

  private static startLogWatcher() {
    if (!DiscordPresence.enabled || DiscordPresence.logWatcher) {
      return
    }

    const watcher = new LogWatcher()

    watcher.onLine((line) => {
      DiscordPresence.readLogLine(line)
    })

    void watcher
      .start()
      .then(() => {
        // start() awaits the log file; a disable/suspend may have stopped this
        // watcher while that await was pending.
        if (DiscordPresence.logWatcher !== watcher) watcher.stop()
      })
      .catch(() => {})
    DiscordPresence.logWatcher = watcher
  }

  private static stopLogWatcher() {
    DiscordPresence.logWatcher?.stop()
    DiscordPresence.logWatcher = null
    // The island only means anything while its log is being followed; a
    // game exit, disable or suspend forgets it.
    DiscordPresence.island = null
    DiscordPresence.selectionSeen = false
  }

  private static readLogLine(line: string) {
    const selection = extractIslandSelection(line)

    if (selection) {
      DiscordPresence.select(classifyLinkMnemonic(selection.mnemonic))

      return
    }

    // Friends' presence and plugin lists name BR playlists all session long,
    // so the heuristics only stand in until the game logs a real selection.
    if (DiscordPresence.selectionSeen) {
      return
    }

    const next = classifyFortniteLogLine(line)

    if (next && next !== DiscordPresence.mode) {
      DiscordPresence.mode = next
      DiscordPresence.publish()
    }
  }

  private static select(selection: FortniteSelection) {
    DiscordPresence.selectionSeen = true

    const code = selection.kind === 'island' ? selection.code : null
    const mode: DiscordPresenceMode =
      selection.kind === 'stw'
        ? 'stw'
        : selection.kind === 'none'
          ? DiscordPresence.mode
          : 'br'

    if (
      mode === DiscordPresence.mode &&
      code === (DiscordPresence.island?.code ?? null)
    ) {
      return
    }

    DiscordPresence.mode = mode

    if (!code) {
      DiscordPresence.island = null
      DiscordPresence.publish()

      return
    }

    // Publish the code straight away; the title follows when it arrives.
    const known = IslandDirectory.peek(code)

    DiscordPresence.island = {
      code,
      title: known?.title ?? null,
      imageUrl: known?.imageUrl ?? null,
    }
    DiscordPresence.publish()
    DiscordPresence.describeIsland(code)
  }

  private static describeIsland(code: string) {
    void IslandDirectory.lookup(code)
      .then((identity) => {
        const current = DiscordPresence.island

        // The player may have picked something else, or quit, meanwhile.
        if (current?.code !== code) {
          return
        }

        const next = {
          code,
          title: identity.title ?? current.title,
          imageUrl: identity.imageUrl ?? current.imageUrl,
        }

        if (
          next.title === current.title &&
          next.imageUrl === current.imageUrl
        ) {
          return
        }

        DiscordPresence.island = next
        DiscordPresence.publish()
      })
      .catch(() => {})
  }

  private static ipcPath(id: number) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${id}`
    }

    const base =
      process.env.XDG_RUNTIME_DIR ||
      process.env.TMPDIR ||
      process.env.TMP ||
      process.env.TEMP ||
      '/tmp'

    return path.join(base, `discord-ipc-${id}`)
  }

  private static scheduleReconnect() {
    if (!DiscordPresence.enabled || DiscordPresence.retryTimer) return
    DiscordPresence.retryTimer = setTimeout(() => {
      DiscordPresence.retryTimer = null
      DiscordPresence.connect()
    }, 15_000)
    DiscordPresence.retryTimer.unref()
  }

  private static connect() {
    if (
      !DiscordPresence.enabled ||
      DiscordPresence.socket ||
      DiscordPresence.retryTimer
    )
      return
    DiscordPresence.tryConnect(0)
  }

  private static tryConnect(id: number) {
    if (!DiscordPresence.enabled) return
    if (id > 9) {
      DiscordPresence.scheduleReconnect()
      return
    }

    const socket = createConnection(DiscordPresence.ipcPath(id))
    // Own pending connections too, so disabling presence cancels the handshake.
    DiscordPresence.socket = socket
    DiscordPresence.ready = false
    DiscordPresence.incoming = Buffer.alloc(0)
    let connected = false

    const closed = () => {
      if (DiscordPresence.socket !== socket) return
      DiscordPresence.socket = null
      DiscordPresence.ready = false
      DiscordPresence.clearHandshakeTimer()
      socket.destroy()
      if (!DiscordPresence.enabled) return
      if (connected) DiscordPresence.scheduleReconnect()
      else DiscordPresence.tryConnect(id + 1)
    }

    DiscordPresence.handshakeTimer = setTimeout(closed, 10_000)
    DiscordPresence.handshakeTimer.unref()
    socket.once('connect', () => {
      if (DiscordPresence.socket !== socket || !DiscordPresence.enabled) return
      connected = true
      DiscordPresence.write(0, { v: 1, client_id: discordApplicationId })
    })
    socket.on('data', (chunk: Buffer) => {
      if (DiscordPresence.socket === socket) DiscordPresence.onData(chunk)
    })
    socket.once('error', closed)
    socket.once('close', closed)
  }

  private static onData(chunk: Buffer) {
    DiscordPresence.incoming = Buffer.concat([
      byteView(DiscordPresence.incoming),
      byteView(chunk),
    ])
    while (DiscordPresence.incoming.length >= 8) {
      const opcode = DiscordPresence.incoming.readUInt32LE(0)
      const length = DiscordPresence.incoming.readUInt32LE(4)
      if (length > 1024 * 1024) {
        RuntimeLog.error(
          'discord:protocol',
          new Error('Invalid IPC frame length'),
        )
        DiscordPresence.socket?.destroy()
        return
      }
      if (DiscordPresence.incoming.length < 8 + length) return
      const payload = DiscordPresence.incoming.subarray(8, 8 + length)
      DiscordPresence.incoming = DiscordPresence.incoming.subarray(
        8 + length,
      ) as Buffer

      // Heartbeats carry opaque bytes. Echo them without JSON decoding.
      if (opcode === 3) {
        DiscordPresence.writeFrame(4, payload)
        continue
      }
      if (opcode === 4) continue
      if (opcode === 2) {
        RuntimeLog.error('discord:close', payload.toString('utf8'))
        DiscordPresence.socket?.destroy()
        return
      }
      if (opcode !== 1) continue

      try {
        const message = JSON.parse(payload.toString('utf8')) as {
          evt?: string
          data?: { code?: number; message?: string }
        }
        if (message.evt === 'READY') {
          DiscordPresence.ready = true
          DiscordPresence.clearHandshakeTimer()
          DiscordPresence.publish()
        } else if (message.evt === 'ERROR') {
          RuntimeLog.error(
            'discord:rpc',
            `${message.data?.code ?? 'unknown'}: ${message.data?.message ?? 'Activity request rejected'}`,
          )
        }
      } catch (error) {
        RuntimeLog.error('discord:protocol', error)
        DiscordPresence.socket?.destroy()
        return
      }
    }
  }

  private static clearHandshakeTimer() {
    if (DiscordPresence.handshakeTimer)
      clearTimeout(DiscordPresence.handshakeTimer)
    DiscordPresence.handshakeTimer = null
  }

  private static disconnect() {
    if (DiscordPresence.retryTimer) clearTimeout(DiscordPresence.retryTimer)
    DiscordPresence.retryTimer = null
    DiscordPresence.clearHandshakeTimer()
    const socket = DiscordPresence.socket
    DiscordPresence.socket = null
    DiscordPresence.ready = false
    DiscordPresence.incoming = Buffer.alloc(0)
    socket?.destroy()
  }

  private static publish() {
    if (!DiscordPresence.enabled) {
      return
    }

    if (!DiscordPresence.socket) {
      DiscordPresence.connect()

      return
    }

    if (!DiscordPresence.ready) return

    DiscordPresence.write(1, {
      cmd: 'SET_ACTIVITY',
      nonce: randomUUID(),
      args: {
        pid: process.pid,
        activity: discordActivity({
          accountName: DiscordPresence.accountName,
          gameRunning: DiscordPresence.gameRunning,
          island: DiscordPresence.island,
          mode: DiscordPresence.mode,
          startedAt: DiscordPresence.startedAt,
        }),
      },
    })
  }

  private static write(opcode: number, payload: unknown) {
    DiscordPresence.writeFrame(
      opcode,
      Buffer.from(JSON.stringify(payload), 'utf8'),
    )
  }

  private static writeFrame(opcode: number, payload: Buffer) {
    const socket = DiscordPresence.socket
    if (!socket || socket.destroyed) return
    try {
      const header = Buffer.alloc(8)
      header.writeUInt32LE(opcode, 0)
      header.writeUInt32LE(payload.length, 4)
      socket.write(
        byteView(Buffer.concat([byteView(header), byteView(payload)])),
      )
    } catch (error) {
      RuntimeLog.error('discord:write', error)
      socket.destroy()
    }
  }
}
