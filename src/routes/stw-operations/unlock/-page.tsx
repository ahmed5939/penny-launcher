import { UpdateIcon } from '@radix-ui/react-icons'
import { Check, LockOpen, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../components/page'

import { useUnlockData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={LockOpen}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.unlock')}
        description={t('unlock.description', { ns: 'stw-operations' })}
      />

      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    currentStatuses,
    data,
    isDisabledForm,

    clearFormData,
    handleSave,
  } = useUnlockData()

  return (
    <>
      {/*
        Form on the left, results on the right on wide windows. The old
        layout pushed the result list below the fold, so you submitted and
        then had to go looking for what happened. The account half of the
        form is gone — the titlebar picker answers that.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <Panel id="ssd-card-header">
          <PanelBody>
            <Callout tone="warning">{t('unlock.note')}</Callout>
          </PanelBody>
          <PanelFooter>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isDisabledForm}
            >
              {t('unlock.form.submit-button')}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              onClick={clearFormData}
              disabled={data.length <= 0}
            >
              {t('unlock.form.clear-button')}
            </Button>
          </PanelFooter>
        </Panel>

        {data.length > 0 && (
          <Panel>
            <ul className="divide-y divide-border/50">
              {data.map((account) => {
                const currentStatus = currentStatuses[account.accountId]

                return (
                  <li
                    className="flex items-center gap-3 px-4 py-2.5"
                    key={account.accountId}
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                      {parseCustomDisplayName(account)}
                    </span>
                    {currentStatus !== undefined && (
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-md',
                          currentStatus.status === null
                            ? 'text-muted-foreground'
                            : currentStatus.status
                              ? 'bg-success/15 text-success'
                              : 'bg-destructive/15 text-destructive'
                        )}
                      >
                        {currentStatus.status === null ? (
                          <UpdateIcon className="animate-spin" />
                        ) : currentStatus.status ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </div>

      <GoToTop containerId="ssd-card-header" />
    </>
  )
}
