import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const entries = vi.hoisted(() => ({ main: vi.fn(), overlay: vi.fn() }))
vi.mock('../app', () => {
  entries.main()
  return {}
})
vi.mock('../overlay/app', () => {
  entries.overlay()
  return {}
})
vi.mock('../globals.css', () => ({}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

describe('renderer entry selection', () => {
  it('starts the overlay without the main-window bridge or storage', async () => {
    const addClass = vi.fn()
    const body = { dataset: {} as Record<string, string> }
    vi.stubGlobal('document', {
      documentElement: { classList: { add: addClass } },
      body,
    })
    vi.stubGlobal('window', {
      location: { search: '?penny-overlay=1' },
      pennyOverlay: {},
    })
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Overlay must not read main-window appearance')
      },
    })

    await import('./renderer')
    await vi.dynamicImportSettled()

    expect(body.dataset.pennyOverlay).toBe('true')
    expect(addClass).toHaveBeenCalledWith('dark')
    expect(entries.overlay).toHaveBeenCalledOnce()
    expect(entries.main).not.toHaveBeenCalled()
  })

  it('preserves the main window appearance and entry', async () => {
    const root = {
      classList: { add: vi.fn() },
      dataset: {} as Record<string, string>,
    }
    vi.stubGlobal('document', { documentElement: root, body: { dataset: {} } })
    vi.stubGlobal('window', {
      location: { search: '' },
      electronAPI: { initialAppearance: { resolved: 'light' } },
    })
    vi.stubGlobal('localStorage', { getItem: () => 'rose' })

    await import('./renderer')
    await vi.dynamicImportSettled()

    expect(root.classList.add).toHaveBeenCalledWith('light')
    expect(root.dataset.theme).toBe('rose')
    expect(entries.main).toHaveBeenCalledOnce()
  })
})
