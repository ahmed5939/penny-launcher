import { afterEach, expect, it, vi } from 'vitest'
import { renderOnDemand } from './render-on-demand'

afterEach(() => vi.unstubAllGlobals())
it('settles without idle frames, supports damping, and stops hidden or disposed work', () => {
  const doc = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const pending = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal('document', doc)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key))
  const flush = () => {
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach((callback) => callback(0))
  }
  let damping = true
  const render = vi.fn(() => { if (damping) frames.request() })
  const frames = renderOnDemand(render)
  frames.request(); frames.request()
  expect(pending.size).toBe(1)
  flush()
  expect(pending.size).toBe(1)
  damping = false
  flush()
  expect(pending.size).toBe(0)
  expect(render).toHaveBeenCalledTimes(2)
  frames.request()
  doc.hidden = true
  const visibility = doc.addEventListener.mock.calls[0][1] as () => void
  visibility()
  frames.request()
  expect(pending.size).toBe(0)
  doc.hidden = false
  visibility()
  expect(pending.size).toBe(1)
  frames.dispose()
  frames.request()
  expect(pending.size).toBe(0)
  expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', visibility)
})
