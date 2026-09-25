import type { ReactNode } from 'react'

import { Link } from '@tanstack/react-router'
import { FolderOpen, Plus, Rocket, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useDocumentVisible } from '../../hooks/ui/document-visibility'

import { zoneArt } from '../../components/page/page-header'
import { Button } from '../../components/ui/button'

import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'
import { useGameAction } from '../../hooks/ui/game-action'
import { useGameInstall } from '../../hooks/game-install'
import { useGameFolderActions } from './-game-install'

import { parseCustomDisplayName } from '../../lib/utils'

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

  const { accountsArray } = useGetAccounts()
  const { selected } = useGetSelectedAccount()
  const { isRunning: customProcessIsRunning, canLaunch, launch: handleLaunch, close } = useGameAction()
  const { status: install } = useGameInstall()
  const { chooseFolder, openOfficial } = useGameFolderActions()
  const notInstalled = install !== null && !install.install.found

  const elapsed = useSessionTimer(customProcessIsRunning)

  const hasAccounts = accountsArray.length > 0
  const displayName = selected ? parseCustomDisplayName(selected) : null

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
      */}
      <img
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-[center_35%] opacity-80 dark:opacity-75"
        decoding="async"
        src={zoneArt['twine-peaks']}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/0" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />

      <div className="relative flex min-h-60 flex-col justify-end gap-5 px-6 pb-6 pt-14 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
            {customProcessIsRunning && (
              <span className="relative flex size-1.5">
                <span className="relative inline-flex size-full rounded-full bg-success" />
              </span>
            )}
            {!hasAccounts ? t('home.eyebrow') : customProcessIsRunning ? t('home.playing') : notInstalled ? <span className="text-warning">{t('home.game.missing-title')}</span> : t('home.ready')}
          </div>

          <h1 className="mt-2 text-display-lg font-extrabold leading-none tracking-tight text-foreground">
            {headline}
          </h1>

          <div className="mt-3 flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
            {!hasAccounts ? (
              <span>{t('home.no-account-description')}</span>
            ) : displayName ? (
              <>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xs font-bold uppercase text-primary ring-1 ring-inset ring-primary/40">
                  {displayName.charAt(0)}
                </span>
                <span className="truncate font-medium text-foreground/80">
                  {displayName}
                </span>
                {elapsed !== null && (
                  <span className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-caption tabular-nums text-foreground/70">
                    {formatElapsed(elapsed)}
                  </span>
                )}
              </>
            ) : (
              <span>{t('home.select-account')}</span>
            )}
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
            ) : (
              <Button
                className="h-12 min-w-44 px-10 text-base font-semibold"
                disabled={
                  !canLaunch
                }
                onClick={handleLaunch}
              >
                <Rocket className="mr-2 size-4" />
                {customProcessIsRunning
                  ? t('is-running')
                  : t('launch-game.button')}
              </Button>
            )}

            {customProcessIsRunning && (
              <Button
                className="h-12 border-destructive/40 px-5 text-sm font-semibold text-destructive hover:bg-destructive/15"
                variant="outline"
                onClick={close}
              >
                <Square className="mr-2 size-3.5" />
                {t('close-game.button')}
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
