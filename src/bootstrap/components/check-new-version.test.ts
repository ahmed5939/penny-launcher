import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import type { Action, ExternalToast } from 'sonner'

import { toast } from '../../lib/notifications'
import { CheckNewVersion } from './check-new-version'

const hooks = vi.hoisted(() => ({
  slot: 0,
  deps: [] as Array<Array<unknown> | undefined>,
  cleanups: [] as Array<(() => void) | undefined>,
}))
const i18n = vi.hoisted(() => ({
  language: 'en-US',
  t: (key: string): string => `${i18n.language}:${key}`,
}))
const translator = vi.hoisted(() => ({ t: () => undefined }))

vi.mock('react', () => ({
  // Runs an effect only when its deps change, as React does.
  useEffect: (effect: () => (() => void) | void, deps: Array<unknown>) => {
    const slot = hooks.slot++
    const previous = hooks.deps[slot]

    if (previous && deps.every((dep, index) => Object.is(dep, previous[index]))) {
      return
    }

    hooks.cleanups[slot]?.()
    const cleanup = effect()
    hooks.cleanups[slot] = typeof cleanup === 'function' ? cleanup : undefined
    hooks.deps[slot] = deps
  },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n, t: translator.t }) }))
vi.mock('../../lib/notifications', () => ({ toast: { info: vi.fn() } }))

beforeEach(() => {
  hooks.slot = 0
  hooks.deps.length = 0
  hooks.cleanups.length = 0
  i18n.language = 'en-US'
})
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

function render() {
  hooks.slot = 0
  CheckNewVersion()
}

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
  render()
  expect(api.requestNewVersionStatus).toHaveBeenCalledTimes(1)
  const respond = api.responseNewVersionStatus.mock.calls[0][0]
  await respond({ version: 'v2.0.0', link: 'https://github.com/example/releases/v2.0.0' })
  expect(toast.info).toHaveBeenCalledTimes(1)
  const [title, options] = vi.mocked(toast.info).mock.calls[0]
  expect(title).toBe('en-US:version.title')
  expect(options).toMatchObject({ id: 'new-version', duration: Infinity, action: { label: 'en-US:version.action' } })
  const action = (options as ExternalToast).action as Action
  action.onClick({} as MouseEvent<HTMLButtonElement>)
  expect(api.openExternalURL).toHaveBeenCalledWith('https://github.com/example/releases/v2.0.0')
})

it('requests the release check once, however often the translator changes', () => {
  const api = stubApi()
  render()
  i18n.language = 'de-DE'
  translator.t = () => undefined
  render()
  render()
  expect(api.requestNewVersionStatus).toHaveBeenCalledTimes(1)
  expect(api.responseNewVersionStatus).toHaveBeenCalledTimes(1)
})

it('translates the toast in the language current when the reply lands', async () => {
  const api = stubApi()
  render()
  i18n.language = 'de-DE'
  render()
  await api.responseNewVersionStatus.mock.calls[0][0]({ version: 'v2.0.0', link: 'https://github.com/example/releases/v2.0.0' })
  expect(vi.mocked(toast.info).mock.calls[0][0]).toBe('de-DE:version.title')
})

it('stays quiet when there is no newer release', async () => {
  const api = stubApi()
  render()
  await api.responseNewVersionStatus.mock.calls[0][0](null)
  expect(toast.info).not.toHaveBeenCalled()
})
