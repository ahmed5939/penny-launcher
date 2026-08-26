import type { CSSProperties, ReactNode } from 'react'
import type { MatchmakingTrackStatus } from '../../../types/data/advanced-mode/matchmaking'
import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Clock,
  ExternalLink,
  Globe2,
  MapPin,
  MapPinOff,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDocumentVisible } from '../../../hooks/ui/document-visibility'
import { useTranslation } from 'react-i18next'

import {
  World,
  WorldColor,
  WorldLetter,
  zoneColors,
  zoneLetters,
} from '../../../config/constants/fortnite/world-info'
import { pennyDBProfileURL } from '../../../config/fortnite/links'

import { Button } from '../../../components/ui/button'
import { Panel, PanelBody } from '../../../components/page'

import {
  useCurrentWorldInfoData,
  useWorldInfo,
} from '../../../hooks/advanced-mode/world-info'

import { parseResource } from '../../../lib/parsers/resources'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { cn } from '../../../lib/utils'

/**
 * The in-game names Epic never sends over the wire — the session only
 * carries a mission generator, which `zoneParser` reduces to these keys.
 */
const missionNames: Record<string, string> = {
  atlas: 'Fight the Storm',
  'atlas-c2': 'Fight the Storm: Category 2',
  'atlas-c3': 'Fight the Storm: Category 3',
  'atlas-c4': 'Fight the Storm: Category 4',
  dtb: 'Deliver the Bomb',
  dte: 'Destroy the Encampments',
  eac: 'Eliminate and Collect',
  ets: 'Evacuate the Shelter',
  htm: 'Haunt the Titan',
  htr: 'Hit the Road',
  'mini-boss': 'Mini-Boss Mission Alert',
  ptp: 'Protect the Presents',
  quest: 'Quest Mission',
  radar: 'Build the Radar Grid',
  refuel: 'Refuel the Homebase',
  rescue: 'Rescue the Survivors',
  resupply: 'Resupply',
  rocket: 'Launch the Rocket',
  rtd: 'Retrieve the Data',
  rtl: 'Ride the Lightning',
  rts: 'Repair the Shelter',
  stn: 'Survive the Night',
  'storm-shield': 'Homebase Storm Shield',
  tts: 'Trap the Storm',
}

type RawRewardItems = Array<{
  itemType: string
  quantity: number
}>

/**
 * Collapses duplicate template ids and resolves each to its real name and
 * icon; `eventscaling` is an internal multiplier, not a reward.
 */
function namedRewards(items: RawRewardItems) {
  return items
    .filter((item) => !item.itemType.includes('eventscaling'))
    .reduce((accumulator, current) => {
      const existing = accumulator.find(
        (item) => item.itemType === current.itemType
      )

      if (existing) {
        existing.quantity += current.quantity
      } else {
        accumulator.push({ ...current })
      }

      return accumulator
    }, [] as RawRewardItems)
    .map((item) =>
      parseResource({
        context: 'world-info',
        key: item.itemType,
        quantity: item.quantity,
      })
    )
}

function StatBlock({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: typeof MapPin
  label: string
}) {
  return (
    <div className="flex gap-3 items-center">
      <span className="flex flex-shrink-0 items-center justify-center rounded-full bg-surface/80 border border-border/60 size-9">
        <Icon className="size-4 text-primary" />
      </span>
      <div>
        <div className="text-[0.625rem] text-muted-foreground uppercase tracking-[0.2em]">
          {label}
        </div>
        <div className="font-medium">{children}</div>
      </div>
    </div>
  )
}

function SectionLabel({
  children,
  className,
  icon: Icon,
}: {
  children: ReactNode
  className?: string
  icon?: typeof Users
}) {
  return (
    <div
      className={cn(
        'flex gap-1.5 items-center text-xs uppercase tracking-[0.15em]',
        className
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </div>
  )
}

function RewardNames({
  rewards,
  className,
}: {
  rewards: ReturnType<typeof namedRewards>
  className?: string
}) {
  return (
    <div className="flex flex-wrap gap-y-1 items-center mt-2">
      {rewards.map((reward, index) => (
        <span
          className="flex items-center"
          key={reward.itemType}
        >
          {index > 0 && (
            <span className="bg-border/80 h-4 mx-3 w-px" />
          )}
          <span
            className={cn('flex gap-1.5 items-center', className)}
          >
            <img decoding="async" loading="lazy"
              src={reward.imgUrl}
              className="size-5 object-contain"
              alt=""
            />
            {reward.name}
            {reward.quantity > 1 && (
              <span className="text-muted-foreground text-xs">
                ×{numberWithCommaSeparator(reward.quantity)}
              </span>
            )}
          </span>
        </span>
      ))}
    </div>
  )
}

function useSessionClock(lastUpdated: string | null) {
  const [now, setNow] = useState(() => Date.now())
  const isVisible = useDocumentVisible()

  useEffect(() => {
    setNow(Date.now())
    if (!isVisible) return

    const interval = window.setInterval(() => setNow(Date.now()), 1_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [isVisible])

  if (!lastUpdated) {
    return null
  }

  const timestamp = Date.parse(lastUpdated)

  if (Number.isNaN(timestamp)) {
    return null
  }

  const totalSeconds = Math.max(0, Math.floor((now - timestamp) / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = `${totalSeconds % 60}`.padStart(2, '0')

  return `${minutes}:${seconds}`
}

export function LiveMissionCard({
  displayName,
  isTracking,
  status,
  onRefresh,
}: {
  displayName: string
  isTracking: boolean
  status: MatchmakingTrackStatus
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation(['advanced-mode', 'zones'])

  const { data: worldInfo } = useWorldInfo()
  const { data: rawWorldInfo } = useCurrentWorldInfoData()

  const session = status.playing ? status.session : null
  const zone = session?.zone ?? null

  const mission: WorldInfoMission | null = zone
    ? worldInfo.get(zone.theaterId as World)?.get(zone.theaterMissionId) ??
      null
    : null

  const theaterName = zone
    ? i18n.exists(zone.theaterId, {
        ns: 'zones',
      })
      ? t(zone.theaterId, {
          ns: 'zones',
        })
      : rawWorldInfo?.theaters?.find(
          (theater) => theater.uniqueId === zone.theaterId
        )?.displayName?.en ?? t('ventures', { ns: 'zones' })
    : null

  const missionTypeId = mission?.ui.mission.zone.type.id ?? null
  const missionName = missionTypeId
    ? missionNames[missionTypeId] ??
      t('matchmaking-track.live.unknown-mission')
    : t('matchmaking-track.live.unknown-mission')
  /**
   * PennyDB titles storm shields as "<zone> Homebase Storm Shield" — the
   * zone is part of the mission's identity there, unlike normal missions.
   */
  const title =
    missionTypeId === 'storm-shield' && theaterName
      ? `${theaterName} ${missionName}`
      : missionName
  const powerLevel =
    mission && mission.ui.powerLevel > 0
      ? mission.ui.powerLevel
      : session?.minDifficulty ?? null
  const zoneColor = zone
    ? zoneColors[zone.theaterId] ?? WorldColor.Ventures
    : WorldColor.Ventures
  const zoneLetter = zone
    ? zoneLetters[zone.theaterId] ?? WorldLetter.Ventures
    : WorldLetter.Ventures
  const sessionTime = useSessionClock(session?.lastUpdated ?? null)

  const missionRewards = mission
    ? namedRewards(mission.raw.mission.missionRewards.items)
    : []
  const alertRewards = mission?.raw.alert
    ? namedRewards(mission.raw.alert.missionAlertRewards.items)
    : []
  const modifiers = mission?.ui.mission.modifiers ?? []

  const handleOpenPennyDB = (name: string) => () => {
    window.electronAPI.openExternalURL(pennyDBProfileURL(name))
  }

  return (
    <Panel
      className="border-l-2 border-l-[color:var(--zone-color)]"
      style={
        {
          '--zone-color': zoneColor,
        } as CSSProperties
      }
    >
      <PanelBody className="relative px-6 py-5">
        {/* accent line running along the top, PennyDB-style */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/60 via-primary/20 to-transparent pointer-events-none"
        />

        {!status.playing ? (
          <div className="flex flex-col gap-2 items-center py-10 text-center">
            <MapPinOff className="size-8 text-muted-foreground/60" />
            <div className="text-muted-foreground">
              {t('matchmaking-track.live.status.not-playing', {
                name: displayName,
              })}
            </div>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isTracking}
            >
              {isTracking ? (
                <UpdateIcon className="animate-spin h-4" />
              ) : (
                <>
                  <RefreshCw className="mr-1.5 size-3.5" />
                  {t('matchmaking-track.live.refresh')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            {/* header */}
            <div className="flex gap-4 items-center">
              <div className="relative flex-shrink-0">
                <span className="flex items-center justify-center rounded-xl border bg-surface/80 size-14 border-[color:var(--zone-color)]/50">
                  {mission ? (
                    <img decoding="async" loading="lazy"
                      src={mission.ui.mission.zone.type.imageUrl}
                      className="size-10"
                      alt=""
                    />
                  ) : (
                    <span className="font-bold text-xl uppercase text-[color:var(--zone-color)]">
                      {zoneLetter}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'absolute -right-1 -top-1 rounded-full ring-2 ring-background size-2.5',
                    session?.started
                      ? 'animate-pulse bg-green-400'
                      : 'bg-amber-400'
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-primary text-xs uppercase tracking-[0.2em]">
                  {'// '}
                  {t('matchmaking-track.live.eyebrow')}
                </div>
                <h2 className="font-bold text-2xl truncate">{title}</h2>
              </div>
              <div className="flex flex-shrink-0 gap-2 items-center">
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    session?.started
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  )}
                >
                  {session?.started
                    ? t('matchmaking-track.live.status.launched')
                    : t('matchmaking-track.live.status.in-lobby')}
                </span>
                <Button
                  className="p-0 size-7"
                  variant="ghost"
                  onClick={onRefresh}
                  disabled={isTracking}
                  aria-label={t('matchmaking-track.live.refresh')}
                >
                  {isTracking ? (
                    <UpdateIcon className="animate-spin h-4" />
                  ) : (
                    <RefreshCw className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* zone / difficulty / region */}
            <div className="flex flex-wrap gap-x-10 gap-y-4 items-center">
              {theaterName && (
                <StatBlock
                  icon={MapPin}
                  label={t('matchmaking-track.live.zone')}
                >
                  {theaterName}
                </StatBlock>
              )}
              {powerLevel !== null && (
                <StatBlock
                  icon={Shield}
                  label={t('matchmaking-track.live.difficulty')}
                >
                  {powerLevel}
                </StatBlock>
              )}
              {session?.region && (
                <StatBlock
                  icon={Globe2}
                  label={t('matchmaking-track.live.region')}
                >
                  {session.region}
                </StatBlock>
              )}
            </div>

            {/* squad + rewards */}
            <div className="space-y-5">
              <div>
                <SectionLabel
                  className="text-primary"
                  icon={Users}
                >
                  {t('matchmaking-track.live.squad', {
                    total: session?.totalPlayers ?? 0,
                  })}
                </SectionLabel>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {session?.players.map((player) => (
                    <button
                      className="flex gap-1.5 items-center rounded-md border border-border/60 bg-surface/60 px-2.5 py-1 text-sm hover:border-primary/40 hover:bg-accent/50 transition-colors"
                      key={player.id}
                      onClick={handleOpenPennyDB(
                        player.displayName ?? player.id
                      )}
                      title={t('matchmaking-track.live.pennydb')}
                    >
                      <span className="max-w-40 truncate">
                        {player.displayName ?? player.id}
                      </span>
                      <ExternalLink
                        className="stroke-muted-foreground"
                        size={12}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {missionRewards.length > 0 && (
                <div>
                  <SectionLabel className="text-emerald-400">
                    {t('matchmaking-track.live.mission-rewards')}
                  </SectionLabel>
                  <RewardNames
                    rewards={missionRewards}
                    className="text-primary"
                  />
                </div>
              )}

              {alertRewards.length > 0 && (
                <div>
                  <SectionLabel className="text-amber-400">
                    {t('matchmaking-track.live.alert-rewards')}
                  </SectionLabel>
                  <RewardNames
                    rewards={alertRewards}
                    className="text-amber-200"
                  />
                </div>
              )}

              {modifiers.length > 0 && (
                <div>
                  <SectionLabel className="text-muted-foreground">
                    {t('matchmaking-track.live.modifiers')}
                  </SectionLabel>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {modifiers.map((modifier) => (
                      <img decoding="async" loading="lazy"
                        src={modifier.imageUrl}
                        className="size-6"
                        key={modifier.id}
                        alt=""
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* session clock */}
            {sessionTime && (
              <div>
                <StatBlock
                  icon={Clock}
                  label={t('matchmaking-track.live.session')}
                >
                  <span className="text-primary">
                    {t('matchmaking-track.live.session-time', {
                      time: sessionTime,
                    })}
                  </span>
                </StatBlock>
              </div>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}
