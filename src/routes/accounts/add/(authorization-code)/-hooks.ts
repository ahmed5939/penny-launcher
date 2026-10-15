import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMemo } from 'react'
import { z } from 'zod'

import { useAddAccountUpdateSubmittingState } from '../../../../hooks/accounts'
import { useBaseSetupForm } from '../-hooks'
import { extractAuthorizationCode } from '../-paste'
import { useTranslation } from 'react-i18next'

export function useSetupForm() {
  const { t, i18n } = useTranslation(['accounts'], {
    keyPrefix: 'auth-code.validations',
  })

  const formSchema = useMemo(
    () =>
      z.object({
        code: z.preprocess(
          (value) =>
            typeof value === 'string'
              ? extractAuthorizationCode(value)
              : value,
          z.string().length(32, {
            message: t('code'),
          })
        ),
      }),
    [i18n.language]
  )

  const { isSubmitting, updateSubmittingState } =
    useAddAccountUpdateSubmittingState('authorizationCode')
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
    },
  })

  useBaseSetupForm({
    fetcher: window.electronAPI.responseAuthWithAuthorization,
    onSuccess: () => form.reset(),
    type: 'authorizationCode',
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) {
      return
    }

    updateSubmittingState(true)
    window.electronAPI.createAuthWithAuthorization(values.code)
  }

  return { form, isSubmitting, onSubmit }
}
