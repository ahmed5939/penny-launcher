import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectUrl,
  openPresenceLink,
  parseFrame,
  type PresenceSocket,
} from './presence-transport'

const NUL = '\u0000'

class FakeSocket extends EventEmitter implements PresenceSocket {
  readyState = 0
  sent: Array<string> = []
  pings = 0
  closeCalls: Array<number | undefined> = []
  terminated = false
  /** Whether close() leads to a close event, as a healthy server would. */
  closesCleanly = true

  constructor(
    readonly url: string,
    readonly headers: Record<string, string>
  ) {
    super()
  }

  send(data: string) {
    this.sent.push(data)
  }

  ping() {
    this.pings += 1
  }

  close(code?: number) {
    this.closeCalls.push(code)

    if (this.closesCleanly && this.readyState !== 3) {
      this.readyState = 3
      queueMicrotask(() => this.emit('close', code ?? 1005))
    }
  }

  terminate() {
    this.terminated = true

    if (this.readyState !== 3) {
      this.readyState = 3
      this.emit('close', 1006)
    }
  }

  // Server side.
  open() {
    this.readyState = 1
    this.emit('open')
  }

  frame(command: string, headers: Record<string, string> = {}, body = '') {
    const head = Object.entries(headers).map(([key, value]) => `${key}:${value}`)

    this.emit('message', Buffer.from([command, ...head, '', body].join('\n') + NUL))
  }

  connected(connectionId = 'conn-1') {
    this.frame('CONNECTED', { 'heart-beat': '0,30000', version: '1.2' })
    this.frame(
      'MESSAGE',
      { destination: 'launcher', subscription: '0' },
      JSON.stringify({ type: 'core.connect.v1.connected', connectionId })
    )
  }
}

let sockets: Array<FakeSocket>
const factory = (url: string, headers: Record<string, string>) => {
  const socket = new FakeSocket(url, headers)

  sockets.push(socket)

  return socket
}

function open(signal = new AbortController().signal, extra = {}) {
  return openPresenceLink({
    accessToken: 'eas-access',
    signal,
    socketFactory: factory,
    ...extra,
  })
}

beforeEach(() => {
  sockets = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('openPresenceLink', () => {
  it('sends the bearer and STOMP in the upgrade headers, without a protocols argument', async () => {
    const pending = open()
    const socket = sockets[0]

    expect(socket.url).toBe(connectUrl)
    expect(socket.headers).toEqual({
      Authorization: 'Bearer eas-access',
      'Epic-Connect-Protocol': 'stomp',
      'Sec-WebSocket-Protocol': 'v10.stomp,v11.stomp,v12.stomp',
      'Epic-Connect-Device-Id': ' ',
    })

    socket.open()
    expect(socket.sent[0]).toMatch(/^CONNECT\n/)
    expect(socket.sent[0]).toContain('heart-beat:30000,0')

    socket.connected('conn-42')
    expect(socket.sent[1]).toBe(`SUBSCRIBE\nid:0\ndestination:launcher\n\n${NUL}`)

    const link = await pending

    expect(link.connectionId).toBe('conn-42')
  })

  it('is not established by CONNECTED alone', async () => {
    vi.useFakeTimers()

    const pending = open(undefined, { openTimeoutMs: 1_000 })
    const socket = sockets[0]

    socket.open()
    socket.frame('CONNECTED')
    vi.advanceTimersByTime(1_000)

    await expect(pending).rejects.toMatchObject({ code: 'timeout', retryable: true })
    expect(socket.terminated).toBe(true)
  })

  it('stops opening when aborted', async () => {
    const controller = new AbortController()
    const pending = open(controller.signal)

    sockets[0].open()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
    expect(sockets[0].terminated).toBe(true)
  })

  it('refuses at once when already aborted', async () => {
    const controller = new AbortController()

    controller.abort()

    await expect(open(controller.signal)).rejects.toMatchObject({ code: 'aborted' })
    expect(sockets).toHaveLength(0)
  })

  it('reports a handshake refusal from ws', async () => {
    const pending = open()
    const socket = sockets[0]

    socket.emit('error', new Error('Unexpected server response: 401'))
    socket.emit('close', 1006)

    await expect(pending).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
  })

  it('reports an ERROR frame while opening', async () => {
    const pending = open()
    const socket = sockets[0]

    socket.open()
    socket.frame('ERROR', { message: 'nope' }, JSON.stringify({ statusCode: 4019 }))

    await expect(pending).rejects.toMatchObject({
      code: 'connection-lost',
      retryable: true,
    })
  })

  it('ignores malformed and oversized frames', async () => {
    vi.useFakeTimers()

    const pending = open(undefined, { openTimeoutMs: 1_000 })
    const socket = sockets[0]

    socket.open()
    socket.emit('message', Buffer.from('garbage'))
    socket.frame('MESSAGE', {}, '{not json')
    socket.frame('MESSAGE', {}, JSON.stringify({ type: 'core.connect.v1.connected', connectionId: 'bad\nid' }))
    socket.emit(
      'message',
      Buffer.from(
        `MESSAGE\n\n${JSON.stringify({
          type: 'core.connect.v1.connected',
          connectionId: 'huge',
          pad: 'x'.repeat(70 * 1024),
        })}${NUL}`
      )
    )
    vi.advanceTimersByTime(1_000)

    await expect(pending).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('an open link', () => {
  async function established() {
    const pending = open()
    const socket = sockets[0]

    socket.open()
    socket.connected()

    return { link: await pending, socket }
  }

  it('drops social traffic unread and reports an unexpected close once', async () => {
    const { link, socket } = await established()
    const lost = vi.fn()

    link.onLost(lost)
    socket.frame(
      'MESSAGE',
      {},
      JSON.stringify({ type: 'presence.v1.UPDATE', payload: { accountId: 'friend' } })
    )
    expect(lost).not.toHaveBeenCalled()

    socket.terminate()

    expect(lost).toHaveBeenCalledTimes(1)
    expect(lost.mock.calls[0][0]).toMatchObject({
      code: 'connection-lost',
      retryable: true,
    })
  })

  it('hands a loss nobody heard yet to the first listener', async () => {
    const { link, socket } = await established()
    const lost = vi.fn()

    socket.terminate()
    link.onLost(lost)
    await Promise.resolve()

    expect(lost).toHaveBeenCalledTimes(1)
    expect(lost.mock.calls[0][0]).toMatchObject({ code: 'connection-lost' })
  })

  it('ends on an ERROR frame after opening', async () => {
    const { link, socket } = await established()
    const lost = vi.fn()

    link.onLost(lost)
    socket.frame('ERROR', { message: 'session over' })

    expect(socket.terminated).toBe(true)
    expect(lost).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'connection-lost' })
    )
  })

  it('does not report its own close as a loss', async () => {
    const { link, socket } = await established()
    const lost = vi.fn()

    link.onLost(lost)
    await link.close()

    expect(socket.sent.at(-1)).toBe(`DISCONNECT\n\n${NUL}`)
    expect(socket.closeCalls).toEqual([1000])
    expect(lost).not.toHaveBeenCalled()
    await link.close()
    expect(socket.closeCalls).toEqual([1000])
  })

  it('finishes closing within the grace period even if the server never answers', async () => {
    const { link, socket } = await established()

    vi.useFakeTimers()
    socket.closesCleanly = false

    const closing = link.close()

    vi.advanceTimersByTime(2_000)
    await closing

    expect(socket.terminated).toBe(true)
  })

  it('beats at the agreed rate and drops a server that stops answering pings', async () => {
    vi.useFakeTimers()

    const { link, socket } = await established()
    const lost = vi.fn()

    link.onLost(lost)

    vi.advanceTimersByTime(30_000)
    expect(socket.sent.at(-1)).toBe('\n')
    expect(socket.pings).toBe(1)

    // The server shows it answers pings, then goes quiet.
    socket.emit('pong')
    vi.advanceTimersByTime(30_000)
    vi.advanceTimersByTime(30_000)
    expect(lost).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)

    expect(socket.terminated).toBe(true)
    expect(lost).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'connection-lost' })
    )
  })

  it('never enforces pings on a server that never answered one', async () => {
    vi.useFakeTimers()

    const { socket } = await established()

    vi.advanceTimersByTime(10 * 30_000)

    expect(socket.terminated).toBe(false)
    expect(socket.pings).toBe(10)
  })
})

describe('parseFrame', () => {
  it('skips heart-beat EOLs and keeps the first repeated header', () => {
    expect(parseFrame('\n\r\nCONNECTED\nversion:1.2\nversion:1.0\n\n')).toMatchObject({
      command: 'CONNECTED',
      headers: { version: '1.2' },
      body: '',
    })
  })

  it('treats prototype names as plain headers', () => {
    const frame = parseFrame('MESSAGE\n__proto__:x\nconstructor:y\n\n{}')

    expect(frame?.headers.__proto__).toBe('x')
    expect(frame?.headers.constructor).toBe('y')
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('returns null for an empty frame', () => {
    expect(parseFrame('\n\n')).toBeNull()
  })
})
