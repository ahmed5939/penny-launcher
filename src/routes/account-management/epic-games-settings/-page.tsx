import { UpdateIcon } from '@radix-ui/react-icons'
import { Clipboard, Cog, ExternalLinkIcon } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { epicGamesAccountSettingsURL } from '../../../config/fortnite/links'

import { SeparatorWithTitle } from '../../../components/ui/extended/separator'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import {
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../components/page'

import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useHandlers } from './-actions'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'account-management',
  })

  return (
    <>
      <PageHeader
        icon={Cog}
        section={t('title')}
        title={t('options.epic-settings')}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['account-management', 'general'])

  const { selected } = useGetSelectedAccount()
  const {
    currentCode,
    isLoading,
    handleGenerateCode,
    handleOpenURL,
    handleCopyCode,
  } = useHandlers()

  const settingsUrl = currentCode
    ? epicGamesAccountSettingsURL(currentCode)
    : undefined

  return (
    <Panel className="max-w-xl">
      <PanelBody>
        <FieldGroup>
          <FieldRow
            label={
              <Trans
                ns="general"
                i18nKey="account-selected"
                values={{
                  name: parseCustomDisplayName(selected),
                }}
              >
                Account selected:{' '}
                <span className="font-semibold text-foreground">
                  {parseCustomDisplayName(selected)}
                </span>
              </Trans>
            }
          >
            <Button onClick={handleGenerateCode}>
              {isLoading ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                t('epic-settings.form.generate-button')
              )}
            </Button>
          </FieldRow>

          <FieldRow
            label={t('epic-settings.form.open-button')}
            stacked
          >
            <div className="relative flex w-full items-center">
              <Input
                type="text"
                className="select-none pr-10"
                defaultValue={settingsUrl}
                disabled={settingsUrl === undefined}
                readOnly
              />
              <Button
                type="button"
                className="absolute right-1 z-20 size-8 p-0"
                variant="ghost"
                onClick={handleCopyCode}
                disabled={settingsUrl === undefined}
              >
                <Clipboard size={16} />
              </Button>
            </div>
          </FieldRow>
        </FieldGroup>
      </PanelBody>

      <PanelFooter className="flex-col items-stretch gap-3">
        <SeparatorWithTitle>
          {t('separators.or', {
            ns: 'general',
          })}
        </SeparatorWithTitle>

        <Button
          className={cn('space-x-1 w-full', {
            'bg-secondary/80 cursor-not-allowed opacity-50':
              settingsUrl === undefined,
          })}
          variant="secondary"
          asChild
        >
          <a
            href={settingsUrl}
            title={settingsUrl}
            onClick={handleOpenURL}
          >
            <Trans
              ns="account-management"
              i18nKey="epic-settings.form.open-button"
            >
              <span>Open Account Settings</span>
              <ExternalLinkIcon size={16} />
            </Trans>
          </a>
        </Button>
      </PanelFooter>
    </Panel>
  )
}
