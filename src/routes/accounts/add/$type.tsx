import type { LucideIcon } from 'lucide-react'

import { UpdateIcon } from '@radix-ui/react-icons'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Import, KeyRound, Smartphone, UserPlus, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Route as RootRoute } from '../../__root'

import { PageHeader } from '../../../components/page'
import { Button } from '../../../components/ui/button'

import { AuthorizationCodePage } from './(authorization-code)/-page'
import { DeviceAuthPage } from './(device-auth)/-page'
import { ExchangeCodePage } from './(exchange-code)/-page'
import { QuickLoginPage } from './(quick-login)/-page'

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
 * Five ways in (Quick login, authorization code, exchange code, device
 * auth, Aerial import). The method is picked here; the URL still carries the type for
 * deep links.
 */

type MethodType =
  | 'quick-login'
  | 'authorization-code'
  | 'exchange-code'
  | 'device-auth'

type Method = {
  component: JSX.Element
  hint: string
  icon: LucideIcon
  labelKey: string
  type: MethodType
}

const methods: Array<Method> = [
  {
    type: 'quick-login',
    icon: Zap,
    labelKey: 'accounts.options.quick',
    hint: 'Approve in your browser. Nothing to copy or paste.',
    component: <QuickLoginPage />,
  },
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
  const { t } = useTranslation(['sidebar'])
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
        description="Link an Epic account to Penny. Pick the credential you have."
      />

      <div className="flex w-full max-w-4xl flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col gap-4 lg:w-64">
          {/*
            The method list reads like a game menu: the active one lit with a
            bar on its edge, the rest quiet. Icons stand alone — no tinted
            squares.
          */}
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="panel grid grid-cols-1 overflow-hidden sm:grid-cols-2 lg:grid-cols-1"
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
                    'relative flex items-start gap-3 px-4 py-3 text-left transition-colors',
                    active
                      ? 'bg-primary/[0.08]'
                      : 'hover:bg-accent/30'
                  )}
                  onClick={() =>
                    navigate({
                      to: '/accounts/add/$type',
                      params: { type: method.type },
                      replace: true,
                    })
                  }
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <method.icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-ui font-semibold leading-tight',
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

          <div className="flex items-center gap-3 px-1">
            <Import className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
              Coming from Aerial? Bring every account across at once.
            </span>
            <Button
              disabled={isImporting}
              onClick={importFromAerial}
              size="sm"
              variant="outline"
            >
              {isImporting ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </div>

        <div className="min-w-0 flex-1">{current.component}</div>
      </div>
    </>
  )
}
