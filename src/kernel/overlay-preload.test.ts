import type { OverlaySnapshot } from '../types/overlay'
import { beforeEach, expect, it, vi } from 'vitest'

const ipc = vi.hoisted(() => ({ expose: vi.fn(), on: vi.fn() }))
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: ipc.expose },
  ipcRenderer: { on: ipc.on },
}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

it('replays an early snapshot and keeps delivering updates until unsubscribe', async () => {
  await import('./overlay-preload')
  const receive = ipc.on.mock.calls[0][1]
  const bridge = ipc.expose.mock.calls[0][1] as {
    onSnapshot: (callback: (snapshot: OverlaySnapshot) => void) => {
      removeListener: () => void
    }
  }
  const early: OverlaySnapshot = {
    players: [],
    position: 'top-right',
    status: 'Select an account in Penny first.',
    updatedAt: '2026-09-05T00:00:00Z',
  }
  receive({}, early)
  const callback = vi.fn()
  const listener = bridge.onSnapshot(callback)
  expect(callback).toHaveBeenCalledExactlyOnceWith(early)

  const loaded: OverlaySnapshot = {
    ...early,
    status: undefined,
    players: [{ displayName: 'Player', quests: [] }],
  }
  receive({}, loaded)
  expect(callback).toHaveBeenLastCalledWith(loaded)
  listener.removeListener()
  receive({}, early)
  expect(callback).toHaveBeenCalledTimes(2)
  expect(ipc.expose.mock.calls[0][0]).toBe('pennyOverlay')
  expect(Object.keys(bridge)).toEqual(['onSnapshot'])
})
