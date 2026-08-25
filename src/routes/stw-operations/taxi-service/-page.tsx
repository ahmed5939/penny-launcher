import type {
  TaxiServiceNotificationEventFriendAdded,
  TaxiServiceNotificationEventFriendRequestSend,
  TaxiServiceNotificationEventPartyInvite,
  TaxiServiceNotificationEventPartyMemberJoined,
} from '../../../state/stw-operations/taxi-service'

import { FormEvent, useRef, type ChangeEvent } from 'react'

import { useDebouncedCallback } from '@mantine/hooks'
import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ArrowDownLeftIcon,
  Car,
  CrownIcon,
  SendIcon,
  Trash2,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
  X,
} from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { AutomationStatusType } from '../../../config/constants/automation'

import { Combobox } from '../../../components/ui/extended/combobox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion'
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
import { ScrollArea } from '../../../components/ui/scroll-area'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '../../../components/ui/sheet'
import { Switch } from '../../../components/ui/switch'
import { GoToTop } from '../../../components/go-to-top'


import { useTaxiServiceNotifications } from '../../../hooks/stw-operations/taxi-service'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useTaxiServiceData } from './-hooks'

import { TaxiServiceNotificationType } from '../../../state/stw-operations/taxi-service'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Car}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.taxi-service')}
      />
      <Content />
    </>
  )
}

const statusDotClass = (status: AutomationStatusType | null) =>
  cn('size-2 shrink-0 rounded-full', {
    'bg-success': status === AutomationStatusType.LISTENING,
    'bg-muted-foreground': status === AutomationStatusType.DISCONNECTED,
    'bg-destructive': status === AutomationStatusType.ERROR,
  })

/** One entry in the legend that explains what the row dots mean. */
function StatusItem({
  status,
  title,
}: {
  status: AutomationStatusType
  title: string
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={statusDotClass(status)} />
      {title}
    </span>
  )
}

export function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    accounts,
    accountSelectorIsDisabled,
    options,
    selectedAccounts,

    customFilter,
    handleReloadAccounts,
    handleRemoveAccount,
    handleUpdateStatusAction,
    onSelectItem,
  } = useTaxiServiceData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <>
      <Panel id="selector-card">
        <PanelBody>
          <FieldGroup>
            <FieldRow
              label={t('form.accounts.select', { ns: 'general' })}
              stacked
            >
              <Combobox
                    className="max-w-full"
                    emptyPlaceholder={t('form.accounts.no-options', {
                      ns: 'general',
                    })}
                    emptyContent={t('form.accounts.search-empty', {
                      ns: 'general',
                    })}
                    placeholder={t('form.accounts.select', {
                      ns: 'general',
                    })}
                    placeholderSearch={t('form.accounts.placeholder', {
                      ns: 'general',
                      context: !getMenuOptionVisibility(
                        'showTotalAccounts',
                      )
                        ? 'private'
                        : undefined,
                      total: options.length,
                    })}
                    options={options}
                    value={[]}
                    customFilter={customFilter}
                    onChange={() => {}}
                    onSelectItem={onSelectItem}
                    emptyContentClassname="py-6 text-center text-sm"
                    disabled={accountSelectorIsDisabled}
                    disabledItem={accountSelectorIsDisabled}
                    inputSearchIsDisabled={accountSelectorIsDisabled}
                hideInputSearchWhenOnlyOneOptionIsAvailable
                hideSelectorOnSelectItem
              />
            </FieldRow>
            <FieldRow
              label={t('stw-operations:taxi-service.main.search.send')}
              stacked
            >
              <InputAddAccounts
                accountIds={accounts.map(({ accountId }) => accountId)}
                disabled={accounts.length <= 0}
              />
            </FieldRow>
          </FieldGroup>
        </PanelBody>

        <PanelFooter>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (accounts.length <= 0) {
                return
              }

              handleReloadAccounts(
                accounts.map(({ accountId }) => accountId)
              )()
            }}
            disabled={accounts.length <= 0}
          >
            {t('stw-operations:taxi-service.main.actions.restart-all')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (accounts.length <= 0) {
                return
              }

              accounts.forEach(({ accountId }) => {
                handleRemoveAccount(accountId)()
              })
            }}
            disabled={accounts.length <= 0}
          >
            {t('stw-operations:taxi-service.main.actions.remove-all')}
          </Button>

          <NotificationsSidebar />

          {/* Legend, next to the list of accounts it describes. */}
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusItem
              status={AutomationStatusType.LISTENING}
              title={t('auto-kick.statuses.listening')}
            />
            <StatusItem
              status={AutomationStatusType.ERROR}
              title={t('auto-kick.statuses.credential-error')}
            />
            <StatusItem
              status={AutomationStatusType.DISCONNECTED}
              title={t('auto-kick.statuses.disconnected')}
            />
          </div>
        </PanelFooter>
      </Panel>

      {accounts.length <= 0 ? (
        <EmptyState
          icon={Car}
          title={t('form.accounts.no-options', { ns: 'general' })}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
              const current = selectedAccounts[account.accountId]
              const isLoading =
                current.status === null ||
                current.status === AutomationStatusType.LOADING ||
                current.submittings.removing
            const disabledActions =
              current.submittings.connecting ||
              current.submittings.removing ||
              isLoading

            const defaultActiveStatusValue =
              current.actions.activeStatus?.trim() ?? ''
            const defaultBusyStatusValue =
              current.actions.busyStatus?.trim() ?? ''

            return (
              <Panel key={account.accountId}>
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
                  {current.status !== AutomationStatusType.LOADING &&
                    current.status !== null && (
                      <span className={statusDotClass(current.status)} />
                    )}
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                    {parseCustomDisplayName(account)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    className="size-7 shrink-0"
                    variant="ghost"
                    onClick={
                      !isLoading
                        ? handleReloadAccounts([account.accountId])
                        : undefined
                    }
                    disabled={disabledActions}
                  >
                    <UpdateIcon
                      className={cn(
                        'size-3.5',
                        isLoading && 'animate-spin'
                      )}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className={cn('size-7 shrink-0', {
                      'text-destructive/60 [&:not(:disabled)]:hover:text-destructive':
                        !isLoading,
                    })}
                    variant="ghost"
                    onClick={
                      !isLoading
                        ? handleRemoveAccount(account.accountId)
                        : undefined
                    }
                    disabled={disabledActions}
                  >
                    {isLoading ? (
                      <UpdateIcon className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </Button>
                </div>

                <PanelBody className="px-4 py-2">
                  <FieldGroup>
                    <FieldRow
                      className="py-2.5"
                      label={t(
                        'stw-operations:taxi-service.card.power-level'
                      )}
                    >
                      <Switch
                        checked={current.actions.high}
                        onCheckedChange={
                          !isLoading
                            ? handleUpdateStatusAction(
                                'high',
                                account.accountId
                              )
                            : undefined
                        }
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t(
                        'stw-operations:taxi-service.card.deny-requests'
                      )}
                    >
                      <Switch
                        checked={current.actions.denyFriendsRequests}
                        onCheckedChange={
                          !isLoading
                            ? handleUpdateStatusAction(
                                'denyFriendsRequests',
                                account.accountId
                              )
                            : undefined
                        }
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t(
                        'stw-operations:taxi-service.card.status.active'
                      )}
                      stacked
                    >
                      <InputActiveStatus
                        placeholder={t(
                          'stw-operations:taxi-service.card.status.active'
                        )}
                        onChange={(value) =>
                          handleUpdateStatusAction(
                            'activeStatus',
                            account.accountId
                          )(value)
                        }
                        defaultValue={defaultActiveStatusValue}
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t(
                        'stw-operations:taxi-service.card.status.busy'
                      )}
                      stacked
                    >
                      <InputActiveStatus
                        placeholder={t(
                          'stw-operations:taxi-service.card.status.busy'
                        )}
                        onChange={(value) =>
                          handleUpdateStatusAction(
                            'busyStatus',
                            account.accountId
                          )(value)
                        }
                        defaultValue={defaultBusyStatusValue}
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t(
                        'stw-operations:taxi-service.main.search.send'
                      )}
                      stacked
                    >
                      <InputAddAccounts
                        accountIds={[account.accountId]}
                        disabled={disabledActions}
                      />
                    </FieldRow>
                  </FieldGroup>
                </PanelBody>
              </Panel>
            )
          })}
        </div>
      )}

      <GoToTop containerId="selector-card" />
    </>
  )
}

function InputActiveStatus({
  defaultValue,
  disabled,
  placeholder,
  onChange,
}: {
  defaultValue?: string
  disabled: boolean
  placeholder: string
  onChange?: (value: string) => void
}) {
  const debouncedHandleStatus = useDebouncedCallback((value: string) => {
    onChange?.(value)
  }, 500)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    debouncedHandleStatus(
      event.currentTarget.value.replace(/[\s]+/gi, ' '),
    )
  }

  return (
    <div className="">
      <Input
        placeholder={placeholder}
        className="h-8"
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  )
}

function InputAddAccounts({
  accountIds,
  disabled = false,
}: {
  accountIds: Array<string>
  disabled?: boolean
}) {
  const { t } = useTranslation(['stw-operations'])

  const $input = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (accountIds.length <= 0) {
      return
    }

    const displayNames = ($input.current?.value.split(';') ?? []).reduce(
      (accumulator, current) => {
        const name = current.trim()

        if (name.length > 0 && !accumulator.includes(name)) {
          accumulator.push(name)
        }

        return accumulator
      },
      [] as Array<string>,
    )

    if (displayNames.length <= 0) {
      return
    }

    window.electronAPI.taxiServiceAddAccounts(accountIds, displayNames)

    if ($input.current) {
      $input.current.value = ''
    }
  }

  return (
    <div className="border-t pt-2">
      <form
        className="space-y-2"
        onSubmit={handleSubmit}
      >
        <Input
          placeholder={t('taxi-service.main.search.input.placeholder')}
          className="h-8"
          disabled={disabled}
          ref={$input}
        />
        <Button
          className="h-8 w-full"
          size="sm"
          variant="secondary"
          type="submit"
          disabled={disabled}
        >
          {t('taxi-service.main.search.send')}
        </Button>
      </form>
    </div>
  )
}

function NotificationsSidebar() {
  const { t } = useTranslation(['stw-operations'])

  const { data, clearData } = useTaxiServiceNotifications()

  return (
    <div className="">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            className="w-full"
            size="sm"
            variant="outline"
          >
            {t('stw-operations:taxi-service.main.show-notifications')}
            <span className="sr-only">toggle notifications sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          className="flex flex-col p-0"
          hideCloseButton
        >
          <div className="w-full">
            <div className="app-draggable-region flex gap-1.5 h-[var(--header-height)] items-center px-1.5">
              <div className="flex items-center w-full">
                <div className="not-draggable-region">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={clearData}
                  >
                    {t('taxi-service.notifications.clear-logs')}
                  </Button>
                </div>
                <SheetClose className="not-draggable-region ml-auto mr-3">
                  <X />
                  <span className="sr-only">close history sidebar</span>
                </SheetClose>
              </div>
            </div>
            <div className="mx-2">
              <div className="border-l-4 italic mb-1.5 pl-2 py-1 text-muted-foreground text-xs">
                一
              </div>
              <ScrollArea className="h-[calc(100vh-var(--header-height)-1.875rem-0.375rem)]">
                <div className="text-sm w-full">
                  <ul className="flex flex-col gap-1- [&>li]:py-1 [&>li:not(:last-child)]:border-b">
                    {data.map((notification) => {
                      if (
                        notification.type ===
                        TaxiServiceNotificationType.FriendRequestSend
                      ) {
                        return (
                          <NotificationFriendRequestSend
                            data={notification}
                            key={notification.id}
                          />
                        )
                      }

                      if (
                        notification.type ===
                        TaxiServiceNotificationType.FriendAdded
                      ) {
                        return (
                          <NotificationFriendAdded
                            data={notification}
                            key={notification.id}
                          />
                        )
                      }

                      if (
                        notification.type ===
                        TaxiServiceNotificationType.PartyInvite
                      ) {
                        return (
                          <NotificationPartyInvite
                            data={notification}
                            key={notification.id}
                          />
                        )
                      }

                      if (
                        notification.type ===
                        TaxiServiceNotificationType.PartyMemberJoined
                      ) {
                        return (
                          <NotificationPartyMemberJoined
                            data={notification}
                            key={notification.id}
                          />
                        )
                      }

                      return null
                    })}
                  </ul>
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function NotificationPartyMemberJoined({
  data,
}: {
  data: TaxiServiceNotificationEventPartyMemberJoined
}) {
  return (
    <li className="">
      <Accordion
        type="single"
        className="w-full"
        collapsible
      >
        <AccordionItem
          className="border-0 p-0"
          value={data.id}
        >
          <AccordionTrigger className="flex-0 gap-2 items-center justify-start leading-5 px-0 py-0 text-left">
            <UsersIcon
              className="no-animate text-muted-foreground"
              size={20}
            />
            <div className="">
              <Trans
                ns="stw-operations"
                i18nKey="taxi-service.notifications.party-member-joined"
                values={{
                  me: data.me.displayName,
                  total: data.members.length,
                  createdAt: data.createdAt,
                }}
              >
                <strong>{data.me.displayName}</strong> joined a party of{' '}
                {data.members.length}
                <div className="text-muted-foreground text-xs">
                  一 {data.createdAt}
                </div>
              </Trans>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 pb-1 text-balance">
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {data.members.map((member) => (
                <li
                  className={cn('flex gap-1 items-center', {
                    'pl-4': !member.isLeader && !member.isSender,
                  })}
                  key={member.accountId}
                >
                  {member.isLeader && <CrownIcon size={12} />}
                  {member.isSender && <SendIcon size={12} />}
                  <strong>{member.displayName}</strong>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </li>
  )
}

function NotificationPartyInvite({
  data,
}: {
  data: TaxiServiceNotificationEventPartyInvite
}) {
  return (
    <li className="flex gap-2 items-center">
      <div className="flex-shrink-0 size-5">
        <ArrowDownLeftIcon
          className="text-muted-foreground"
          size={20}
        />
      </div>
      <div className="flex-grow">
        <Trans
          ns="stw-operations"
          i18nKey="taxi-service.notifications.party-invite"
          values={{
            friend: data.friend.displayName,
            me: data.me.displayName,
            createdAt: data.createdAt,
          }}
        >
          <strong>{data.friend.displayName}</strong> invited to{' '}
          <strong>{data.me.displayName}</strong>{' '}
          <div className="text-muted-foreground text-xs">
            一 {data.createdAt}
          </div>
        </Trans>
      </div>
    </li>
  )
}

function NotificationFriendAdded({
  data,
}: {
  data: TaxiServiceNotificationEventFriendAdded
}) {
  return (
    <li className="flex gap-2 items-center">
      <div className="flex-shrink-0 size-5">
        <UserCheckIcon
          className="text-green-500"
          size={20}
        />
      </div>
      <div className="flex-grow">
        <Trans
          ns="stw-operations"
          i18nKey="taxi-service.notifications.friend-added"
          values={{
            friend: data.friend.displayName,
            me: data.me.displayName,
          }}
        >
          <strong>{data.friend.displayName}</strong> added to{' '}
          <strong>{data.me.displayName}</strong>
        </Trans>
      </div>
    </li>
  )
}

function NotificationFriendRequestSend({
  data,
}: {
  data: TaxiServiceNotificationEventFriendRequestSend
}) {
  if (!data.withErrors) {
    return (
      <li className="">
        <div className="flex gap-2 items-center">
          <UserCheckIcon
            className="text-muted-foreground"
            size={18}
          />
          <div className="">
            <Trans
              ns="stw-operations"
              i18nKey="taxi-service.notifications.friend-request-send"
              values={{
                me: data.me.displayName,
                initial: data.accounts.length,
                total: data.accounts.length,
              }}
            >
              <strong>{data.me.displayName}</strong> sent{' '}
              {data.accounts.length}/{data.accounts.length} friend requests
            </Trans>
          </div>
        </div>
      </li>
    )
  }

  const withErrors = data.accounts.filter(
    (item) => item.error !== undefined,
  )

  return (
    <li className="">
      <Accordion
        type="single"
        className="w-full"
        collapsible
      >
        <AccordionItem
          className="border-0 p-0"
          value={data.id}
        >
          <AccordionTrigger className="flex-0 gap-2 items-center justify-start leading-5 px-0 py-0 text-left">
            <UserPlusIcon
              className="no-animate text-muted-foreground"
              size={18}
            />
            <div className="">
              <Trans
                ns="stw-operations"
                i18nKey="taxi-service.notifications.friend-request-send"
                values={{
                  me: data.me.displayName,
                  initial: data.accounts.length - withErrors.length,
                  total: data.accounts.length,
                }}
              >
                <strong>{data.me.displayName}</strong> sent{' '}
                {data.accounts.length - withErrors.length}/
                {data.accounts.length} friend requests
              </Trans>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 pb-1 text-balance">
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {withErrors.map((item) => (
                <li key={item.accountId}>
                  <Trans
                    ns="stw-operations"
                    i18nKey="taxi-service.notifications.friend-request-send-with-errors"
                    values={{
                      name: item.displayName,
                      error: item.error ?? 'unknown',
                    }}
                  >
                    <strong>{item.displayName}</strong> with error{' '}
                    <span className="bg-muted px-1 py-0.5 rounded text-xs">
                      {item.error}
                    </span>
                  </Trans>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </li>
  )
}

