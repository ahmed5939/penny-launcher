import type { LobbyHackResult } from '../../types/lobby-hacks'

import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import lobbyHackStrings from '../../locales/en-US/account-management/lobby-hacks.json'
import sidebarStrings from '../../locales/en-US/sidebar.json'

const alice = { accountId: 'a'.repeat(32), displayName: 'Alice' }
const bob = {
  accountId: 'b'.repeat(32),
  displayName: 'bob_epic',
  customDisplayName: 'Bob',
}

const fixtures = vi.hoisted(() => ({
  accounts: {} as Record<string, unknown>,
  primary: null as unknown,
  missingKeys: [] as Array<string>,
}))

vi.mock('../../hooks/accounts', () => ({
  useGetAccounts: () => ({
    accountList: fixtures.accounts,
    idsList: Object.keys(fixtures.accounts),
    accountsArray: Object.values(fixtures.accounts),
  }),
  useGetSelectedAccount: () => ({ selected: fixtures.primary ?? undefined }),
}))

/** The real en-US strings, so a missing key fails here rather than on screen. */
vi.mock('react-i18next', () => {
  const resources: Record<string, unknown> = {
    'account-management': { 'lobby-hacks': lobbyHackStrings },
    sidebar: sidebarStrings,
  }

  return {
    useTranslation: (namespaces?: string | Array<string>) => {
      const fallback = Array.isArray(namespaces) ? namespaces[0] : namespaces

      return {
        t: (key: string, values: Record<string, unknown> = {}) => {
          const [ns, path] = key.includes(':')
            ? key.split(':')
            : [fallback ?? 'general', key]
          const found = path
            .split('.')
            .reduce<unknown>(
              (node, part) =>
                node && typeof node === 'object'
                  ? (node as Record<string, unknown>)[part]
                  : undefined,
              resources[ns]
            )

          if (typeof found !== 'string') {
            fixtures.missingKeys.push(key)

            return key
          }

          return found.replace(/\{\{(\w+)\}\}/g, (_, name) =>
            String(values[name])
          )
        },
      }
    },
  }
})
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) =>
    createElement('a', null, children),
}))
/*
 * Server rendering reads zustand's initial state, so the hook reads the
 * real store's current state instead. Everything else in the module, the
 * submit included, is the real thing.
 */
vi.mock('./store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./store')>()
  const store = actual.useLobbyHackStore
  const hook = (
    selector?: (state: ReturnType<typeof store.getState>) => unknown
  ) => (selector ? selector(store.getState()) : store.getState())

  return {
    ...actual,
    useLobbyHackStore: Object.assign(hook, {
      getState: store.getState,
      setState: store.setState,
    }),
  }
})

import { unknownResult } from './model'
import {
  setLobbyHackDraft,
  submitLobbyHackCode,
  useLobbyHackStore,
} from './store'
import { LobbyHacksView } from './view'

function page() {
  return renderToStaticMarkup(createElement(LobbyHacksView))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

function markup() {
  return renderToStaticMarkup(createElement(LobbyHacksView))
}

function submitButton(html: string) {
  return html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? ''
}

function isDisabled(button: string) {
  return /\sdisabled=""/.test(button)
}

function result(fields: Partial<LobbyHackResult>): LobbyHackResult {
  return { ...unknownResult(alice.accountId), ...fields }
}

beforeEach(() => {
  fixtures.accounts = {
    [alice.accountId]: alice,
    [bob.accountId]: bob,
  }
  fixtures.primary = alice
  fixtures.missingKeys = []
  useLobbyHackStore.setState({
    draft: { accountId: null, code: '' },
    pending: null,
    last: null,
  })
})

describe('BR Lobby Hacks page', () => {
  it('asks for an account when none is linked', () => {
    fixtures.accounts = {}
    fixtures.primary = null

    const text = page()

    expect(text).toContain('BR Lobby Hacks')
    expect(text).toContain('No linked accounts')
    expect(submitButton(markup())).toBe('')
  })

  it('opens on the title-bar account with Submit disabled until a code is typed', () => {
    const html = markup()
    const text = page()

    expect(text).toContain('BR Lobby Hacks')
    expect(text).toContain('Beta')
    expect(text).toContain('lobby effects only play in game')
    expect(text).toContain('Nothing is sent until you press Submit')
    expect(text).toContain('Submits for Alice')
    expect(text).toContain('0 of 256 characters')
    expect(isDisabled(submitButton(html))).toBe(true)
    expect(fixtures.missingKeys).toEqual([])
  })

  it('enables Submit for a valid code and shows the code as typed', () => {
    setLobbyHackDraft({ code: '  Cheat-Code 42!  ' })

    const html = markup()

    expect(isDisabled(submitButton(html))).toBe(false)
    expect(html).toContain('value="  Cheat-Code 42!  "')
    expect(page()).toContain('14 of 256 characters')
  })

  it('names a picked account rather than the title-bar one', () => {
    setLobbyHackDraft({ accountId: bob.accountId })

    expect(page()).toContain('Submits for Bob')
  })

  it('explains a code it will not send', () => {
    setLobbyHackDraft({ code: 'x'.repeat(300) })
    expect(page()).toContain('That is 300 characters; the limit is 256.')
    expect(isDisabled(submitButton(markup()))).toBe(true)

    setLobbyHackDraft({ code: 'ONE\nTWO' })
    expect(page()).toContain('One code at a time')
    expect(isDisabled(submitButton(markup()))).toBe(true)
    expect(fixtures.missingKeys).toEqual([])
  })

  it('runs a submission end to end for one fixed account', async () => {
    let answer!: (result: LobbyHackResult) => void
    const send = vi.fn(
      () =>
        new Promise<LobbyHackResult>((resolve) => {
          answer = resolve
        })
    )

    setLobbyHackDraft({ accountId: bob.accountId, code: 'Cheat-Code 42!' })

    const running = submitLobbyHackCode(bob.accountId, 'Cheat-Code 42!', send)

    // While pending: the account and code are fixed and nothing can be resent.
    const pendingHtml = markup()
    const pendingText = page()

    expect(send).toHaveBeenCalledWith({
      accountId: bob.accountId,
      code: 'Cheat-Code 42!',
    })
    expect(pendingText).toContain('Submitting for')
    expect(pendingText).toContain('Bob')
    expect(pendingText).toContain('Cheat-Code 42!')
    expect(isDisabled(submitButton(pendingHtml))).toBe(true)
    expect(pendingHtml).toMatch(/role="status"/)

    // The title bar moving does not move the submission.
    fixtures.primary = alice
    answer({
      ...unknownResult(bob.accountId),
      outcome: 'granted',
      canRepeat: false,
      httpStatus: 200,
      rewards: [
        {
          itemType: 'AthenaBackpack:backpack_wintergift',
          name: 'Winter Gift',
          quantity: 1,
          itemProfile: 'athena',
          imageUrl: null,
        },
        {
          itemType: 'Currency:MtxGiveaway',
          name: 'V-Bucks',
          quantity: 1500,
          itemProfile: 'common_core',
          imageUrl: null,
        },
      ],
    })
    await running

    const text = page()

    expect(text).toContain('Rewards granted')
    expect(text).toContain('Epic confirmed the code and granted its rewards.')
    expect(text).toContain('Bob')
    expect(text).toContain("Rewards in Epic's reply")
    expect(text).toContain('Winter Gift')
    expect(text).toContain('AthenaBackpack:backpack_wintergift')
    expect(text).toContain('×1,500')
    // The spent code is cleared from the form.
    expect(useLobbyHackStore.getState().draft.code).toBe('')
    expect(send).toHaveBeenCalledTimes(1)
    expect(fixtures.missingKeys).toEqual([])
  })

  it('shows an answer without the terminal notification as not confirmed', () => {
    useLobbyHackStore.setState({
      last: {
        accountId: alice.accountId,
        code: 'CODE',
        result: result({ outcome: 'unconfirmed', httpStatus: 200 }),
      },
    })

    const text = page()

    expect(text).toContain('Not confirmed')
    expect(text).toContain('Check the account in game before submitting this code again.')
    expect(text).not.toContain('Rewards granted')
  })

  it('warns after a lost connection that the code may have gone through', () => {
    useLobbyHackStore.setState({
      last: {
        accountId: alice.accountId,
        code: 'CODE',
        result: result({ outcome: 'uncertain' }),
      },
    })

    const text = page()

    expect(text).toContain('Result unknown')
    expect(text).toContain('may or may not have gone through')
    expect(text).toContain('Check the account in game')
  })

  it("offers sign-in after an auth failure and shows Epic's reason for refusals", () => {
    useLobbyHackStore.setState({
      last: {
        accountId: alice.accountId,
        code: 'CODE',
        result: result({ outcome: 'auth-failed' }),
      },
    })
    expect(page()).toContain('Sign in again')

    useLobbyHackStore.setState({
      last: {
        accountId: alice.accountId,
        code: 'CODE',
        result: result({
          outcome: 'cooldown',
          httpStatus: 429,
          errorCode: 'errors.com.epicgames.common.throttled',
          errorMessage: 'Try later',
          retryAfterSeconds: 30,
        }),
      },
    })

    const text = page()

    expect(text).toContain('On cooldown')
    expect(text).toContain('Try again in 30 seconds.')
    expect(text).toContain('HTTP 429 · errors.com.epicgames.common.throttled · Try later')
    expect(fixtures.missingKeys).toEqual([])
  })

  it('lists every known code, grouped, with reward codes as buttons that only fill the form', () => {
    const html = markup()
    const text = page()

    expect(text).toContain('Lobby Hack codes')
    expect(text).toMatch(/\d+ codes from community guides, checked 9 October 2026/)
    for (const heading of ['Sprites', 'Sprite Dust', 'XP', 'Gizmos', 'Cosmetics', 'Lobby effects: in game only', 'Expired']) {
      expect(text).toContain(heading)
    }
    expect(text).toContain('OverrideXP')
    expect(text).toContain('40,000 XP')
    expect(text).toContain('Finish the Geno story quests first.')

    const rowButton = (code: string) =>
      new RegExp(`<button[^>]*>(?:(?!</button>).)*>${code}<`, 's').test(html)

    expect(rowButton('OverrideXP')).toBe(true)
    expect(rowButton('H0p0nVC')).toBe(true)
    // In game only, or no longer running: listed, not offered.
    expect(text).toContain('CrowsAreAfraid')
    expect(rowButton('CrowsAreAfraid')).toBe(false)
    expect(text).toContain('NOPROLLAMA')
    expect(rowButton('NOPROLLAMA')).toBe(false)
    // Listing codes sends nothing.
    expect(useLobbyHackStore.getState().pending).toBeNull()
    expect(fixtures.missingKeys).toEqual([])
  })

  it('still lists the codes with no account linked, but offers none', () => {
    fixtures.accounts = {}
    fixtures.primary = null

    const html = markup()

    expect(page()).toContain('OverrideXP')
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*>OverrideXP</s)
  })

  it('labels a result whose account has since been removed', () => {
    useLobbyHackStore.setState({
      last: {
        accountId: 'c'.repeat(32),
        code: 'CODE',
        result: { ...result({ outcome: 'already-used' }), accountId: 'c'.repeat(32) },
      },
    })

    const text = page()

    expect(text).toContain('Removed account')
    expect(text).toContain('Already used')
  })
})
