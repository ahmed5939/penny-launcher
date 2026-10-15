import type { ContextMenuRequestItem } from '../../kernel/startup/context-menu'
import type { AccountData } from '../../types/accounts'

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { useAccountListStore } from '../../state/accounts/list'

import {
  useAccountScope,
  usePrimaryAccount,
} from '../../hooks/accounts/scope'

import { useHandleRemove } from '../../routes/accounts/remove/-actions'


import { checkIfCustomDisplayNameIsValid } from '../../lib/validations/properties'
import { parseCustomDisplayName } from '../../lib/utils'

export function useAccountList() {
  const accountList = useAccountListStore((state) => state.accounts)
  const idsList = useAccountListStore((state) => state.idsList)
  /**
   * Writes the global scope rather than a picker-local `selected` field. This
   * is the whole point of the change: choosing here now reaches every tool
   * instead of only the three places that happened to read the old value.
   */
  const { members, selectAll, setPrimary, toggleMember } =
    useAccountScope()
  const selected = usePrimaryAccount()
  const navigate = useNavigate()
  const { handleRemove } = useHandleRemove()
  const [open, setOpen] = useState(false)
  const accounts = idsList
    .map((accountId) => accountList[accountId])
    .filter((account): account is AccountData => account !== undefined)

  const createKeywords = (account: AccountData) => {
    const _keys: Array<string> = [account.displayName]
    const provider = account.provider ?? ''

    if (checkIfCustomDisplayNameIsValid(account.customDisplayName)) {
      _keys.push(account.customDisplayName)
    }

    if (provider !== '') {
      _keys.push(provider)
    }

    return _keys.length > 0 ? _keys : undefined
  }

  const customFilter = (
    _value: string,
    search: string,
    keywords?: Array<string>
  ) => {
    const _search = search.toLowerCase().trim()
    const _keys =
      keywords &&
      keywords.some((keyword) =>
        keyword.toLowerCase().trim().includes(_search)
      )

    return _keys ? 1 : 0
  }
  const onSelect = (account: AccountData) => (accountId: string) => {
    if (account.authStatus === 'invalid') {
      return
    }

    if (accountId !== selected?.accountId) {
      setPrimary(account.accountId)
    }

    setOpen(false)
  }

  const onToggleMember = (accountId: string) => {
    if (accountList[accountId]?.authStatus === 'invalid') {
      return
    }

    toggleMember(accountId)
  }

  const onSelectAll = () => {
    selectAll(
      accounts
        .filter((account) => account.authStatus !== 'invalid')
        .map((account) => account.accountId)
    )
  }

  /**
   * "Clear" collapses the scope back to the current account, never to
   * nothing — an empty scope turns every button in the app into a no-op.
   */
  const onClearScope = () => {
    if (selected) {
      selectAll([selected.accountId])
    }
  }

  const availableAccounts = accounts.filter(
    (account) => account.authStatus !== 'invalid'
  )
  const allSelected =
    availableAccounts.length > 0 &&
    members.length >= availableAccounts.length

  /**
   * Removing from the roster asks twice, as the Remove page does (§7): the
   * first pick opens this second menu, and only its Confirm removes anything.
   */
  const confirmRemove = async (account: AccountData) => {
    const chosen = await window.electronAPI.popupContextMenu([
      {
        id: 'confirm',
        label: `Confirm — unlink ${parseCustomDisplayName(account)}`,
      },
      { id: 'cancel', label: 'Cancel' },
    ])

    if (chosen === 'confirm') {
      handleRemove({ account, defaultRedirect: false })
    }
  }

  /**
   * A real OS context menu, not an HTML one.
   *
   * Right-clicking a list row and getting nothing is one of the clearest tells
   * that a window is a web page; getting a menu in the wrong font with the
   * wrong corners is arguably worse. `Menu.popup` in the main process gives the
   * genuine article, with the OS's own keyboard handling and edge-flipping.
   */
  const onContextMenu =
    (account: AccountData) => async (event: React.MouseEvent) => {
      event.preventDefault()

      const isInScope = members.includes(account.accountId)
      const isInvalid = account.authStatus === 'invalid'
      const isCurrent = account.accountId === selected?.accountId
      const items: Array<ContextMenuRequestItem> = [
        {
          id: 'switch',
          label: `Switch to ${parseCustomDisplayName(account)}`,
          // Already the current account, so there is nothing to switch to.
          enabled: !isInvalid && !isCurrent,
        },
        {
          id: 'scope',
          label: isInScope ? 'Remove from scope' : 'Add to scope',
          // The scope may never be emptied, so the last member cannot leave.
          enabled: !isInvalid && (!isInScope || members.length > 1),
        },
        { type: 'separator' },
      ]

      if (isInvalid) {
        items.push(
          { id: 'reauth', label: 'Sign in again…' },
          { id: 'remove', label: 'Remove from Penny…' },
          { type: 'separator' }
        )
      }

      items.push(
        { copy: account.accountId, label: 'Copy account ID' },
        { copy: account.displayName, label: 'Copy display name' }
      )

      const chosen = await window.electronAPI.popupContextMenu(items)

      if (chosen === 'switch') {
        setPrimary(account.accountId)
        setOpen(false)
      } else if (chosen === 'scope') {
        toggleMember(account.accountId)
      } else if (chosen === 'reauth') {
        setOpen(false)
        navigate({
          to: '/accounts/add/$type',
          params: { type: 'quick-login' },
        })
      } else if (chosen === 'remove') {
        await confirmRemove(account)
      }
    }

  return {
    accounts,
    allSelected,
    members,
    open,
    selected,

    createKeywords,
    customFilter,
    onClearScope,
    onContextMenu,
    onSelect,
    onSelectAll,
    onToggleMember,
    setOpen,
  }
}
