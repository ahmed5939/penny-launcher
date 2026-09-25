import { History, LoaderCircle, Radar, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { PageHeader, Panel, PanelBody, PanelHeader } from '../../../components/page'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { PlatformIcon } from '../../../components/friends/platform-icon'

import { LiveMissionCard } from './-live-mission'

import { useState } from 'react'

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

  const [input, setInput] = useState('')
  /**
   * Suggestions follow typing only. Submitting, picking one, Escape or
   * leaving the field closes them, and they stay closed until the next
   * keystroke — otherwise the in-flight prefix search reopens the list.
   */
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const {
    isTracking,
    options,
    players,
    status,

    customFilter,
    handleRefresh,
    track,
  } = useCurrentActions()
  const {
    clear: clearSuggestions,
    isSearching: suggestionsAreLoading,
    results: suggestions,
  } = usePlayerSuggestions({
    disabled: !suggestionsOpen,
    query: input,
  })
  const isSearching = isTracking && status === null
  const searchIsDisabled = isSearching || input.trim() === ''

  const submit = (query: string, label = query) => {
    setSuggestionsOpen(false)
    clearSuggestions()
    setInput(label)
    track(query)
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Panel className="overflow-visible">
        <PanelHeader
          compact
          description={t('matchmaking-track.form.description')}
          title={t('matchmaking-track.form.title')}
        />
        <PanelBody className="relative overflow-visible">
          <div className="space-y-3">
            <form
              onSubmit={(event) => {
                event.preventDefault()

                if (!searchIsDisabled) {
                  submit(input)
                }
              }}
            >
              <Label className="sr-only" htmlFor="global-input-search-player">
                {t('form.search-account.label', {
                  ns: 'general',
                })}
              </Label>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t('form.search-account.input.placeholder', {
                        ns: 'general',
                      })}
                      className="pl-9 pr-9"
                      value={input}
                      onChange={(event) => {
                        setInput(event.target.value)
                        setSuggestionsOpen(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setSuggestionsOpen(false)
                        }
                      }}
                      onBlur={() => {
                        // Lets a click on a suggestion land before closing.
                        window.setTimeout(() => setSuggestionsOpen(false), 150)
                      }}
                      disabled={isSearching}
                      id="global-input-search-player"
                    />
                    {suggestionsAreLoading && suggestionsOpen && (
                      <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-28 shrink-0"
                    disabled={searchIsDisabled}
                  >
                    {isSearching ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      t('actions.search', {
                        ns: 'general',
                      })
                    )}
                  </Button>
                </div>

                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-[calc(100%-7.5rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
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
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            submit(result.accountId, result.displayName)
                          }
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

              </div>
            </form>

            {options.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
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
                  onSelectItem={(value) =>
                    submit(
                      value,
                      players.find((player) => player.id === value)
                        ?.displayName ??
                        options.find((option) => option.value === value)
                          ?.label.replace(/ · friend$/, '') ??
                        value
                    )
                  }
                  emptyContentClassname="py-6 text-center text-sm"
                  disabled={isSearching}
                  disabledItem={isSearching}
                  inputSearchIsDisabled={isSearching}
                  hideSelectorOnSelectItem
                />
              </div>
            )}

            {status && !status.player && (
              <p className="text-ui text-muted-foreground">
                {t('form.player.search-empty', {
                  ns: 'general',
                })}
              </p>
            )}
          </div>
        </PanelBody>
      </Panel>

      {status?.player && (
        <LiveMissionCard
          displayName={status.player.displayName}
          accountId={status.player.id}
          isTracking={isTracking}
          status={status}
          onRefresh={handleRefresh}
        />
      )}

      {isSearching && (
        <div className="flex items-center gap-2 px-1 py-2 text-ui text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" />
          {t('matchmaking-track.live.loading')}
        </div>
      )}
    </div>
  )
}
