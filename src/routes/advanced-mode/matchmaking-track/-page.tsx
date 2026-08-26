import type { MouseEventHandler } from 'react'

import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, Radar } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { pennyDBProfileURL } from '../../../config/fortnite/links'

import {
  AccountBasicInformationSection,
  ExternalAuthTypeImage,
} from '../../stw-operations/xpboosts/-shared'

import { Combobox } from '../../../components/ui/extended/combobox'
import { SeparatorWithTitle } from '../../../components/ui/extended/separator'
import { Button } from '../../../components/ui/button'
import { PageHeader, Panel, PanelBody } from '../../../components/page'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'

import { LiveMissionCard } from './-live-mission'

import { useSearchUser } from '../../stw-operations/xpboosts/-hooks'

import { useMatchmakingPlayersPath } from '../../../hooks/advanced-mode/matchmaking'
import { useInputPaddingButton } from '../../../hooks/ui/inputs'
import { useCurrentActions } from './-hooks'


export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'advanced-mode'])

  return (
    <>
      <PageHeader
        icon={Radar}
        section={t('advanced-mode.title')}
        title={t('advanced-mode.options.matchmaking-track')}
        description={t('matchmaking-track.description', {
          ns: 'advanced-mode',
        })}
      />

      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['advanced-mode', 'general'])

  const { updateRecentlyPlayers } = useMatchmakingPlayersPath()
  const {
    inputSearchButtonIsDisabled,
    inputSearchDisplayName,
    searchUserIsSubmitting,
    searchedUser,

    handleChangeSearchDisplayName,
    handleManualChangeSearchDisplayName,
    handleSearchUser,
  } = useSearchUser({
    callback: (value) => {
      if (value.data?.lookup) {
        updateRecentlyPlayers(value.data.lookup)
      }
    },
  })
  const {
    isTracking,
    options,
    status,

    autoCompletePlayer,
    customFilter,
    handleRefresh,
  } = useCurrentActions({
    searchedUser,
    handleManualChangeSearchDisplayName,
  })

  const [$updateInput, $updateButton] = useInputPaddingButton()

  const handleOpenExternalPennyDBUrl =
    (displayName: string): MouseEventHandler<HTMLAnchorElement> =>
    (event) => {
      event.preventDefault()

      window.electronAPI.openExternalURL(pennyDBProfileURL(displayName))
    }

  return (
    <div className="max-w-2xl space-y-4">
      <Panel>
        <PanelBody className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label
                className="text-muted-foreground text-sm"
                htmlFor="global-input-recently-players"
              >
                {t('matchmaking-track.form.recently.label')}
              </Label>
              <Combobox
                className="max-w-full"
                emptyPlaceholder={t('form.player.recently.empty-placeholder', {
                  ns: 'general',
                })}
                emptyContent={t('form.player.search-empty')}
                placeholder={t('form.player.recently.select-placeholder', {
                  ns: 'general',
                })}
                placeholderSearch={t(
                  'form.player.recently.search-placeholder',
                  {
                    ns: 'general',
                    total: options.length,
                  }
                )}
                options={options}
                value={[]}
                customFilter={customFilter}
                onChange={() => {}}
                onSelectItem={autoCompletePlayer}
                emptyContentClassname="py-6 text-center text-sm"
                disabled={searchUserIsSubmitting}
                disabledItem={searchUserIsSubmitting}
                inputSearchIsDisabled={searchUserIsSubmitting}
                hideSelectorOnSelectItem
              />
            </div>

            <SeparatorWithTitle>
              {t('separators.or', {
                ns: 'general',
              })}
            </SeparatorWithTitle>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()

                if (!inputSearchButtonIsDisabled) {
                  handleSearchUser()
                }
              }}
            >
              <Label htmlFor="global-input-search-player">
                {t('form.search-account.label', {
                  ns: 'general',
                })}
              </Label>
              <div className="flex items-center relative">
                <Input
                  placeholder={t('form.search-account.input.placeholder', {
                    ns: 'general',
                  })}
                  className="pr-[var(--pr-button-width)] pl-3 py-1"
                  value={inputSearchDisplayName}
                  onChange={handleChangeSearchDisplayName}
                  disabled={searchUserIsSubmitting}
                  id="global-input-search-player"
                  ref={$updateInput}
                />
                <Button
                  type="submit"
                  className="absolute h-8 px-2 py-1.5 right-1 text-sm w-28"
                  disabled={inputSearchButtonIsDisabled}
                  ref={$updateButton}
                >
                  {searchUserIsSubmitting ? (
                    <UpdateIcon className="animate-spin h-4" />
                  ) : (
                    t('actions.search', {
                      ns: 'general',
                    })
                  )}
                </Button>
              </div>
            </form>

            {searchedUser &&
              !searchedUser.success &&
              !searchedUser.isPrivate && (
                <div className="mt-2 text-center text-muted-foreground">
                  {searchedUser.errorMessage
                    ? searchedUser.errorMessage
                    : t('form.player.search-empty', {
                        ns: 'general',
                      })}
                </div>
              )}
          </div>

          {searchedUser && searchedUser.data && (
            <div>
              <a
                href={pennyDBProfileURL(
                  searchedUser.data.lookup.displayName
                )}
                className="inline-flex gap-2 items-center hover:opacity-75"
                onClick={handleOpenExternalPennyDBUrl(
                  searchedUser.data.lookup.displayName
                )}
                title={t('matchmaking-track.live.pennydb')}
              >
                <ExternalAuthTypeImage
                  externalAuthType={
                    searchedUser.data.lookup.externalAuthType
                  }
                />
                <span className="max-w-72 text-lg truncate">
                  {searchedUser.data.lookup.displayName}
                </span>
                <ExternalLink
                  className="stroke-muted-foreground"
                  size={16}
                />
              </a>
              <div className="mt-2 space-y-0.5 rounded-lg bg-surface/70 px-3 py-2 text-muted-foreground text-sm">
                <AccountBasicInformationSection
                  title={t('information.account-id', {
                    ns: 'general',
                  })}
                  value={searchedUser.data.lookup.id}
                />
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      {searchedUser?.data && status && (
        <LiveMissionCard
          displayName={searchedUser.data.lookup.displayName}
          isTracking={isTracking}
          status={status}
          onRefresh={handleRefresh}
        />
      )}

      {searchedUser?.data && !status && isTracking && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
          <UpdateIcon className="animate-spin h-4" />
          {t('matchmaking-track.live.loading')}
        </div>
      )}
    </div>
  )
}
