import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: Array<unknown>) => Promise<unknown>>(),
  window: null as null | {
    isDestroyed: () => boolean
    webContents: { id: number; mainFrame: object }
  },
  error: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: Array<unknown>) => Promise<unknown>) =>
      mocks.handlers.set(channel, handler),
    on: vi.fn(),
  },
}))
vi.mock('./startup/windows/main', () => ({
  MainWindow: {
    get instance() {
      return mocks.window
    },
  },
}))
vi.mock('./runtime-log', () => ({ RuntimeLog: { error: mocks.error } }))

import { secureIpcHandle } from './secure-ipc'

const mainFrame = {}

beforeEach(() => {
  mocks.handlers.clear()
  mocks.window = {
    isDestroyed: () => false,
    webContents: { id: 1, mainFrame },
  }
})

function event(senderId: number, senderFrame: object | null) {
  return { sender: { id: senderId, mainFrame }, senderFrame }
}

describe('secureIpcHandle', () => {
  it('runs the listener for the main window', async () => {
    const listener = vi.fn(async () => 'ok')

    secureIpcHandle('test', listener, { mainFrameOnly: true })

    await expect(
      mocks.handlers.get('test')!(event(1, mainFrame), 'arg')
    ).resolves.toBe('ok')
    expect(listener).toHaveBeenCalledWith(expect.anything(), 'arg')
  })

  it('rejects another webContents', async () => {
    const listener = vi.fn()

    secureIpcHandle('test', listener, { mainFrameOnly: true })

    await expect(mocks.handlers.get('test')!(event(2, mainFrame))).rejects.toThrow(
      'Request rejected.'
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it('rejects a sub-frame of the main window when asked to', async () => {
    const listener = vi.fn()

    secureIpcHandle('strict', listener, { mainFrameOnly: true })
    secureIpcHandle('loose', listener)

    await expect(mocks.handlers.get('strict')!(event(1, {}))).rejects.toThrow(
      'Request rejected.'
    )
    await expect(mocks.handlers.get('strict')!(event(1, null))).rejects.toThrow(
      'Request rejected.'
    )
    expect(listener).not.toHaveBeenCalled()

    await mocks.handlers.get('loose')!(event(1, {}))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized payloads', async () => {
    const listener = vi.fn()

    secureIpcHandle('test', listener, { mainFrameOnly: true })

    await expect(
      mocks.handlers.get('test')!(event(1, mainFrame), 'x'.repeat(1_000_001))
    ).rejects.toThrow('Request rejected.')
    expect(listener).not.toHaveBeenCalled()
  })
})
