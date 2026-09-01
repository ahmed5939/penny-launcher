import packageJson from '../../../package.json'
import { useEffect, useState } from 'react'

import { AutomationStatusType } from '../../config/constants/automation'

import { StatusDot } from '../page'

import { useAccountScope, usePrimaryAccount } from '../../hooks/accounts/scope'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * The status bar.
 *
 * Auto-kick, the taxi service and auto-llamas run whether or not you are
 * looking at their page — they were previously represented by coloured dots
 * inside a dropdown menu, which is to say they were invisible. Every desktop
 * app puts its always-running state in a strip along the bottom, and this is
 * also the natural second home for the scope: a global selection that acts on
 * several accounts at once should never be more than a glance away.
 *
 * Everything in the strip is a caption at `micro-label` rank, so the one
 * thing that changes with what you do — the scope — is the only thing on the
 * line carrying weight and colour.
 */
export function StatusBar() {
  const [isOnline, setOnline] = useState(() => navigator.onLine)
  const { members } = useAccountScope()
  const primary = usePrimaryAccount()
  const { status: taxi } = useGetTaxiServiceDataStatus()

  useEffect(() => {
    const online = () => setOnline(true)
    const offline = () => setOnline(false)

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  const scopeLabel =
    members.length === 0
      ? 'Nothing in scope'
      : members.length === 1
        ? (primary ? parseCustomDisplayName(primary) : '1 account')
        : `${members.length} accounts`

  return (
    <footer
      className={cn(
        'chrome-surface flex h-[var(--status-bar-height)] shrink-0 select-none',
        'items-center gap-3 border-t border-border/60 px-2.5'
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="micro-label">Scope</span>
        <span className="text-[0.6875rem] font-semibold text-brand-teal">
          {scopeLabel}
        </span>
      </span>

      {/* Auto-kick is temporarily disabled, so its service dot is hidden. */}
      <span className="contents max-[700px]:hidden">
        <Divider />
        <Service
          label="Taxi"
          status={taxi}
        />

        <Divider />
        <span
          className={cn(
            'micro-label flex items-center gap-1.5',
            !isOnline && 'text-warning'
          )}
        >
          <StatusDot tone={isOnline ? 'active' : 'warning'} />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </span>

      <span className="figure ml-auto text-[0.6875rem] text-muted-foreground">
        v{packageJson.version}
      </span>
    </footer>
  )
}

function Divider() {
  return <span className="h-3 w-px shrink-0 bg-border/60" />
}

/**
 * A background service. `null` means "not running", which is a state worth
 * showing rather than hiding — the common support question about this app is
 * "why did my auto-kick stop".
 */
function Service({
  label,
  status,
}: {
  label: string
  status: AutomationStatusType | null
}) {
  return (
    <span className="micro-label flex items-center gap-1.5">
      <StatusDot
        tone={
          status === null
            ? 'idle'
            : status === AutomationStatusType.ISSUE
              ? 'warning'
              : 'active'
        }
      />
      {label}
      {status === null && <span className="opacity-60">off</span>}
    </span>
  )
}
