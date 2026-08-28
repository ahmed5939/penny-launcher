import { createConnection, type Socket } from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { discordApplicationId } from '../../config/discord'
import { LogWatcher } from './endurance/log-watcher'
import { RuntimeLog } from '../runtime-log'

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
  line: string
): DiscordPresenceMode | null {
  const playlistMatch = line.match(
    /playlist[_-]?([a-z0-9]+(?:[_-][a-z0-9]+)*)/i
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
  private static connecting = false

  static setEnabled(value: boolean) {
    DiscordPresence.enabled = value

    if (!value) {
      DiscordPresence.disconnect()
      DiscordPresence.stopLogWatcher()

      return
    }

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
    if (DiscordPresence.logWatcher) {
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

    watcher.start().catch(() => {})
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
      '/tmp'

    return path.join(base, `discord-ipc-${id}`)
  }

  private static connect() {
    if (
      !DiscordPresence.enabled ||
      DiscordPresence.socket ||
      DiscordPresence.connecting
    ) {
      return
    }

    DiscordPresence.connecting = true
    DiscordPresence.tryConnect(0)
  }

  private static tryConnect(id: number) {
    if (id > 9) {
      DiscordPresence.connecting = false

      return
    }

    const socket = createConnection(DiscordPresence.ipcPath(id))

    socket.once('connect', () => {
      DiscordPresence.connecting = false
      DiscordPresence.socket = socket
      DiscordPresence.incoming = Buffer.alloc(0)
      DiscordPresence.write(0, {
        v: 1,
        client_id: discordApplicationId,
      })
    })

    socket.on('data', (chunk: Buffer) => {
      DiscordPresence.onData(chunk)
    })

    socket.once('error', () => {
      socket.destroy()

      if (DiscordPresence.socket) {
        return
      }

      DiscordPresence.tryConnect(id + 1)
    })

    socket.once('close', () => {
      if (DiscordPresence.socket === socket) {
        DiscordPresence.socket = null
      }
    })
  }

  private static onData(chunk: Buffer) {
    const combined = Buffer.allocUnsafe(
      DiscordPresence.incoming.length + chunk.length
    )

    for (let index = 0; index < DiscordPresence.incoming.length; index += 1) {
      combined[index] = DiscordPresence.incoming[index] ?? 0
    }

    for (let index = 0; index < chunk.length; index += 1) {
      combined[DiscordPresence.incoming.length + index] = chunk[index] ?? 0
    }

    DiscordPresence.incoming = combined

    while (DiscordPresence.incoming.length >= 8) {
      const length = DiscordPresence.incoming.readInt32LE(4)

      if (DiscordPresence.incoming.length < 8 + length) {
        return
      }

      const json = DiscordPresence.incoming.subarray(8, 8 + length).toString(
        'utf8'
      )

      DiscordPresence.incoming = DiscordPresence.incoming.subarray(
        8 + length
      ) as Buffer

      try {
        const message = JSON.parse(json) as { evt?: string }

        if (message.evt === 'READY') {
          DiscordPresence.publish()
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        RuntimeLog.error('caught:core/discord-presence.ts', error)
      }
    }
  }

  private static disconnect() {
    DiscordPresence.socket?.destroy()
    DiscordPresence.socket = null
    DiscordPresence.connecting = false
  }

  private static publish() {
    if (!DiscordPresence.enabled) {
      return
    }

    if (!DiscordPresence.socket) {
      DiscordPresence.connect()

      return
    }

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
          timestamps: { start: DiscordPresence.startedAt },
          instance: false,
        },
      },
    })
  }

  private static write(opcode: number, payload: unknown) {
    const socket = DiscordPresence.socket

    if (!socket || socket.destroyed) {
      return
    }

    try {
      const json = Buffer.from(JSON.stringify(payload), 'utf8')
      const header = Buffer.alloc(8)

      header.writeInt32LE(opcode, 0)
      header.writeInt32LE(json.length, 4)
      socket.write(header as unknown as Uint8Array)
      socket.write(json as unknown as Uint8Array)

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/discord-presence.ts', error)
    }
  }
}
