import { createConnection, type Socket } from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { discordApplicationId } from '../../config/discord'
import { LogWatcher } from './fortnite-log-watcher'
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

export function discordActivityCopy(input: {
  accountName: string | null
  gameRunning: boolean
  mode: DiscordPresenceMode
}) {
  if (!input.gameRunning) {
    return {
      details: 'In launcher',
      state: input.accountName ?? 'No account selected',
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
 * Discord Rich Presence, owned by the launcher process.
 *
 * Connects to the local Discord client over a named pipe / UNIX socket and
 * publishes Penny's activity. When Fortnite is running we only *read*
 * FortniteGame.log to distinguish STW from BR — we never inject, overlay, or
 * write into the game.
 */
export class DiscordPresence {
  private static accountName: string | null = null
  private static enabled = true
  private static gameRunning = false
  private static incoming = Buffer.alloc(0)
  private static logWatcher: LogWatcher | null = null
  private static mode: DiscordPresenceMode = 'launcher'
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
      const next = classifyFortniteLogLine(line)

      if (next && next !== DiscordPresence.mode) {
        DiscordPresence.mode = next
        DiscordPresence.publish()
      }
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

    const copy = discordActivityCopy({
      accountName: DiscordPresence.accountName,
      gameRunning: DiscordPresence.gameRunning,
      mode: DiscordPresence.gameRunning ? DiscordPresence.mode : 'launcher',
    })

    DiscordPresence.write(1, {
      cmd: 'SET_ACTIVITY',
      nonce: randomUUID(),
      args: {
        pid: process.pid,
        activity: {
          details: copy.details,
          state: copy.state,
          timestamps: { start: Math.floor(DiscordPresence.startedAt / 1000) },
          instance: false,
        },
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
