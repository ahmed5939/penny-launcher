import type { AccountData } from '../../../types/accounts'

import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, FileText, FileWarning } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Chip,
  CopyField,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  PanelHeader,
  SearchField,
} from '../../../components/page'

import {
  defaultEULAAccountStatus,
  EULAAccountStatus,
} from '../../../state/accounts/eula'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useEULAActions } from './-hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

const eulaHistoryUrl = 'https://www.epicgames.com/account/eula-history'

/**
 * Which accounts still owe Epic an "I Agree". One row per linked account:
 * its state, the Verify that finds out, and — when Epic answers with a
 * continuation link — the link itself, right under the account it belongs to.
 */
export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'account-management',
  })
  const actions = useEULAActions()
  const anyLoading = actions.accounts.some(
    (account) => actions.data[account.accountId]?.isLoading
  )

  return (
    <div
      className="space-y-6"
      id="gtk-eula"
    >
      <PageHeader
        actions={
          actions.accounts.length > 1 && (
            <Button
              disabled={anyLoading}
              onClick={actions.handleVerifyAll}
              variant="outline"
            >
              {anyLoading ? (
                <UpdateIcon className="mr-2 size-4 animate-spin" />
              ) : null}
              Verify all
            </Button>
          )
        }
        description="Check whether each account has accepted Epic's latest EULA, and get the link for any that has not."
        icon={FileText}
        section={t('title')}
        title="EULA"
      />
      <Content actions={actions} />
      <GoToTop containerId="gtk-eula" />
    </div>
  )
}

function Content({ actions }: { actions: ReturnType<typeof useEULAActions> }) {
  const { t } = useTranslation(['account-management', 'general'])
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()

  const {
    accounts,
    accountsArray,
    data,
    searchValue,
    handleVerifyById,
    setSearchValue,
  } = actions

  return (
    <div className="max-w-3xl space-y-4">
      <Panel>
        <PanelHeader
          compact
          title="Accounts"
          actions={
            <span className="text-xs text-muted-foreground">
              <span className="figure">{accountsArray.length}</span> linked
            </span>
          }
        />
        {accountsArray.length > 1 && (
          <FilterBar className="px-4">
            <SearchField
              label="Search accounts"
              onChange={setSearchValue}
              placeholder={t('form.accounts.placeholder', {
                ns: 'general',
                context: !getMenuOptionVisibility('showTotalAccounts')
                  ? 'private'
                  : undefined,
                total: accountsArray.length,
              })}
              value={searchValue}
            />
          </FilterBar>
        )}

        {accounts.length > 0 ? (
          <ul className="divide-y divide-border/40">
            {accounts.map((account) => (
              <AccountRow
                account={account}
                key={account.accountId}
                onVerify={handleVerifyById(account.accountId)}
                status={data[account.accountId] ?? defaultEULAAccountStatus}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            icon={FileWarning}
            title={t('form.accounts.search-empty', {
              ns: 'general',
            })}
          />
        )}
      </Panel>

      {/* Fine print: the manual route, for anyone who would rather click it themselves. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        <Trans
          ns="account-management"
          i18nKey="eula.link"
          values={{
            link: eulaHistoryUrl,
          }}
        >
          You can go to{' '}
          <a
            href={eulaHistoryUrl}
            className="font-medium text-primary hover:underline"
            onClick={(event) => {
              event.preventDefault()
              window.electronAPI.openExternalURL(eulaHistoryUrl)
            }}
          >
            {eulaHistoryUrl}
          </a>{' '}
          and click the "I Agree" button at the bottom of the page:
        </Trans>
      </p>
    </div>
  )
}

function AccountRow({
  account,
  onVerify,
  status,
}: {
  account: AccountData
  onVerify: () => void
  status: Partial<EULAAccountStatus>
}) {
  const { t } = useTranslation(['general'])

  const url = status.url ?? null

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-ui font-medium">
          {parseCustomDisplayName(account)}
        </span>

        {status.status === true ? (
          <Chip tone="success">{t('actions.accepted')}</Chip>
        ) : status.status === false ? (
          <Chip tone="danger">
            {status.correctiveAction ?? 'Needs accepting'}
          </Chip>
        ) : (
          <span className="text-xs text-muted-foreground">Not checked</span>
        )}

        <Button
          className="h-8 w-24"
          disabled={status.isLoading}
          onClick={onVerify}
          size="sm"
          variant="secondary"
        >
          {status.isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('actions.verify')
          )}
        </Button>
      </div>

      {url && (
        <div className="mt-2 flex items-center gap-2">
          <CopyField
            className="min-w-0 flex-1"
            value={url}
          />
          <Button
            className="h-8"
            onClick={() => window.electronAPI.openExternalURL(url)}
            size="sm"
            variant="outline"
          >
            <ExternalLink className="mr-1.5 size-3.5" />
            Open
          </Button>
        </div>
      )}
    </li>
  )
}
