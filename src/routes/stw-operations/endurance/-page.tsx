import type {
  EndurancePhase,
  EnduranceZone,
} from '../../../types/endurance'

import { Crosshair, Repeat } from 'lucide-react'
import dayjs from 'dayjs'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  EmptyState,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  Segmented,
  StatusPill,
} from '../../../components/page'

import { useEnduranceData } from './-hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

const phaseLabels: Record<EndurancePhase, string> = {
  idle: 'Idle',
  launching: 'Launching Fortnite',
  'waiting-for-process': 'Waiting for Fortnite',
  'waiting-for-frontend': 'Waiting for Homebase',
  navigating: 'Navigating menus',
  'in-mission': 'Endurance running',
  returning: 'Returning to Homebase',
  claiming: 'Claiming rewards',
  stopped: 'Stopped',
  error: 'Error',
}

export function RouteComponent() {
  const {
    account,
    feed,
    handleCalibrate,
    handleCalibrateCancel,
    handleStart,
    handleStop,
    snapshot,
    updateConfig,
  } = useEnduranceData()

  const status = snapshot?.status ?? null
  const config = snapshot?.config ?? null
  const running = status?.running === true

  return (
    <>
      <PageHeader
        icon={Repeat}
        section="STW Operations"
        title={
          <span className="flex items-center gap-2">
            Endurance
            <BetaBadge />
          </span>
        }
        description="Starts Storm Shield Endurance with the scoped account, verifies every screen, retries missed clicks, recovers rewards and loops. F8 stops it at any time."
        status={
          status ? (
            status.phase === 'error' ? (
              <StatusPill tone="danger">Error</StatusPill>
            ) : running ? (
              <StatusPill
                pulse
                tone="active"
              >
                {phaseLabels[status.phase]}
              </StatusPill>
            ) : (
              <StatusPill tone="idle">
                {phaseLabels[status.phase]}
              </StatusPill>
            )
          ) : undefined
        }
        actions={
          running ? (
            <Button
              className="min-w-32"
              variant="destructive"
              onClick={handleStop}
            >
              Stop (F8)
            </Button>
          ) : (
            <Button
              className="min-w-32"
              onClick={handleStart}
              disabled={!account || !config}
            >
              Start
            </Button>
          )
        }
      />

      {!account && (
        <Callout
          title="No account selected"
          tone="warning"
        >
          Pick the account in the titlebar — Endurance launches Fortnite
          and claims rewards as that account.
        </Callout>
      )}

      {status?.lastError && (
        <Callout
          title="The last run failed"
          tone="danger"
        >
          {status.lastError}
        </Callout>
      )}

      {config && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
          <Panel>
            <PanelBody className="space-y-4">
              <FieldGroup>
                <FieldRow
                  label="Zone"
                  hint="Runs always navigate from Stonewood, hopping right to the chosen zone."
                >
                  <Segmented<EnduranceZone>
                    value={config.zone}
                    onChange={(zone) => updateConfig({ zone })}
                    options={[
                      { label: 'Stonewood', value: 'stonewood' },
                      { label: 'Plankerton', value: 'plankerton' },
                      { label: 'Canny', value: 'canny-valley' },
                      { label: 'Twine', value: 'twine-peaks' },
                    ]}
                  />
                </FieldRow>

                <FieldRow
                  label="Launch Fortnite if needed"
                  hint="Uses the launcher's own exchange-code sign-in for the scoped account."
                >
                  <Switch
                    checked={config.autoLaunch}
                    onCheckedChange={(autoLaunch) =>
                      updateConfig({ autoLaunch })
                    }
                  />
                </FieldRow>

                <FieldRow
                  label="Loop runs"
                  hint="Start the next Endurance as soon as one finishes."
                >
                  <Switch
                    checked={config.loop}
                    onCheckedChange={(loop) => updateConfig({ loop })}
                  />
                </FieldRow>

                <FieldRow
                  label="Claim rewards after each run"
                  hint="Runs the launcher's reward claim for the account."
                >
                  <Switch
                    checked={config.claimAfterRun}
                    onCheckedChange={(claimAfterRun) =>
                      updateConfig({ claimAfterRun })
                    }
                  />
                </FieldRow>

                <FieldRow
                  label="Run length (minutes)"
                  hint="Expected run duration. The runner then allows up to 45 more minutes for the results screen before using the fallback exit."
                >
                  <Input
                    className="w-24"
                    type="number"
                    min={10}
                    max={600}
                    defaultValue={config.missionMinutes}
                    onBlur={(event) => {
                      const value = Number(event.target.value)

                      if (Number.isFinite(value) && value >= 10) {
                        updateConfig({
                          missionMinutes: Math.min(600, Math.round(value)),
                        })
                      }
                    }}
                  />
                </FieldRow>

                <FieldRow
                  label="Completion log marker"
                  hint="Optional regular expression — when it appears in FortniteGame.log the run ends early instead of waiting for the timer."
                >
                  <Input
                    className="w-full"
                    placeholder="e.g. Wave 30"
                    defaultValue={config.completionPattern}
                    onBlur={(event) =>
                      updateConfig({
                        completionPattern: event.target.value,
                      })
                    }
                  />
                </FieldRow>
              </FieldGroup>
            </PanelBody>
            <PanelFooter>
              <p className="text-xs text-muted-foreground">
                {account
                  ? `Running as ${parseCustomDisplayName(account)}.`
                  : 'No account in scope.'}{' '}
                Use Windowed Fullscreen and keep the session unlocked.
              </p>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelBody>
              <Label className="text-sm font-semibold">Activity</Label>
              {feed.length === 0 ? (
                <EmptyState
                  icon={Repeat}
                  title="Nothing yet"
                  description="Start a run and every step, map load and recovery shows up here."
                />
              ) : (
                <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto text-xs">
                  {feed.map((event, index) => (
                    <li
                      key={`${event.at}-${index}`}
                      className="flex gap-2"
                    >
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {dayjs(event.at).format('HH:mm:ss')}
                      </span>
                      <span
                        className={
                          event.type === 'log'
                            ? 'break-all text-muted-foreground'
                            : 'text-foreground'
                        }
                      >
                        {event.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      )}

      {config && snapshot && (
        <CalibrationPanel
          calibratingPointId={status?.calibratingPointId ?? null}
          onCalibrate={handleCalibrate}
          onCancel={handleCalibrateCancel}
          snapshot={snapshot}
        />
      )}
    </>
  )
}

function CalibrationPanel({
  calibratingPointId,
  onCalibrate,
  onCancel,
  snapshot,
}: {
  calibratingPointId: string | null
  onCalibrate: (pointId: string) => void
  onCancel: () => void
  snapshot: NonNullable<
    ReturnType<typeof useEnduranceData>['snapshot']
  >
}) {
  const { config, pointDefinitions } = snapshot
  const zoneName = snapshot.zones[config.zone].name

  return (
    <Panel>
      <PanelBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold">
              Manual overrides (optional)
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vision finds every step by itself. If one specific step ever
              misclicks, press Calibrate, hover the exact spot inside
              Fortnite and press <span className="font-semibold">F9</span>{' '}
              — that step then always clicks your point. F8 cancels.
              Zone-specific spots are saved for {zoneName}.
            </p>
          </div>
          {calibratingPointId && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onCancel}
            >
              Cancel calibration
            </Button>
          )}
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {pointDefinitions.map((definition) => {
            const point = definition.perZone
              ? config.zonePoints[config.zone]?.[definition.id]
              : config.points[definition.id]
            const overridden = Boolean(point)
            const isCalibrating = calibratingPointId === definition.id

            return (
              <li
                key={definition.id}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      {definition.name}
                      {definition.perZone && (
                        <span className="rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
                          {zoneName}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {point
                      ? `${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {isCalibrating ? (
                    <StatusPill
                      pulse
                      tone="active"
                    >
                      Hover in Fortnite, press F9
                    </StatusPill>
                  ) : overridden ? (
                    <StatusPill tone="warning">Manual override</StatusPill>
                  ) : (
                    <StatusPill tone="active">Auto (vision)</StatusPill>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      calibratingPointId !== null && !isCalibrating
                    }
                    onClick={() =>
                      isCalibrating ? onCancel() : onCalibrate(definition.id)
                    }
                  >
                    <Crosshair className="mr-1 size-3.5" />
                    {isCalibrating ? 'Cancel' : 'Calibrate'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </PanelBody>
    </Panel>
  )
}
