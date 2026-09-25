import packageJson from '../../../package.json'
import { useEffect, useState } from 'react'


import { StatusDot } from '../page'

import { useAccountScope, usePrimaryAccount } from '../../hooks/accounts/scope'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/** Connection status and current account scope. */
export function StatusBar() {
  const [isOnline, setOnline] = useState(() => navigator.onLine)
  const { members } = useAccountScope()
  const primary = usePrimaryAccount()

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
        <span className="text-caption font-semibold text-brand-teal">
          {scopeLabel}
        </span>
      </span>

      {/* Auto-kick is temporarily disabled, so its service dot is hidden. */}
      <span className="contents max-[700px]:hidden">
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

      <span className="figure ml-auto text-caption text-muted-foreground">
        v{packageJson.version}
      </span>
    </footer>
  )
}

function Divider() {
  return <span className="h-3 w-px shrink-0 bg-border/60" />
}
