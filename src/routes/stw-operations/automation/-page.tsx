import { UpdateIcon } from '@radix-ui/react-icons'
import { Gift, PackageOpen, Trash2, UserPlus, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AutomationStatusType } from '../../../config/constants/automation'

import { ArtToggle } from '../../../features/automation-rewards/view'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelFooter,
  PanelHeader,
  StatusPill,
} from '../../../components/page'
import type { StatusTone } from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useAutomationData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={UserX}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-kick')}
        description="Kicks, leaves and claims for you the moment a match ends."
      />
      <Content />
    </>
  )
}

/** The listener's state, said in the status colours every page uses. */
function connection(status: AutomationStatusType | null): { key: string | null; tone: StatusTone; pulse?: boolean } {
  switch (status) {
    case AutomationStatusType.LISTENING:
      return { key: 'auto-kick.statuses.listening', tone: 'active', pulse: true }
    case AutomationStatusType.ERROR:
      return { key: 'auto-kick.statuses.credential-error', tone: 'danger' }
    case AutomationStatusType.DISCONNECTED:
      return { key: 'auto-kick.statuses.disconnected', tone: 'idle' }
    default:
      return { key: null, tone: 'idle' }
  }
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
              </div>
            </>
          }
          compact
          icon={UserX}
          title={accounts.length > 0 ? `Watching · ${accounts.length}` : 'Watching'}
        />

        {accounts.length <= 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-10"
            description="Add an account and Penny will watch its matches."
            icon={UserPlus}
            title="No accounts on auto-kick"
          />
        ) : (
          <ul className="divide-y divide-border/50">
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
              const state = connection(current.status)
              const name = parseCustomDisplayName(account)

              return (
                <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3" key={account.accountId}>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-ui font-semibold">{name}</p>
                    <StatusPill className="mt-1.5" pulse={state.pulse} tone={state.tone}>
                      {state.key ? t(state.key) : 'Connecting…'}
                    </StatusPill>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ArtToggle
                      disabled={disabledActions}
                      icon={UserX}
                      label={t('auto-kick.options.kick')}
                      onChange={handleUpdateClaimAction('kick', account.accountId)}
                      pressed={current.actions.kick}
                      title="Kick everyone else when the match ends"
                    />
                    <ArtToggle
                      disabled={disabledActions}
                      icon={Gift}
                      label={t('auto-kick.options.claim')}
                      onChange={handleUpdateClaimAction('claim', account.accountId)}
                      pressed={current.actions.claim}
                      title="Claim the mission rewards"
                    />
                    <ArtToggle
                      disabled={disabledActions}
                      icon={PackageOpen}
                      label={t('auto-kick.options.transfer-mats')}
                      onChange={handleUpdateClaimAction('transferMats', account.accountId)}
                      pressed={current.actions.transferMats}
                      title="Move crafting materials to storage"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`Reconnect ${name}`}
                      className="size-8 shrink-0 text-muted-foreground"
                      disabled={disabledActions}
                      onClick={handleReloadAccount(account.accountId)}
                      size="icon"
                      title="Reconnect"
                      type="button"
                      variant="ghost"
                    >
                      <UpdateIcon className={cn(isLoading && 'animate-spin')} />
                    </Button>
                    <Button
                      aria-label={`Remove ${name} from auto-kick`}
                      className="size-8 shrink-0 text-muted-foreground [&:not(:disabled)]:hover:text-destructive"
                      disabled={disabledActions}
                      onClick={handleRemoveAccount(account.accountId)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {accounts.length > 0 && (
          <PanelFooter className="px-4 py-2.5">
            <Button size="sm" variant="ghost" onClick={handleReloadAll}>
              {t('auto-kick.actions.restart-all')}
            </Button>
            <Button
              className="ml-auto text-muted-foreground [&:not(:disabled)]:hover:text-destructive"
              size="sm"
              variant="ghost"
              onClick={handleRemoveAll}
            >
              {t('auto-kick.actions.remove-all')}
            </Button>
          </PanelFooter>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Accounts in the same party only need auto-kick on one of them; the others are kicked or leave (and claim, if on) with it. Stacking chest rewards may stop it working properly.
      </p>

      <GoToTop containerId="selector-card" />
    </>
  )
}
