import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Server rendering reads the phase the hook mock returns, so each test sets
 * the phase it wants before rendering.
 */
const state = vi.hoisted(() => ({
  phase: { name: 'idle' } as Record<string, unknown>,
}))

vi.mock('./-hooks', () => ({
  useCountdown: () => null,
  useQuickLogin: () => ({
    cancel: () => undefined,
    phase: state.phase,
    reopen: () => undefined,
    start: () => undefined,
  }),
}))

import { QuickLoginPage } from './-page'

function render(phase: Record<string, unknown>) {
  state.phase = phase

  return renderToStaticMarkup(createElement(QuickLoginPage))
}

beforeEach(() => {
  state.phase = { name: 'idle' }
})

describe('Quick login page', () => {
  it('explains the flow in one line, not numbered steps', () => {
    const html = render({ name: 'idle' })

    expect(html).toContain('Sign in opens Epic in your browser.')
    expect(html).not.toMatch(/>[123]\.</)
  })

  it('announces progress while waiting for approval', () => {
    const html = render({ name: 'waiting', verificationUri: 'https://epicgames.com', expiresAt: 0 })

    expect(html).toMatch(/role="status"[^>]*>.*Waiting for you to approve in the browser…/)
  })

  it('names the busy button while starting', () => {
    const html = render({ name: 'starting' })

    expect(html).toContain('Signing in…')
  })
})
