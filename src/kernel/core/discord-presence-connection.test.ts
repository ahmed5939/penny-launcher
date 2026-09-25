import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  error: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))
vi.mock('node:net', () => ({ createConnection: mocks.connect }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: mocks.error } }))
vi.mock('./fortnite-log-watcher', () => ({
  LogWatcher: class {
    onLine() {}
    start = mocks.start
    stop = mocks.stop
  },
}))

class FakeSocket extends EventEmitter {
  destroyed = false
  write = vi.fn()
  destroy() {
    if (this.destroyed) return this
    this.destroyed = true
    this.emit('close')
    return this
  }
}
const frame = (opcode: number, payload: unknown) => {
  const bytes = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(JSON.stringify(payload))
  const header = Buffer.alloc(8)
  header.writeUInt32LE(opcode)
  header.writeUInt32LE(bytes.length, 4)
  return Buffer.concat([Uint8Array.from(header), Uint8Array.from(bytes)])
}
const activity = (socket: FakeSocket) =>
  JSON.parse(
    Buffer.from(socket.write.mock.calls.at(-1)![0])
      .subarray(8)
      .toString('utf8'),
  )
let presence: typeof import('./discord-presence').DiscordPresence
let sockets: Array<FakeSocket>

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  sockets = []
  mocks.start.mockResolvedValue(undefined)
  mocks.connect.mockImplementation(() => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  })
  presence = (await import('./discord-presence')).DiscordPresence
})
afterEach(() => {
  presence.destroy()
  vi.useRealTimers()
})

const ready = () => {
  const socket = sockets.at(-1)!
  socket.emit('connect')
  socket.emit('data', frame(1, { evt: 'READY' }))
  return socket
}

describe('Discord IPC lifecycle', () => {
  it('waits for READY and publishes the latest account with a seconds timestamp', () => {
    presence.init(true)
    const socket = sockets[0]
    socket.emit('connect')
    expect(socket.write).toHaveBeenCalledOnce()
    expect(activity(socket)).toMatchObject({ v: 1 })
    presence.setAccountName('Current account')
    expect(socket.write).toHaveBeenCalledOnce()
    socket.emit('data', frame(1, { evt: 'READY' }))
    expect(activity(socket)).toMatchObject({
      cmd: 'SET_ACTIVITY',
      args: {
        activity: {
          state: 'Current account',
          timestamps: { start: Math.floor(Date.now() / 1000) },
        },
      },
    })
  })

  it('retries when Discord starts after Penny', () => {
    presence.init(true)
    for (let i = 0; i < 10; i++)
      sockets[i].emit('error', new Error('Not running'))
    expect(sockets).toHaveLength(10)
    vi.advanceTimersByTime(15_000)
    expect(sockets).toHaveLength(11)
    expect(activity(ready()).cmd).toBe('SET_ACTIVITY')
  })

  it('reconnects and republishes after Discord restarts', () => {
    presence.init(true)
    ready().destroy()
    presence.setAccountName('New account')
    vi.advanceTimersByTime(15_000)
    expect(sockets).toHaveLength(2)
    expect(activity(ready()).args.activity.state).toBe('New account')
  })

  it('echoes heartbeat bytes and handles fragmented and combined frames', () => {
    presence.init(true)
    const socket = sockets[0]
    socket.emit('connect')
    const payload = Buffer.from([0, 255, 42])
    const frames = Buffer.concat([
      Uint8Array.from(frame(1, { evt: 'READY' })),
      Uint8Array.from(frame(3, payload)),
    ])
    socket.emit('data', frames.subarray(0, 6))
    expect(socket.write).toHaveBeenCalledOnce()
    socket.emit('data', frames.subarray(6))
    expect(socket.write).toHaveBeenCalledTimes(3)
    expect(Buffer.from(socket.write.mock.calls.at(-1)![0])).toEqual(
      frame(4, payload),
    )
  })

  it('cancels pending handshakes and ignores callbacks after disabling', () => {
    presence.init(true)
    const socket = sockets[0]
    presence.setEnabled(false)
    socket.emit('connect')
    socket.emit('data', frame(1, { evt: 'READY' }))
    socket.emit('error', new Error('Late failure'))
    vi.advanceTimersByTime(60_000)
    expect(socket.destroyed).toBe(true)
    expect(socket.write).not.toHaveBeenCalled()
    expect(sockets).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('recovers from a handshake that never completes', () => {
    presence.init(true)
    sockets[0].emit('connect')
    vi.advanceTimersByTime(10_000)
    expect(sockets[0].destroyed).toBe(true)
    vi.advanceTimersByTime(15_000)
    expect(sockets).toHaveLength(2)
  })

  it('logs RPC rejections and reconnects on protocol close', () => {
    presence.init(true)
    const socket = ready()
    socket.emit(
      'data',
      frame(1, {
        evt: 'ERROR',
        data: { code: 4000, message: 'Invalid activity' },
      }),
    )
    expect(mocks.error).toHaveBeenCalledWith(
      'discord:rpc',
      '4000: Invalid activity',
    )
    socket.emit('data', frame(2, { message: 'Closed' }))
    expect(socket.destroyed).toBe(true)
    vi.advanceTimersByTime(15_000)
    expect(sockets).toHaveLength(2)
  })

  it('rejects oversized frames instead of buffering indefinitely', () => {
    presence.init(true)
    const socket = ready()
    const header = Buffer.alloc(8)
    header.writeUInt32LE(1)
    header.writeUInt32LE(0xffffffff, 4)
    socket.emit('data', header)
    expect(socket.destroyed).toBe(true)
    expect(mocks.error).toHaveBeenCalled()
  })

  it('stops a watcher that finishes starting after shutdown', async () => {
    let finish!: () => void
    mocks.start.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    presence.init(true)
    presence.setGameRunning(true)
    presence.destroy()
    expect(mocks.stop).toHaveBeenCalledOnce()
    finish()
    await Promise.resolve()
    expect(mocks.stop).toHaveBeenCalledTimes(2)
  })

  it('restarts game mode tracking when presence is re-enabled during a game', () => {
    presence.init(false)
    presence.setGameRunning(true)
    expect(mocks.start).not.toHaveBeenCalled()
    presence.setEnabled(true)
    expect(mocks.start).toHaveBeenCalledOnce()
    presence.setEnabled(false)
    expect(mocks.stop).toHaveBeenCalledOnce()
    presence.setEnabled(true)
    expect(mocks.start).toHaveBeenCalledTimes(2)
  })
})
