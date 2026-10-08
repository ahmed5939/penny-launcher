import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'

import { StatusDot } from '../../components/page'

import { cn } from '../../lib/utils'
import { usePresenceStore } from '../../state/accounts/presence'

import { isPresenceLive, isPresenceVisible, presencePhase } from './model'
import { stopPresence } from './sync'

/**
 * Presence in the status bar, on every page: what is running, for whom, a
 * way back to the page and a way to stop it. Leaving the Presence page
 * never leaves a session out of sight.
 */
export function PresenceStatusItem() {
  const snapshot = usePresenceStore((state) => state.snapshot)

  if (!isPresenceVisible(snapshot)) {
    return null
  }

  const phase = presencePhase(snapshot)
  const live = isPresenceLive(snapshot)

  return (
    <span className="flex min-w-0 items-center gap-1">
      <Link
        aria-label={`Presence for ${snapshot.displayName ?? 'an account'}: ${phase.label}`}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded px-1 text-caption',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
        to="/account-management/presence"
      >
        <StatusDot
          pulse={phase.pulse}
          tone={phase.tone}
        />
        <span className="micro-label">Presence</span>
        <span className="truncate font-semibold">
          {phase.label}
          {snapshot.displayName ? ` · ${snapshot.displayName}` : ''}
        </span>
      </Link>
      {live && (
        <button
          aria-label="Stop presence"
          className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={() => void stopPresence()}
          title="Stop presence"
          type="button"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
