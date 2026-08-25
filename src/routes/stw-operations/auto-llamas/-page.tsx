import { UpdateIcon } from '@radix-ui/react-icons'
import { Gift, Trash2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

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

import { useAutoLlamaData } from '../../../hooks/stw-operations/auto-llamas'
import { useGetComboboxAccounts } from '../../../hooks/accounts'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={Gift}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-llamas')}
        description={t('llamas.description', { ns: 'stw-operations' })}
      />
      <Content />
    </>
  )
}

export function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    checkLoading,
    isAllEnabled,
    isDisableBuyButtonDisabled,
    selected,
    totalEnabledPurchases,

    handleAddAllAccounts,
    handleRemoveAccount,
    handleRemoveAllAccounts,
    handleUpdateAccounts,
    handleDisableBuy,
    handleEnableBuy,
    handleCheck,
    onSelectItem,
  } = useAutoLlamaData()
  const {
    accountSelectorIsDisabled,
    accounts,
    options,
    selectedAccounts,
    customFilter,
  } = useGetComboboxAccounts({
    selected,
  })
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <>
      <Panel id="llamas-card-header">
        <PanelBody className="space-y-4">
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
                  context: !getMenuOptionVisibility('showTotalAccounts')
                    ? 'private'
                    : undefined,
                  total: 0,
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

          {/*
            The three footnotes were four stacked paragraphs of grey text
            above the form, which is where nobody reads them. They sit under
            the control they annotate now, as one numbered notice.
          */}
          <Callout>
            <ol className="space-y-1">
              <li>
                <Trans
                  ns="stw-operations"
                  i18nKey="llamas.note1"
                >
                  <sup>1</sup> If there's at least one free upgrade llama
                  available it will be claimed.
                </Trans>
              </li>
              <li>
                <Trans
                  ns="stw-operations"
                  i18nKey="llamas.note2"
                >
                  <sup>2</sup> You can also enable the purchase of an
                  upgrade llama (50 V-Bucks) if you want. This purchase will
                  only be made if there's at least one legendary or mythic
                  survivor.
                </Trans>
              </li>
              <li>
                <Trans
                  ns="stw-operations"
                  i18nKey="llamas.note3"
                >
                  <sup>3</sup> You can choose whether to use an X-Ray
                  Tickets or a llama token.
                </Trans>
              </li>
            </ol>
          </Callout>
        </PanelBody>

        <PanelFooter>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              handleAddAllAccounts(options.map((item) => item.value))
            }
            disabled={
              options.length <= 0 ? true : accountSelectorIsDisabled
            }
          >
            {t('llamas.form.actions.buttons.add.accounts')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemoveAllAccounts}
            disabled={accounts.length <= 0}
          >
            {t('llamas.form.actions.buttons.remove.accounts')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleEnableBuy}
            disabled={accounts.length <= 0 || isAllEnabled}
          >
            {t('llamas.form.actions.buttons.enable.buy')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisableBuy}
            disabled={accounts.length <= 0 || isDisableBuyButtonDisabled}
          >
            {t('llamas.form.actions.buttons.disable.buy')}
          </Button>
          <Button
            className="ml-auto"
            size="sm"
            onClick={handleCheck}
            disabled={totalEnabledPurchases <= 0 || checkLoading}
          >
            {checkLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              t('llamas.form.actions.buttons.check')
            )}
          </Button>
        </PanelFooter>
      </Panel>

      {accounts.length <= 0 ? (
        <EmptyState
          icon={Gift}
          title={t('form.accounts.no-options', { ns: 'general' })}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const current = selectedAccounts[account.accountId]

            return (
              <Panel key={account.accountId}>
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                    {parseCustomDisplayName(account)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    className="size-7 shrink-0 text-destructive/60 [&:not(:disabled)]:hover:text-destructive"
                    variant="ghost"
                    onClick={handleRemoveAccount(account.accountId)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <PanelBody className="px-4 py-2">
                  <FieldGroup>
                    <FieldRow
                      className="py-2.5"
                      label={
                        <Trans
                          ns="stw-operations"
                          i18nKey="llamas.results.features.free-llamas"
                        >
                          Free llamas
                          <sup className="text-muted-foreground">1</sup>
                        </Trans>
                      }
                    >
                      <Switch
                        checked={current.actions['free-llamas']}
                        onCheckedChange={(value) =>
                          handleUpdateAccounts({
                            [current.accountId]: {
                              accountId: current.accountId,
                              config: {
                                type: 'free-llamas',
                                value,
                              },
                            },
                          })
                        }
                      />
                    </FieldRow>

                    <FieldRow
                      className="py-2.5"
                      label={
                        <Trans
                          ns="stw-operations"
                          i18nKey="llamas.results.features.survivors"
                        >
                          Survivors
                          <sup className="text-muted-foreground">2</sup>
                        </Trans>
                      }
                    >
                      <Switch
                        checked={current.actions.survivors}
                        onCheckedChange={(value) =>
                          handleUpdateAccounts({
                            [current.accountId]: {
                              accountId: current.accountId,
                              config: {
                                type: 'survivors',
                                value,
                              },
                            },
                          })
                        }
                      />
                    </FieldRow>

                    <FieldRow
                      className="py-2.5"
                      label={
                        <span
                          className={cn({
                            'text-muted-foreground':
                              !current.actions.survivors,
                          })}
                        >
                          <Trans
                            ns="stw-operations"
                            i18nKey="llamas.results.features.use-token"
                          >
                            Use token
                            <sup className="text-muted-foreground">3</sup>
                          </Trans>
                        </span>
                      }
                    >
                      <Switch
                        checked={current.actions['use-token']}
                        onCheckedChange={(value) => {
                          if (!current.actions.survivors) {
                            return
                          }

                          handleUpdateAccounts({
                            [current.accountId]: {
                              accountId: current.accountId,
                              config: {
                                type: 'use-token',
                                value,
                              },
                            },
                          })
                        }}
                        disabled={!current.actions.survivors}
                      />
                    </FieldRow>
                  </FieldGroup>
                </PanelBody>
              </Panel>
            )
          })}
        </div>
      )}

      <GoToTop containerId="llamas-card-header" />
    </>
  )
}
