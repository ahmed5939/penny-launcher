import { UpdateIcon } from '@radix-ui/react-icons'
import { Gift, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ArtToggle, LlamaRecyclePicker } from '../../../features/automation-rewards/view'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  PanelFooter,
  PanelHeader,
} from '../../../components/page'

import { useAutoLlamaData } from '../../../hooks/stw-operations/auto-llamas'
import { useGetComboboxAccounts } from '../../../hooks/accounts'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={Gift}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-llamas')}
        description="Opens free upgrade llamas for you, and can buy the 50 V-Buck one when it holds a Legendary or Mythic survivor."
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

  const set = (accountId: string, type: 'free-llamas' | 'survivors' | 'use-token', value: boolean) =>
    handleUpdateAccounts({
      [accountId]: { accountId, config: { type, value } },
    })

  return (
    <>
      <Panel id="llamas-card-header">
        <PanelHeader
          actions={
            <>
              <div className="w-56">
                <Combobox
                  emptyPlaceholder={t('form.accounts.no-options', { ns: 'general' })}
                  emptyContent={t('form.accounts.search-empty', { ns: 'general' })}
                  placeholder="Add an account"
                  placeholderSearch={t('form.accounts.placeholder', {
                    ns: 'general',
                    context: !getMenuOptionVisibility('showTotalAccounts') ? 'private' : undefined,
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
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAddAllAccounts(options.map((item) => item.value))}
                disabled={options.length <= 0 || accountSelectorIsDisabled}
              >
                {t('llamas.form.actions.buttons.add.accounts')}
              </Button>
              <Button
                size="sm"
                onClick={handleCheck}
                disabled={totalEnabledPurchases <= 0 || checkLoading}
              >
                {checkLoading ? <UpdateIcon className="animate-spin" /> : 'Check now'}
              </Button>
            </>
          }
          compact
          icon={Gift}
          title={accounts.length > 0 ? `Accounts · ${accounts.length}` : 'Accounts'}
        />

        {accounts.length <= 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-10"
            description="Add an account to start opening its free llamas."
            icon={UserPlus}
            title="No accounts on auto-llamas"
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {accounts.map((account) => {
              const current = selectedAccounts[account.accountId]

              return (
                <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3" key={account.accountId}>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-ui font-semibold">{parseCustomDisplayName(account)}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {current.actions['free-llamas'] || current.actions.survivors ? (
                        <Chip tone="success">Active</Chip>
                      ) : (
                        <Chip>Nothing enabled</Chip>
                      )}
                      {current.actions.survivors && (
                        <Chip tone="warning">{current.actions['use-token'] ? 'Spends tokens' : 'Spends X-Ray'}</Chip>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ArtToggle
                      art="voucher_cardpack_bronze"
                      label="Free llamas"
                      onChange={(value) => set(current.accountId, 'free-llamas', value)}
                      pressed={current.actions['free-llamas']}
                      title="Open any free upgrade llama"
                    />
                    <ArtToggle
                      art="voucher_generic_worker_sr"
                      label="Buy survivor llamas"
                      onChange={(value) => set(current.accountId, 'survivors', value)}
                      pressed={current.actions.survivors}
                      title="Buy the upgrade llama when it holds a Legendary or Mythic survivor"
                    />
                    <ArtToggle
                      art="voucher_basicpack"
                      disabled={!current.actions.survivors}
                      label="Use llama token"
                      onChange={(value) => set(current.accountId, 'use-token', value)}
                      pressed={current.actions['use-token']}
                      title="Pay for survivor llamas with a llama token instead of X-Ray Tickets (the default)"
                    />
                  </div>

                  <LlamaRecyclePicker accountId={account.accountId} />

                  <Button
                    aria-label={`Remove ${parseCustomDisplayName(account)} from auto-llamas`}
                    className="size-8 shrink-0 text-muted-foreground [&:not(:disabled)]:hover:text-destructive"
                    onClick={handleRemoveAccount(account.accountId)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        {accounts.length > 0 && (
          <PanelFooter className="px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Free llamas on every account</span>
            <Button size="sm" variant="ghost" onClick={handleEnableBuy} disabled={isAllEnabled}>
              All on
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisableBuy} disabled={isDisableBuyButtonDisabled}>
              All off
            </Button>
            <Button
              className="ml-auto text-muted-foreground [&:not(:disabled)]:hover:text-destructive"
              size="sm"
              variant="ghost"
              onClick={handleRemoveAllAccounts}
            >
              {t('llamas.form.actions.buttons.remove.accounts')}
            </Button>
          </PanelFooter>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Survivor llamas (50, paid in X-Ray Tickets or with a llama token) are only bought when one holds a Legendary or Mythic survivor. Recycling covers new rewards from free and survivor llamas; favourites, assigned items, Legendary and Mythic are always kept. Totals are on Recycled Rewards.
      </p>

      <GoToTop containerId="llamas-card-header" />
    </>
  )
}
