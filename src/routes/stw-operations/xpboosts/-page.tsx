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
  Search,
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
import { pennyDBProfileURL } from '../../../config/fortnite/links'


import { Button } from '../../../components/ui/button'
import {
  EmptyState,
  FilterBar,
  PageHeader,
  PageTabs,
  PageTabPanel,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  SearchField,
  StatRow,
  StatTile,
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
import { assets } from '../../../lib/repository'
import {
  AccountBasicInformationSection,
  ExternalAuthTypeImage,
  SearchedUserData,
} from './-shared'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

import { Route } from './route'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Zap}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.xp-boosts')}
        description="Burn personal XP boosts across your accounts or send teammate boosts to a player, and look up anyone's boosts and record."
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['stw-operations', 'general', 'sidebar'])
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

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
  const { showLink, handleWhy } = useWhy({
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

      window.electronAPI.openExternalURL(pennyDBProfileURL(accountId))
    }

  return (
    <>
      <PageTabs label={t('sidebar:stw-operations.options.xp-boosts')} value={tab} tabs={[
        { value: 'accounts', label: t('sidebar:your-accounts') },
        { value: 'lookup', label: t('sidebar:look-up-player') },
      ]} onValueChange={(value) => { void navigate({ search: (previous) => ({ ...previous, tab: value }), resetScroll: false }) }}>
        <PageTabPanel value="lookup" activeValue={tab}>
            <Panel>
              <PanelHeader
                compact
                icon={Search}
                title="Look up a player"
              />
              <PanelBody className="space-y-5">
                <div className="space-y-4">
                  <div className="max-w-xl space-y-2">
                    <Label htmlFor="global-input-search-player">
                      {t('form.search-account.label', {
                        ns: 'general',
                      })}
                    </Label>
                    <form
                      className="flex items-center relative"
                      onSubmit={(event) => {
                        event.preventDefault()

                        if (!inputSearchButtonIsDisabled) {
                          handleSearchUser()
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
                  <div className="border-t border-border/40 pt-4">
                    <div>
                      <div>
                        <a
                          href={pennyDBProfileURL(
                            searchedUser.data.lookup.id,
                          )}
                          className="inline-flex gap-2 items-center hover:opacity-75"
                          onClick={handleOpenExternalFNDBProfileUrl(
                            searchedUser.data.lookup.id,
                          )}
                        >
                          <ExternalAuthTypeImage
                            externalAuthType={
                              searchedUser.data.lookup.externalAuthType
                            }
                          />
                          <span className="max-w-72 truncate text-title font-bold">
                            {searchedUser.data.lookup.displayName}
                          </span>
                          <ExternalLink
                            className="stroke-muted-foreground"
                            size={16}
                          />
                        </a>
                      </div>
                      <div className="mt-3 text-sm">
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

        </PageTabPanel>
        <PageTabPanel value="accounts" activeValue={tab}>
            {/*
              The account selector that opened this form is gone — the
              titlebar picker answers it. The amount is the form.
            */}
            <Panel id="xpboosts-card">
              <PanelHeader
                compact
                icon={Zap}
                title="Boosts to use"
              />
              <PanelBody className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 space-y-2 sm:max-w-sm">
                  <Label htmlFor="amountToSend">
                    {t('xpboosts.form.label', {
                      limit: compactNumber(maxAmountLimitedTo),
                    })}
                  </Label>
                  <Input
                    placeholder={t('xpboosts.form.input.placeholder')}
                    value={amountToSend}
                    onChange={handleChangeAmount}
                    disabled={actionFormIsDisabled}
                    id="amountToSend"
                  />
                </div>
                <Button
                  className="min-w-32"
                  onClick={handleSearch}
                  disabled={seeBoostsButtonIsDisabled}
                  variant={data.length > 0 ? 'outline' : 'default'}
                >
                  {isSubmitting ? (
                    <UpdateIcon className="animate-spin" />
                  ) : data.length > 0 ? (
                    t('xpboosts.form.refetch')
                  ) : (
                    t('xpboosts.form.see-boosts')
                  )}
                </Button>
                <div className="min-w-32">
                  <SendBoostsSheet recalculateTotal={recalculateTotal} />
                </div>
              </PanelBody>
            </Panel>

      {data.length > 0 && (
        <>
          <StatRow>
            <StatTile
              label="Teammate XP boosts"
              tone="primary"
              value={<BoostFigure quantity={summary.teammate} type="teammate" />}
            />
            <StatTile
              label="Personal XP boosts"
              value={<BoostFigure quantity={summary.personal} type="personal" />}
            />
            <StatTile
              label="Accounts"
              value={data.length}
            />
          </StatRow>

          <Panel>
            <PanelHeader
              compact
              title={t('xpboosts.results.summary.title', {
                total: data.length,
              })}
            />

            {data.length > 1 && (
              <FilterBar>
                <SearchField
                  className="max-w-xs"
                  label="Filter accounts"
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
              </FilterBar>
            )}

            {filteredData.length > 0 ? (
              <ul className="grid gap-px bg-border/30 sm:grid-cols-2 lg:grid-cols-3">
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
              </ul>
            ) : (
              <EmptyState
                className="border-0 bg-transparent py-8"
                icon={Zap}
                title={t('form.accounts.search-empty', { ns: 'general' })}
              />
            )}
          </Panel>
        </>
      )}

        </PageTabPanel>
      </PageTabs>
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
                <img decoding="async" loading="lazy" src={assets('smallxpboost_gift')} />
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
                <img decoding="async" loading="lazy" src={assets('smallxpboost')} />
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
                        className="rounded-md bg-muted/30 px-2.5 py-1.5"
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
                          href={pennyDBProfileURL(
                            searchedUser.data.lookup.id,
                          )}
                          className="inline-flex gap-2 items-center hover:opacity-75"
                          onClick={handleOpenExternalFNDBProfileUrl(
                            searchedUser.data.lookup.id,
                          )}
                        >
                          <ExternalAuthTypeImage
                            externalAuthType={
                              searchedUser.data.lookup.externalAuthType
                            }
                          />
                          <span className="max-w-72 truncate text-title font-bold">
                            {searchedUser.data.lookup.displayName}
                          </span>
                          <ExternalLink
                            className="stroke-muted-foreground"
                            size={16}
                          />
                        </a>
                      </div>
                      <div className="mt-3 text-sm">
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

/** A boost count beside the game's boost art: the gift box for teammate, the bolt for personal. */
function BoostFigure({
  quantity,
  size = 'large',
  type,
}: {
  quantity: number
  size?: 'small' | 'large'
  type: XPBoostType
}) {
  return (
    <span className="flex items-center gap-2">
      <img
        alt=""
        className={size === 'large' ? 'size-7' : 'size-6'}
        decoding="async"
        loading="lazy"
        src={assets(`smallxpboost${type === 'personal' ? '' : '_gift'}`)}
      />
      <span className="figure">{numberWithCommaSeparator(quantity)}</span>
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
    isDisabled,
    isZero,
    handleChangeAvailability,
  } = useAccountDataItem({
    data,
  })
  const teammateTotal = data.items.teammate?.quantity ?? 0

  return (
    <li className="flex flex-col gap-3 bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn('min-w-0 flex-1 truncate text-ui font-semibold', {
            'text-muted-foreground line-through': isDisabled,
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
            aria-label={isDisabled ? 'Use this account again' : 'Leave this account out'}
            title={isDisabled ? 'Use this account again' : 'Leave this account out'}
          >
            {isDisabled ? <Undo2 size={14} /> : <Trash2 size={14} />}
          </Toggle>
        )}
      </div>
      <div
        className={cn('flex items-center gap-6 text-lg font-bold', {
          'opacity-40': isDisabled,
        })}
      >
        <BoostFigure
          quantity={teammateTotal}
          size="small"
          type="teammate"
        />
        <BoostFigure
          quantity={data.items.personal?.quantity ?? 0}
          size="small"
          type="personal"
        />
      </div>
      {!isDisabled && teammateTotal > 0 && (
        <div className="space-y-1">
          <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            {t('xpboosts.results.options.description').replace(/:\s*$/, '')}
            <span className="figure text-foreground">
              {compactNumber(teammateXPBoostsFiltered)} / {compactNumber(teammateTotal)}
            </span>
          </p>
          <ProgressBar
            total={teammateTotal}
            value={teammateXPBoostsFiltered}
          />
        </div>
      )}
    </li>
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
      >
        {link.join('')}
      </a>
    </div>
  )
}

