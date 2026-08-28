import { Pin, ScrollText, Trash2, UserPlus } from 'lucide-react'
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
    questOptions,

    customFilter,
    handleRemoveAccount,
    handleUpdateAccount,
    onSelectItem,
  } = useData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <div className="max-w-3xl space-y-4">
      <Callout>{t('urns.note')}</Callout>

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
              const selected = selectedAccounts[account.accountId] ?? []
              const quests = questOptions[account.accountId] ?? []

              return (
                <li
                  className="px-4 py-3"
                  key={account.accountId}
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                      {parseCustomDisplayName(account)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selected.length} selected
                    </span>
                    <Button
                      className="size-8 text-destructive/60 [&:not(:disabled)]:hover:text-destructive"
                      size="icon"
                      variant="ghost"
                      onClick={handleRemoveAccount(account.accountId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {quests.map((quest) => {
                      const id = `quest-${account.accountId}-${quest.templateId}`
                      return (
                        <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2" key={quest.templateId}>
                          <Label className="min-w-0 flex-1 truncate text-xs" htmlFor={id} title={quest.name}>
                            {quest.name}
                          </Label>
                          <Switch
                            id={id}
                            checked={selected.includes(quest.templateId)}
                            onCheckedChange={handleUpdateAccount(account.accountId, quest.templateId)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {quests.length <= 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ScrollText className="size-4" />
                      {t('urns.loading')}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
