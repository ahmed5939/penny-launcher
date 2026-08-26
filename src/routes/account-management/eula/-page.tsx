import { UpdateIcon } from '@radix-ui/react-icons'
import { Check, Clipboard, FileText, FileWarning, X } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
} from '../../../components/page'

import {
  defaultEULAAccountStatus,
  EULAAccountStatus,
} from '../../../state/accounts/eula'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useEULAActions } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'account-management',
  })

  return (
    <>
      <PageHeader icon={FileText} section={t('title')} title="EULA" />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['account-management', 'general'])

  const {
    accounts,
    accountsArray,
    data,
    searchValue,
    handleCopyUrl,
    handleVerifyById,
    onChangeSearchValue,
  } = useEULAActions()
  // const { scrollToTopButtonIsVisible, scrollButtonOnClick } =
  //   useScrollToTop()
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()

  return (
    <>
      <div className="max-w-2xl space-y-4" id="gtk-eula">
        <Callout
          title={t('eula.good-to-know', {
            ns: 'account-management',
          })}
        >
          <p>
            <Trans
              ns="account-management"
              i18nKey="eula.link"
              values={{
                link: 'https://www.epicgames.com/account/eula-history',
              }}
            >
              You can go to{' '}
              <a
                href="https://www.epicgames.com/account/eula-history"
                className="font-bold text-primary"
                onClick={(event) => {
                  event.preventDefault()
                  window.electronAPI.openExternalURL(
                    'https://www.epicgames.com/account/eula-history'
                  )
                }}
              >
                https://www.epicgames.com/account/eula-history
              </a>{' '}
              and click the "I Agree" button at the bottom of the page:
            </Trans>
          </p>
        </Callout>

        {accountsArray.length > 1 && (
          <div className="flex gap-3 items-center">
            <Input
              // placeholder={
              //   getMenuOptionVisibility('showTotalAccounts')
              //     ? `Search on ${accounts.length} accounts...`
              //     : 'Search on your accounts'
              // }
              placeholder={t('form.accounts.placeholder', {
                ns: 'general',
                context: !getMenuOptionVisibility('showTotalAccounts')
                  ? 'private'
                  : undefined,
                total: accounts.length,
              })}
              value={searchValue}
              onChange={onChangeSearchValue}
            />
          </div>
        )}

        {accounts.length > 0 ? (
          <section className="flex flex-col gap-2 w-full">
            {accounts.map((account) => {
              const current: EULAAccountStatus =
                data[account.accountId] ?? defaultEULAAccountStatus
              const continuationUrl = current.url

              return (
                <Panel key={account.accountId}>
                  <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2 text-xs">
                    <span className="min-w-0 max-w-40 flex-1 truncate text-[0.8125rem] font-medium">
                      {parseCustomDisplayName(account)}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <div
                        className={cn('flex gap-1 items-center', {
                          'opacity-0 pointer-events-none select-none':
                            typeof current.status !== 'boolean',
                          'text-success': current.status === true,
                          'font-semibold text-destructive':
                            current.status === false,
                        })}
                      >
                        {current.status ? (
                          <>
                            <Check size={16} />
                            {t('actions.accepted', {
                              ns: 'general',
                            })}
                          </>
                        ) : (
                          <>
                            <X size={16} />
                            {current.correctiveAction}
                          </>
                        )}
                      </div>
                      <Button
                        className="h-8 relative w-24"
                        variant="secondary"
                        onClick={handleVerifyById(account.accountId)}
                        disabled={current.isLoading}
                      >
                        {current.isLoading ? (
                          <UpdateIcon className="animate-spin" />
                        ) : (
                          t('actions.verify', {
                            ns: 'general',
                          })
                        )}
                      </Button>
                    </div>
                  </div>
                  <footer>
                    <div
                      className={cn(
                        'flex items-center overflow-hidden relative rounded-md'
                      )}
                    >
                      <Input
                        className={cn(
                          'border-none pr-10 select-none text-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent'
                        )}
                        placeholder={t('eula.placeholder', {
                          ns: 'account-management',
                        })}
                        value={continuationUrl ?? ''}
                        readOnly
                      />
                      <Button
                        variant="ghost"
                        className={cn('absolute p-0 right-1 size-8 z-20')}
                        onClick={handleCopyUrl(current.url)}
                        disabled={continuationUrl === null}
                      >
                        <Clipboard size={16} />
                      </Button>
                    </div>
                  </footer>
                </Panel>
              )
            })}
          </section>
        ) : (
          <EmptyState
            icon={FileWarning}
            title={t('form.accounts.search-empty', {
              ns: 'general',
            })}
          />
        )}
      </div>

      {/* <Button
        className={cn(
          'bottom-5 fixed opacity-0 px-4 right-5 transition-all translate-x-28 z-50',
          {
            'opacity-100 translate-x-0': scrollToTopButtonIsVisible,
          }
        )}
        size="sm"
        variant="secondary"
        onClick={scrollButtonOnClick}
      >
        Go To Top
      </Button> */}
      <GoToTop containerId="gtk-eula" />
    </>
  )
}
