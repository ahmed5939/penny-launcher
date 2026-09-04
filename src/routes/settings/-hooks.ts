import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useShallow } from 'zustand/react/shallow'

import { useGameInstall } from '../../hooks/game-install'
import { useSettingsStore } from '../../state/settings/main'

import { settingsSchema } from '../../lib/validations/schemas/settings'
import { toast } from '../../lib/notifications'

export function useSetupForm() {
  const { t } = useTranslation(['settings'])

  const {
    autoDailyQuests,
    claimingRewards,
    customProcess,
    missionInterval,
    path,
    systemTray,
    discordRichPresence,
    overlay,
    userAgent,
  } = useSettingsStore(
    useShallow((state) => ({
      autoDailyQuests: state.autoDailyQuests,
      claimingRewards: state.claimingRewards,
      customProcess: state.customProcess,
      missionInterval: state.missionInterval,
      path: state.path,
      systemTray: state.systemTray,
      discordRichPresence: state.discordRichPresence,
      overlay: state.overlay,
      userAgent: state.userAgent,
    })),
  )
  const { refresh: refreshGameInstall } = useGameInstall()
  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    values: {
      autoDailyQuests,
      claimingRewards,
      customProcess,
      missionInterval,
      path,
      systemTray,
      discordRichPresence,
      overlay,
      userAgent,
    },
  })

  const onDetectPath = async () => {
    const result = await window.electronAPI.detectGamePath()

    form.setValue('path', result.path, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    onSubmit({
      ...form.getValues(),
      path: result.path,
    })
    await refreshGameInstall(true)
  }

  const onChooseFolder = async () => {
    const result = await window.electronAPI.chooseGameFolder()

    if (result.reason === 'canceled') {
      return
    }

    if (!result.ok || !result.path) {
      toast(t('app-settings.form.path.invalid'))
      return
    }

    form.setValue('path', result.path, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    onSubmit({
      ...form.getValues(),
      path: result.path,
    })
    await refreshGameInstall(true)
  }

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    window.electronAPI.updateSettings({
      ...values,
    })

    toast(t('form.submit.status.success'))
  }

  return {
    form,
    onChooseFolder,
    onDetectPath,
    onSubmit,
  }
}
