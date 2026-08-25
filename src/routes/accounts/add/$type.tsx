import type { LucideIcon } from 'lucide-react'

import { createRoute } from '@tanstack/react-router'
import { KeyRound, Smartphone, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

import { Route as RootRoute } from '../../__root'

import { PageHeader } from '../../../components/page'

import { AuthorizationCodePage } from './(authorization-code)/-page'
import { DeviceAuthPage } from './(device-auth)/-page'
import { ExchangeCodePage } from './(exchange-code)/-page'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/accounts/add/$type',
  component: ComponentRoute,
})

function ComponentRoute() {
  const { t, i18n } = useTranslation(['accounts', 'sidebar'])

  const { type } = Route.useParams()
  const availableTypes: Record<
    string,
    { component: JSX.Element; icon: LucideIcon; title: string }
  > = useMemo(
    () => ({
      'authorization-code': {
        component: <AuthorizationCodePage />,
        icon: KeyRound,
        title: t('accounts.options.auth', {
          ns: 'sidebar',
        }),
      },
      'exchange-code': {
        component: <ExchangeCodePage />,
        icon: UserPlus,
        title: t('accounts.options.exchange', {
          ns: 'sidebar',
        }),
      },
      'device-auth': {
        component: <DeviceAuthPage />,
        icon: Smartphone,
        title: t('accounts.options.device', {
          ns: 'sidebar',
        }),
      },
    }),
    [i18n.language]
  )

  const currentType = availableTypes[type]

  return (
    <>
      <PageHeader
        icon={currentType.icon}
        section={t('accounts.title', {
          ns: 'sidebar',
        })}
        title={currentType.title}
      />

      {currentType.component}
    </>
  )
}
