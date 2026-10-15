import type { ClipboardEventHandler } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { z } from 'zod'

import { useAddAccountUpdateSubmittingState } from '../../../../hooks/accounts'
import { useBaseSetupForm } from '../-hooks'
import { parseDeviceAuth } from '../-paste'

export function useSetupForm() {
  const { t, i18n } = useTranslation(['accounts'], {
    keyPrefix: 'device-auth.validations',
  })

  const formSchema = useMemo(
    () =>
      z.object({
        accountId: z.string().min(32, {
          message: t('account-id'),
        }),
        deviceId: z.string().min(32, {
          message: t('device-id'),
        }),
        secret: z.string().min(32, {
          message: t('secret'),
        }),
      }),
    [i18n.language]
  )

  const { isSubmitting, updateSubmittingState } =
    useAddAccountUpdateSubmittingState('deviceAuth')
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      deviceId: '',
      secret: '',
    },
  })

  useBaseSetupForm({
    fetcher: window.electronAPI.responseAuthWithDevice,
    onSuccess: () => form.reset(),
    type: 'deviceAuth',
  })

  // A saved device auth pasted into any of the three fields fills them all.
  // Anything that is not one is left to paste as text.
  const onPaste: ClipboardEventHandler<HTMLInputElement> = (event) => {
    const deviceAuth = parseDeviceAuth(event.clipboardData.getData('text'))

    if (!deviceAuth) {
      return
    }

    event.preventDefault()

    form.setValue('accountId', deviceAuth.accountId, { shouldValidate: true })
    form.setValue('deviceId', deviceAuth.deviceId, { shouldValidate: true })
    form.setValue('secret', deviceAuth.secret, { shouldValidate: true })
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) {
      return
    }

    updateSubmittingState(true)
    window.electronAPI.createAuthWithDevice(values)
  }

  return { form, isSubmitting, onPaste, onSubmit }
}
