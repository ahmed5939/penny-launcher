import type { PresenceSnapshot } from '../../types/presence'

import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The real prefs store still loads (for its exports) and asks for storage.
vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

const selection = vi.hoisted(() => ({
  account: null as null | {
    accountId: string
    displayName: string
    customDisplayName?: string
  },
}))

vi.mock('../../hooks/accounts', () => ({
  useGetSelectedAccount: () => ({ selected: selection.account ?? undefined }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
/*
 * Server rendering reads zustand 4's initial state, not the current one, so
 * the stores are swapped for plain state this test sets directly.
 */
const stores = vi.hoisted(() => ({
  presence: { snapshot: null as unknown, busy: null as unknown },
  prefs: {} as Record<string, unknown>,
}))

vi.mock('../../state/accounts/presence', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../state/accounts/presence')>()
  const pick = <T,>(state: T, selector?: (state: T) => unknown) =>
    selector ? selector(state) : state

  return {
    ...actual,
    usePresenceStore: (selector?: (state: unknown) => unknown) =>
      pick(stores.presence, selector),
    usePresencePrefs: (selector?: (state: unknown) => unknown) =>
      pick(stores.prefs, selector),
  }
})
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => createElement('a', null, children),
}))

import { emptyPresenceSnapshot } from '../../state/accounts/presence'

import { PresenceStatusItem } from './status-item'
import { PresenceView } from './view'

const alice = { accountId: 'a'.repeat(32), displayName: 'Alice' }
const bob = { accountId: 'b'.repeat(32), displayName: 'Bob' }

/**
 * Synthetic states only — this is markup, not proof that anything reached
 * Epic.
 */
function render(snapshot: Partial<PresenceSnapshot>) {
  stores.presence = {
    busy: null,
    snapshot: { ...emptyPresenceSnapshot, ...snapshot },
  }

  return renderToStaticMarkup(createElement(PresenceView))
}

function text(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

beforeEach(() => {
  selection.account = alice
  stores.prefs = {
    text: 'Farming Twine',
    availability: 'online',
    durationMinutes: 60,
    setText: vi.fn(),
    setAvailability: vi.fn(),
    setDurationMinutes: vi.fn(),
  }
})

describe('Presence page', () => {
  it('asks for an account when none is selected', () => {
    selection.account = null

    const page = text(render({}))

    expect(page).toContain('No account selected')
    expect(page).not.toContain('Start presence')
  })

  it('names the account beside the form and starts nothing by itself', () => {
    const page = text(render({}))

    expect(page).toContain('Alice')
    expect(page).toContain('Start presence')
    expect(page).toContain('Nothing goes out until you press Start')
    expect(page).not.toContain('Presence session')
  })

  it('shows Connecting without claiming the status is live', () => {
    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'connecting',
        pending: { text: 'Farming Twine', availability: 'online' },
      })
    )

    expect(page).toContain('Connecting')
    expect(page).toContain('Waiting to publish')
    expect(page).not.toContain('what friends see now')
    expect(page).toContain('Stop presence')
  })

  it('shows the active session with its account, text, times and the online caveat', () => {
    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'active',
        text: 'Farming Twine',
        availability: 'away',
        lastPublishedAt: '2026-10-07T12:00:00.000Z',
        expiresAt: null,
      })
    )

    expect(page).toContain('Active')
    expect(page).toContain('Farming Twine')
    expect(page).toContain('Away · what friends see now')
    expect(page).toContain('When you stop it')
    expect(page).toContain('Update presence')
    expect(page).toMatch(/does not hide you or make you appear offline/)
  })

  it('shows a failure with sign-in and retry', () => {
    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'error',
        errorCode: 'reauth-required',
        errorMessage: 'Sign in to the account again, then retry.',
      })
    )

    expect(page).toContain('Presence stopped')
    expect(page).toContain('Sign in to the account again')
    expect(page).toContain('Sign in again')
    expect(page).toContain('Try again')
    expect(page).not.toContain('Stop presence')
  })

  it('says why it stepped aside for Fortnite', () => {
    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'stopped',
        stoppedReason: 'game-running',
      })
    )

    expect(page).toContain('Stepped aside')
    expect(page).toContain('Fortnite started')
    expect(page).toContain('Start presence')
  })

  it('shows reconnect progress', () => {
    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'reconnecting',
        retryAt: '2026-10-07T12:01:00.000Z',
        errorCode: 'connection-lost',
        errorMessage: 'The connection dropped.',
      })
    )

    expect(page).toContain('Reconnecting')
    expect(page).toContain('Next try')
    expect(page).toContain('Penny keeps trying on its own')
  })

  it('keeps the running account visible when the title bar shows another', () => {
    selection.account = bob

    const page = text(
      render({
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'active',
        text: 'Farming Twine',
        availability: 'online',
      })
    )

    expect(page).toContain('Alice')
    expect(page).toContain('Bob')
    expect(page).toContain('Presence is running for Alice. Starting here stops it.')
    expect(page).not.toContain('Update presence')
  })
})

describe('status bar item', () => {
  it('is absent when nothing is running', () => {
    stores.presence = { busy: null, snapshot: emptyPresenceSnapshot }

    expect(renderToStaticMarkup(createElement(PresenceStatusItem))).toBe('')
  })

  it('shows the running account and a labelled stop button', () => {
    stores.presence = {
      busy: null,
      snapshot: {
        ...emptyPresenceSnapshot,
        accountId: alice.accountId,
        displayName: 'Alice',
        state: 'active',
      },
    }

    const html = renderToStaticMarkup(createElement(PresenceStatusItem))

    expect(text(html)).toContain('Active · Alice')
    expect(html).toContain('aria-label="Stop presence"')
  })
})
