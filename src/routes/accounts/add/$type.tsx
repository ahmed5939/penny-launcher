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
 * The three sign-in methods used to be three separate sidebar destinations —
 * an Aerial inheritance that made "add an account" look like three different
 * chores. They are one chore with three ways in, so the method is picked
 * here, in place, and the URL still carries the type for deep links.
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
    hint: 'Sign in on epicgames.com and paste the code it gives you. The quickest way in.',
    component: <AuthorizationCodePage />,
  },
  {
    type: 'exchange-code',
    icon: UserPlus,
    labelKey: 'accounts.options.exchange',
    hint: 'Paste an exchange code — or generate one from an account already linked here.',
    component: <ExchangeCodePage />,
  },
  {
    type: 'device-auth',
    icon: Smartphone,
    labelKey: 'accounts.options.device',
    hint: 'Enter the account ID, device ID and secret from a saved device auth.',
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
        section={t('accounts.title', {
          ns: 'sidebar',
        })}
        title="Add account"
        description="Link an Epic Games account to the launcher. Every method ends in the same place — pick whichever credential you have at hand."
      />

      <div className="flex w-full max-w-4xl flex-col gap-6 lg:flex-row lg:items-start">
        {/*
          The method rail. Cards rather than a Segmented: a first-time user
          does not know these words, so each option carries the sentence
          that tells them whether it is theirs.
        */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-72">
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
                    'panel-interactive flex items-start gap-3 p-3.5 text-left',
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
                      'grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors',
                      active
                        ? 'bg-primary/15 text-primary ring-primary/25'
                        : 'bg-surface/70 text-muted-foreground ring-border/70'
                    )}
                  >
                    <method.icon className="size-[1.125rem]" />
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
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
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
            title="Import from Aerial Launcher"
            description="Already used Aerial on this PC? Bring every linked account over in one click."
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
