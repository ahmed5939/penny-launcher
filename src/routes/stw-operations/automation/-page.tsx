import { UpdateIcon } from '@radix-ui/react-icons'
import { Trash2, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AutomationStatusType } from '../../../config/constants/automation'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  EmptyState,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useAutomationData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={UserX}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-kick')}
        description={t('auto-kick.description1', { ns: 'stw-operations' })}
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
    handleReloadAccount,
    handleReloadAll,
    handleRemoveAccount,
    handleRemoveAll,
    handleUpdateClaimAction,
    onSelectItem,
  } = useAutomationData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <>
      <Panel id="selector-card">
        <PanelBody className="space-y-4">
          <Callout tone="warning">{t('auto-kick.note')}</Callout>

          <FieldGroup>
            <FieldRow
              label={t('form.accounts.select', { ns: 'general' })}
              hint={t('auto-kick.description2')}
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
                  context: !getMenuOptionVisibility('showTotalAccounts')
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
          </FieldGroup>
        </PanelBody>

        <PanelFooter>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReloadAll}
            disabled={accounts.length <= 0}
          >
            {t('stw-operations:auto-kick.actions.restart-all')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemoveAll}
            disabled={accounts.length <= 0}
          >
            {t('stw-operations:auto-kick.actions.remove-all')}
          </Button>

          {/* Legend, next to the list it describes rather than above the form. */}
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
          icon={UserX}
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
                        ? handleReloadAccount(account.accountId)
                        : undefined
                    }
                    disabled={disabledActions}
                  >
                    <UpdateIcon
                      className={cn(isLoading && 'animate-spin')}
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
                      label={t('auto-kick.options.kick')}
                    >
                      <Switch
                        checked={current.actions.kick}
                        onCheckedChange={
                          !isLoading
                            ? handleUpdateClaimAction(
                                'kick',
                                account.accountId
                              )
                            : undefined
                        }
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t('auto-kick.options.claim')}
                    >
                      <Switch
                        checked={current.actions.claim}
                        onCheckedChange={
                          !isLoading
                            ? handleUpdateClaimAction(
                                'claim',
                                account.accountId
                              )
                            : undefined
                        }
                        disabled={disabledActions}
                      />
                    </FieldRow>
                    <FieldRow
                      className="py-2.5"
                      label={t('auto-kick.options.transfer-mats')}
                    >
                      <Switch
                        checked={current.actions.transferMats}
                        onCheckedChange={
                          !isLoading
                            ? handleUpdateClaimAction(
                                'transferMats',
                                account.accountId
                              )
                            : undefined
                        }
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
