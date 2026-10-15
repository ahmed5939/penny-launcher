import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Chip,
  KeyValue,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  RefreshButton,
} from '../../components/page'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'

import { useGameInstall } from '../../hooks/game-install'
import { relativeTime } from '../../lib/dates'
import { toast } from '../../lib/notifications'

/** Each store app gets its own confirmation, and its own failure, so the toast names what opened. */
const officialAppToasts = {
  updater: { ok: 'home.game.update-started', failed: 'home.game.update-failed' },
  egl: { ok: 'home.game.opened-egl', failed: 'home.game.open-egl-failed' },
  xbox: { ok: 'home.game.opened-xbox', failed: 'home.game.open-xbox-failed' },
} as const

/** Point Penny at the game, or hand off to the store app that installs it. */
export function useGameFolderActions() {
  const { t } = useTranslation(['general'])
  const { refresh } = useGameInstall()

  const chooseFolder = async () => {
    const result = await window.electronAPI.chooseGameFolder()

    if (result.reason === 'canceled') {
      return
    }

    if (!result.ok) {
      toast.error(t('home.game.folder-invalid'))
      return
    }

    await refresh(true)
  }

  const openOfficial = async (target: 'updater' | 'egl' | 'xbox') => {
    const result = await window.electronAPI.openGameOfficialApp(target)

    if (result.ok) {
      toast.success(t(officialAppToasts[target].ok))
    } else {
      toast.error(t(officialAppToasts[target].failed))
    }
    await refresh(true)
  }

  return { chooseFolder, openOfficial }
}

/**
 * The installed game's version and update state. A missing install is the
 * hero's business — it replaces Play with "Choose game folder" — so this
 * only draws once there is a game to describe.
 */
export function HomeGameInstall() {
  const { t } = useTranslation(['general'])
  const { loading, status, refresh } = useGameInstall()
  const { chooseFolder: handleChooseFolder, openOfficial: handleOpen } = useGameFolderActions()

  if (!status) {
    return (
      <Panel>
        <PanelBody className="grid gap-3" role="status" aria-label={t('home.game.loading')}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </PanelBody>
      </Panel>
    )
  }

  if (!status.install.found) {
    return null
  }

  const { install } = status
  const sourceKey = `home.game.source-${install.source}` as const

  return (
    <Panel>
      <PanelHeader
        compact
        icon={HardDrive}
        title={t('home.game.title')}
        actions={
          <Chip
            tone={
              status.updateAvailable
                ? 'warning'
                : status.latestVersion
                  ? 'success'
                  : 'neutral'
            }
          >
            {status.updateAvailable
              ? t('home.game.update-available')
              : status.latestVersion
                ? t('home.game.up-to-date')
                : t('home.game.unknown')}
          </Chip>
        }
      />
      <PanelBody>
        <dl className="grid gap-4 sm:grid-cols-2">
          <KeyValue
            copyable
            label={t('home.game.path')}
            value={
              <span className="break-all font-mono text-xs">
                {install.binariesPath}
              </span>
            }
          />
          <KeyValue
            label={t('home.game.version')}
            value={install.version ?? t('home.game.unknown')}
          />
          <KeyValue
            label={t('home.game.latest')}
            value={status.latestVersion ?? t('home.game.unknown')}
          />
          <KeyValue
            label={t('home.game.disk')}
            value={
              install.diskBytes != null
                ? formatDiskBytes(install.diskBytes)
                : t('home.game.unknown')
            }
          />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {t(sourceKey)}
          {status.lastCheckedAt
            ? ` · ${t('home.game.last-checked')} ${relativeTime(status.lastCheckedAt)}`
            : ''}
          {install.incomplete ? ` · ${t('home.game.incomplete')}` : ''}
        </p>
      </PanelBody>
      <PanelFooter>
        {status.updateAvailable && (
          <Button
            type="button"
            disabled={loading}
            onClick={() => void handleOpen('updater')}
          >
            {t('home.game.update')}
          </Button>
        )}
        <RefreshButton
          label={t('home.game.check')}
          loading={loading}
          onClick={() => void refresh(true)}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => void handleChooseFolder()}
        >
          {t('home.game.choose-folder')}
        </Button>
      </PanelFooter>
    </Panel>
  )
}

function formatDiskBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  const digits = value >= 10 || unit === 0 ? 0 : 1

  return `${value.toFixed(digits)} ${units[unit]}`
}
