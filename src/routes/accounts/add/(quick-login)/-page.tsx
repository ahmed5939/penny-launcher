import { ExternalLinkIcon, UpdateIcon } from '@radix-ui/react-icons'

import { Button } from '../../../../components/ui/button'
import {
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../../components/page'

import { useCountdown, useQuickLogin } from './-hooks'

export function QuickLoginPage() {
  const { cancel, phase, reopen, start } = useQuickLogin()
  const secondsLeft = useCountdown(
    phase.name === 'waiting' ? phase.expiresAt : null
  )

  const busy = phase.name !== 'idle'

  return (
    <div className="w-full max-w-md">
      <Panel>
        <div className="space-y-2 border-b border-border/60 px-5 py-4 text-ui leading-relaxed text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">1.</span> Press
            Sign in. Penny opens Epic's sign-in page in your browser.
          </p>
          <p>
            <span className="font-semibold text-foreground">2.</span> Sign in
            to the account you want to add and approve. Check which account
            is signed in before you approve.
          </p>
          <p>
            <span className="font-semibold text-foreground">3.</span> Come
            back here. Penny picks it up on its own; there is nothing to
            paste.
          </p>
        </div>

        {busy && (
          <PanelBody className="flex items-center gap-3 text-ui">
            <UpdateIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="min-w-0 flex-1">
              {phase.name === 'starting' && 'Opening Epic sign-in…'}
              {phase.name === 'waiting' &&
                'Waiting for you to approve in the browser…'}
              {phase.name === 'signing-in' && 'Approved. Linking the account…'}
            </span>
            {secondsLeft !== null && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatSeconds(secondsLeft)}
              </span>
            )}
          </PanelBody>
        )}

        <PanelFooter>
          {phase.name === 'waiting' ? (
            <>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="flex-1 space-x-1"
                onClick={reopen}
              >
                <span>Reopen page</span>
                <ExternalLinkIcon />
              </Button>
            </>
          ) : (
            <Button
              className="ml-auto min-w-32"
              disabled={busy}
              onClick={start}
            >
              {busy ? <UpdateIcon className="animate-spin" /> : 'Sign in'}
            </Button>
          )}
        </PanelFooter>
      </Panel>
    </div>
  )
}

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
