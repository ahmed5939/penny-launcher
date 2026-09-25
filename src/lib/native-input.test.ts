import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installNativeInput } from './native-input'

const listeners = new Map<string, (event: Event) => void>()

function fire(type: string, init: Record<string, unknown> = {}) {
  const event = {
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...init,
  }
  listeners.get(type)?.(event as unknown as Event)

  return event
}

describe('installNativeInput', () => {
  beforeEach(() => {
    listeners.clear()
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: (event: Event) => void) =>
        listeners.set(type, listener),
    })
    installNativeInput()
  })

  it('stops Ctrl+wheel from zooming the page', () => {
    expect(fire('wheel', { ctrlKey: true }).preventDefault).toHaveBeenCalled()
  })

  it('leaves plain scrolling and claimed wheel events alone', () => {
    expect(fire('wheel', { ctrlKey: false }).preventDefault).not.toHaveBeenCalled()
    expect(
      fire('wheel', { ctrlKey: true, defaultPrevented: true }).preventDefault,
    ).not.toHaveBeenCalled()
  })

  it('shows "no drop" for unclaimed drags and never navigates on drop', () => {
    const dataTransfer = { dropEffect: 'copy' }
    expect(fire('dragover', { dataTransfer }).preventDefault).toHaveBeenCalled()
    expect(dataTransfer.dropEffect).toBe('none')
    expect(fire('drop').preventDefault).toHaveBeenCalled()
  })

  it('lets a real drop target keep its drop effect', () => {
    const dataTransfer = { dropEffect: 'copy' }
    fire('dragover', { dataTransfer, defaultPrevented: true })
    expect(dataTransfer.dropEffect).toBe('copy')
  })
})
