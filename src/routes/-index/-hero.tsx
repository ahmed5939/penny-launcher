import type { ReactNode } from 'react'

import { Link } from '@tanstack/react-router'
import { Plus, Rocket, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useDocumentVisible } from '../../hooks/ui/document-visibility'

import { PennyRender } from '../../components/branding/penny-portrait'
import { Button } from '../../components/ui/button'

import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'
import { useGameInstall } from '../../hooks/game-install'
import { useCustomProcessStatus } from '../../hooks/settings'
import { useAlertsSummary, useAutomationServices } from './-hooks'

import { numberWithCommaSeparator } from '../../lib/parsers/numbers'
import { parseCustomDisplayName, cn } from '../../lib/utils'

/**
 * Home hero: identity, the one action that matters, and the numbers worth
 * knowing before you press it.
 *
 * The launch/kill notification listener is registered by the titlebar's
 * `useHandlers`, so this calls the electron API directly rather than reusing
 * that hook — otherwise every toast would fire twice.
 */
export function HomeHero() {
  const { t } = useTranslation(['general'])

  const { accountsArray } = useGetAccounts()
  const { selected } = useGetSelectedAccount()
  const { customProcessIsRunning } = useCustomProcessStatus()
  const { status: gameInstall } = useGameInstall({ autoLoad: false })
  const { running, services } = useAutomationServices()
  const alerts = useAlertsSummary()

  const elapsed = useSessionTimer(customProcessIsRunning)

  const hasAccounts = accountsArray.length > 0
  const installMissing = gameInstall?.install.found === false
  const displayName = selected ? parseCustomDisplayName(selected) : null

  const handleLaunch = () => {
    if (selected) {
      window.electronAPI.launcherStart(selected)
    }
  }

  const headline = !hasAccounts
    ? t('home.no-account')
    : customProcessIsRunning
      ? t('home.playing')
      : t('home.ready')

  return (
    <section className="relative mb-4 select-none overflow-hidden rounded-xl border border-border/70 bg-card">
      {/*
        Backdrop: a brand-gradient wash over the card plus two soft light
        sources. Everything is tokens — the wash follows the active colour
        theme, and the card underneath follows the mode, so the hero reads as
        a poster in dark and a sunlit panel in light instead of a dark island.
      */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--brand-via)/0.10)] via-transparent to-[hsl(var(--brand-to)/0.08)] dark:from-[hsl(var(--brand-via)/0.16)] dark:to-[hsl(var(--brand-to)/0.14)]" />
      <div className="absolute -right-24 -top-32 size-80 rounded-full bg-primary/20 blur-3xl" />
      {/* The gradient's far stop, as the second light source. */}
      <div className="absolute -bottom-36 -left-24 size-80 rounded-full bg-[hsl(var(--brand-to)/0.10)] blur-3xl" />
      {/*
        Penny herself as the watermark. Faded into the corner and masked out
        toward the text so the headline never sits on top of her face.
      */}
      <PennyRender className="absolute -bottom-16 -right-16 hidden h-[128%] w-auto opacity-[0.10] [mask-image:linear-gradient(to_left,black_30%,transparent_80%)] sm:block" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-primary/80">
            {customProcessIsRunning && (
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex size-full rounded-full bg-success" />
              </span>
            )}
            {t('home.eyebrow')}
          </div>

          <h1 className="mt-2 text-[1.75rem] font-black leading-none tracking-tight text-foreground sm:text-[2rem]">
            {headline}
          </h1>

          <div className="mt-3 flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
            {!hasAccounts ? (
              <span>{t('home.no-account-description')}</span>
            ) : displayName ? (
              <>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[0.65rem] font-bold uppercase text-primary ring-1 ring-inset ring-primary/40">
                  {displayName.charAt(0)}
                </span>
                <span className="truncate font-medium text-foreground/80">
                  {displayName}
                </span>
                {elapsed !== null && (
                  <span className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[0.7rem] tabular-nums text-foreground/70">
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
                className="h-11 rounded-lg bg-gradient-to-r from-brand-from to-brand-to px-7 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-black/15 hover:brightness-110 dark:shadow-black/40"
                asChild
              >
                <Link
                  to="/accounts/add/$type"
                  params={{ type: 'authorization-code' }}
                >
                  <Plus className="mr-2 size-4" />
                  {t('home.add-account')}
                </Link>
              </Button>
            ) : (
              <Button
                className={cn(
                  'h-11 rounded-lg px-9 text-sm font-bold uppercase tracking-wider text-white',
                  'bg-gradient-to-r from-brand-from to-brand-to',
                  'shadow-lg shadow-black/15 transition-all hover:brightness-110 dark:shadow-black/40',
                  'disabled:opacity-40 disabled:shadow-none'
                )}
                disabled={
                  selected === null ||
                  customProcessIsRunning ||
                  installMissing
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
                className="h-11 rounded-lg border-destructive/40 px-5 text-sm font-semibold uppercase tracking-wider text-destructive hover:bg-destructive/15"
                variant="outline"
                onClick={() => window.electronAPI.killProcess()}
              >
                <Square className="mr-2 size-3.5" />
                {t('close-game.button')}
              </Button>
            )}
          </div>
        </div>

        <dl className="flex shrink-0 gap-6 sm:flex-col sm:gap-3 sm:border-l sm:border-foreground/10 sm:pl-8">
          <Stat
            label={t('home.stats.accounts')}
            value={numberWithCommaSeparator(accountsArray.length)}
          />
          <Stat
            label={t('home.stats.services')}
            value={`${running}/${services.length}`}
          />
          <Stat
            label={t('home.stats.alerts')}
            value={
              alerts.isLoading
                ? '—'
                : numberWithCommaSeparator(alerts.total)
            }
          />
        </dl>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="sm:text-right">
      <dd className="text-lg font-bold leading-none tabular-nums text-foreground">
        {value}
      </dd>
      <dt className="mt-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground/70">
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
