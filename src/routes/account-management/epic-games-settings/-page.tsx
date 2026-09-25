import { UpdateIcon } from '@radix-ui/react-icons'
import { Cog, ExternalLinkIcon, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { epicGamesAccountSettingsURL } from '../../../config/fortnite/links'

import { Button } from '../../../components/ui/button'
import {
  CopyField,
  EmptyState,
  PageHeader,
  Panel,
  PanelFooter,
} from '../../../components/page'

import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useHandlers } from './-actions'

import { assets } from '../../../lib/repository'
import { parseCustomDisplayName } from '../../../lib/utils'

const epicLogo = assets('epicgames')

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'account-management',
  })
  const { selected } = useGetSelectedAccount()

  return (
    <>
      <PageHeader
        icon={Cog}
        section={t('title')}
        title={t('options.epic-settings')}
        description="Open your Epic account settings in the browser, already signed in as the title-bar account."
      />
      {/* Keyed so a link made for one account never shows under another. */}
      <Content key={selected?.accountId ?? 'none'} />
    </>
  )
}

/**
 * One job: get the selected account into epicgames.com without a password.
 * The account and the button that does it lead; the link itself — for
 * pasting into another browser — sits under it once there is one.
 */
function Content() {
  const { t } = useTranslation(['account-management', 'general'])

  const { selected } = useGetSelectedAccount()
  const { currentCode, isLoading, handleGenerateCode, handleOpenURL } =
    useHandlers()

  if (!selected) {
    return (
      <EmptyState
        description="Pick one in the title bar and its settings link is generated here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  const settingsUrl = currentCode
    ? epicGamesAccountSettingsURL(currentCode)
    : undefined

  return (
    <Panel className="max-w-xl">
      <div className="flex items-center gap-4 px-5 py-5">
        {epicLogo && (
          <img
            alt=""
            className="size-12 shrink-0 object-contain opacity-90 dark:invert"
            decoding="async"
            src={epicLogo}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-title font-semibold">
            {parseCustomDisplayName(selected)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {settingsUrl
              ? 'Link ready — open it or copy it below.'
              : 'Generate a one-time sign-in link for this account.'}
          </p>
        </div>
        <Button
          className="min-w-32"
          disabled={isLoading}
          onClick={handleGenerateCode}
          variant={settingsUrl ? 'secondary' : 'default'}
        >
          {isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('epic-settings.form.generate-button')
          )}
        </Button>
      </div>

      {settingsUrl && (
        <PanelFooter>
          <CopyField
            className="min-w-0 flex-1"
            value={settingsUrl}
          />
          <Button
            asChild
            className="h-8"
            size="sm"
          >
            <a
              href={settingsUrl}
              onClick={handleOpenURL}
              title={settingsUrl}
            >
              {t('epic-settings.form.open-button')}
              <ExternalLinkIcon className="ml-1.5 size-3.5" />
            </a>
          </Button>
        </PanelFooter>
      )}
    </Panel>
  )
}
