import {
  abortedFailure,
  failureFromSocketError,
  PresenceFailure,
} from './presence-model'

/**
 * One connection to Epic's connect service (STOMP over WebSocket), held
 * only so presence has a connection id to hang off.
 *
 * Shape after fnapi-js `ConnectClient` (pinned in presence-model.ts): the
 * bearer and STOMP subprotocol go in the upgrade headers, `CONNECT`, then
 * `SUBSCRIBE` to `launcher`, then a `core.connect.v1.connected` message
 * carries the connection id. Differences on purpose:
 *
 * - it never reconnects by itself — the session manager decides, so a
 *   stopped session cannot come back;
 * - every frame after the connection id is dropped unread: friends'
 *   presence and chat arrive here and Penny has no use for them;
 * - nothing that crosses the socket is logged, headers included;
 * - frames are size-capped, and a server that answers pings must keep
 *   answering them.
 *
 * The `protocols` argument is deliberately not given to `ws`. Epic does not
 * echo a subprotocol, and ws 8 fails the handshake with "Server sent no
 * subprotocol" when one was requested and none came back. Should Epic start
 * echoing, ws fails with "Server sent a subprotocol but none was requested",
 * which surfaces as a `handshake` error rather than a retry loop.
 */

export const connectUrl = 'wss://connect.epicgames.dev/'

const NUL = '\u0000'

/** Bigger than this, ws closes the socket (1009). Social frames can be large. */
export const maxSocketPayloadBytes = 1024 * 1024

/** Frames Penny actually reads are tiny; anything bigger is not parsed. */
const maxParsedFrameBytes = 64 * 1024

const socketOpen = 1

/** The subset of a `ws` WebSocket this module uses, so tests can fake it. */
export type PresenceSocket = {
  readonly readyState: number
  send(data: string): void
  ping(): void
  close(code?: number, reason?: string): void
  terminate(): void
  on(event: 'open', listener: () => void): unknown
  on(event: 'message', listener: (data: unknown) => void): unknown
  on(event: 'pong', listener: () => void): unknown
  on(event: 'close', listener: (code: number) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
}

export type PresenceSocketFactory = (
  url: string,
  headers: Record<string, string>
) => PresenceSocket

export type PresenceLink = {
  readonly connectionId: string
  /** Called once, only when the socket goes away without `close()`. */
  onLost(listener: (failure: PresenceFailure) => void): void
  /** Settles within `closeGraceMs`, whatever the server does. */
  close(): Promise<void>
}

export type PresenceLinkOptions = {
  accessToken: string
  signal: AbortSignal
  socketFactory: PresenceSocketFactory
  openTimeoutMs?: number
  closeGraceMs?: number
  /** Heartbeat floor; the server may ask for a slower beat, never a faster one. */
  heartbeatMs?: number
}

export function openPresenceLink(
  options: PresenceLinkOptions
): Promise<PresenceLink> {
  return new StompPresenceLink(options).open()
}

type Frame = {
  command: string
  headers: Record<string, string>
  body: string
}

class StompPresenceLink implements PresenceLink {
  connectionId = ''

  private socket: PresenceSocket | null = null
  private phase: 'opening' | 'open' | 'closed' = 'opening'
  private lostListener: ((failure: PresenceFailure) => void) | null = null
  /** A loss with nobody listening yet, handed to the first listener. */
  private unheardLoss: PresenceFailure | null = null
  private socketError: PresenceFailure | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private settleOpen: {
    resolve: (link: PresenceLink) => void
    reject: (failure: PresenceFailure) => void
  } | null = null
  private closed: Promise<void> | null = null
  private signalClosed: (() => void) | null = null
  private heardSinceBeat = true
  private answersPings = false
  private missedBeats = 0

  constructor(private readonly options: PresenceLinkOptions) {}

  open(): Promise<PresenceLink> {
    const { signal } = this.options

    if (signal.aborted) {
      return Promise.reject(abortedFailure())
    }

    return new Promise<PresenceLink>((resolve, reject) => {
      this.settleOpen = { resolve, reject }
      this.closed = new Promise<void>((done) => {
        this.signalClosed = done
      })

      signal.addEventListener('abort', this.onAbort, { once: true })
      this.openTimer = setTimeout(() => {
        this.fail(
          new PresenceFailure(
            'timeout',
            "Epic's presence service did not finish connecting in time.",
            { retryable: true }
          )
        )
      }, this.options.openTimeoutMs ?? 15_000)

      let socket: PresenceSocket

      try {
        socket = this.options.socketFactory(connectUrl, {
          Authorization: `Bearer ${this.options.accessToken}`,
          'Epic-Connect-Protocol': 'stomp',
          'Sec-WebSocket-Protocol': 'v10.stomp,v11.stomp,v12.stomp',
          // Epic's own clients send a single space here.
          'Epic-Connect-Device-Id': ' ',
        })
      } catch (error) {
        this.fail(failureFromSocketError(error))
        return
      }

      this.socket = socket

      socket.on('open', () => {
        this.send(
          `CONNECT\naccept-version:1.0,1.1,1.2\nheart-beat:30000,0\n\n${NUL}`
        )
      })
      socket.on('message', (data) => this.receive(data))
      socket.on('pong', () => {
        this.answersPings = true
        this.heardSinceBeat = true
      })
      socket.on('error', (error) => {
        // Kept for the close that follows; ws always emits one.
        this.socketError = failureFromSocketError(error)
      })
      socket.on('close', (code) => this.onSocketClosed(code))
    })
  }

  onLost(listener: (failure: PresenceFailure) => void) {
    const missed = this.unheardLoss

    if (missed) {
      this.unheardLoss = null
      queueMicrotask(() => listener(missed))
      return
    }

    this.lostListener = listener
  }

  close(): Promise<void> {
    if (this.phase !== 'closed') {
      this.phase = 'closed'
      this.teardown()

      const socket = this.socket
      const grace = setTimeout(() => {
        try {
          socket?.terminate()
        } catch {
          // Already gone.
        }
        this.signalClosed?.()
      }, this.options.closeGraceMs ?? 2_000)

      grace.unref?.()

      try {
        if (socket && socket.readyState === socketOpen) {
          socket.send(`DISCONNECT\n\n${NUL}`)
        }
        socket?.close(1000)
      } catch {
        // Best effort; the grace timer finishes the job.
      }

      if (!socket) {
        this.signalClosed?.()
      }

      void this.closed?.then(() => clearTimeout(grace))
    }

    return this.closed ?? Promise.resolve()
  }

  private onAbort = () => {
    this.fail(abortedFailure())
  }

  private send(data: string) {
    if (!this.socket || this.socket.readyState !== socketOpen) {
      return
    }

    this.socket.send(data)
  }

  private receive(data: unknown) {
    this.heardSinceBeat = true

    // Once the connection id is known nothing else here matters, except the
    // server saying the session is over.
    if (this.phase === 'open') {
      if (startsWithError(data)) {
        this.socketError = new PresenceFailure(
          'connection-lost',
          "Epic's presence service ended the connection.",
          { retryable: true }
        )
        this.socket?.terminate()
      }

      return
    }

    if (this.phase !== 'opening') {
      return
    }

    const text = textOf(data)

    if (text === null || text.length > maxParsedFrameBytes) {
      return
    }

    for (const raw of text.split(NUL)) {
      const frame = parseFrame(raw)

      if (frame) {
        this.handleFrame(frame)
      }

      if (this.phase !== 'opening') {
        return
      }
    }
  }

  private handleFrame(frame: Frame) {
    switch (frame.command) {
      case 'CONNECTED': {
        this.startHeartbeat(frame.headers['heart-beat'])
        this.send(`SUBSCRIBE\nid:0\ndestination:launcher\n\n${NUL}`)
        return
      }

      case 'MESSAGE': {
        const body = parseJson(frame.body)

        if (body?.type !== 'core.connect.v1.connected') {
          return
        }

        const connectionId = body.connectionId

        if (
          typeof connectionId === 'string' &&
          connectionId.length > 0 &&
          connectionId.length <= 256 &&
          // eslint-disable-next-line no-control-regex
          !/[\u0000-\u001f\u007f]/.test(connectionId)
        ) {
          this.established(connectionId)
        }

        return
      }

      case 'ERROR': {
        const body = parseJson(frame.body)
        const stale = body?.statusCode === 4019

        this.fail(
          new PresenceFailure(
            stale ? 'connection-lost' : 'handshake',
            stale
              ? "Epic's presence service dropped a stale connection."
              : "Epic's presence service refused the connection.",
            { retryable: true }
          )
        )
        return
      }
    }
  }

  private established(connectionId: string) {
    this.connectionId = connectionId
    this.phase = 'open'
    this.clearOpenTimer()
    this.options.signal.removeEventListener('abort', this.onAbort)

    const settle = this.settleOpen

    this.settleOpen = null
    settle?.resolve(this)
  }

  private startHeartbeat(header: string | undefined) {
    if (this.heartbeat) {
      return
    }

    // `heart-beat: sx,sy` — sy is how often the server wants to hear from us.
    const wanted = Number.parseInt(header?.split(',')[1] ?? '0', 10)
    const floor = this.options.heartbeatMs ?? 30_000
    const interval =
      Number.isFinite(wanted) && wanted > 0 ? Math.max(wanted, floor) : floor

    this.heartbeat = setInterval(() => this.beat(), interval)
    this.heartbeat.unref?.()
  }

  /**
   * An EOL keeps STOMP happy; a ping finds a half-open TCP connection the
   * OS would otherwise sit on for minutes. Liveness is only enforced once
   * the server has shown it answers pings at all.
   */
  private beat() {
    if (!this.socket || this.socket.readyState !== socketOpen) {
      return
    }

    if (this.answersPings) {
      this.missedBeats = this.heardSinceBeat ? 0 : this.missedBeats + 1

      if (this.missedBeats >= 2) {
        this.socketError = new PresenceFailure(
          'connection-lost',
          "Epic's presence service stopped answering.",
          { retryable: true }
        )
        this.socket.terminate()
        return
      }
    }

    this.heardSinceBeat = false

    try {
      this.socket.send('\n')
      this.socket.ping()
    } catch {
      // The close event reports it.
    }
  }

  private onSocketClosed(code: number) {
    this.signalClosed?.()

    if (this.phase === 'closed') {
      return
    }

    const failure =
      this.socketError ??
      new PresenceFailure(
        'connection-lost',
        `The connection to Epic's presence service closed (code ${code}).`,
        { retryable: true }
      )

    if (this.phase === 'opening') {
      this.fail(failure)
      return
    }

    this.phase = 'closed'
    this.teardown()

    const listener = this.lostListener

    this.lostListener = null

    if (listener) {
      listener(failure)
    } else {
      this.unheardLoss = failure
    }
  }

  /** Opening failed: close everything and reject `open()`. */
  private fail(failure: PresenceFailure) {
    if (this.phase !== 'opening') {
      return
    }

    this.phase = 'closed'
    this.teardown()

    try {
      this.socket?.terminate()
    } catch {
      // Already gone.
    }

    this.signalClosed?.()

    const settle = this.settleOpen

    this.settleOpen = null
    settle?.reject(failure)
  }

  private teardown() {
    this.clearOpenTimer()
    this.options.signal.removeEventListener('abort', this.onAbort)

    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private clearOpenTimer() {
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
  }
}

/** ws delivers a Buffer (binaryType is left at `nodebuffer`); tests use strings. */
function textOf(data: unknown): string | null {
  if (typeof data === 'string') {
    return data
  }

  if (Buffer.isBuffer(data)) {
    return data.length > maxParsedFrameBytes ? null : data.toString('utf8')
  }

  if (data instanceof ArrayBuffer) {
    return data.byteLength > maxParsedFrameBytes
      ? null
      : Buffer.from(data).toString('utf8')
  }

  return null
}

/** Peeks at the command without decoding a whole social frame. */
function startsWithError(data: unknown) {
  const head =
    typeof data === 'string'
      ? data.slice(0, 16)
      : Buffer.isBuffer(data)
        ? data.subarray(0, 16).toString('latin1')
        : data instanceof ArrayBuffer
          ? Buffer.from(data, 0, Math.min(16, data.byteLength)).toString('latin1')
          : ''

  return head.replace(/^[\r\n]+/, '').startsWith('ERROR')
}

export function parseFrame(raw: string): Frame | null {
  // Heart-beats are bare EOLs between frames.
  const text = raw.replace(/^[\r\n]+/, '')

  if (!text) {
    return null
  }

  const separator = text.search(/\r?\n\r?\n/)
  const head = separator === -1 ? text : text.slice(0, separator)
  const body =
    separator === -1 ? '' : text.slice(separator).replace(/^\r?\n\r?\n/, '')
  const [command, ...lines] = head.split(/\r?\n/)
  // No prototype: a header named `__proto__` or `constructor` is just a header.
  const headers = Object.create(null) as Record<string, string>

  for (const line of lines) {
    const colon = line.indexOf(':')
    const name = line.slice(0, colon)

    // STOMP: the first occurrence of a repeated header wins.
    if (colon > 0 && !Object.prototype.hasOwnProperty.call(headers, name)) {
      headers[name] = line.slice(colon + 1)
    }
  }

  return { command: command.trim(), headers, body }
}

function parseJson(body: string): Record<string, unknown> | null {
  if (!body) {
    return null
  }

  try {
    const value = JSON.parse(body) as unknown

    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
