import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IslandIdentity } from './island-directory'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  error: vi.fn(),
  line: null as ((line: string) => void) | null,
  lookup: vi.fn(),
  peek: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))
vi.mock('node:net', () => ({ createConnection: mocks.connect }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: mocks.error } }))
vi.mock('./fortnite-log-watcher', () => ({
  LogWatcher: class {
    onLine(listener: (line: string) => void) {
      mocks.line = listener
    }
    start = mocks.start
    stop = mocks.stop
  },
}))
vi.mock('./island-directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./island-directory')>()),
  IslandDirectory: { lookup: mocks.lookup, peek: mocks.peek },
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
  mocks.line = null
  mocks.peek.mockReturnValue(null)
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

const code = '6155-1398-4059'
const art =
  'https://cdn-0001.qstv.on.epicgames.com/LCLNkOFcWZzuXqOpFO/image/landscape_comp_s_b.jpeg'
const link = (mnemonic: string) =>
  `[2026.10.01-19.20.02:114][512]MatchmakingLog: [2a77] Link id changing from [Mnemonic=[] Version=[latest]] to [Mnemonic=[${mnemonic}] Version=[latest]]`
const island = (identity: Partial<IslandIdentity> = {}): IslandIdentity => ({
  code,
  title: null,
  imageUrl: null,
  url: `https://www.fortnite.com/creative/island-codes/${code}`,
  ...identity,
})
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
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

describe('creator island presence', () => {
  const inGame = () => {
    presence.init(true)
    const socket = ready()
    presence.setAccountName('PennyMain')
    presence.setGameRunning(true)
    return socket
  }

  it('publishes the code at once, then the title, art and island link', async () => {
    let answer!: (identity: IslandIdentity) => void
    mocks.lookup.mockReturnValue(
      new Promise<IslandIdentity>((resolve) => {
        answer = resolve
      }),
    )
    const socket = inGame()
    mocks.line!(link(code))
    expect(mocks.lookup).toHaveBeenCalledWith(code)
    expect(activity(socket).args.activity).toMatchObject({
      details: `Island ${code}`,
      state: 'PennyMain',
      buttons: [
        {
          label: 'View island',
          url: `https://www.fortnite.com/creative/island-codes/${code}`,
        },
      ],
    })
    expect(activity(socket).args.activity).not.toHaveProperty('assets')
    answer(island({ title: '1V1 WITH EVERY GUN', imageUrl: art }))
    await settle()
    expect(activity(socket).args.activity).toMatchObject({
      details: '1V1 WITH EVERY GUN',
      state: 'PennyMain',
      assets: { large_image: art, large_text: code },
    })
  })

  it('ignores other islands named in the log and BR heuristics', () => {
    mocks.lookup.mockReturnValue(new Promise(() => {}))
    const socket = inGame()
    mocks.line!(link(code))
    const writes = socket.write.mock.calls.length
    mocks.line!(
      '[2026.10.01-19.10.51:428][295]LogActivityImageContext: Warning: Requesting PNG image for activity [Mnemonic=[0148-0322-5437] Version=[latest]]. Path: [https://cdn2.unrealengine.com/a.png]',
    )
    mocks.line!(
      '[2026.10.01-19.10.41:250][911]LogJoinInProgress: Verbose: [Presence.Parse] user=MCP:27944...85b3e SessionId(empty=False) SessionKey(empty=True) Playlist=Playlist_PunchBerryNoBuildSolo ServerPlayers=12',
    )
    mocks.line!(
      `[2026.10.01-19.20.03:002][540]LogMatchmakingUtility: [3273] LinkId: 'Mnemonic=[${code}] Version=[latest]'.`,
    )
    expect(socket.write.mock.calls.length).toBe(writes)
    expect(mocks.lookup).toHaveBeenCalledOnce()
  })

  it('keeps STW once selected even when friends play BR', () => {
    const socket = inGame()
    mocks.line!(link('campaign'))
    mocks.line!(
      '[2026.10.01-19.10.41:250][911]LogJoinInProgress: Verbose: [Presence.Parse] user=MCP:27944...85b3e SessionId(empty=False) SessionKey(empty=True) Playlist=Playlist_PunchBerryNoBuildSolo ServerPlayers=12',
    )
    expect(activity(socket).args.activity.details).toBe('In Save the World')
    expect(activity(socket).args.activity).not.toHaveProperty('assets')
    expect(activity(socket).args.activity).not.toHaveProperty('buttons')
  })

  it('drops a title that arrives after the player moved on', async () => {
    let answer!: (identity: IslandIdentity) => void
    mocks.lookup.mockReturnValue(
      new Promise<IslandIdentity>((resolve) => {
        answer = resolve
      }),
    )
    const socket = inGame()
    mocks.line!(link(code))
    mocks.line!(link('campaign'))
    const writes = socket.write.mock.calls.length
    answer(island({ title: '1V1 WITH EVERY GUN', imageUrl: art }))
    await settle()
    expect(socket.write.mock.calls.length).toBe(writes)
    expect(activity(socket).args.activity.details).toBe('In Save the World')
  })

  it('uses what the Islands page already knows without waiting', () => {
    mocks.peek.mockReturnValue(
      island({ title: '1V1 WITH EVERY GUN', imageUrl: art }),
    )
    mocks.lookup.mockReturnValue(new Promise(() => {}))
    const socket = inGame()
    mocks.line!(link(code))
    expect(activity(socket).args.activity).toMatchObject({
      details: '1V1 WITH EVERY GUN',
      assets: { large_image: art, large_text: code },
    })
  })

  it('clears the island on a reset, a playlist and game exit', () => {
    mocks.lookup.mockReturnValue(new Promise(() => {}))
    const socket = inGame()

    mocks.line!(link(code))
    mocks.line!(link(''))
    expect(activity(socket).args.activity).not.toHaveProperty('buttons')

    mocks.line!(link(code))
    mocks.line!(link('playlist_figment_martin_md'))
    expect(activity(socket).args.activity.details).toBe('In Battle Royale')
    expect(activity(socket).args.activity).not.toHaveProperty('buttons')

    mocks.line!(link(code))
    presence.setGameRunning(false)
    expect(activity(socket).args.activity).toMatchObject({
      details: 'In launcher',
      state: 'PennyMain',
    })
    expect(activity(socket).args.activity).not.toHaveProperty('buttons')
  })
})
