import type { CSSProperties, ReactNode } from 'react'
import type { MatchmakingTrackStatus } from '../../../types/data/advanced-mode/matchmaking'
import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { ExternalLink, MapPinOff } from 'lucide-react'
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

import {
  Panel,
  PanelBody,
  RefreshButton,
  StatusPill,
  zoneArt,
  type ZoneArt,
} from '../../../components/page'

import {
  useCurrentWorldInfoData,
  useWorldInfo,
} from '../../../hooks/advanced-mode/world-info'

import { parseResource } from '../../../lib/parsers/resources'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'

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

/** A figure over its caption, the way the Home hero states today's numbers. */
function Figure({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dd className="figure truncate text-title font-semibold leading-tight text-foreground">
        {children}
      </dd>
      <dt className="mb-1 text-caption text-foreground/60">{label}</dt>
    </div>
  )
}

function Section({
  children,
  label,
}: {
  children: ReactNode
  label: ReactNode
}) {
  return (
    <section className="min-w-0">
      <p className="section-label mb-2.5">{label}</p>
      {children}
    </section>
  )
}

function RewardNames({
  rewards,
}: {
  rewards: ReturnType<typeof namedRewards>
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rewards.map((reward) => (
        <li
          className="flex items-center gap-1.5 rounded-md bg-muted/40 py-1 pl-1 pr-2.5 text-ui"
          key={reward.itemType}
        >
          <img
            alt=""
            className="size-6 object-contain"
            decoding="async"
            loading="lazy"
            src={reward.imgUrl}
          />
          <span className="truncate">{reward.name}</span>
          {reward.quantity > 1 && (
            <span className="figure text-xs text-muted-foreground">
              ×{numberWithCommaSeparator(reward.quantity)}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** PennyDB only sends reward names, so these render without icons. */
function PlainRewards({ rewards }: { rewards: Array<string> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rewards.map((reward, index) => (
        <li
          className="rounded-md bg-muted/40 px-2.5 py-1 text-ui"
          key={`${reward}-${index}`}
        >
          {reward}
        </li>
      ))}
    </ul>
  )
}

/** The four base zones have key art; everything else plays on a plain fill. */
const theaterArt: Partial<Record<string, ZoneArt>> = {
  [World.Stonewood]: 'stonewood',
  [World.Plankerton]: 'plankerton',
  [World.CannyValley]: 'canny-valley',
  [World.TwinePeaks]: 'twine-peaks',
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
  accountId,
  displayName,
  isTracking,
  status,
  onRefresh,
}: {
  accountId: string
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
  /**
   * PennyDB's live `what_mission_data` is preferred for everything it
   * names; Epic's session fills in rewards with icons, modifiers and region.
   */
  const pennydb = status.mission
  const theaterId = zone?.theaterId ?? pennydb?.theaterId ?? null

  const mission: WorldInfoMission | null = zone
    ? worldInfo.get(zone.theaterId as World)?.get(zone.theaterMissionId) ??
      null
    : null
  const isHestiaLobby = session !== null && mission === null && !pennydb

  const theaterName =
    pennydb?.zone ??
    (zone
      ? i18n.exists(zone.theaterId, {
          ns: 'zones',
        })
        ? t(zone.theaterId, {
            ns: 'zones',
          })
        : rawWorldInfo?.theaters?.find(
            (theater) => theater.uniqueId === zone.theaterId
          )?.displayName?.en ?? t('ventures', { ns: 'zones' })
      : null)

  const missionTypeId = mission?.ui.mission.zone.type.id ?? null
  const missionName = missionTypeId
    ? missionNames[missionTypeId] ??
      t('matchmaking-track.live.unknown-mission')
    : t('matchmaking-track.live.hestia-lobby')
  /**
   * PennyDB titles storm shields as "<zone> Homebase Storm Shield" — the
   * zone is part of the mission's identity there, unlike normal missions.
   */
  const title =
    pennydb?.name ??
    (missionTypeId === 'storm-shield' && theaterName
      ? `${theaterName} ${missionName}`
      : missionName)
  const powerLevel =
    pennydb?.difficulty ??
    (mission && mission.ui.powerLevel > 0
      ? mission.ui.powerLevel
      : session?.minDifficulty ?? null)
  const zoneColor = theaterId
    ? zoneColors[theaterId] ?? WorldColor.Ventures
    : WorldColor.Ventures
  const zoneLetter = theaterId
    ? zoneLetters[theaterId] ?? WorldLetter.Ventures
    : WorldLetter.Ventures
  const sessionTime = useSessionClock(
    pennydb?.startedAt ?? session?.lastUpdated ?? null
  )

  /** Epic's resolved rewards carry icons; PennyDB's names are the fallback. */
  const missionRewards = mission
    ? namedRewards(mission.raw.mission.missionRewards.items)
    : []
  const alertRewards = mission?.raw.alert
    ? namedRewards(mission.raw.alert.missionAlertRewards.items)
    : []
  const pennydbRewards =
    missionRewards.length === 0 ? pennydb?.rewards ?? [] : []
  const pennydbAlerts = alertRewards.length === 0 ? pennydb?.alerts ?? [] : []
  const squad =
    session && session.players.length > 0
      ? session.players.map((member) => ({
          key: member.id,
          name: member.displayName ?? member.id,
        }))
      : (pennydb?.players ?? []).map((name) => ({ key: name, name }))
  const modifiers = mission?.ui.mission.modifiers ?? []

  const handleOpenPennyDB = (name: string) => () => {
    window.electronAPI.openExternalURL(pennyDBProfileURL(name))
  }

  const launched = pennydb
    ? pennydb.launched
    : Boolean(session?.started && !isHestiaLobby)
  const art = theaterId ? theaterArt[theaterId] : undefined

  const player = (
    <div className="min-w-0">
      <button
        className="flex max-w-full items-center gap-1.5 text-title font-semibold hover:text-primary"
        onClick={handleOpenPennyDB(displayName)}
        title={t('matchmaking-track.live.pennydb')}
        type="button"
      >
        <span className="truncate">{displayName}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <p className="truncate font-mono text-caption text-muted-foreground">
        {accountId}
      </p>
    </div>
  )

  if (!status.playing) {
    return (
      <Panel>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <div className="min-w-0 flex-1">{player}</div>
          <StatusPill tone="idle">
            {t('matchmaking-track.live.status.offline')}
          </StatusPill>
          <RefreshButton
            label={t('matchmaking-track.live.refresh')}
            loading={isTracking}
            onClick={onRefresh}
          />
        </div>
        <div className="flex items-start gap-3 border-t border-border/30 px-5 py-4">
          <MapPinOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-ui font-medium">
              {t('matchmaking-track.live.status.not-playing', {
                name: displayName,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('matchmaking-track.live.status.not-playing-hint')}
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      style={
        {
          '--zone-color': zoneColor,
        } as CSSProperties
      }
    >
      {/*
        The mission as the game would frame it: the zone's key art behind the
        mission name, the numbers that matter along its foot.
      */}
      <div className="relative overflow-hidden">
        {art ? (
          <>
            <img
              alt=""
              className="absolute inset-0 size-full object-cover object-[center_40%] opacity-70"
              decoding="async"
              src={zoneArt[art]}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-card/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-card/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-muted/30" />
        )}

        <div className="relative flex min-h-56 flex-col justify-between gap-6 px-6 pb-5 pt-5">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">{player}</div>
            <StatusPill
              pulse={launched}
              tone={launched ? 'active' : 'warning'}
            >
              {launched
                ? t('matchmaking-track.live.status.launched')
                : t('matchmaking-track.live.status.in-lobby')}
            </StatusPill>
            <RefreshButton
              label={t('matchmaking-track.live.refresh')}
              loading={isTracking}
              onClick={onRefresh}
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="flex min-w-0 items-center gap-4">
              {mission ? (
                <img
                  alt=""
                  className="ink-glyph size-14 shrink-0 drop-shadow"
                  decoding="async"
                  loading="lazy"
                  src={mission.ui.mission.zone.type.imageUrl}
                />
              ) : (
                <span className="figure shrink-0 text-display font-bold text-[color:var(--zone-color)]">
                  {zoneLetter}
                </span>
              )}
              <p className="min-w-0 truncate text-display-sm font-bold leading-tight tracking-tight">
                {title}
              </p>
            </div>

            <dl className="flex shrink-0 flex-wrap gap-x-8 gap-y-3">
              {theaterName && (
                <Figure label={t('matchmaking-track.live.zone')}>
                  {theaterName}
                </Figure>
              )}
              {powerLevel !== null && (
                <Figure label={t('matchmaking-track.live.difficulty')}>
                  {powerLevel}
                </Figure>
              )}
              {session?.region && (
                <Figure label={t('matchmaking-track.live.region')}>
                  {session.region}
                </Figure>
              )}
              {sessionTime && (
                <Figure label={t('matchmaking-track.live.session')}>
                  {sessionTime}
                </Figure>
              )}
            </dl>
          </div>
        </div>
      </div>

      <PanelBody className="grid gap-6 py-5 lg:grid-cols-2">
        <Section
          label={t('matchmaking-track.live.squad', {
            total: session?.totalPlayers ?? squad.length,
          })}
        >
          <ul className="flex flex-wrap gap-1.5">
            {squad.map((member) => (
              <li key={member.key}>
                <button
                  className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1 text-ui transition-colors hover:bg-accent/50"
                  onClick={handleOpenPennyDB(member.name)}
                  title={t('matchmaking-track.live.pennydb')}
                  type="button"
                >
                  <span className="max-w-40 truncate">{member.name}</span>
                  <ExternalLink className="size-3 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {modifiers.length > 0 && (
          <Section label={t('matchmaking-track.live.modifiers')}>
            <div className="flex flex-wrap gap-1">
              {modifiers.map((modifier) => (
                <img
                  alt=""
                  className="size-7"
                  decoding="async"
                  key={modifier.id}
                  loading="lazy"
                  src={modifier.imageUrl}
                />
              ))}
            </div>
          </Section>
        )}

        {missionRewards.length > 0 && (
          <Section label={t('matchmaking-track.live.mission-rewards')}>
            <RewardNames rewards={missionRewards} />
          </Section>
        )}

        {pennydbRewards.length > 0 && (
          <Section label={t('matchmaking-track.live.mission-rewards')}>
            <PlainRewards rewards={pennydbRewards} />
          </Section>
        )}

        {alertRewards.length > 0 && (
          <Section
            label={
              <span className="text-warning">
                {t('matchmaking-track.live.alert-rewards')}
              </span>
            }
          >
            <RewardNames rewards={alertRewards} />
          </Section>
        )}

        {pennydbAlerts.length > 0 && (
          <Section
            label={
              <span className="text-warning">
                {t('matchmaking-track.live.alert-rewards')}
              </span>
            }
          >
            <PlainRewards rewards={pennydbAlerts} />
          </Section>
        )}
      </PanelBody>
    </Panel>
  )
}
