import {
  FolderOpen,
  Gamepad2,
  HardDrive,
  RefreshCw,
  Store,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Chip,
  EmptyState,
  KeyValue,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from '../../components/page'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'

import { useGameInstall } from '../../hooks/game-install'
import { relativeTime } from '../../lib/dates'
import { toast } from '../../lib/notifications'

export function HomeGameInstall() {
  const { t } = useTranslation(['general'])
  const { loading, status, refresh } = useGameInstall()

  const handleChooseFolder = async () => {
    const result = await window.electronAPI.chooseGameFolder()

    if (result.reason === 'canceled') {
      return
    }

    if (!result.ok) {
      toast(t('home.game.folder-invalid'))
      return
    }

    await refresh(true)
  }

  const handleOpen = async (target: 'updater' | 'egl' | 'xbox') => {
    const result = await window.electronAPI.openGameOfficialApp(target)

    toast(
      t(result.ok ? 'home.game.update-started' : 'home.game.update-failed')
    )
    await refresh(true)
  }

  if (!status) {
    return (
      <Panel>
        <PanelBody className="grid gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </PanelBody>
      </Panel>
    )
  }

  if (!status.install.found) {
    return (
      <EmptyState
        icon={HardDrive}
        title={t('home.game.missing-title')}
        description={t('home.game.missing-description')}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => void handleChooseFolder()}
            >
              <FolderOpen className="mr-2 size-4" />
              {t('home.game.choose-folder')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleOpen('egl')}
            >
              <Store className="mr-2 size-4" />
              {t('home.game.open-egl')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleOpen('xbox')}
            >
              <Gamepad2 className="mr-2 size-4" />
              {t('home.game.open-xbox')}
            </Button>
          </div>
        }
      />
    )
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
              <span className="break-all font-mono text-[0.75rem]">
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
        <p className="mt-2 text-xs text-muted-foreground">{t('home.game.note')}</p>
      </PanelBody>
      <PanelFooter>
        <Button
          type="button"
          disabled={loading}
          onClick={() => void handleOpen('updater')}
        >
          {t('home.game.update')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => void refresh(true)}
        >
          <RefreshCw className="mr-2 size-3.5" />
          {t('home.game.check')}
        </Button>
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
