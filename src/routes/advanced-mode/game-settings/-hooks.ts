import type {
  GameSettingsBackup,
  GameSettingsResult,
} from '../../../types/fn-launch'

import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { gameUserSettingsSchema } from '../../../lib/validations/schemas/settings'
import { toast } from '../../../lib/notifications'

export type GameUserSettingsValues = z.infer<typeof gameUserSettingsSchema>

const emptyValues: GameUserSettingsValues = {
  resolutionX: '1920',
  resolutionY: '1080',
  fullscreenMode: '1',
  vsync: false,
  frameRateLimit: '240',
  resolutionQuality: '100',
}

function toFormValues(
  settings: NonNullable<GameSettingsResult['settings']>
): GameUserSettingsValues {
  const mode = `${settings.fullscreenMode}`

  return {
    resolutionX: `${settings.resolutionX}`,
    resolutionY: `${settings.resolutionY}`,
    // Windowed fullscreen is the game's own default for anything unexpected.
    fullscreenMode: mode === '0' || mode === '2' ? mode : '1',
    vsync: settings.vsync,
    frameRateLimit: `${Math.round(settings.frameRateLimit)}`,
    resolutionQuality: `${settings.resolutionQuality}`,
  }
}

/**
 * The monitor Penny is on, as a resolution the game can be pointed at. Only
 * used to offer a preset — nothing is applied without the user asking.
 */
export function useDisplayResolution() {
  const [resolution] = useState(() => ({
    width: Math.round(window.screen.width * window.devicePixelRatio),
    height: Math.round(window.screen.height * window.devicePixelRatio),
  }))

  return resolution
}

/**
 * The GameUserSettings.ini editor.
 *
 * The file is read on mount and re-read after every write, so the form always
 * shows what is on disk rather than what was last typed — Fortnite rewrites
 * the file when it exits and can undo a save made mid-session.
 */
export function useGameUserSettings() {
  const { t } = useTranslation(['advanced-mode'])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iniPath, setIniPath] = useState<string | null>(null)
  const [backup, setBackup] = useState<GameSettingsBackup | null>(null)
  const [gameRunning, setGameRunning] = useState(false)

  const form = useForm<GameUserSettingsValues>({
    resolver: zodResolver(gameUserSettingsSchema),
    defaultValues: emptyValues,
  })

  const load = useCallback(async () => {
    setLoading(true)

    const result = await window.electronAPI.fnLaunchGameSettingsRequest()

    if (!result.success) {
      setError(result.error)
      setIniPath(null)
      setBackup(null)
      setGameRunning(false)
      setLoading(false)

      return
    }

    setError(null)
    setIniPath(result.iniPath)
    setBackup(result.backup)
    setGameRunning(result.gameRunning)
    form.reset(toFormValues(result.settings))
    setLoading(false)
  }, [form])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async (values: GameUserSettingsValues) => {
    setSaving(true)

    const result = await window.electronAPI.fnLaunchGameSettingsUpdate({
      resolutionX: Number(values.resolutionX),
      resolutionY: Number(values.resolutionY),
      fullscreenMode: Number(values.fullscreenMode),
      vsync: values.vsync,
      frameRateLimit: Number(values.frameRateLimit),
      resolutionQuality: Number(values.resolutionQuality),
    })

    setSaving(false)

    if (!result.success) {
      toast(result.error ?? t('game-settings.status.save-error'))

      return
    }

    toast(t('game-settings.status.saved'))
    await load()
  }

  const onRestore = async () => {
    setSaving(true)

    const result = await window.electronAPI.fnLaunchGameSettingsRestore()

    setSaving(false)

    if (!result.success) {
      toast(result.error ?? t('game-settings.status.restore-error'))

      return
    }

    toast(t('game-settings.status.restored'))
    await load()
  }

  return {
    backup,
    error,
    form,
    gameRunning,
    iniPath,
    loading,
    onRestore,
    onSubmit,
    reload: load,
    saving,
  }
}
