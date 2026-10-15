import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { toast } from '../../lib/notifications'
import { CheckNewVersion } from './check-new-version'

const effects = vi.hoisted(() => [] as Array<() => (() => void) | void>)
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | void) => effects.push(effect) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../lib/notifications', () => ({ toast: { info: vi.fn() } }))

beforeEach(() => { effects.length = 0 })
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

function stubApi() {
  const api = {
    responseNewVersionStatus: vi.fn<(callback: (data: unknown) => Promise<void>) => { removeListener: ReturnType<typeof vi.fn> }>().mockReturnValue({ removeListener: vi.fn() }),
    requestNewVersionStatus: vi.fn(),
    openExternalURL: vi.fn(),
  }
  vi.stubGlobal('window', { electronAPI: api })
  return api
}

it('toasts a newer release once, with an action that opens it', async () => {
  const api = stubApi()
  CheckNewVersion()
  effects.pop()!()
  expect(api.requestNewVersionStatus).toHaveBeenCalledTimes(1)
  const respond = api.responseNewVersionStatus.mock.calls[0][0]
  await respond({ version: 'v2.0.0', link: 'https://github.com/example/releases/v2.0.0' })
  expect(toast.info).toHaveBeenCalledTimes(1)
  const [title, options] = vi.mocked(toast.info).mock.calls[0]
  expect(title).toBe('version.title')
  expect(options).toMatchObject({ id: 'new-version', duration: Infinity, action: { label: 'version.action' } })
  ;(options as { action: { onClick: () => void } }).action.onClick()
  expect(api.openExternalURL).toHaveBeenCalledWith('https://github.com/example/releases/v2.0.0')
})

it('stays quiet when there is no newer release', async () => {
  const api = stubApi()
  CheckNewVersion()
  effects.pop()!()
  await api.responseNewVersionStatus.mock.calls[0][0](null)
  expect(toast.info).not.toHaveBeenCalled()
})
