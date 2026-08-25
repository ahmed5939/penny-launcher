import { useEffect } from 'react'

import { useAccountScopeStore } from '../../state/accounts/scope'
import { useGetAccounts } from '../accounts'

import { parseCustomDisplayName } from '../../lib/utils'

/**
 * Draws the overlay badge.
 *
 * `nativeImage` cannot rasterise vector art, so the image has to be produced
 * somewhere that can draw — which on this side of the wall means a canvas.
 * 32px is the size Windows asks for; anything smaller gets upscaled and looks
 * soft against the crisp taskbar icons either side of it.
 */
function drawBadge(count: number): string | null {
  if (count <= 0) {
    return null
  }

  const size = 32
  const canvas = document.createElement('canvas')

  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  const label = count > 99 ? '99+' : `${count}`

  context.beginPath()
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  context.fillStyle = '#ee4f8e'
  context.fill()

  context.fillStyle = '#ffffff'
  context.font = `600 ${label.length > 2 ? 13 : 18}px "Segoe UI Variable Text", "Segoe UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, size / 2, size / 2 + 1)

  return canvas.toDataURL('image/png')
}

/**
 * Keeps the taskbar in step with the app.
 *
 * The badge carries how many accounts are in scope — the number every bulk
 * action is about to act on — so it is answerable at a glance from a minimised
 * window. The jump list carries the roster, so right-clicking the taskbar icon
 * switches accounts without restoring the window at all.
 */
export function useTaskbarSync() {
  const members = useAccountScopeStore((state) => state.members)
  const primaryId = useAccountScopeStore((state) => state.primary)
  const setPrimary = useAccountScopeStore((state) => state.setPrimary)
  const { accountsArray } = useGetAccounts()

  useEffect(() => {
    const count = members.length

    window.electronAPI.setTaskbarBadge(
      // One account in scope is the resting state, not information.
      count > 1 ? drawBadge(count) : null,
      count === 1 ? '1 account in scope' : `${count} accounts in scope`
    )
  }, [members])

  useEffect(() => {
    window.electronAPI.setTaskbarJumpList(
      accountsArray.map((account) => ({
        accountId: account.accountId,
        displayName: parseCustomDisplayName(account),
      }))
    )
  }, [accountsArray])

  useEffect(() => {
    const listener = window.electronAPI.onScopeRequest((accountId) => {
      setPrimary(accountId)
    })

    return () => {
      listener.removeListener()
    }
  }, [setPrimary])

  useEffect(() => {
    const primary = accountsArray.find(
      (account) => account.accountId === primaryId
    )

    window.electronAPI.setTraySummary({
      primaryName: primary ? parseCustomDisplayName(primary) : null,
      running: [],
      total: members.length,
    })
  }, [accountsArray, members, primaryId])
}
