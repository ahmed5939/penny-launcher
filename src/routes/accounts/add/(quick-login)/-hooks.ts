import { useEffect, useRef, useState } from 'react'

import { useAddAccountUpdateSubmittingState } from '../../../../hooks/accounts'
import { useBaseSetupForm } from '../-hooks'

import { toast } from '../../../../lib/notifications'

type Phase =
  | { name: 'idle' }
  | { name: 'starting' }
  | { name: 'waiting'; verificationUri: string; expiresAt: number }
  | { name: 'signing-in' }

/**
 * Drives a Quick login attempt. The main process owns the device code and
 * the polling; this only mirrors its progress and reports the result through
 * the shared add-account listener.
 *
 * Leaving the page cancels a pending attempt, so an approval never lands
 * while nothing is listening for it.
 */
export function useQuickLogin() {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const { isSubmitting, updateSubmittingState } =
    useAddAccountUpdateSubmittingState('quickLogin')

  useBaseSetupForm({
    fetcher: window.electronAPI.responseAuthWithQuickLogin,
    type: 'quickLogin',
  })

  useEffect(() => {
    const listener = window.electronAPI.responseQuickLoginStatus(
      async (value) => {
        switch (value.status) {
          case 'starting':
            setPhase({ name: 'starting' })
            break
          case 'waiting':
            setPhase({
              name: 'waiting',
              verificationUri: value.verificationUri,
              expiresAt: value.expiresAt,
            })
            break
          case 'signing-in':
            setPhase({ name: 'signing-in' })
            break
          case 'expired':
            toast.warning('Sign-in timed out. Start again to get a fresh link.')
            setPhase({ name: 'idle' })
            updateSubmittingState(false)
            break
          default:
            setPhase({ name: 'idle' })
            updateSubmittingState(false)
        }
      }
    )

    return () => {
      listener.removeListener()

      const current = phaseRef.current.name

      if (current === 'starting' || current === 'waiting') {
        window.electronAPI.cancelAuthWithQuickLogin()
        updateSubmittingState(false)
      }
    }
  }, [])

  const start = () => {
    if (isSubmitting) {
      return
    }

    updateSubmittingState(true)
    setPhase({ name: 'starting' })
    window.electronAPI.createAuthWithQuickLogin()
  }

  const cancel = () => {
    window.electronAPI.cancelAuthWithQuickLogin()
  }

  const reopen = () => {
    if (phase.name === 'waiting') {
      window.electronAPI.openExternalURL(phase.verificationUri)
    }
  }

  return { cancel, phase, reopen, start }
}

/**
 * Seconds left until `expiresAt`, ticking once a second while set.
 */
export function useCountdown(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (expiresAt === null) {
      return
    }

    setNow(Date.now())

    const timer = setInterval(() => setNow(Date.now()), 1_000)

    return () => clearInterval(timer)
  }, [expiresAt])

  return expiresAt === null
    ? null
    : Math.max(0, Math.ceil((expiresAt - now) / 1_000))
}
