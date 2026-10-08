import type { AccountData } from '../../types/accounts'
import type { PresenceSnapshot } from '../../types/presence'

import { useNavigate } from '@tanstack/react-router'
import { MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import {
  Callout,
  EmptyState,
  FieldGroup,
  FieldRow,
  KeyValue,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  Picker,
  Segmented,
  StatusPill,
  ToolBadges,
} from '../../components/page'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'

import { useGetSelectedAccount } from '../../hooks/accounts'
import {
  checkPresenceText,
  presenceDurationOptions,
  presenceTextMaxBytes,
  presenceTextProblem,
} from '../../lib/presence'
import { parseCustomDisplayName } from '../../lib/utils'
import {
  usePresencePrefs,
  usePresenceStore,
} from '../../state/accounts/presence'

import {
  availabilityLabel,
  clockTime,
  isPresenceLive,
  needsSignIn,
  presenceAction,
  presencePhase,
  stopReasonText,
} from './model'
import { startPresence, stopPresence, updatePresence } from './sync'

/**
 * Fortnite presence: one linked account's status line for friends, held up
 * by Penny while the game is closed.
 *
 * Two panels: the session as it is (account, what Epic accepted, until
 * when), and the form for the account in the title bar. They are kept
 * apart because they can be different accounts — switching the title bar
 * never moves a running session.
 */
export function PresenceView() {
  const { t } = useTranslation(['sidebar'])
  const { selected } = useGetSelectedAccount()
  const snapshot = usePresenceStore((state) => state.snapshot)

  return (
    <>
      <PageHeader
        description="Show friends your own status line while Fortnite is closed. Penny has to stay open to keep it up."
        icon={MessageSquareText}
        section={t('account-management.title')}
        status={<ToolBadges beta />}
        title={t('presence')}
      />

      {showsSession(snapshot) && <SessionPanel snapshot={snapshot} />}

      {selected ? (
        <ComposePanel
          account={selected}
          key={selected.accountId}
          snapshot={snapshot}
        />
      ) : (
        <EmptyState
          description="Pick one in the title bar to set its status."
          icon={MessageSquareText}
          title="No account selected"
        />
      )}
    </>
  )
}

export function showsSession(snapshot: PresenceSnapshot) {
  return (
    snapshot.accountId !== null &&
    (snapshot.state !== 'stopped' ||
      (snapshot.stoppedReason !== null && snapshot.stoppedReason !== 'user'))
  )
}

export function SessionPanel({ snapshot }: { snapshot: PresenceSnapshot }) {
  const navigate = useNavigate()
  const busy = usePresenceStore((state) => state.busy)
  const prefs = usePresencePrefs(
    useShallow(({ availability, durationMinutes, text }) => ({
      availability,
      durationMinutes,
      text,
    }))
  )
  const phase = presencePhase(snapshot)
  const live = isPresenceLive(snapshot)
  const ended = stopReasonText(snapshot.stoppedReason)
  const published = clockTime(snapshot.lastPublishedAt)
  const ends = clockTime(snapshot.expiresAt)
  const retry = clockTime(snapshot.retryAt)

  const retryStart = () => {
    if (!snapshot.accountId) {
      return
    }

    void startPresence({
      accountId: snapshot.accountId,
      availability: prefs.availability,
      durationMinutes: prefs.durationMinutes,
      text: prefs.text,
    })
  }

  return (
    <Panel aria-live="polite">
      <PanelHeader
        actions={
          <>
            <StatusPill
              pulse={phase.pulse}
              tone={phase.tone}
            >
              {phase.label}
            </StatusPill>
            {(live || snapshot.state === 'stopping') && (
              <Button
                disabled={snapshot.state === 'stopping'}
                onClick={() => void stopPresence()}
                size="sm"
                variant="outline"
              >
                {snapshot.state === 'stopping' ? 'Stopping…' : 'Stop presence'}
              </Button>
            )}
          </>
        }
        as="div"
        description="Presence session"
        title={snapshot.displayName ?? 'Unknown account'}
      />

      <PanelBody className="space-y-4">
        {snapshot.text !== null && (
          <div className="space-y-1">
            <p className="break-words text-title font-semibold leading-snug">
              {snapshot.text}
            </p>
            <p className="text-xs text-muted-foreground">
              {availabilityLabel(snapshot.availability)} · what friends see now
            </p>
          </div>
        )}

        {snapshot.pending && (
          <p className="break-words text-ui text-muted-foreground">
            Waiting to publish: “{snapshot.pending.text}” (
            {availabilityLabel(snapshot.pending.availability)})
          </p>
        )}

        {live && (
          <div className="grid gap-4 sm:grid-cols-3">
            <KeyValue
              label="Last published"
              value={published ?? 'Not yet'}
            />
            <KeyValue
              label="Ends"
              value={ends ?? 'When you stop it'}
            />
            {snapshot.state === 'reconnecting' && (
              <KeyValue
                label="Next try"
                value={retry ?? 'Shortly'}
              />
            )}
          </div>
        )}

        {snapshot.state === 'reconnecting' && snapshot.errorMessage && (
          <Callout
            title="Reconnecting"
            tone="warning"
          >
            {snapshot.errorMessage} Penny keeps trying on its own.
          </Callout>
        )}

        {snapshot.state === 'active' && snapshot.errorMessage && (
          <Callout tone="warning">{snapshot.errorMessage}</Callout>
        )}

        {snapshot.state === 'error' && (
          <Callout
            title="Presence stopped"
            tone="danger"
          >
            <p>{snapshot.errorMessage ?? 'Something went wrong.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {needsSignIn(snapshot) && (
                <Button
                  onClick={() =>
                    void navigate({
                      params: { type: 'quick-login' },
                      to: '/accounts/add/$type',
                    })
                  }
                  size="sm"
                >
                  Sign in again
                </Button>
              )}
              <Button
                disabled={busy !== null || !checkPresenceText(prefs.text).ok}
                onClick={retryStart}
                size="sm"
                variant="outline"
              >
                Try again
              </Button>
              <Button
                onClick={() => void stopPresence()}
                size="sm"
                variant="ghost"
              >
                Dismiss
              </Button>
            </div>
          </Callout>
        )}

        {snapshot.state === 'stopped' && ended && (
          <Callout tone="info">{ended}</Callout>
        )}

        {live && (
          <p className="text-xs text-muted-foreground">
            Friends see you online with this line while Penny is open. It
            does not hide you or make you appear offline.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}

const durationValue = (minutes: number | null) =>
  minutes === null ? 'until-stopped' : String(minutes)

const durationOptions = presenceDurationOptions.map((option) => ({
  label: option.label,
  value: durationValue(option.minutes),
}))

export function ComposePanel({
  account,
  snapshot,
}: {
  account: AccountData
  snapshot: PresenceSnapshot
}) {
  const busy = usePresenceStore((state) => state.busy)
  const prefs = usePresencePrefs()
  const [replaceArmed, setReplaceArmed] = useState(false)
  const check = checkPresenceText(prefs.text)
  const action = presenceAction(snapshot, account.accountId)
  // Disarms by itself if the other session ends before the second press.
  const confirmingReplace = replaceArmed && action.kind === 'replace'
  const name = parseCustomDisplayName(account)
  const disabled = busy !== null || !check.ok || snapshot.state === 'stopping'

  const submit = () => {
    if (disabled) {
      return
    }

    const request = {
      accountId: account.accountId,
      availability: prefs.availability,
      durationMinutes: prefs.durationMinutes,
      text: prefs.text,
    }

    if (action.kind === 'update') {
      void updatePresence(request)
      return
    }

    // Moving presence to another account closes the running one: ask twice.
    if (action.kind === 'replace' && !confirmingReplace) {
      setReplaceArmed(true)
      return
    }

    setReplaceArmed(false)
    void startPresence({ ...request, replaceActive: action.kind === 'replace' })
  }

  const buttonLabel =
    busy === 'start'
      ? 'Starting…'
      : busy === 'update'
        ? 'Updating…'
        : action.kind === 'update'
          ? 'Update presence'
          : action.kind === 'replace' && confirmingReplace
            ? `Confirm — replaces ${action.activeName}`
            : 'Start presence'

  return (
    <Panel>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <PanelHeader
          description={
            action.kind === 'update'
              ? 'Change what friends see. It goes out when you press Update.'
              : 'Nothing goes out until you press Start.'
          }
          title="Status"
        />

        <PanelBody>
          <FieldGroup>
            <FieldRow
              hint="The account in the title bar."
              label="Account"
            >
              <span className="text-ui font-semibold">{name}</span>
            </FieldRow>

            <FieldRow
              hint={
                check.ok || check.reason === 'blank' ? (
                  `${check.bytes} of ${presenceTextMaxBytes} bytes. Shown instead of “In the launcher”.`
                ) : (
                  <span className="text-warning">
                    {presenceTextProblem(check)}
                  </span>
                )
              }
              label="Status line"
              stacked
            >
              <Input
                aria-label="Status line"
                autoComplete="off"
                onChange={(event) => prefs.setText(event.target.value)}
                placeholder="Back in five — farming Twine"
                spellCheck
                value={prefs.text}
              />
            </FieldRow>

            <FieldRow label="Show as">
              <Segmented
                onChange={prefs.setAvailability}
                options={[
                  { label: 'Online', value: 'online' },
                  { label: 'Away', value: 'away' },
                ]}
                value={prefs.availability}
              />
            </FieldRow>

            <FieldRow
              hint="Counts from when you press the button."
              label="Keep it up for"
            >
              <Picker
                label="Keep it up for"
                onChange={(value) =>
                  prefs.setDurationMinutes(
                    value === 'until-stopped' ? null : Number(value)
                  )
                }
                options={durationOptions}
                value={durationValue(prefs.durationMinutes)}
              />
            </FieldRow>
          </FieldGroup>
        </PanelBody>

        <PanelFooter>
          <Button
            disabled={disabled}
            type="submit"
            variant={confirmingReplace ? 'destructive' : 'default'}
          >
            {buttonLabel}
          </Button>
          {confirmingReplace && (
            <Button
              onClick={() => setReplaceArmed(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          )}
          {action.kind === 'replace' && !confirmingReplace && (
            <span className="text-xs text-muted-foreground">
              Presence is running for {action.activeName}. Starting here
              stops it.
            </span>
          )}
        </PanelFooter>
      </form>
    </Panel>
  )
}
