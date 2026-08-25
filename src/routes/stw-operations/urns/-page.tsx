import { Pin, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { Label } from '../../../components/ui/label'
import { Switch } from '../../../components/ui/switch'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
} from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useData } from './-hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={Pin}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-pin-urns')}
        description={t('urns.description', { ns: 'stw-operations' })}
      />
      <Content />
    </>
  )
}

export function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    accounts,
    accountSelectorIsDisabled,
    options,
    selectedAccounts,
    selectedAccountsMiniBosses,

    customFilter,
    handleRemoveAccount,
    handleUpdateAccount,
    onSelectItem,
  } = useData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <div className="max-w-3xl space-y-4">
      <Callout tone="warning">{t('urns.note')}</Callout>

      <Panel>
        <PanelBody className="flex flex-wrap items-center gap-3">
          <Combobox
            className="max-w-full flex-1"
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
            emptyPlaceholder={t('form.accounts.no-options', {
              ns: 'general',
            })}
            emptyContent={t('form.accounts.search-empty', {
              ns: 'general',
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
        </PanelBody>
      </Panel>

      {accounts.length <= 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t('form.accounts.select', { ns: 'general' })}
        />
      ) : (
        <Panel>
          <ul className="divide-y divide-border/50">
            {accounts.map((account) => {
              const value = selectedAccounts[account.accountId]
              const valueMiniBosses =
                selectedAccountsMiniBosses[account.accountId]
              /**
               * Every row rendered the same two switch ids, so clicking any
               * label toggled the first account's switch. Scope them to the
               * account instead.
               */
              const urnsId = `urns-${account.accountId}`
              const miniBossesId = `mini-bosses-${account.accountId}`

              return (
                <li
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3"
                  key={account.accountId}
                >
                  <span className="min-w-0 max-w-40 flex-1 truncate text-[0.8125rem] font-medium">
                    {parseCustomDisplayName(account)}
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    <Label
                      className="text-xs text-muted-foreground"
                      htmlFor={urnsId}
                    >
                      {t('urns.options.urns')}
                    </Label>
                    <Switch
                      id={urnsId}
                      checked={value}
                      onCheckedChange={handleUpdateAccount(
                        account.accountId,
                        'urns'
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label
                      className="text-xs text-muted-foreground"
                      htmlFor={miniBossesId}
                    >
                      {t('urns.options.mini-bosses')}
                    </Label>
                    <Switch
                      id={miniBossesId}
                      checked={valueMiniBosses}
                      onCheckedChange={handleUpdateAccount(
                        account.accountId,
                        'mini-bosses'
                      )}
                    />
                  </div>

                  <Button
                    className="size-8 text-destructive/60 [&:not(:disabled)]:hover:text-destructive"
                    size="icon"
                    variant="ghost"
                    onClick={handleRemoveAccount(account.accountId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
