import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useShellStore } from '../../state/ui/shell'

import { useAccountScopeStore } from '../../state/accounts/scope'
import { useAccountListStore } from '../../state/accounts/list'

/**
 * True when a keystroke belongs to whatever the user is typing into.
 *
 * Without this, Ctrl+1 while renaming an account would jump accounts out from
 * under the field — the sort of thing that reads as the app fighting you.
 */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
  )
}

/**
 * The keys Windows taught people to expect.
 *
 * None of these are discoverable, and that is fine — they are muscle memory
 * borrowed from every other desktop app, and their absence is what makes a
 * window feel like a web page with the address bar hidden.
 */
export function useAppKeyboard({
  onRefresh,
}: {
  onRefresh?: () => void
} = {}) {
  const router = useRouter()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target)

      // Alt+Left / Alt+Right — back and forward, as in Explorer.
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        router.history.back()

        return
      }

      if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault()
        router.history.forward()

        return
      }

      // F5 / Ctrl+R — refresh data without tearing down the renderer.
      if (
        event.key === 'F5' ||
        (event.ctrlKey && event.key.toLowerCase() === 'r')
      ) {
        event.preventDefault()

        if (onRefresh) {
          onRefresh()
        } else {
          const refreshEvent = new Event('penny:refresh', {
            cancelable: true,
          })

          if (window.dispatchEvent(refreshEvent)) {
            void router.invalidate()
          }
        }

        return
      }

      // F6 / Shift+F6 — cycle through the app's major regions.
      if (event.key === 'F6') {
        // Let modal dialogs retain their own focus boundary.
        if (document.querySelector('[role="dialog"][data-state="open"]')) return
        const regions = [
          ...document.querySelectorAll<HTMLElement>('[data-app-focus-region]'),
        ].filter(
          (region) =>
            region.getClientRects().length > 0 &&
            !region.closest('[hidden], [inert], [aria-hidden="true"]'),
        )

        if (regions.length > 0) {
          event.preventDefault()
          const current = regions.findIndex(
            (region) =>
              region === document.activeElement ||
              region.contains(document.activeElement),
          )
          const step = event.shiftKey ? -1 : 1
          const nextIndex =
            current < 0
              ? event.shiftKey
                ? regions.length - 1
                : 0
              : (current + step + regions.length) % regions.length
          const next = regions[nextIndex]
          const focusTarget = [
            ...(next?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? []),
          ].find(
            (element) =>
              element.getClientRects().length > 0 &&
              !element.closest('[hidden], [inert], [aria-hidden="true"]'),
          )

          ;(focusTarget ?? next)?.focus()
        }

        return
      }

      if (
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        !typing &&
        event.key.toLowerCase() === 'b'
      ) {
        event.preventDefault()
        const pane = document.querySelector('[data-app-focus-region="pane"]')
        if (pane?.contains(document.activeElement)) {
          document.querySelector<HTMLElement>('[data-pane-toggle]')?.focus()
        }
        useShellStore.getState().togglePane()
        return
      }

      // Ctrl+1..9 — jump straight to an account by their stable roster position.
      if (event.ctrlKey && !event.shiftKey && !event.altKey && !typing) {
        const index = Number.parseInt(event.key, 10)

        if (Number.isInteger(index) && index >= 1 && index <= 9) {
          const { accounts, idsList } = useAccountListStore.getState()
          const accountId = idsList[index - 1]

          if (accountId && accounts[accountId]?.authStatus !== 'invalid') {
            event.preventDefault()
            useAccountScopeStore.getState().setPrimary(accountId)
          }

          return
        }
      }

      // Ctrl+Tab — cycle the subject through the accounts in scope.
      if (event.ctrlKey && event.key === 'Tab') {
        const { members, primary, setPrimary } = useAccountScopeStore.getState()

        if (members.length > 1) {
          event.preventDefault()

          const at = members.indexOf(primary ?? '')
          const step = event.shiftKey ? -1 : 1
          const next = members[(at + step + members.length) % members.length]

          if (next) {
            setPrimary(next)
          }
        }
      }
    }

    window.addEventListener('keydown', handler)

    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [onRefresh, router])
}
