import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  forward: vi.fn(),
  invalidate: vi.fn(),
  togglePane: vi.fn(),
  setPrimary: vi.fn(),
  cleanup: [] as Array<() => void>,
}))
vi.mock('react', () => ({
  useEffect: (effect: () => () => void) => mocks.cleanup.push(effect()),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: { back: mocks.back, forward: mocks.forward },
    invalidate: mocks.invalidate,
  }),
}))
vi.mock('../../state/ui/shell', () => ({
  useShellStore: { getState: () => ({ togglePane: mocks.togglePane }) },
}))
vi.mock('../../state/accounts/scope', () => ({
  useAccountScopeStore: {
    getState: () => ({
      members: ['one', 'two'],
      primary: 'one',
      setPrimary: mocks.setPrimary,
    }),
  },
}))
vi.mock('../../state/accounts/list', () => ({
  useAccountListStore: {
    getState: () => ({
      accounts: { one: {}, two: {} },
      idsList: ['one', 'two'],
    }),
  },
}))

import { useAppKeyboard } from './keyboard'

class FocusNode {
  tagName = 'BUTTON'
  isContentEditable = false
  visible = true
  children: Array<FocusNode> = []
  getClientRects() {
    return this.visible ? [{}] : []
  }
  closest() {
    return null
  }
  contains(node: unknown) {
    return node === this || this.children.includes(node as FocusNode)
  }
  querySelectorAll() {
    return this.children
  }
  focus() {
    dom.activeElement = this
  }
}
const dom = {
  activeElement: null as FocusNode | null,
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
}
let handler: (event: KeyboardEvent) => void
const send = (key: string, extras: Partial<KeyboardEvent> = {}) => {
  const event = {
    key,
    target: dom.activeElement,
    preventDefault: vi.fn(),
    ...extras,
  }
  handler(event as unknown as KeyboardEvent)
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  dom.activeElement = null
  dom.querySelector.mockReturnValue(null)
  vi.stubGlobal('HTMLElement', FocusNode)
  vi.stubGlobal('document', dom)
  vi.stubGlobal('window', {
    addEventListener: (_name: string, callback: typeof handler) => {
      handler = callback
    },
    removeEventListener: vi.fn(),
  })
  useAppKeyboard()
})
afterEach(() => {
  mocks.cleanup.splice(0).forEach((cleanup) => cleanup())
  vi.unstubAllGlobals()
})

describe('shell keyboard navigation', () => {
  it('skips the CSS-hidden pane and invisible controls with F6', () => {
    const rail = new FocusNode(),
      pane = new FocusNode(),
      content = new FocusNode()
    pane.visible = false
    const hiddenControl = new FocusNode(),
      visibleControl = new FocusNode()
    hiddenControl.visible = false
    content.children = [hiddenControl, visibleControl]
    dom.querySelectorAll.mockReturnValue([rail, pane, content])
    dom.activeElement = rail
    send('F6')
    expect(dom.activeElement).toBe(visibleControl)
    send('F6', { shiftKey: true })
    expect(dom.activeElement).toBe(rail)
  })
  it('starts at the final region when cycling backward from outside the shell', () => {
    const header = new FocusNode(),
      content = new FocusNode()
    dom.querySelectorAll.mockReturnValue([header, content])
    send('F6', { shiftKey: true })
    expect(dom.activeElement).toBe(content)
  })
  it('does not move focus out of an open dialog', () => {
    const control = new FocusNode()
    dom.activeElement = control
    dom.querySelector.mockReturnValue({})
    send('F6')
    expect(dom.activeElement).toBe(control)
    expect(dom.querySelectorAll).not.toHaveBeenCalled()
  })
  it('keeps Ctrl+B out of text fields', () => {
    const input = new FocusNode()
    input.tagName = 'INPUT'
    dom.activeElement = input
    send('b', { ctrlKey: true })
    expect(mocks.togglePane).not.toHaveBeenCalled()
    dom.activeElement = new FocusNode()
    expect(send('b', { ctrlKey: true }).preventDefault).toHaveBeenCalled()
    expect(mocks.togglePane).toHaveBeenCalledOnce()
  })
  it('preserves account shortcuts and history navigation', () => {
    dom.activeElement = new FocusNode()
    send('2', { ctrlKey: true })
    expect(mocks.setPrimary).toHaveBeenLastCalledWith('two')
    send('Tab', { ctrlKey: true })
    expect(mocks.setPrimary).toHaveBeenLastCalledWith('two')
    send('ArrowLeft', { altKey: true })
    send('ArrowRight', { altKey: true })
    expect(mocks.back).toHaveBeenCalledOnce()
    expect(mocks.forward).toHaveBeenCalledOnce()
  })
})
