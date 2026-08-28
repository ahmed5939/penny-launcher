import { UpdateIcon } from '@radix-ui/react-icons'
import { History, Radar, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { PageHeader, Panel, PanelBody } from '../../../components/page'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { PlatformIcon } from '../../../components/friends/platform-icon'

import { LiveMissionCard } from './-live-mission'

import { useSearchUser } from '../../stw-operations/xpboosts/-hooks'

import { useMatchmakingPlayersPath } from '../../../hooks/advanced-mode/matchmaking'
import { useInputPaddingButton } from '../../../hooks/ui/inputs'
import { useCurrentActions, usePlayerSuggestions } from './-hooks'


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
    clear: clearSuggestions,
    isSearching: suggestionsAreLoading,
    results: suggestions,
  } = usePlayerSuggestions({
    disabled: searchUserIsSubmitting,
    query: inputSearchDisplayName,
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

  return (
    <div className="max-w-3xl space-y-4">
      <Panel className="overflow-visible">
        <PanelBody className="relative overflow-visible p-5">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/70 via-primary/20 to-transparent"
          />
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Radar className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">
                {t('matchmaking-track.form.title')}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t('matchmaking-track.form.description')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <form
              onSubmit={(event) => {
                event.preventDefault()

                if (!inputSearchButtonIsDisabled) {
                  handleSearchUser()
                }
              }}
            >
              <Label className="sr-only" htmlFor="global-input-search-player">
                {t('form.search-account.label', {
                  ns: 'general',
                })}
              </Label>
              <div className="relative">
                <div className="flex items-center relative">
                  <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={t('form.search-account.input.placeholder', {
                      ns: 'general',
                    })}
                    className="pr-[var(--pr-button-width)] pl-9 py-1"
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

                {suggestions.length > 0 && !searchUserIsSubmitting && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {t('matchmaking-track.form.suggestions', {
                        ns: 'advanced-mode',
                      })}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {suggestions.map((result) => (
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                          key={`${result.accountId}:${result.platform}`}
                          onClick={() => {
                            clearSuggestions()
                            handleManualChangeSearchDisplayName(
                              result.displayName
                            )
                          }}
                        >
                          <PlatformIcon
                            className="text-muted-foreground"
                            platform={result.platform}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {result.displayName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {result.matchType === 'exact'
                                ? t('matchmaking-track.form.exact-match', {
                                    ns: 'advanced-mode',
                                  })
                                : t('matchmaking-track.form.player-result', {
                                    ns: 'advanced-mode',
                                    mutual: result.mutual,
                                  })}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestionsAreLoading && !searchUserIsSubmitting && (
                  <UpdateIcon className="absolute right-[7.5rem] top-2.5 z-10 size-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </form>

            {options.length > 0 && (
              <div className="flex items-center gap-3 border-t border-border/50 pt-3">
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <History className="size-3.5" />
                  {t('matchmaking-track.form.quick-pick')}
                </div>
                <Combobox
                  className="max-w-sm flex-1"
                  emptyPlaceholder={t(
                    'form.player.recently.empty-placeholder',
                    { ns: 'general' }
                  )}
                  emptyContent={t('form.player.search-empty')}
                  placeholder={t(
                    'matchmaking-track.form.recently.placeholder'
                  )}
                  placeholderSearch={t(
                    'form.player.recently.search-placeholder',
                    { ns: 'general', total: options.length }
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
            )}

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
        </PanelBody>
      </Panel>

      {searchedUser?.data && status && (
        <LiveMissionCard
          displayName={searchedUser.data.lookup.displayName}
          accountId={searchedUser.data.lookup.id}
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
