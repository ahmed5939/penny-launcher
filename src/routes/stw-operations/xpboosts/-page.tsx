import type {
  ChangeEventHandler,
  MouseEventHandler,
} from 'react'
import type {
  XPBoostsDataWithAccountData,
  XPBoostType,
} from '../../../types/xpboosts'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ExternalLink,
  Info,
  Send,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import {
  maxAmountLimitedTo,
} from '../../../config/constants/xpboosts'
import { stwNewsProfileURL } from '../../../config/fortnite/links'


import { Button } from '../../../components/ui/button'
import {
  EmptyState,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../components/page'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { ScrollArea } from '../../../components/ui/scroll-area'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '../../../components/ui/sheet'
import { Switch } from '../../../components/ui/switch'
import { Toggle } from '../../../components/ui/toggle'
import { GoToTop } from '../../../components/go-to-top'

import { useInputPaddingButton } from '../../../hooks/ui/inputs'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import {
  useAccountDataItem,
  useData,
  useFilterXPBoosts,
  useSearchUser,
  useSendBoostsSheet,
} from './-hooks'
import { useWhy } from './-why'

import {
  compactNumber,
  numberWithCommaSeparator,
} from '../../../lib/parsers/numbers'
import {
  extractXPBoosts,
  extractCommanderLevel,
} from '../../../lib/parsers/query-profile'
import { whatIsThis } from '../../../lib/callbacks'
import { assets } from '../../../lib/repository'
import {
  AccountBasicInformationSection,
  ExternalAuthTypeImage,
  SearchedUserData,
} from './-shared'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Zap}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.xp-boosts')}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    actionFormIsDisabled,
    amountToSend,
    amountToSendParsedToNumber,
    data,
    filteredData,
    isSubmitting,
    seeBoostsButtonIsDisabled,
    searchValue,
    summary,

    handleChangeAmount,
    handleSearch,
    onChangeSearchValue,
  } = useData()
  const {
    inputSearchButtonIsDisabled,
    inputSearchDisplayName,
    searchUserIsSubmitting,
    searchedUser,

    handleChangeSearchDisplayName,
    handleSearchUser,
  } = useSearchUser()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { showLink, handleXD, handleWhy } = useWhy({
    inputSearchValue: inputSearchDisplayName,
  })
  const { recalculateTotal, teammateXPBoostsFiltered } = useFilterXPBoosts(
    {
      data,
      amountToSend: amountToSendParsedToNumber,
    },
  )
  const [$updateInput, $updateButton] = useInputPaddingButton()

  const userBoosts = extractXPBoosts(
    searchedUser?.success && searchedUser?.data
      ? searchedUser.data.profileChanges
      : undefined,
  )

  const handleOpenExternalFNDBProfileUrl =
    (accountId: string): MouseEventHandler<HTMLAnchorElement> =>
    (event) => {
      event.preventDefault()

      window.electronAPI.openExternalURL(stwNewsProfileURL(accountId))
    }

  return (
    <>
      {/*
        Lookup and your-own-accounts are two separate jobs on this page. Side
        by side they stay distinct; stacked in one column they read as one
        long form.
      */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Panel>
              <PanelBody className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="global-input-search-player">
                      {t('form.search-account.label', {
                        ns: 'general',
                      })}
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('xpboosts.top-search.description')}
                    </p>
                    <form
                      className="flex items-center relative"
                      onSubmit={(event) => {
                        event.preventDefault()

                        if (!inputSearchButtonIsDisabled) {
                          handleSearchUser()
                          handleXD()
                          handleWhy()
                        }
                      }}
                    >
                      <Input
                        placeholder={t(
                          'form.search-account.input.placeholder',
                          {
                            ns: 'general',
                          },
                        )}
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
                    </form>
                  </div>

                  {showLink && <PrayForXPBoosts />}

                  {searchedUser &&
                    !searchedUser.success &&
                    !searchedUser.isPrivate && (
                      <div className="break-all mt-2 text-center text-muted-foreground">
                        {searchedUser.errorMessage
                          ? searchedUser.errorMessage
                          : t('form.player.search-empty', {
                              ns: 'general',
                            })}
                      </div>
                    )}
                </div>
                {searchedUser?.data && (
                  <div>
                    <div>
                      <div>
                        <a
                          href={stwNewsProfileURL(
                            searchedUser.data.lookup.id,
                          )}
                          className="inline-flex gap-2 items-center hover:opacity-75"
                          onClick={handleOpenExternalFNDBProfileUrl(
                            searchedUser.data.lookup.id,
                          )}
                          onAuxClick={whatIsThis()}
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
                      </div>
                      <div className="mt-2 space-y-0.5 rounded-lg bg-surface/70 px-3 py-2 text-muted-foreground text-sm [&_.icon-wrapper]:flex [&_.icon-wrapper]:items-center [&_.icon-wrapper]:justify-center [&_.icon-wrapper]:size-5">
                        {searchedUser.isPrivate ? (
                          <>
                            <AccountBasicInformationSection
                              title="Account Id:"
                              value={searchedUser.data.lookup.id}
                            />
                            <div className="py-1.5">
                              {t('public-stats', {
                                ns: 'general',
                              })}
                            </div>
                          </>
                        ) : (
                          searchedUser.success && (
                            <SearchedUserData
                              accountId={searchedUser.data.lookup.id}
                              boostedXP={searchedUser.data.profileChanges}
                              collectionBookLevel={
                                searchedUser.data.profileChanges.profile
                                  .stats.attributes.collection_book
                                  ?.maxBookXpLevelAchieved ?? 0
                              }
                              commanderLevel={
                                extractCommanderLevel(
                                  searchedUser.data.profileChanges,
                                ).total
                              }
                              daysLoggedIn={
                                searchedUser.data.profileChanges.profile
                                  .stats.attributes.daily_rewards
                                  ?.totalDaysLoggedIn ?? 0
                              }
                              founderStatus={
                                searchedUser.data.profileChanges
                              }
                              personalXPBoosts={userBoosts.personal}
                              teammateXPBoosts={userBoosts.teammate}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel id="xpboosts-card">
              <PanelBody>
                <FieldGroup>
                  {/*
                    The account selector that opened this form is gone —
                    the titlebar picker answers it. The amount is the form.
                  */}
                  <FieldRow
                    label={
                      <Label htmlFor="amountToSend">
                        {t('xpboosts.form.label', {
                          limit: compactNumber(maxAmountLimitedTo),
                        })}
                      </Label>
                    }
                    stacked
                  >
                    <Input
                      placeholder={t('xpboosts.form.input.placeholder')}
                      value={amountToSend}
                      onChange={handleChangeAmount}
                      disabled={actionFormIsDisabled}
                      id="amountToSend"
                    />
                  </FieldRow>
                </FieldGroup>
              </PanelBody>
              <PanelFooter>
                <Button
                  className="flex-1"
                  onClick={handleSearch}
                  disabled={seeBoostsButtonIsDisabled}
                >
                  {isSubmitting ? (
                    <UpdateIcon className="animate-spin" />
                  ) : data.length > 0 ? (
                    t('xpboosts.form.refetch')
                  ) : (
                    t('xpboosts.form.see-boosts')
                  )}
                </Button>

                <SendBoostsSheet recalculateTotal={recalculateTotal} />
              </PanelFooter>
            </Panel>
      </div>

      {data.length > 0 && (
        <>
          {/*
            Result count, totals and the filter used to be three centred
            blocks floating between cards. They belong together as one
            toolbar over the grid they describe.
          */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
            <h2 className="text-sm font-semibold">
              {t('xpboosts.results.summary.title', {
                total: data.length,
              })}
            </h2>

            <div className="flex items-center gap-2">
              <BoostSummaryItem
                type="teammate"
                quantity={summary.teammate}
              />
              <BoostSummaryItem
                type="personal"
                quantity={summary.personal}
              />
            </div>

            {data.length > 1 && (
              <Input
                className="ml-auto h-9 max-w-xs"
                placeholder={t('form.accounts.placeholder', {
                  ns: 'general',
                  context: !getMenuOptionVisibility('showTotalAccounts')
                    ? 'private'
                    : undefined,
                  total: data.length,
                })}
                value={searchValue}
                onChange={onChangeSearchValue}
              />
            )}
          </div>

          {filteredData.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredData.map((currentData) => (
                <AccountInformation
                  data={currentData}
                  disableActions={actionFormIsDisabled}
                  teammateXPBoostsFiltered={
                    teammateXPBoostsFiltered[currentData.accountId] ?? 0
                  }
                  key={currentData.accountId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title={t('form.accounts.search-empty', { ns: 'general' })}
            />
          )}
        </>
      )}

      <GoToTop containerId="xpboosts-card" />
    </>
  )
}

function SendBoostsSheet({
  recalculateTotal,
}: Pick<ReturnType<typeof useFilterXPBoosts>, 'recalculateTotal'>) {
  const { t } = useTranslation(['stw-operations'])

  const {
    success,

    // accountList,
    amountToSendIsInvalid,
    amountToSendParsedToNumber,
    consumePersonalBoostsButtonIsDisabled,
    consumeTeammateBoostsButtonIsDisabled,
    dataFilterByPersonalType,
    generalIsSubmitting,
    inputSearchDisplayName,
    inputSearchIsDisabled,
    inputSearchButtonIsDisabled,
    isSubmittingPersonal,
    isSubmittingTeammate,
    newCalculatedTotal,
    noPersonalBoostsData,
    noTeammateBoostsData,
    searchedUser,
    searchUserIsSubmitting,
    sendBoostsButtonIsDisabled,
    xpBoostType,

    handleChangeSearchDisplayName,
    handleConsumePersonal,
    handleConsumeTeammate,
    handleOpenExternalFNDBProfileUrl,
    handleSearchUser,
    handleSetXPBoostsType,
  } = useSendBoostsSheet({ recalculateTotal })

  const userBoosts = extractXPBoosts(
    searchedUser?.success && searchedUser?.data
      ? searchedUser.data.profileChanges
      : undefined,
  )

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          className="w-full"
          disabled={sendBoostsButtonIsDisabled}
        >
          {t('xpboosts.form.send-boosts')}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex flex-col gap-2 pb-0 px-4 w-96"
        hideCloseButton
      >
        <div className="flex justify-center w-full">
          <SheetClose>
            <X />
            <span className="sr-only">Close history sidebar</span>
          </SheetClose>
        </div>
        <SheetHeader>
          <div className="flex flex-col text-center">
            {t('xpboosts.sidebar.title')}
            <div className="flex gap-3 items-center mt-2 mx-auto [&_img]:size-10">
              <figure
                className={cn({
                  grayscale: xpBoostType,
                })}
              >
                <img src={assets('smallxpboost_gift')} />
              </figure>
              <Switch
                checked={xpBoostType}
                onCheckedChange={handleSetXPBoostsType}
                disabled={generalIsSubmitting}
              />
              <figure
                className={cn({
                  grayscale: !xpBoostType,
                })}
              >
                <img src={assets('smallxpboost')} />
              </figure>
            </div>
          </div>
        </SheetHeader>
        <div className="flex flex-col overflow-x-hidden overflow-y-auto">
          {xpBoostType ? (
            noPersonalBoostsData ? (
              <div className="mt-14 text-center text-muted-foreground">
                {t('form.accounts.no-available', {
                  ns: 'general',
                })}
              </div>
            ) : (
              <>
                <div className="p-1">
                  <p className="px-2 text-sm">
                    {t('xpboosts.sidebar.personal.description')}
                  </p>
                </div>
                <ScrollArea>
                  <div className="flex flex-col gap-1 overflow-auto">
                    {dataFilterByPersonalType.map((item) => (
                      <div
                        className="border px-2 py-1 rounded-sm"
                        key={item.accountId}
                      >
                        <div className="text-muted-foreground text-sm truncate max-w-[40ch]">
                          {parseCustomDisplayName(item.account)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="mb-5 mt-5 px-1">
                  <Button
                    className="w-full"
                    onClick={handleConsumePersonal}
                    disabled={consumePersonalBoostsButtonIsDisabled}
                  >
                    {isSubmittingPersonal ? (
                      <UpdateIcon className="animate-spin" />
                    ) : noPersonalBoostsData ? (
                      t('form.accounts.no-available', {
                        ns: 'general',
                      })
                    ) : amountToSendIsInvalid ? (
                      t('xpboosts.sidebar.errors.valid-amount')
                    ) : (
                      t('xpboosts.sidebar.personal.submit-button', {
                        total: compactNumber(amountToSendParsedToNumber),
                      })
                    )}
                  </Button>
                </div>
              </>
            )
          ) : noTeammateBoostsData ? (
            <div className="mt-14 text-center text-muted-foreground">
              {t('form.accounts.no-available', {
                ns: 'general',
              })}
            </div>
          ) : (
            <>
              <div className="p-1">
                <form
                  className="space-y-1"
                  onSubmit={(event) => {
                    event.preventDefault()

                    if (!inputSearchButtonIsDisabled) {
                      handleSearchUser()
                    }
                  }}
                >
                  <Label
                    className="text-xs"
                    htmlFor="sheet-input-search-player"
                  >
                    {t('form.search-account.label', {
                      ns: 'general',
                    })}
                  </Label>
                  <SearchExternalAccount
                    searchUserIsSubmitting={searchUserIsSubmitting}
                    inputSearchDisplayName={inputSearchDisplayName}
                    handleChangeSearchDisplayName={
                      handleChangeSearchDisplayName
                    }
                    inputSearchIsDisabled={inputSearchIsDisabled}
                    inputSearchButtonIsDisabled={
                      inputSearchButtonIsDisabled
                    }
                  />
                </form>

                {searchedUser &&
                  !searchedUser.success &&
                  !searchedUser.isPrivate && (
                    <div className="break-all mt-14 text-center text-muted-foreground">
                      {searchedUser.errorMessage
                        ? searchedUser.errorMessage
                        : t('form.player.search-empty', {
                            ns: 'general',
                          })}
                    </div>
                  )}
              </div>
              {!noTeammateBoostsData && searchedUser?.data && (
                <>
                  <ScrollArea>
                    <div className="flex flex-col gap-1 overflow-auto px-1 pt-4">
                      <div>
                        <a
                          href={stwNewsProfileURL(
                            searchedUser.data.lookup.id,
                          )}
                          className="inline-flex gap-2 items-center hover:opacity-75"
                          onClick={handleOpenExternalFNDBProfileUrl(
                            searchedUser.data.lookup.id,
                          )}
                          onAuxClick={whatIsThis()}
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
                      </div>
                      <div className="mt-2 space-y-0.5 rounded-lg bg-surface/70 px-3 py-2 text-muted-foreground text-sm [&_.icon-wrapper]:flex [&_.icon-wrapper]:items-center [&_.icon-wrapper]:justify-center [&_.icon-wrapper]:size-5">
                        {searchedUser.isPrivate ? (
                          <>
                            <AccountBasicInformationSection
                              title={t('information.account-id', {
                                ns: 'general',
                              })}
                              value={searchedUser.data.lookup.id}
                            />
                            <div className="py-1.5">
                              {t('public-stats', {
                                ns: 'general',
                              })}
                            </div>
                          </>
                        ) : (
                          searchedUser.success && (
                            <SearchedUserData
                              accountId={searchedUser.data.lookup.id}
                              boostedXP={searchedUser.data.profileChanges}
                              collectionBookLevel={
                                searchedUser.data.profileChanges.profile
                                  .stats.attributes.collection_book
                                  ?.maxBookXpLevelAchieved ?? 0
                              }
                              commanderLevel={
                                extractCommanderLevel(
                                  searchedUser.data.profileChanges,
                                ).total
                              }
                              daysLoggedIn={
                                searchedUser.data.profileChanges.profile
                                  .stats.attributes.daily_rewards
                                  ?.totalDaysLoggedIn ?? 0
                              }
                              founderStatus={
                                searchedUser.data.profileChanges
                              }
                              personalXPBoosts={userBoosts.personal}
                              teammateXPBoosts={userBoosts.teammate}
                            />
                          )
                        )}
                      </div>
                      <div className="mb-4 mt-4 px-1">
                        <div className="flex gap-1 items-center mb-4 px-1 text-muted-foreground text-xs">
                          <Info className="flex-shrink-0 relative size-3.5 top-[1px]" />
                          {t('xpboosts.sidebar.teammate.note')}
                        </div>
                        <Button
                          className="gap-1 w-full"
                          onClick={handleConsumeTeammate}
                          disabled={consumeTeammateBoostsButtonIsDisabled}
                        >
                          {isSubmittingTeammate ? (
                            <UpdateIcon className="animate-spin" />
                          ) : amountToSendIsInvalid ? (
                            t('xpboosts.sidebar.errors.valid-amount')
                          ) : (
                            <Trans
                              ns="stw-operations"
                              i18nKey="xpboosts.sidebar.teammate.submit-button"
                              values={{
                                total: compactNumber(newCalculatedTotal),
                                name: searchedUser.data.lookup.displayName,
                              }}
                            >
                              Send
                              <span className="underline">
                                {compactNumber(newCalculatedTotal)}
                              </span>
                              to:
                              <span className="font-bold max-w-[25ch] truncate">
                                {searchedUser.data.lookup.displayName}
                              </span>
                            </Trans>
                          )}
                        </Button>
                      </div>
                      <div className="mb-4 px-2 text-sm">
                        <div className="flex gap-1.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Send className="flex-shrink-0 size-3.5" />
                            {t('actions.success', {
                              ns: 'general',
                            })}
                            :
                          </div>{' '}
                          {numberWithCommaSeparator(success)}/
                          {numberWithCommaSeparator(newCalculatedTotal)}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SearchExternalAccount({
  inputSearchButtonIsDisabled,
  inputSearchDisplayName,
  inputSearchIsDisabled,
  searchUserIsSubmitting,

  handleChangeSearchDisplayName,
}: {
  inputSearchDisplayName: string
  inputSearchIsDisabled: boolean
  inputSearchButtonIsDisabled: boolean
  searchUserIsSubmitting: boolean

  handleChangeSearchDisplayName: ChangeEventHandler<HTMLInputElement>
}) {
  const { t } = useTranslation(['stw-operations'])

  const [$updateInput, $updateButton] = useInputPaddingButton()

  return (
    <div className="flex items-center relative">
      <Input
        placeholder={t('form.search-account.input.placeholder', {
          ns: 'general',
        })}
        className="pr-[var(--pr-button-width)] pl-3 py-1"
        value={inputSearchDisplayName}
        onChange={handleChangeSearchDisplayName}
        disabled={inputSearchIsDisabled}
        id="sheet-input-search-player"
        ref={$updateInput}
      />
      <Button
        type="submit"
        className="absolute h-8 px-2 py-1.5 right-1 text-sm w-16"
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
  )
}

function BoostSummaryItem({
  type,
  quantity,
}: {
  type: XPBoostType
  quantity: number
}) {
  const isPersonal = type === 'personal'

  /*
    Was a 9rem-tall tile per boost type, stacked above the results. As a pill
    it carries the same two facts in a line of the toolbar.
  */
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 py-1 pl-1 pr-3">
      <img
        src={assets(`smallxpboost${isPersonal ? '' : '_gift'}`)}
        className="size-6"
      />
      <span className="text-sm font-bold tabular-nums">
        {compactNumber(quantity)}
      </span>
    </span>
  )
}

function AccountInformation({
  data,
  disableActions,
  teammateXPBoostsFiltered,
}: {
  data: XPBoostsDataWithAccountData
  disableActions: boolean
  teammateXPBoostsFiltered: number
}) {
  const { t } = useTranslation(['stw-operations'])

  const {
    amountToSendParsedToNumber,
    isDisabled,
    isZero,
    handleChangeAvailability,
  } = useAccountDataItem({
    data,
  })

  return (
    <Panel
      className={cn({
        'opacity-60': isDisabled,
      })}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <span
          className={cn('min-w-0 flex-1 truncate text-[0.8125rem] font-medium', {
            'opacity-40': isDisabled,
          })}
        >
          {parseCustomDisplayName(data.account)}
        </span>
        {!isZero && (
          <Toggle
            className="action size-7 shrink-0 px-0 data-[state=on]:hover:bg-muted/60"
            defaultPressed={isDisabled}
            onPressedChange={handleChangeAvailability}
            disabled={disableActions}
            aria-label="toggle availability"
          >
            {isDisabled ? <Undo2 size={14} /> : <Trash2 size={14} />}
          </Toggle>
        )}
      </div>
      <footer>
        <div
          className={cn('gap-1 grid grid-cols-2 px-1', {
            'opacity-40': isDisabled,
          })}
        >
          <AccountSummaryItem
            type="teammate"
            data={data}
          />
          <AccountSummaryItem
            type="personal"
            data={data}
          />
        </div>
        <div
          className={cn(
            'border-t border-border/60 pt-2 px-3 text-muted-foreground text-xs',
            {
              'opacity-40': isDisabled,
            }
          )}
        >
          {t('xpboosts.results.options.description')}
        </div>
        <div
          className={cn('flex px-1', {
            'opacity-40': isDisabled,
          })}
        >
          <div className="flex items-center py-1">
            <figure className="flex-shrink-0 px-2">
              <img
                src={assets('smallxpboost_gift')}
                className="size-5"
              />
            </figure>
            <div className="flex-grow space-y-1">
              <div className="text-muted-foreground text-xs">
                {t('xpboosts.results.options.information', {
                  current: compactNumber(teammateXPBoostsFiltered),
                  total: compactNumber(data.items.teammate.quantity),
                  amount: compactNumber(amountToSendParsedToNumber),
                })}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </Panel>
  )
}

function AccountSummaryItem({
  data,
  type,
}: {
  data: XPBoostsDataWithAccountData
  type: XPBoostType
}) {
  const isPersonal = type === 'personal'

  return (
    <div className="flex items-center py-1 last:border-l">
      <figure className="flex-shrink-0 px-2">
        <img
          src={assets(`smallxpboost${isPersonal ? '' : '_gift'}`)}
          className="size-5"
        />
      </figure>
      <div className="flex-grow space-y-1">
        <div className="flex max-w-20 relative text-muted-foreground text-xs">
          <span className="truncate">
            {compactNumber(data.items[type]?.quantity)}
          </span>
        </div>
      </div>
    </div>
  )
}

function PrayForXPBoosts() {
  const link = [
    'ht',
    'tps://',
    'do',
    'cs.g',
    'oog',
    'le.c',
    'om/doc',
    'ument/d',
    '/1nZo6T',
    'A3aTlb1u',
    '7SwxvnpJbg5',
    '5U0MQ',
    'RGcyNV0',
    'i-Xk',
    '1q',
    'Y',
  ]
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault()

    window.electronAPI.openExternalURL(link.join(''))
  }

  return (
    <div className="flex flex-col gap-2 text-center">
      <div className="text-2xl">🙏</div>
      <div className="font-bold text-lg">Súplica Al Potenciador</div>
      <a
        className="bg-muted/50 break-all flex px-2 py-1 rounded text-xs hover:opacity-85"
        href={link.join('')}
        onClick={handleClick}
        onAuxClick={whatIsThis()}
      >
        {link.join('')}
      </a>
    </div>
  )
}

