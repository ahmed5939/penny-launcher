import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

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

      // F5 — refresh the current view's data, not the document.
      if (event.key === 'F5') {
        event.preventDefault()
        onRefresh?.()

        return
      }

      // Ctrl+1..9 — jump straight to an account by position in the rail.
      if (event.ctrlKey && !event.shiftKey && !event.altKey && !typing) {
        const index = Number.parseInt(event.key, 10)

        if (Number.isInteger(index) && index >= 1 && index <= 9) {
          const { idsList } = useAccountListStore.getState()
          const accountId = idsList[index - 1]

          if (accountId) {
            event.preventDefault()
            useAccountScopeStore.getState().setPrimary(accountId)
          }

          return
        }
      }

      // Ctrl+Tab — cycle the subject through the accounts in scope.
      if (event.ctrlKey && event.key === 'Tab') {
        const { members, primary, setPrimary } =
          useAccountScopeStore.getState()

        if (members.length > 1) {
          event.preventDefault()

          const at = members.indexOf(primary ?? '')
          const step = event.shiftKey ? -1 : 1
          const next =
            members[(at + step + members.length) % members.length]

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
