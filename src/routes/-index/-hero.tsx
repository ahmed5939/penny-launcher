import type { ReactNode } from 'react'

import { Link } from '@tanstack/react-router'
import { FolderOpen, Plus, Rocket, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useDocumentVisible } from '../../hooks/ui/document-visibility'

import { homeBackdrop } from '../../config/backdrops'
import { useBackdropStore } from '../../state/ui/backdrop'
import { useTheme } from '../../components/theme-provider'
import { Button } from '../../components/ui/button'
import { AccountAvatar } from '../../components/accounts/account-avatar'

import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'
import { useGameAction } from '../../hooks/ui/game-action'
import { useGameInstall } from '../../hooks/game-install'
import { useGameFolderActions } from './-game-install'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/** What a player checks before pressing Play. Absent until loaded. */
export type HeroToday = {
  dailies: { done: number; total: number } | null
  expeditionsReady: number | null
  resetIn: string
}

/**
 * The launcher: key art, who you are, one Play button and the three things
 * worth knowing before you press it. When the game is not installed, Play
 * becomes the way to fix that, rather than a disabled button above a
 * separate "not installed" card further down the page.
 */
export function HomeHero({ today }: { today?: HeroToday }) {
  const { t } = useTranslation(['general'])
  const { colorTheme } = useTheme()
  const homeArt = useBackdropStore((state) => state.homeArt)
  const backdrop = homeBackdrop(colorTheme, homeArt)

  const { accountsArray } = useGetAccounts()
  const { selected } = useGetSelectedAccount()
  const { isRunning: customProcessIsRunning, canLaunch, launch: handleLaunch, close } = useGameAction()
  const { status: install } = useGameInstall()
  const { chooseFolder, openOfficial } = useGameFolderActions()
  const notInstalled = install !== null && !install.install.found

  const elapsed = useSessionTimer(customProcessIsRunning)
  const [confirmingClose, setConfirmingClose] = useState(false)

  useEffect(() => {
    if (!confirmingClose) return

    const timeout = setTimeout(() => {
      setConfirmingClose(false)
    }, 4000)

    return () => {
      clearTimeout(timeout)
    }
  }, [confirmingClose])

  useEffect(() => {
    if (!customProcessIsRunning) setConfirmingClose(false)
  }, [customProcessIsRunning])

  const hasAccounts = accountsArray.length > 0
  const displayName = selected ? parseCustomDisplayName(selected) : null
  const signInExpired = selected?.authStatus === 'invalid'
  const launchBlockedBy = signInExpired ? t('home.sign-in-expired') : t('home.select-account')

  const pressClose = () => {
    if (!confirmingClose) {
      setConfirmingClose(true)

      return
    }

    setConfirmingClose(false)
    close()
  }

  // The game's name, not a status: the state (ready, playing, not
  // installed) is the line above it, in the tone it deserves.
  const headline = !hasAccounts ? t('home.no-account') : 'Save the World'

  return (
    <section className="relative -mx-5 -mt-5 select-none overflow-hidden">
      {/*
        The game's key art, full bleed, fading into the page — the opening of
        a game client's library page. It replaces a brand-gradient wash, two
        blurred light orbs and a faded mascot watermark, which together were
        the generated-landing-page look this screen was meant not to have.
        The art follows the colour theme, so a Canny Valley theme opens on
        Canny Valley, unless a picture is chosen in Settings → Appearance.
      */}
      <img
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover opacity-85 dark:opacity-80"
        decoding="async"
        key={backdrop.src}
        src={backdrop.src}
        style={{ objectPosition: backdrop.position }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/0" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />

      <div className="relative flex min-h-72 flex-col justify-end gap-5 px-6 pb-6 pt-14 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            {customProcessIsRunning && (
              <span className="relative flex size-1.5">
                <span className="relative inline-flex size-full rounded-full bg-success" />
              </span>
            )}
            {!hasAccounts ? (
              t('home.eyebrow')
            ) : customProcessIsRunning ? (
              t('home.playing')
            ) : notInstalled ? (
              <span className="text-warning">{t('home.game.missing-title')}</span>
            ) : canLaunch ? (
              t('home.ready')
            ) : signInExpired ? (
              <Link
                className="text-warning hover:underline"
                params={{ type: 'quick-login' }}
                to="/accounts/add/$type"
              >
                {launchBlockedBy}
              </Link>
            ) : (
              <span className="text-warning">{launchBlockedBy}</span>
            )}
          </div>

          <h1 className="mt-2 text-display-lg font-extrabold leading-none tracking-tight text-foreground">
            {headline}
          </h1>

          <div className="mt-3 flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
            {!hasAccounts ? (
              <span>{t('home.no-account-description')}</span>
            ) : displayName ? (
              <>
                <AccountAvatar
                  accountId={selected?.accountId ?? ''}
                  className="ring-1 ring-primary/40"
                  name={displayName}
                  size="sm"
                />
                <span className="truncate font-medium text-foreground/80">
                  {displayName}
                </span>
                {elapsed !== null && (
                  <span className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-caption tabular-nums text-foreground/70">
                    {formatElapsed(elapsed)}
                  </span>
                )}
              </>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {!hasAccounts ? (
              <Button
                className="h-11 px-7 text-sm font-semibold"
                asChild
              >
                <Link
                  to="/accounts/add/$type"
                  params={{ type: 'quick-login' }}
                >
                  <Plus className="mr-2 size-4" />
                  {t('home.add-account')}
                </Link>
              </Button>
            ) : notInstalled && !customProcessIsRunning ? (
              <>
                <Button
                  className="h-12 px-8 text-base font-semibold"
                  onClick={() => void chooseFolder()}
                >
                  <FolderOpen className="mr-2 size-4" />
                  {t('home.game.choose-folder')}
                </Button>
                <Button
                  className="h-12 px-5 text-sm font-semibold"
                  variant="secondary"
                  onClick={() => void openOfficial('egl')}
                >
                  {t('home.game.open-egl')}
                </Button>
              </>
            ) : customProcessIsRunning ? null : (
              <Button
                className="h-12 min-w-44 px-10 text-base font-semibold"
                disabled={!canLaunch}
                onClick={handleLaunch}
                title={canLaunch ? undefined : launchBlockedBy}
              >
                <Rocket className="mr-2 size-4" />
                {t('launch-game.button')}
              </Button>
            )}

            {customProcessIsRunning && (
              <Button
                className={cn(
                  'h-12 px-5 text-sm font-semibold',
                  !confirmingClose && 'border-destructive/40 text-destructive hover:bg-destructive/15',
                )}
                onBlur={() => {
                  setConfirmingClose(false)
                }}
                onClick={pressClose}
                variant={confirmingClose ? 'destructive' : 'outline'}
              >
                <Square className="mr-2 size-3.5" />
                {confirmingClose ? t('close-game.confirm') : t('close-game.button')}
              </Button>
            )}
          </div>
        </div>

        {today && (
          <dl className="flex shrink-0 gap-8">
            <Stat
              label="Daily quests"
              value={today.dailies ? `${today.dailies.done}/${today.dailies.total}` : '—'}
            />
            <Stat
              label="Expeditions ready"
              value={today.expeditionsReady ?? '—'}
            />
            <Stat
              label="Daily reset in"
              value={today.resetIn}
            />
          </dl>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dd className="figure text-display-sm font-bold leading-none text-foreground">
        {value}
      </dd>
      <dt className="mt-1.5 text-caption text-foreground/60">
        {label}
      </dt>
    </div>
  )
}

/**
 * Times the current play session. Only sessions this component observed
 * starting are timed — if the game was already running when the app opened
 * we have no start time and would rather show nothing than guess one.
 */
function useSessionTimer(isRunning: boolean) {
  const isVisible = useDocumentVisible()
  const [elapsed, setElapsed] = useState<number | null>(null)
  const startedAt = useRef<number | null>(null)
  const wasRunning = useRef(isRunning)

  useEffect(() => {
    if (!isRunning) {
      startedAt.current = null
      wasRunning.current = false
      setElapsed(null)

      return
    }

    if (!wasRunning.current) {
      startedAt.current = Date.now()
      wasRunning.current = true
    }

    const start = startedAt.current

    if (start === null) {
      return
    }

    setElapsed(Date.now() - start)

    if (!isVisible) return

    const interval = setInterval(() => {
      setElapsed(Date.now() - start)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isRunning, isVisible])

  return elapsed
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => `${value}`.padStart(2, '0')

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}
