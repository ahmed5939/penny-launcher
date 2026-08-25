import packageJson from '../../../package.json'

import { AutomationStatusType } from '../../config/constants/automation'

import { useAccountScope, usePrimaryAccount } from '../../hooks/accounts/scope'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
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
 */
export function StatusBar() {
  const { members } = useAccountScope()
  const primary = usePrimaryAccount()
  const { status: autoKick } = useGetAutomationDataStatus()
  const { status: taxi } = useGetTaxiServiceDataStatus()

  const scopeLabel =
    members.length === 0
      ? 'Nothing in scope'
      : members.length === 1
        ? (primary ? parseCustomDisplayName(primary) : '1 account')
        : `${members.length} accounts`

  return (
    <footer
      className={cn(
        'mica-chrome flex h-6 shrink-0 select-none items-center gap-3',
        'border-t border-border/60 bg-surface/50 px-2.5',
        'text-[0.6875rem] tabular-nums text-muted-foreground'
      )}
    >
      <span className="flex items-center gap-1.5">
        Scope
        <span className="font-semibold text-brand-teal">{scopeLabel}</span>
      </span>

      <Divider />
      <Service
        label="Auto-kick"
        status={autoKick}
      />
      <Divider />
      <Service
        label="Taxi"
        status={taxi}
      />

      <span className="ml-auto font-mono">v{packageJson.version}</span>
    </footer>
  )
}

function Divider() {
  return <span className="opacity-30">│</span>
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
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === null && 'bg-muted-foreground/45',
          status === AutomationStatusType.ISSUE && 'bg-warning',
          status !== null &&
            status !== AutomationStatusType.ISSUE &&
            'bg-success'
        )}
      />
      {label}
      {status === null && <span className="opacity-60">off</span>}
    </span>
  )
}
