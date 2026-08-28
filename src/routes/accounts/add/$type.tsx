import type { LucideIcon } from 'lucide-react'

import { UpdateIcon } from '@radix-ui/react-icons'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Import, KeyRound, Smartphone, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Route as RootRoute } from '../../__root'

import { ActionTile, PageHeader } from '../../../components/page'
import { SeparatorWithTitle } from '../../../components/ui/extended/separator'

import { AuthorizationCodePage } from './(authorization-code)/-page'
import { DeviceAuthPage } from './(device-auth)/-page'
import { ExchangeCodePage } from './(exchange-code)/-page'

import { useAerialImport } from './-hooks'

import { cn } from '../../../lib/utils'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/accounts/add/$type',
  component: ComponentRoute,
})

/**
 * One page for linking an account, whatever the credential.
 *
 * Four ways in (authorization code, exchange code, device auth, Aerial
 * import). The method is picked here; the URL still carries the type for
 * deep links.
 */

type MethodType = 'authorization-code' | 'exchange-code' | 'device-auth'

type Method = {
  component: JSX.Element
  hint: string
  icon: LucideIcon
  labelKey: string
  type: MethodType
}

const methods: Array<Method> = [
  {
    type: 'authorization-code',
    icon: KeyRound,
    labelKey: 'accounts.options.auth',
    hint: 'Sign in on epicgames.com and paste the code.',
    component: <AuthorizationCodePage />,
  },
  {
    type: 'exchange-code',
    icon: UserPlus,
    labelKey: 'accounts.options.exchange',
    hint: 'Paste an exchange code, or generate one from an account already here.',
    component: <ExchangeCodePage />,
  },
  {
    type: 'device-auth',
    icon: Smartphone,
    labelKey: 'accounts.options.device',
    hint: 'Account ID, device ID, and secret from a saved device auth.',
    component: <DeviceAuthPage />,
  },
]

function ComponentRoute() {
  const { t } = useTranslation(['sidebar', 'general'])
  const navigate = useNavigate()
  const { importFromAerial, isImporting } = useAerialImport()

  const { type } = Route.useParams()
  const current =
    methods.find((method) => method.type === type) ?? methods[0]

  return (
    <>
      <PageHeader
        icon={UserPlus}
        title="Add account"
        description="Same four methods as before — pick the credential you have."
      />

      <div className="flex w-full max-w-4xl flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col gap-2 lg:w-64">
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
          >
            {methods.map((method) => {
              const active = method.type === current.type

              return (
                <button
                  key={method.type}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    'panel-interactive flex items-start gap-3 p-3 text-left',
                    active &&
                      'border-primary/50 bg-primary/[0.08] hover:bg-primary/[0.08]'
                  )}
                  onClick={() =>
                    navigate({
                      to: '/accounts/add/$type',
                      params: { type: method.type },
                      replace: true,
                    })
                  }
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors',
                      active
                        ? 'bg-primary/15 text-primary ring-primary/25'
                        : 'bg-surface/70 text-muted-foreground ring-border/70'
                    )}
                  >
                    <method.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-sm font-semibold leading-tight',
                        !active && 'text-muted-foreground'
                      )}
                    >
                      {t(method.labelKey, {
                        ns: 'sidebar',
                      })}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {method.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <SeparatorWithTitle>
            {t('separators.or', {
              ns: 'general',
            })}
          </SeparatorWithTitle>

          <ActionTile
            icon={Import}
            title="Import from Aerial"
            description="Bring every Aerial Launcher account on this PC across in one click."
            disabled={isImporting}
            onClick={importFromAerial}
            trailing={
              isImporting ? (
                <UpdateIcon className="animate-spin" />
              ) : undefined
            }
          />
        </div>

        <div className="min-w-0 flex-1">{current.component}</div>
      </div>
    </>
  )
}
