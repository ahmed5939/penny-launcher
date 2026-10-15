import type { ReactElement, ReactNode } from 'react'

import { isValidElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ panel: {} as Record<string, unknown> }))

vi.mock('./hooks', () => ({ useFriendsPanel: () => state.panel }))
vi.mock('@tanstack/react-router', () => ({ Link: () => null }))

import { FriendsPanel } from './panel'
import { FriendsWorkspace } from './workspace'

/** The panel is a plain function returning elements, so the tree can be walked without a DOM. */
function findWorkspaces(node: ReactNode): Array<ReactElement> {
  if (Array.isArray(node)) {
    return node.flatMap(findWorkspaces)
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return []
  }

  const own = node.type === FriendsWorkspace ? [node] : []

  return [...own, ...findWorkspaces(node.props.children)]
}

const panelFor = (accountId: string) => ({
  closePanel: () => undefined,
  errorMessage: null,
  filter: '',
  grouped: { friends: [], incoming: [], outgoing: [], blocked: [] },
  handleAction: () => () => undefined,
  handleAdd: () => undefined,
  handleBulk: () => undefined,
  handleInvite: () => undefined,
  handleReload: () => undefined,
  isLoading: false,
  isOpen: true,
  isSearching: false,
  limitsReached: undefined,
  pending: [],
  query: '',
  searchResults: [],
  selected: { accountId, displayName: 'Penny' },
  setFilter: () => undefined,
  setQuery: () => undefined,
})

describe('FriendsPanel', () => {
  it('keys its workspace by the selected account so an account switch remounts it', () => {
    state.panel = panelFor('account-one')
    const [first] = findWorkspaces(FriendsPanel())

    state.panel = panelFor('account-two')
    const [second] = findWorkspaces(FriendsPanel())

    expect(first.key).toBe('account-one')
    expect(second.key).toBe('account-two')
  })
})
